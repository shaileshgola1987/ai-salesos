import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppProvider,
  WhatsAppSendParams,
  WhatsAppSendResult,
} from './whatsapp-provider.interface';

const GRAPH_API_VERSION = 'v20.0';

/** Sends real messages via the Meta WhatsApp Cloud API. Activate with WHATSAPP_PROVIDER=meta. */
@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaWhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
    if (!params.phoneNumberId) {
      throw new BadRequestException(
        'This organization has no WhatsApp Business number connected yet',
      );
    }

    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new InternalServerErrorException(
        'WHATSAPP_ACCESS_TOKEN is not configured',
      );
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'text',
        text: { body: params.body },
      }),
    });

    const payload = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok || !payload.messages?.[0]?.id) {
      this.logger.error(`Meta send failed: ${JSON.stringify(payload)}`);
      throw new InternalServerErrorException(
        payload.error?.message ?? 'Failed to send WhatsApp message',
      );
    }

    return { externalId: payload.messages[0].id };
  }
}
