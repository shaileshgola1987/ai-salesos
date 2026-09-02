import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../common/crypto.util';
import { AiProvider } from './providers/ai-provider.interface';
import { StubAiProvider } from './providers/stub-ai.provider';
import { AnthropicAiProvider } from './providers/anthropic-ai.provider';
import { OpenAiAiProvider } from './providers/openai-ai.provider';
import { GeminiAiProvider } from './providers/gemini-ai.provider';

const PLATFORM_SETTINGS_ID = 'singleton';

/**
 * Picks the AI provider live on every call — never cached at app-boot, unlike the
 * WhatsApp/Meta provider selection (env var, fixed at DI time). A PlatformAdmin can switch
 * providers or rotate a key from the platform settings panel and it takes effect on the very
 * next AI call, no redeploy needed. Falls back to the deterministic stub whenever nothing is
 * configured yet, the configured provider has no key, or resolving/decrypting it fails —
 * an AI provider outage or misconfiguration must never break lead scoring, following the
 * same resilience contract as LeadsService.create's try/catch around scoring.
 */
@Injectable()
export class AiProviderResolver {
  private readonly logger = new Logger(AiProviderResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProvider(): Promise<AiProvider> {
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
      });
      if (!settings?.activeAiProvider) return new StubAiProvider();

      const providerConfig = await this.prisma.aiProviderConfig.findUnique({
        where: { provider: settings.activeAiProvider },
      });
      if (!providerConfig) return new StubAiProvider();

      const secret = this.config.get<string>(
        'PLATFORM_SECRET',
        'dev-secret-change-me',
      );
      const apiKey = decryptSecret(providerConfig.apiKey, secret);

      switch (settings.activeAiProvider) {
        case 'ANTHROPIC':
          return new AnthropicAiProvider(
            apiKey,
            providerConfig.model ?? undefined,
          );
        case 'OPENAI':
          return new OpenAiAiProvider(
            apiKey,
            providerConfig.model ?? undefined,
          );
        case 'GEMINI':
          return new GeminiAiProvider(
            apiKey,
            providerConfig.model ?? undefined,
          );
      }
    } catch (err) {
      this.logger.warn(
        'Failed to resolve the platform AI provider — falling back to stub.',
        err,
      );
    }
    return new StubAiProvider();
  }
}
