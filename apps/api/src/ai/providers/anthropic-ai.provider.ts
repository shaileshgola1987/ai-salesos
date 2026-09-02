import { InternalServerErrorException } from '@nestjs/common';
import { BaseLlmAiProvider } from './base-llm-ai.provider';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Real LLM-backed provider. The PRD (§22) names OpenAI/Gemini/local LLaMA, but this
 * codebase's own platform defaults to Claude for AI features it builds — the interface
 * stays provider-abstracted (see AiProvider/BaseLlmAiProvider) alongside OpenAiAiProvider
 * and GeminiAiProvider. A PlatformAdmin picks the active one at runtime (see
 * AiProviderResolver) — never configured via env vars or by an Organization's Owner/Admin.
 */
export class AnthropicAiProvider extends BaseLlmAiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = ANTHROPIC_DEFAULT_MODEL,
  ) {
    super();
  }

  protected async complete(prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const body = await this.readJsonResponse<{
      content?: { type: string; text?: string }[];
      error?: { message: string };
    }>(res);

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
}
