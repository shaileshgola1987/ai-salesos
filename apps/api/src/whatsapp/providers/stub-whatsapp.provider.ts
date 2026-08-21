import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  WhatsAppProvider,
  WhatsAppSendParams,
  WhatsAppSendResult,
} from './whatsapp-provider.interface';

/**
 * Logs outbound messages instead of calling a real WhatsApp Business API.
 * Default provider until a real WABA account is connected (see MetaWhatsAppProvider).
 */
@Injectable()
export class StubWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(StubWhatsAppProvider.name);

  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
    this.logger.log(`[stub] WhatsApp -> ${params.to}: ${params.body}`);
    return Promise.resolve({ externalId: `stub_${randomUUID()}` });
  }
}
