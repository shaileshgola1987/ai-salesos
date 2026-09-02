import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  organizationId: string;
  role: UserRole;
}

/** A short-lived token issued after password/OTP verification succeeds for a user with 2FA
 * enabled, before a full JwtPayload is issued — see AuthService and JwtStrategy.validate. */
export interface PendingTwoFactorPayload {
  sub: string; // userId
  pending2fa: true;
}
