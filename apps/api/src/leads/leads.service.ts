import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { MoveLeadDto } from './dto/move-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  private readonly include = {
    assignedTo: { select: { id: true, name: true } },
    pipelineStage: {
      select: { id: true, name: true, order: true, isClosed: true },
    },
  } satisfies Prisma.LeadInclude;

  list(organizationId: string, query: QueryLeadsDto) {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.temperature && { temperature: query.temperature }),
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
      ...(query.pipelineStageId && { pipelineStageId: query.pipelineStageId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { companyName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ],
      }),
    };

    return this.prisma.lead.findMany({
      where,
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: this.include,
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(organizationId: string, dto: CreateLeadDto) {
    if (dto.assignedToId) {
      await this.assertUserInOrg(organizationId, dto.assignedToId);
    }

    let pipelineStageId = dto.pipelineStageId;
    if (pipelineStageId) {
      await this.assertStageInOrg(organizationId, pipelineStageId);
    } else {
      const firstStage = await this.prisma.pipelineStage.findFirst({
        where: { organizationId },
        orderBy: { order: 'asc' },
      });
      pipelineStageId = firstStage?.id;
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email,
        source: dto.source,
        temperature: dto.temperature,
        assignedToId: dto.assignedToId,
        pipelineStageId,
      },
      include: this.include,
    });

    // AI Lead Scoring (PRD §6) — best-effort: a scoring failure (e.g. AI provider down)
    // must never block lead creation, so the lead simply keeps its default score of 0.
    try {
      const { lead: scored } = await this.aiService.scoreLead(
        organizationId,
        lead.id,
      );
      return scored;
    } catch (err) {
      this.logger.warn(`AI lead scoring failed for lead ${lead.id}`, err);
      return lead;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    await this.getOne(organizationId, id);
    return this.prisma.lead.update({
      where: { id },
      data: dto,
      include: this.include,
    });
  }

  async assign(organizationId: string, id: string, dto: AssignLeadDto) {
    await this.getOne(organizationId, id);
    if (dto.assignedToId) {
      await this.assertUserInOrg(organizationId, dto.assignedToId);
    }
    return this.prisma.lead.update({
      where: { id },
      data: { assignedToId: dto.assignedToId ?? null },
      include: this.include,
    });
  }

  async moveStage(organizationId: string, id: string, dto: MoveLeadDto) {
    await this.getOne(organizationId, id);
    await this.assertStageInOrg(organizationId, dto.pipelineStageId);
    return this.prisma.lead.update({
      where: { id },
      data: { pipelineStageId: dto.pipelineStageId },
      include: this.include,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.lead.delete({ where: { id } });
  }

  private async assertUserInOrg(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user)
      throw new NotFoundException(
        'Assigned user not found in this organization',
      );
  }

  private async assertStageInOrg(organizationId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, organizationId },
    });
    if (!stage)
      throw new NotFoundException(
        'Pipeline stage not found in this organization',
      );
  }
}
