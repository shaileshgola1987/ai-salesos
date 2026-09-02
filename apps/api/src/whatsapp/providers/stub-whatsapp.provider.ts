import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  WhatsAppDownloadResult,
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

  sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
    const media = params.media ? ` [${params.media.type} ${params.media.url}]` : '';
    this.logger.log(`[stub] WhatsApp -> ${params.to}: ${params.body ?? ''}${media}`);
    return Promise.resolve({ externalId: `stub_${randomUUID()}` });
  }

  downloadMedia(): Promise<WhatsAppDownloadResult> {
    // The stub provider never holds real provider-side media (dev/simulate-inbound
    // messages reference a plain URL directly via Message.mediaUrl instead).
    throw new NotFoundException('No media available for this provider');
  }
}
