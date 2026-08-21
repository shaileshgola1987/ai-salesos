import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateProfile(
    organizationId: string,
    data: { name?: string; gstin?: string; whatsappPhoneNumberId?: string },
  ) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }
}
