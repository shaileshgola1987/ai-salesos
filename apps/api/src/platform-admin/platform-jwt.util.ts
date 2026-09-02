import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface PlatformAdminPayload {
  sub: string; // PlatformAdmin id
}

/**
 * A standalone JwtService signing/verifying with its own secret (PLATFORM_JWT_SECRET),
 * deliberately distinct from the org-user JWT_SECRET used by AuthModule/JwtStrategy. This
 * makes it cryptographically impossible for a normal Organization user's token — however it
 * was obtained — to pass as a platform-admin token, and vice versa. Not registered as a
 * global Nest module on purpose: platform-admin auth is intentionally a separate, narrow
 * surface (see PlatformAdminGuard), not something any other module should casually depend on.
 */
export function createPlatformJwtService(config: ConfigService): JwtService {
  return new JwtService({
    secret: config.get<string>(
      'PLATFORM_JWT_SECRET',
      'dev-platform-secret-change-me',
    ),
    signOptions: { expiresIn: '12h' },
  });
}
