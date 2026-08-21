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
import { MessageTemplatesService } from './message-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const MANAGE_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES_MANAGER];

@Controller('message-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessageTemplatesController {
  constructor(private readonly templatesService: MessageTemplatesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.templatesService.list(user.organizationId);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.templatesService.remove(user.organizationId, id);
  }
}
