import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskSecret } from '../common/crypto.util';

const PLATFORM_SETTINGS_ID = 'singleton';

@Injectable()
export class AiProviderConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    return this.config.get<string>('PLATFORM_SECRET', 'dev-secret-change-me');
  }

  async list() {
    const [configs, settings] = await Promise.all([
      this.prisma.aiProviderConfig.findMany(),
      this.prisma.platformSettings.findUnique({
        where: { id: PLATFORM_SETTINGS_ID },
      }),
    ]);

    return {
      activeProvider: settings?.activeAiProvider ?? null,
      providers: configs.map((c) => ({
        provider: c.provider,
        model: c.model,
        keyPreview: maskSecret(decryptSecret(c.apiKey, this.secret())),
        updatedAt: c.updatedAt,
      })),
    };
  }

  async upsert(provider: AiProviderName, apiKey: string, model?: string) {
    const encrypted = encryptSecret(apiKey, this.secret());
    await this.prisma.aiProviderConfig.upsert({
      where: { provider },
      create: { provider, apiKey: encrypted, model },
      update: { apiKey: encrypted, model: model ?? null },
    });
    return this.list();
  }

  async remove(provider: AiProviderName) {
    await this.prisma.aiProviderConfig
      .delete({ where: { provider } })
      .catch(() => undefined);

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
    });
    if (settings?.activeAiProvider === provider) {
      await this.prisma.platformSettings.update({
        where: { id: PLATFORM_SETTINGS_ID },
        data: { activeAiProvider: null },
      });
    }
    return this.list();
  }

  async setActive(provider: AiProviderName | null) {
    if (provider) {
      const providerConfig = await this.prisma.aiProviderConfig.findUnique({
        where: { provider },
      });
      if (!providerConfig) {
        throw new BadRequestException(
          `Configure an API key for ${provider} before activating it`,
        );
      }
    }

    await this.prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: { id: PLATFORM_SETTINGS_ID, activeAiProvider: provider },
      update: { activeAiProvider: provider },
    });
    return this.list();
  }
}
