import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { AiService } from '../ai/ai.service';
import { ConversationsService } from './conversations.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto, SimulateInboundDto } from './dto/send-message.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly aiService: AiService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.conversationsService.list(user.organizationId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.getOne(user.organizationId, id);
  }

  @Get(':id/messages')
  getMessages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.getMessages(user.organizationId, id);
  }

  @Post()
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartConversationDto) {
    return this.conversationsService.start(user.organizationId, dto);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(
      user.organizationId,
      id,
      user.sub,
      dto,
    );
  }

  /** Dev/testing aid — records a fake inbound reply without a live WhatsApp Business account. */
  @Post(':id/simulate-inbound')
  simulateInbound(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SimulateInboundDto,
  ) {
    return this.conversationsService.simulateInbound(
      user.organizationId,
      id,
      dto,
    );
  }

  /** PRD §11 AI Sales Assistant — 2-3 suggested replies for the salesperson to pick/edit and send. */
  @Post(':id/ai/reply-suggestions')
  suggestReplies(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.aiService.suggestReplies(user.organizationId, id);
  }
}
