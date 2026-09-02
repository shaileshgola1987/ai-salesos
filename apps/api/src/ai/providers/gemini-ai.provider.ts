import { InternalServerErrorException } from '@nestjs/common';
import { BaseLlmAiProvider } from './base-llm-ai.provider';

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash';

/** Real LLM-backed provider using Google's Gemini API. See AnthropicAiProvider for the
 * provider-abstraction rationale; activated per-org by a PlatformAdmin only. */
export class GeminiAiProvider extends BaseLlmAiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = GEMINI_DEFAULT_MODEL,
  ) {
    super();
  }

  protected async complete(prompt: string, maxTokens: number): Promise<string> {
    const url = `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });

    const body = await this.readJsonResponse<{
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message: string };
    }>(res);

    if (!res.ok) {
      this.logger.error(`Gemini API call failed: ${JSON.stringify(body)}`);
      throw new InternalServerErrorException(
        body.error?.message ?? 'AI request failed',
      );
    }

    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new InternalServerErrorException(
        'AI response contained no text content',
      );
    }
    return text.trim();
  }
}
