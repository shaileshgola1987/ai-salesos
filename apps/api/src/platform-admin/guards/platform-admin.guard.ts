import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  createPlatformJwtService,
  PlatformAdminPayload,
} from '../platform-jwt.util';

/**
 * Guards every /platform/* route except login. Verifies against PLATFORM_JWT_SECRET, not
 * JWT_SECRET — a valid Organization-user JWT (see JwtAuthGuard) simply fails signature
 * verification here, so no combination of org role ever grants access to this surface.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    if (!token) throw new UnauthorizedException();

    try {
      const payload = createPlatformJwtService(
        this.config,
      ).verify<PlatformAdminPayload>(token);
      (
        request as Request & { platformAdmin: PlatformAdminPayload }
      ).platformAdmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
