import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { PipelineStagesService } from './pipeline-stages.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

const MANAGE_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES_MANAGER];

@Controller('pipeline-stages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PipelineStagesController {
  constructor(private readonly stagesService: PipelineStagesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.stagesService.list(user.organizationId);
  }

  @Get('board')
  board(@CurrentUser() user: JwtPayload) {
    return this.stagesService.board(user.organizationId);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStageDto) {
    return this.stagesService.create(user.organizationId, dto);
  }

  @Patch('reorder')
  @Roles(...MANAGE_ROLES)
  reorder(@CurrentUser() user: JwtPayload, @Body() dto: ReorderStagesDto) {
    return this.stagesService.reorder(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.stagesService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.stagesService.remove(user.organizationId, id);
  }
}
