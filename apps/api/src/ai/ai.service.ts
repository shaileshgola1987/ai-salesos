import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Lead, MessageDirection, Prisma, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import type {
  AiProvider,
  LeadScoringContext,
  LeadSummaryContext,
} from './providers/ai-provider.interface';

const RECENT_MESSAGES_LIMIT = 10;

type LeadWithAiContext = Lead & {
  tasks: Pick<Task, 'title' | 'status' | 'dueAt'>[];
  conversations: {
    messages: { direction: MessageDirection; body: string; createdAt: Date }[];
  }[];
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  private readonly leadInclude = {
    assignedTo: { select: { id: true, name: true } },
    pipelineStage: {
      select: { id: true, name: true, order: true, isClosed: true },
    },
  } satisfies Prisma.LeadInclude;

  async scoreLead(organizationId: string, leadId: string) {
    const lead = await this.getLeadWithContext(organizationId, leadId);
    const result = await this.provider.scoreLead(
      this.buildScoringContext(lead),
    );
    const score = Math.max(0, Math.min(100, Math.round(result.score)));

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { score },
      include: this.leadInclude,
    });

    return {
      lead: updated,
      suggestedTemperature: result.suggestedTemperature,
      reasoning: result.reasoning,
    };
  }

  async summarizeLead(organizationId: string, leadId: string) {
    const lead = await this.getLeadWithContext(organizationId, leadId);
    const summary = await this.provider.summarizeLead(
      this.buildSummaryContext(lead),
    );

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { aiSummary: summary, aiSummaryGeneratedAt: new Date() },
      include: this.leadInclude,
    });
  }

  async suggestFollowUp(organizationId: string, leadId: string) {
    const lead = await this.getLeadWithContext(organizationId, leadId);
    return this.provider.suggestFollowUp(this.buildSummaryContext(lead));
  }

  async suggestReplies(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_MESSAGES_LIMIT,
      select: { direction: true, body: true },
    });

    const suggestions = await this.provider.suggestReplies({
      recentMessages: messages.reverse(),
    });
    return { suggestions };
  }

  private async getLeadWithContext(
    organizationId: string,
    leadId: string,
  ): Promise<LeadWithAiContext> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        tasks: {
          select: { title: true, status: true, dueAt: true },
          orderBy: { dueAt: 'asc' },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: RECENT_MESSAGES_LIMIT,
              select: { direction: true, body: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private buildScoringContext(lead: LeadWithAiContext): LeadScoringContext {
    const messages = [...(lead.conversations[0]?.messages ?? [])].reverse();
    const inbound = messages.filter((m) => m.direction === 'INBOUND');
    const outbound = messages.filter((m) => m.direction === 'OUTBOUND');
    const now = new Date();

    return {
      name: lead.name,
      companyName: lead.companyName,
      source: lead.source,
      status: lead.status,
      currentTemperature: lead.temperature,
      createdAt: lead.createdAt,
      inboundMessageCount: inbound.length,
      outboundMessageCount: outbound.length,
      lastInboundAt: inbound.length
        ? inbound[inbound.length - 1].createdAt
        : null,
      tasksPending: lead.tasks.filter((t) => t.status === 'PENDING').length,
      tasksOverdue: lead.tasks.filter(
        (t) => t.status === 'PENDING' && t.dueAt < now,
      ).length,
      tasksCompleted: lead.tasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }

  private buildSummaryContext(lead: LeadWithAiContext): LeadSummaryContext {
    const scoring = this.buildScoringContext(lead);
    const messages = [...(lead.conversations[0]?.messages ?? [])].reverse();

    return {
      ...scoring,
      phone: lead.phone,
      recentMessages: messages,
      tasks: lead.tasks,
    };
  }
}
