import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';

const OTP_TTL_MINUTES = 5;
const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Creates a new Organization (tenant) plus its first user, as OWNER. PRD §4.1 + §4.2. */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        gstin: dto.gstin,
        users: {
          create: {
            name: dto.ownerName,
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: UserRole.OWNER,
          },
        },
        pipelineStages: {
          create: [
            { name: 'New', order: 0 },
            { name: 'Contacted', order: 1 },
            { name: 'Qualified', order: 2 },
            { name: 'Quotation Sent', order: 3 },
            { name: 'Negotiation', order: 4 },
            { name: 'Won', order: 5, isClosed: true },
            { name: 'Lost', order: 6, isClosed: true },
          ],
        },
      },
      include: { users: true },
    });

    const owner = organization.users[0];
    return this.issueToken(owner.id, organization.id, owner.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    return this.issueToken(user.id, user.organizationId, user.role);
  }

  /** Sends a 6-digit OTP for phone-based login. SMS delivery is a stub — see PRD §9 (Exotel/AWS SNS). */
  async requestOtp(phone: string) {
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('No account found for this phone number');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: code, otpExpiresAt },
    });

    // TODO(PRD §9 SMS Integration): wire up Exotel/AWS SNS instead of logging.
    this.logger.log(
      `OTP for ${phone}: ${code} (expires in ${OTP_TTL_MINUTES}m)`,
    );

    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, code: string) {
    const user = await this.prisma.user.findFirst({ where: { phone } });
    if (!user || !user.otpCode || !user.otpExpiresAt) {
      throw new UnauthorizedException(
        'OTP not requested for this phone number',
      );
    }
    if (user.otpCode !== code || user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null },
    });

    return this.issueToken(user.id, user.organizationId, user.role);
  }

  private issueToken(userId: string, organizationId: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, organizationId, role };
    return { accessToken: this.jwt.sign(payload) };
  }
}
