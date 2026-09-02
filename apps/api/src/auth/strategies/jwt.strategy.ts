import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../jwt-payload.interface';
import type { PendingTwoFactorPayload } from '../jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  /** A pending-2FA token (see AuthService.issueTokenOrRequireTwoFactor) is signed with the
   * same secret but must never authorize a normal request — only /auth/2fa/verify-login,
   * which reads it directly rather than through this guard. */
  validate(payload: JwtPayload | PendingTwoFactorPayload): JwtPayload {
    if ('pending2fa' in payload) {
      throw new UnauthorizedException('Two-factor verification required');
    }
    return payload;
  }
}
