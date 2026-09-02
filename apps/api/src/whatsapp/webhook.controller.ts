import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MessageStatus } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import type { WhatsAppMediaType } from './providers/whatsapp-provider.interface';

interface MetaMedia {
  id: string;
  mime_type?: string;
  caption?: string;
}

interface MetaMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: MetaMedia;
  document?: MetaMedia;
  audio?: MetaMedia;
  video?: MetaMedia;
}

interface MetaStatus {
  id?: string; // WhatsApp message id (our Message.externalId)
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
    }>;
  }>;
}

const META_STATUS_MAP: Record<string, MessageStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

const MEDIA_MESSAGE_TYPES: Record<string, WhatsAppMediaType> = {
  image: 'IMAGE',
  document: 'DOCUMENT',
  audio: 'AUDIO',
  video: 'VIDEO',
};

/**
 * Public endpoint for the Meta WhatsApp Cloud API webhook (PRD §5 WhatsApp CRM).
 * Not behind JwtAuthGuard — Meta calls this directly, not an authenticated user.
 * Routes each inbound message to its org via Organization.whatsappPhoneNumberId.
 */
@Controller('whatsapp/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Verification failed');
  }

  @Post()
  async receive(@Body() payload: MetaWebhookPayload, @Res() res: Response) {
    // Always ack 200 quickly — Meta retries aggressively on non-2xx responses.
    res.status(200).send('EVENT_RECEIVED');

    try {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          if (!phoneNumberId) continue;

          const messages = change.value?.messages ?? [];
          const statuses = change.value?.statuses ?? [];
          if (messages.length === 0 && statuses.length === 0) continue;

          const org = await this.prisma.organization.findUnique({
            where: { whatsappPhoneNumberId: phoneNumberId },
          });
          if (!org) {
            this.logger.warn(
              `No org connected for phone_number_id ${phoneNumberId}`,
            );
            continue;
          }

          for (const message of messages) {
            await this.handleInboundMessage(org.id, message);
          }
          for (const status of statuses) {
            await this.handleStatusUpdate(org.id, status);
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed processing WhatsApp webhook payload', err);
    }
  }

  private async handleInboundMessage(organizationId: string, message: MetaMessage) {
    if (!message.from || !message.type) return;

    const conversation = await this.conversationsService.findOrCreateByPhone(
      organizationId,
      message.from,
    );

    if (message.type === 'text' && message.text?.body) {
      await this.conversationsService.recordInbound(organizationId, conversation.id, {
        body: message.text.body,
      });
      return;
    }

    const mediaType = MEDIA_MESSAGE_TYPES[message.type];
    const media = mediaType && (message[message.type as 'image' | 'document' | 'audio' | 'video']);
    if (mediaType && media) {
      await this.conversationsService.recordInbound(organizationId, conversation.id, {
        body: media.caption,
        mediaType,
        mediaProviderId: media.id,
        mediaMimeType: media.mime_type,
      });
    }
  }

  private async handleStatusUpdate(organizationId: string, status: MetaStatus) {
    const mapped = status.status && META_STATUS_MAP[status.status];
    if (!status.id || !mapped) return;
    await this.conversationsService.updateMessageStatusByExternalId(
      organizationId,
      status.id,
      mapped,
    );
  }
}
