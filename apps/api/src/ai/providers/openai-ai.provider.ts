import { InternalServerErrorException } from '@nestjs/common';
import { BaseLlmAiProvider } from './base-llm-ai.provider';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

/** Real LLM-backed provider using OpenAI's Chat Completions API. See AnthropicAiProvider
 * for the provider-abstraction rationale; activated per-org by a PlatformAdmin only. */
export class OpenAiAiProvider extends BaseLlmAiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = OPENAI_DEFAULT_MODEL,
  ) {
    super();
  }

  protected async complete(prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const body = await this.readJsonResponse<{
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    }>(res);

    if (!res.ok) {
      this.logger.error(`OpenAI API call failed: ${JSON.stringify(body)}`);
      throw new InternalServerErrorException(
        body.error?.message ?? 'AI request failed',
      );
    }

    const text = body.choices?.[0]?.message?.content;
    if (!text) {
      throw new InternalServerErrorException(
        'AI response contained no text content',
      );
    }
    return text.trim();
  }
}
