import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { createPlatformJwtService } from './platform-jwt.util';

const SALT_ROUNDS = 10;

/**
 * There is deliberately no public /platform/auth/register endpoint — a PlatformAdmin
 * account can only exist by being bootstrapped here (from env vars, once, when the table
 * is empty) or created directly in the database by whoever operates this deployment. This
 * is what makes "only the SaaS provider" an enforced property rather than a UI convention:
 * an Organization Owner/Admin has no code path that creates or promotes into this table.
 */
@Injectable()
export class PlatformAuthService implements OnModuleInit {
  private readonly logger = new Logger(PlatformAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const existing = await this.prisma.platformAdmin.count();
    if (existing > 0) return;

    const email = this.config.get<string>('PLATFORM_ADMIN_EMAIL');
    const password = this.config.get<string>('PLATFORM_ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'No PlatformAdmin exists yet and PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PASSWORD are ' +
          'not set — set them and restart to bootstrap the first platform admin account.',
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.prisma.platformAdmin.create({ data: { email, passwordHash } });
    this.logger.log(`Bootstrapped the first PlatformAdmin account (${email}).`);
  }

  async login(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email },
    });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = createPlatformJwtService(this.config).sign({
      sub: admin.id,
    });
    return { accessToken };
  }
}
