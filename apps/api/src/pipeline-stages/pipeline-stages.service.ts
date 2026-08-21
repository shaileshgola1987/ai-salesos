import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

@Injectable()
export class PipelineStagesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  }

  /** Kanban board: every stage with its leads, for a single-fetch board render. */
  board(organizationId: string) {
    return this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
      include: {
        leads: {
          include: { assignedTo: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(organizationId: string, dto: CreateStageDto) {
    const last = await this.prisma.pipelineStage.findFirst({
      where: { organizationId },
      orderBy: { order: 'desc' },
    });
    return this.prisma.pipelineStage.create({
      data: {
        organizationId,
        name: dto.name,
        isClosed: dto.isClosed ?? false,
        order: (last?.order ?? -1) + 1,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateStageDto) {
    await this.assertInOrg(organizationId, id);
    return this.prisma.pipelineStage.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.assertInOrg(organizationId, id);
    const leadCount = await this.prisma.lead.count({
      where: { pipelineStageId: id },
    });
    if (leadCount > 0) {
      throw new ConflictException(
        'Cannot delete a stage that still has leads in it',
      );
    }
    await this.prisma.pipelineStage.delete({ where: { id } });
  }

  /**
   * Two-phase update: the (organizationId, order) unique constraint is checked per-statement
   * (not deferred), so a direct swap of two stages' orders would collide mid-transaction.
   * Bumping everything to unique negative placeholders first avoids that.
   */
  async reorder(organizationId: string, dto: ReorderStagesDto) {
    const stageIds = dto.stages.map((s) => s.id);
    const existing = await this.prisma.pipelineStage.findMany({
      where: { organizationId, id: { in: stageIds } },
    });
    if (existing.length !== stageIds.length) {
      throw new NotFoundException(
        'One or more stages not found in this organization',
      );
    }

    await this.prisma.$transaction([
      ...dto.stages.map((s, i) =>
        this.prisma.pipelineStage.update({
          where: { id: s.id },
          data: { order: -(i + 1) },
        }),
      ),
      ...dto.stages.map((s) =>
        this.prisma.pipelineStage.update({
          where: { id: s.id },
          data: { order: s.order },
        }),
      ),
    ]);

    return this.list(organizationId);
  }

  private async assertInOrg(organizationId: string, id: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id, organizationId },
    });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
  }
}
