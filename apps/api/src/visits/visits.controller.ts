import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { VisitsService } from './visits.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { QueryVisitsDto } from './dto/query-visits.dto';

@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: QueryVisitsDto) {
    return this.visitsService.list(
      user.organizationId,
      user.sub,
      user.role,
      query,
    );
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.visitsService.getOne(user.organizationId, id);
  }

  @Post('check-in')
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.visitsService.checkIn(user.organizationId, user.sub, dto);
  }

  @Patch(':id/check-out')
  checkOut(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.visitsService.checkOut(
      user.organizationId,
      user.sub,
      user.role,
      id,
      dto,
    );
  }
}
