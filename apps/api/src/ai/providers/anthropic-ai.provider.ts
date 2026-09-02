import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadTemperature } from '@prisma/client';
import {
  AiProvider,
  FollowUpSuggestion,
  LeadScoreResult,
  LeadScoringContext,
  LeadSummaryContext,
  ReplySuggestionContext,
} from './ai-provider.interface';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Real LLM-backed provider. The PRD (§22) names OpenAI/Gemini/local LLaMA, but this
 * codebase's own platform defaults to Claude for AI features it builds — the interface
 * stays provider-abstracted (see AiProvider) so an OpenAI/Gemini provider can be added
 * the same way MetaWhatsAppProvider sits alongside StubWhatsAppProvider.
 * Activate with AI_PROVIDER=anthropic and ANTHROPIC_API_KEY.
 *
 * Untested against the live API in this environment (no key configured / no live calls
 * made during development) — verify against a real key before relying on it in production.
 */
@Injectable()
export class AnthropicAiProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicAiProvider.name);

  constructor(private readonly config: ConfigService) {}

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

  private async complete(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY is not configured',
      );
    }
    const model = this.config.get<string>('ANTHROPIC_MODEL', DEFAULT_MODEL);

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const body = (await res.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message: string };
    };

    if (!res.ok) {
      this.logger.error(`Anthropic API call failed: ${JSON.stringify(body)}`);
      throw new InternalServerErrorException(
        body.error?.message ?? 'AI request failed',
      );
    }

    const text = body.content?.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new InternalServerErrorException(
        'AI response contained no text content',
      );
    }
    return text.trim();
  }

  /** Strips a ```json ... ``` fence if the model wrapped its answer in one, then parses. */
  private parseJson<T>(raw: string): T {
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
