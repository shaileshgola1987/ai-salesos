import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { QueryVisitsDto } from './dto/query-visits.dto';

const MANAGER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SALES_MANAGER,
];

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    user: { select: { id: true, name: true } },
    lead: { select: { id: true, name: true, companyName: true } },
    customer: { select: { id: true, name: true, companyName: true } },
  } satisfies Prisma.VisitInclude;

  list(
    organizationId: string,
    requestingUserId: string,
    requestingRole: UserRole,
    query: QueryVisitsDto,
  ) {
    const isManager = MANAGER_ROLES.includes(requestingRole);
    const where: Prisma.VisitWhereInput = {
      organizationId,
      userId: isManager ? query.userId : requestingUserId,
      ...(query.leadId && { leadId: query.leadId }),
      ...(query.status === 'open' && { checkOutAt: null }),
      ...(query.status === 'closed' && { checkOutAt: { not: null } }),
    };

    return this.prisma.visit.findMany({
      where,
      include: this.include,
      orderBy: { checkInAt: 'desc' },
    });
  }

  async getOne(organizationId: string, id: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, organizationId },
      include: this.include,
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async checkIn(organizationId: string, userId: string, dto: CheckInDto) {
    if (dto.clientId) {
      const existing = await this.prisma.visit.findUnique({
        where: {
          organizationId_clientId: { organizationId, clientId: dto.clientId },
        },
        include: this.include,
      });
      if (existing) return existing;
    }

    if (dto.leadId) await this.assertLeadInOrg(organizationId, dto.leadId);
    if (dto.customerId)
      await this.assertCustomerInOrg(organizationId, dto.customerId);

    return this.prisma.visit.create({
      data: {
        organizationId,
        userId,
        leadId: dto.leadId,
        customerId: dto.customerId,
        purpose: dto.purpose,
        notes: dto.notes,
        clientId: dto.clientId,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
      },
      include: this.include,
    });
  }

  async checkOut(
    organizationId: string,
    requestingUserId: string,
    requestingRole: UserRole,
    id: string,
    dto: CheckOutDto,
  ) {
    const visit = await this.getOne(organizationId, id);
    const isManager = MANAGER_ROLES.includes(requestingRole);
    if (visit.userId !== requestingUserId && !isManager) {
      throw new ForbiddenException(
        'You can only check yourself out of a visit',
      );
    }
    if (visit.checkOutAt) {
      throw new BadRequestException('This visit has already been checked out');
    }

    return this.prisma.visit.update({
      where: { id },
      data: {
        checkOutAt: new Date(),
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        checkOutNotes: dto.notes,
      },
      include: this.include,
    });
  }

  private async assertLeadInOrg(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead)
      throw new NotFoundException('Lead not found in this organization');
  }

  private async assertCustomerInOrg(
    organizationId: string,
    customerId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer)
      throw new NotFoundException('Customer not found in this organization');
  }
}
