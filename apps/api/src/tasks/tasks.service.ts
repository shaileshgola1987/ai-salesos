import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    assignedTo: { select: { id: true, name: true } },
    lead: { select: { id: true, name: true, companyName: true } },
  } satisfies Prisma.TaskInclude;

  list(organizationId: string, query: QueryTasksDto) {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
      ...(query.leadId && { leadId: query.leadId }),
      ...(query.status && { status: query.status }),
      ...(query.overdue === 'true' && {
        status: 'PENDING',
        dueAt: { lt: new Date() },
      }),
    };

    return this.prisma.task.findMany({
      where,
      include: this.include,
      orderBy: { dueAt: 'asc' },
    });
  }

  async getOne(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
      include: this.include,
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(organizationId: string, creatorId: string, dto: CreateTaskDto) {
    const assignedToId = dto.assignedToId ?? creatorId;
    await this.assertUserInOrg(organizationId, assignedToId);
    if (dto.leadId) {
      await this.assertLeadInOrg(organizationId, dto.leadId);
    }

    return this.prisma.task.create({
      data: {
        organizationId,
        title: dto.title,
        notes: dto.notes,
        dueAt: new Date(dto.dueAt),
        leadId: dto.leadId,
        assignedToId,
      },
      include: this.include,
    });
  }

  async update(organizationId: string, id: string, dto: UpdateTaskDto) {
    await this.getOne(organizationId, id);
    if (dto.assignedToId) {
      await this.assertUserInOrg(organizationId, dto.assignedToId);
    }
    if (dto.leadId) {
      await this.assertLeadInOrg(organizationId, dto.leadId);
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        notes: dto.notes,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId,
      },
      include: this.include,
    });
  }

  async complete(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    return this.prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: this.include,
    });
  }

  async reopen(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    return this.prisma.task.update({
      where: { id },
      data: { status: 'PENDING', completedAt: null },
      include: this.include,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.task.delete({ where: { id } });
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

  private async assertLeadInOrg(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead)
      throw new NotFoundException('Lead not found in this organization');
  }
}
