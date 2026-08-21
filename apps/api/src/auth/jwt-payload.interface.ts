import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  organizationId: string;
  role: UserRole;
}
