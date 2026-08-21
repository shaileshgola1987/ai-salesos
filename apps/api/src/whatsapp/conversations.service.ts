import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import type { WhatsAppProvider } from './providers/whatsapp-provider.interface';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto, SimulateInboundDto } from './dto/send-message.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
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

    return this.prisma.conversation.create({
      data: { organizationId, phone, leadId: resolvedLeadId },
      include: this.summaryInclude,
    });
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
    if (!body) {
      throw new BadRequestException('Message body or templateName is required');
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const result = await this.provider.sendMessage({
      phoneNumberId: org.whatsappPhoneNumberId,
      to: conversation.phone,
      body,
    });

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'OUTBOUND',
          body,
          status: 'SENT',
          externalId: result.externalId,
          templateName,
          sentById: senderId,
        },
        include: this.messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return message;
  }

  /** Dev/testing aid: records an inbound message without a real WhatsApp Business account. */
  async simulateInbound(
    organizationId: string,
    conversationId: string,
    dto: SimulateInboundDto,
  ) {
    await this.getOne(organizationId, conversationId);
    return this.recordInbound(organizationId, conversationId, dto.body);
  }

  async recordInbound(
    organizationId: string,
    conversationId: string,
    body: string,
  ) {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'INBOUND',
          body,
          status: 'DELIVERED',
        },
        include: this.messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return message;
  }
}
