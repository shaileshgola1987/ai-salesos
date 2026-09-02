import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlatformAdminPayload } from '../platform-jwt.util';

export const CurrentPlatformAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PlatformAdminPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ platformAdmin: PlatformAdminPayload }>();
    return request.platformAdmin;
  },
);
