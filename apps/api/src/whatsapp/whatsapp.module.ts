import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { MessageTemplatesController } from './message-templates.controller';
import { MessageTemplatesService } from './message-templates.service';
import { WebhookController } from './webhook.controller';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { StubWhatsAppProvider } from './providers/stub-whatsapp.provider';
import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';

@Module({
  imports: [ConfigModule],
  controllers: [
    ConversationsController,
    MessageTemplatesController,
    WebhookController,
  ],
  providers: [
    ConversationsService,
    MessageTemplatesService,
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (config: ConfigService) =>
        config.get<string>('WHATSAPP_PROVIDER', 'stub') === 'meta'
          ? new MetaWhatsAppProvider(config)
          : new StubWhatsAppProvider(),
      inject: [ConfigService],
    },
  ],
})
export class WhatsAppModule {}
