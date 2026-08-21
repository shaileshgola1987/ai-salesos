import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class MessageTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  create(organizationId: string, dto: CreateTemplateDto) {
    return this.prisma.messageTemplate.create({
      data: { organizationId, name: dto.name, body: dto.body },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateTemplateDto) {
    await this.assertInOrg(organizationId, id);
    return this.prisma.messageTemplate.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.assertInOrg(organizationId, id);
    await this.prisma.messageTemplate.delete({ where: { id } });
  }

  private async assertInOrg(organizationId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) throw new NotFoundException('Template not found');
  }
}
