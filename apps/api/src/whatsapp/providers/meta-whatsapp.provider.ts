import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppDownloadResult,
  WhatsAppProvider,
  WhatsAppSendParams,
  WhatsAppSendResult,
} from './whatsapp-provider.interface';

const GRAPH_API_VERSION = 'v20.0';

const MEDIA_TYPE_FIELD: Record<string, 'image' | 'document' | 'audio' | 'video'> = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
};

/** Sends real messages via the Meta WhatsApp Cloud API. Activate with WHATSAPP_PROVIDER=meta. */
@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaWhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  private accessToken(): string {
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new InternalServerErrorException(
        'WHATSAPP_ACCESS_TOKEN is not configured',
      );
    }
    return accessToken;
  }

  async sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
    if (!params.phoneNumberId) {
      throw new BadRequestException(
        'This organization has no WhatsApp Business number connected yet',
      );
    }

    const accessToken = this.accessToken();
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${params.phoneNumberId}/messages`;

    const payload = params.media
      ? {
          messaging_product: 'whatsapp',
          to: params.to,
          type: MEDIA_TYPE_FIELD[params.media.type],
          [MEDIA_TYPE_FIELD[params.media.type]]: {
            link: params.media.url,
            ...(params.body ? { caption: params.body } : {}),
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: params.to,
          type: 'text',
          text: { body: params.body ?? '' },
        };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok || !responseBody.messages?.[0]?.id) {
      this.logger.error(`Meta send failed: ${JSON.stringify(responseBody)}`);
      throw new InternalServerErrorException(
        responseBody.error?.message ?? 'Failed to send WhatsApp message',
      );
    }

    return { externalId: responseBody.messages[0].id };
  }

  /**
   * Two-step Graph API media fetch: resolve the media id to a short-lived URL + mime
   * type, then download the bytes with the same bearer token (the URL alone isn't
   * enough — Meta requires the Authorization header on the download too).
   */
  async downloadMedia(mediaProviderId: string): Promise<WhatsAppDownloadResult> {
    const accessToken = this.accessToken();

    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaProviderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; error?: { message: string } };
    if (!metaRes.ok || !meta.url) {
      throw new InternalServerErrorException(
        meta.error?.message ?? 'Failed to resolve WhatsApp media',
      );
    }

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      throw new InternalServerErrorException('Failed to download WhatsApp media');
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: meta.mime_type ?? 'application/octet-stream',
    };
  }
}
