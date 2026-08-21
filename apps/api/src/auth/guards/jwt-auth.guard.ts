import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Every authenticated route sits behind this — enforces multi-tenancy by requiring
 * a valid JWT whose payload carries organizationId (see JwtPayload). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
