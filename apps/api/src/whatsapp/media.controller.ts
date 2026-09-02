import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { ConversationsService } from './conversations.service';

/**
 * Streams provider-hosted inbound media (Meta media ids expire and require an
 * authenticated fetch) to the browser on demand, scoped to the requesting user's org —
 * see WhatsAppProvider.downloadMedia and ConversationsService.getMedia.
 */
@Controller('whatsapp/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(':messageId')
  async get(
    @CurrentUser() user: JwtPayload,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.conversationsService.getMedia(
      user.organizationId,
      messageId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }
}
