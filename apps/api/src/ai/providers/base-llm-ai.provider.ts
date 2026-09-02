import { InternalServerErrorException, Logger } from '@nestjs/common';
import { LeadTemperature } from '@prisma/client';
import {
  AiProvider,
  FollowUpSuggestion,
  LeadScoreResult,
  LeadScoringContext,
  LeadSummaryContext,
  ReplySuggestionContext,
} from './ai-provider.interface';

/**
 * Shared prompt-building/JSON-parsing logic for every real LLM-backed provider — each
 * subclass only implements `complete()` (the actual HTTP call to its API). This is what
 * lets AiProviderResolver construct whichever provider a PlatformAdmin has activated
 * without duplicating the scoring/summary/follow-up/reply prompts three times over.
 */
export abstract class BaseLlmAiProvider implements AiProvider {
  protected readonly logger = new Logger(this.constructor.name);

  /** Sends `prompt` to the underlying model and returns its raw text response. */
  protected abstract complete(
    prompt: string,
    maxTokens: number,
  ): Promise<string>;

  async scoreLead(context: LeadScoringContext): Promise<LeadScoreResult> {
    const prompt = `You are a sales lead-scoring assistant for an Indian MSME sales CRM.
Score this lead from 0-100 based on source quality, WhatsApp engagement, and follow-up history.
Lead data:
${JSON.stringify(context, null, 2)}

Respond with ONLY a JSON object of the exact shape:
{"score": <integer 0-100>, "suggestedTemperature": "HOT" | "WARM" | "COLD", "reasoning": "<one or two sentences>"}`;

    const raw = await this.complete(prompt, 300);
    const parsed = this.parseJson<{
      score: number;
      suggestedTemperature: string;
      reasoning: string;
    }>(raw);

    const suggestedTemperature = Object.values(LeadTemperature).includes(
      parsed.suggestedTemperature as LeadTemperature,
    )
      ? (parsed.suggestedTemperature as LeadTemperature)
      : LeadTemperature.COLD;

    return {
      score: Number(parsed.score),
      suggestedTemperature,
      reasoning: parsed.reasoning,
    };
  }

  async summarizeLead(context: LeadSummaryContext): Promise<string> {
    const prompt = `You are a sales assistant for an Indian MSME sales CRM. Write a concise
2-3 sentence summary of this lead for a busy salesperson glancing at their lead detail page.
Plain text only, no markdown, no preamble.

Lead data:
${JSON.stringify(context, null, 2)}`;

    return this.complete(prompt, 250);
  }

  async suggestFollowUp(
    context: LeadSummaryContext,
  ): Promise<FollowUpSuggestion> {
    const nowIso = new Date().toISOString();
    const prompt = `You are a sales follow-up assistant for an Indian MSME sales CRM.
Current time: ${nowIso}.
Suggest the single most useful next follow-up action for this lead.

Lead data:
${JSON.stringify(context, null, 2)}

Respond with ONLY a JSON object of the exact shape:
{"title": "<short action title>", "notes": "<optional short note, or omit>", "suggestedDueAt": "<ISO 8601 timestamp>", "reasoning": "<one sentence>"}`;

    const raw = await this.complete(prompt, 300);
    return this.parseJson<FollowUpSuggestion>(raw);
  }

  async suggestReplies(context: ReplySuggestionContext): Promise<string[]> {
    const prompt = `You are a WhatsApp sales reply assistant for an Indian MSME. Given this
recent conversation, suggest 3 short, distinct reply options the salesperson could send next
(they will review and edit before sending — you are assisting, not deciding).

Recent messages (oldest first):
${JSON.stringify(context.recentMessages, null, 2)}

Respond with ONLY a JSON array of 2-3 short strings, e.g. ["...", "...", "..."]`;

    const raw = await this.complete(prompt, 300);
    const parsed = this.parseJson<string[]>(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === 'string')
      : [];
  }

  /**
   * Reads an upstream HTTP response as JSON, tolerating a non-JSON body (a proxy block
   * page, a gateway timeout's HTML, a plain-text rate-limit response, ...) — every
   * provider's `complete()` must call this instead of `res.json()` directly, or a
   * malformed upstream response throws a raw, unhandled SyntaxError instead of a clean,
   * catchable error (confirmed live: this happened when an outbound network policy
   * rejected a request before it reached the provider at all).
   */
  protected async readJsonResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(
        `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`,
      );
      throw new InternalServerErrorException(
        `AI provider returned an unexpected response (HTTP ${res.status})`,
      );
    }
  }

  /** Strips a ```json ... ``` fence if the model wrapped its answer in one, then parses. */
  protected parseJson<T>(raw: string): T {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = fenced ? fenced[1] : raw;
    try {
      return JSON.parse(jsonText) as T;
    } catch {
      this.logger.error(`Failed to parse AI JSON response: ${raw}`);
      throw new InternalServerErrorException('AI response was not valid JSON');
    }
  }
}
