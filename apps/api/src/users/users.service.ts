import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly selectFields = {
    id: true,
    organizationId: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    createdAt: true,
  };

  /** PRD §4.2 User Management — list every teammate in the current tenant. */
  listForOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: this.selectFields,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOne(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: this.selectFields,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** OWNER/ADMIN invites a teammate into their own organization (multi-tenant scoped). */
  async invite(organizationId: string, dto: InviteUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        passwordHash,
      },
      select: this.selectFields,
    });
    return user;
  }

  async update(organizationId: string, userId: string, dto: UpdateUserDto) {
    await this.getOne(organizationId, userId); // 404s if outside tenant
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.selectFields,
    });
  }
}
