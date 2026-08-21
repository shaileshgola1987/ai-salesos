import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SALES_MANAGER,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const now = new Date();

    const [
      totalLeads,
      leadsByStatus,
      leadsByTemperature,
      totalCustomers,
      tasksByStatus,
      tasksOverdue,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { organizationId } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.lead.groupBy({
        by: ['temperature'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.customer.count({ where: { organizationId } }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.task.count({
        where: { organizationId, status: 'PENDING', dueAt: { lt: now } },
      }),
    ]);

    return {
      totalLeads,
      totalCustomers,
      leadsByStatus: Object.fromEntries(
        leadsByStatus.map((g) => [g.status, g._count]),
      ),
      leadsByTemperature: Object.fromEntries(
        leadsByTemperature.map((g) => [g.temperature, g._count]),
      ),
      tasksPending:
        tasksByStatus.find((g) => g.status === 'PENDING')?._count ?? 0,
      tasksCompleted:
        tasksByStatus.find((g) => g.status === 'COMPLETED')?._count ?? 0,
      tasksOverdue,
    };
  }

  /** Non-managers only ever see their own row. */
  async performance(
    organizationId: string,
    requestingUserId: string,
    requestingRole: UserRole,
  ) {
    const now = new Date();
    const isManager = MANAGER_ROLES.includes(requestingRole);

    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        ...(isManager ? {} : { id: requestingUserId }),
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    const userIds = users.map((u) => u.id);

    const [leadStatusGroups, taskStatusGroups, overdueGroups] =
      await Promise.all([
        this.prisma.lead.groupBy({
          by: ['assignedToId', 'status'],
          where: { organizationId, assignedToId: { in: userIds } },
          _count: true,
        }),
        this.prisma.task.groupBy({
          by: ['assignedToId', 'status'],
          where: { organizationId, assignedToId: { in: userIds } },
          _count: true,
        }),
        this.prisma.task.groupBy({
          by: ['assignedToId'],
          where: {
            organizationId,
            assignedToId: { in: userIds },
            status: 'PENDING',
            dueAt: { lt: now },
          },
          _count: true,
        }),
      ]);

    return users.map((user) => {
      const leadsForUser = leadStatusGroups.filter(
        (g) => g.assignedToId === user.id,
      );
      const tasksForUser = taskStatusGroups.filter(
        (g) => g.assignedToId === user.id,
      );
      const overdueForUser = overdueGroups.find(
        (g) => g.assignedToId === user.id,
      );

      const leadsAssigned = leadsForUser.reduce((sum, g) => sum + g._count, 0);
      const leadsWon =
        leadsForUser.find((g) => g.status === 'WON')?._count ?? 0;
      const leadsLost =
        leadsForUser.find((g) => g.status === 'LOST')?._count ?? 0;
      const tasksPending =
        tasksForUser.find((g) => g.status === 'PENDING')?._count ?? 0;
      const tasksCompleted =
        tasksForUser.find((g) => g.status === 'COMPLETED')?._count ?? 0;

      return {
        user,
        leadsAssigned,
        leadsWon,
        leadsLost,
        tasksPending,
        tasksCompleted,
        tasksOverdue: overdueForUser?._count ?? 0,
      };
    });
  }
}
