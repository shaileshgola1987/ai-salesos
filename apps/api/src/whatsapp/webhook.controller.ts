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
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
}

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
          const messages = change.value?.messages ?? [];
          if (!phoneNumberId || messages.length === 0) continue;

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
            if (message.type !== 'text' || !message.from || !message.text?.body)
              continue;
            const conversation =
              await this.conversationsService.findOrCreateByPhone(
                org.id,
                message.from,
              );
            await this.conversationsService.recordInbound(
              org.id,
              conversation.id,
              message.text.body,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed processing WhatsApp webhook payload', err);
    }
  }
}
