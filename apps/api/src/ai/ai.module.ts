import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { StubAiProvider } from './providers/stub-ai.provider';
import { AnthropicAiProvider } from './providers/anthropic-ai.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService) =>
        config.get<string>('AI_PROVIDER', 'stub') === 'anthropic'
          ? new AnthropicAiProvider(config)
          : new StubAiProvider(),
      inject: [ConfigService],
    },
  ],
  exports: [AiService],
})
export class AiModule {}
