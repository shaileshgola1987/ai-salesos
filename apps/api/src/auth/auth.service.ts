import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../common/crypto.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, PendingTwoFactorPayload } from './jwt-payload.interface';
import {
  buildTwoFactorOtpauthUri,
  buildTwoFactorQrCodeDataUrl,
  generateTwoFactorSecret,
  verifyTwoFactorCode,
} from './two-factor.util';

const OTP_TTL_MINUTES = 5;
const SALT_ROUNDS = 10;
const PENDING_TWO_FACTOR_TTL = '5m';

type LoginResult =
  { accessToken: string } | { requiresTwoFactor: true; pendingToken: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

    // A brand-new org's owner has never had a chance to enable 2FA yet.
    const owner = organization.users[0];
    return this.issueToken(owner.id, organization.id, owner.role);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    return this.issueTokenOrRequireTwoFactor(user);
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

  async verifyOtp(phone: string, code: string): Promise<LoginResult> {
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

    return this.issueTokenOrRequireTwoFactor(user);
  }

  /** Starts 2FA enrollment: generates and stores a new secret (not yet enabled — see
   * enableTwoFactor) and returns everything needed to render a QR code for an authenticator app. */
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const secret = generateTwoFactorSecret();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptSecret(secret, this.secretsKey()),
        twoFactorEnabled: false,
      },
    });

    const otpauthUrl = buildTwoFactorOtpauthUri(user.email, secret);
    const qrCodeDataUrl = await buildTwoFactorQrCodeDataUrl(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Proves the user actually scanned the QR code before 2FA starts being enforced on login. */
  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Call /auth/2fa/setup first');
    }
    const valid = await verifyTwoFactorCode(
      code,
      decryptSecret(user.twoFactorSecret, this.secretsKey()),
    );
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { twoFactorEnabled: true };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const valid = await verifyTwoFactorCode(
      code,
      decryptSecret(user.twoFactorSecret, this.secretsKey()),
    );
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { twoFactorEnabled: false };
  }

  /** Completes login for a user with 2FA enabled — exchanges the short-lived pendingToken
   * from issueTokenOrRequireTwoFactor plus a valid TOTP code for a real access token. */
  async verifyTwoFactorLogin(pendingToken: string, code: string) {
    let payload: PendingTwoFactorPayload;
    try {
      payload = this.jwt.verify<PendingTwoFactorPayload>(pendingToken);
    } catch {
      throw new UnauthorizedException(
        'This login session has expired — please sign in again',
      );
    }
    if (!payload.pending2fa) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid token');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const valid = await verifyTwoFactorCode(
      code,
      decryptSecret(user.twoFactorSecret, this.secretsKey()),
    );
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    return this.issueToken(user.id, user.organizationId, user.role);
  }

  private issueTokenOrRequireTwoFactor(
    user: Pick<User, 'id' | 'organizationId' | 'role' | 'twoFactorEnabled'>,
  ): LoginResult {
    if (user.twoFactorEnabled) {
      const payload: PendingTwoFactorPayload = {
        sub: user.id,
        pending2fa: true,
      };
      const pendingToken = this.jwt.sign(payload, {
        expiresIn: PENDING_TWO_FACTOR_TTL,
      });
      return { requiresTwoFactor: true, pendingToken };
    }
    return this.issueToken(user.id, user.organizationId, user.role);
  }

  private issueToken(userId: string, organizationId: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, organizationId, role };
    return { accessToken: this.jwt.sign(payload) };
  }

  /** The app's one at-rest encryption secret (see common/crypto.util.ts) — reused here for
   * 2FA secrets rather than introducing a near-duplicate env var. */
  private secretsKey(): string {
    return this.config.get<string>('PLATFORM_SECRET', 'dev-secret-change-me');
  }
}
