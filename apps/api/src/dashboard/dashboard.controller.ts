import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.overview(user.organizationId);
  }

  @Get('performance')
  performance(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.performance(
      user.organizationId,
      user.sub,
      user.role,
    );
  }
}
