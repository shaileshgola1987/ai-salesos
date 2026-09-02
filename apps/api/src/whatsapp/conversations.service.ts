import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageStatus, MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import type { WhatsAppMediaType, WhatsAppProvider } from './providers/whatsapp-provider.interface';
import { WhatsAppGateway } from './whatsapp.gateway';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto, SimulateInboundDto } from './dto/send-message.dto';

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    private readonly gateway: WhatsAppGateway,
  ) {}

  private readonly summaryInclude = {
    lead: { select: { id: true, name: true, companyName: true } },
    customer: { select: { id: true, name: true, companyName: true } },
    messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  } satisfies Prisma.ConversationInclude;

  private readonly messageInclude = {
    sentBy: { select: { id: true, name: true } },
  } satisfies Prisma.MessageInclude;

  list(organizationId: string) {
    return this.prisma.conversation.findMany({
      where: { organizationId },
      include: this.summaryInclude,
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getOne(organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: this.summaryInclude,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getMessages(organizationId: string, conversationId: string) {
    await this.getOne(organizationId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: this.messageInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async start(organizationId: string, dto: StartConversationDto) {
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId },
      });
      if (!lead)
        throw new NotFoundException('Lead not found in this organization');
    }
    return this.findOrCreateByPhone(organizationId, dto.phone, dto.leadId);
  }

  /** Finds an existing thread for this phone number, or opens one — auto-linking to a lead by phone if possible. */
  async findOrCreateByPhone(
    organizationId: string,
    phone: string,
    leadId?: string,
  ) {
    const existing = await this.prisma.conversation.findUnique({
      where: { organizationId_phone: { organizationId, phone } },
      include: this.summaryInclude,
    });
    if (existing) return existing;

    let resolvedLeadId = leadId;
    if (!resolvedLeadId) {
      const matchingLead = await this.prisma.lead.findFirst({
        where: { organizationId, phone },
      });
      resolvedLeadId = matchingLead?.id;
    }

    const conversation = await this.prisma.conversation.create({
      data: { organizationId, phone, leadId: resolvedLeadId },
      include: this.summaryInclude,
    });
    this.gateway.conversationUpdated(organizationId, conversation);
    return conversation;
  }

  async sendMessage(
    organizationId: string,
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.getOne(organizationId, conversationId);

    let body = dto.body;
    let templateName: string | undefined;
    if (dto.templateName) {
      const template = await this.prisma.messageTemplate.findFirst({
        where: { organizationId, name: dto.templateName, isActive: true },
      });
      if (!template) throw new NotFoundException('Template not found');
      body = template.body;
      templateName = template.name;
    }
    if (!body && !dto.mediaUrl) {
      throw new BadRequestException(
        'Message body, mediaUrl, or templateName is required',
      );
    }

    // WhatsApp Cloud API policy: a business can only free-form message a customer within
    // 24h of their last inbound message; outside that window only an approved template
    // reopens the conversation. Templates are exempt from this check.
    if (!templateName && !this.isSessionWindowOpen(conversation.lastInboundMessageAt)) {
      throw new BadRequestException(
        'This conversation’s 24-hour customer session window has closed. Send an approved template message to reopen it.',
      );
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const media = dto.mediaUrl && dto.mediaType
      ? { url: dto.mediaUrl, type: dto.mediaType as WhatsAppMediaType }
      : undefined;
    const result = await this.provider.sendMessage({
      phoneNumberId: org.whatsappPhoneNumberId,
      to: conversation.phone,
      body,
      media,
    });

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'OUTBOUND',
          type: media ? (media.type as MessageType) : MessageType.TEXT,
          body: body ?? '',
          status: 'SENT',
          externalId: result.externalId,
          templateName,
          mediaUrl: media?.url,
          sentById: senderId,
        },
        include: this.messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    this.gateway.messageCreated(organizationId, message);
    this.gateway.conversationUpdated(organizationId, await this.getOne(organizationId, conversationId));
    return message;
  }

  /** Dev/testing aid: records an inbound message without a real WhatsApp Business account. */
  async simulateInbound(
    organizationId: string,
    conversationId: string,
    dto: SimulateInboundDto,
  ) {
    await this.getOne(organizationId, conversationId);
    return this.recordInbound(organizationId, conversationId, {
      body: dto.body,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType as WhatsAppMediaType | undefined,
    });
  }

  async recordInbound(
    organizationId: string,
    conversationId: string,
    input: {
      body?: string;
      mediaUrl?: string;
      mediaProviderId?: string;
      mediaMimeType?: string;
      mediaType?: WhatsAppMediaType;
    },
  ) {
    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'INBOUND',
          type: input.mediaType ? (input.mediaType as MessageType) : MessageType.TEXT,
          body: input.body ?? '',
          status: 'DELIVERED',
          mediaUrl: input.mediaUrl,
          mediaProviderId: input.mediaProviderId,
          mediaMimeType: input.mediaMimeType,
        },
        include: this.messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now, lastInboundMessageAt: now },
      }),
    ]);

    this.gateway.messageCreated(organizationId, message);
    this.gateway.conversationUpdated(organizationId, await this.getOne(organizationId, conversationId));
    return message;
  }

  /** Applies a Meta delivery-status webhook update (sent/delivered/read/failed) to the matching message. */
  async updateMessageStatusByExternalId(
    organizationId: string,
    externalId: string,
    status: MessageStatus,
  ) {
    const message = await this.prisma.message.findFirst({
      where: { organizationId, externalId },
    });
    if (!message) return null;

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: { status },
      include: this.messageInclude,
    });
    this.gateway.messageUpdated(organizationId, updated);
    return updated;
  }

  /** Fetches an inbound/outbound media message's bytes from the provider (only applies to provider-hosted media). */
  async getMedia(organizationId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, organizationId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (!message.mediaProviderId) {
      throw new NotFoundException('This message has no provider-hosted media');
    }
    return this.provider.downloadMedia(message.mediaProviderId);
  }

  private isSessionWindowOpen(lastInboundMessageAt: Date | null): boolean {
    if (!lastInboundMessageAt) return false;
    return Date.now() - lastInboundMessageAt.getTime() < SESSION_WINDOW_MS;
  }
}
