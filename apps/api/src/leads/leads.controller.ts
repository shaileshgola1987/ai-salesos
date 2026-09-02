import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { AiService } from '../ai/ai.service';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { MoveLeadDto } from './dto/move-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: QueryLeadsDto) {
    return this.leadsService.list(user.organizationId, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leadsService.getOne(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.organizationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(user.organizationId, id, dto);
  }

  @Patch(':id/assign')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leadsService.assign(user.organizationId, id, dto);
  }

  @Patch(':id/stage')
  moveStage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MoveLeadDto,
  ) {
    return this.leadsService.moveStage(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.leadsService.remove(user.organizationId, id);
  }

  /** PRD §6 AI Lead Scoring — recomputes Lead.score; temperature stays a suggestion the
   * salesperson applies explicitly (PRD §27: "AI is the assistant... suggestions, not decisions"). */
  @Post(':id/ai/score')
  scoreLead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.aiService.scoreLead(user.organizationId, id);
  }

  /** PRD §11 AI Sales Assistant — regenerates and caches an AI summary on the lead. */
  @Post(':id/ai/summary')
  summarizeLead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.aiService.summarizeLead(user.organizationId, id);
  }

  /** PRD §11 AI Sales Assistant — a follow-up suggestion for the UI to prefill, not auto-create. */
  @Post(':id/ai/follow-up-suggestion')
  suggestFollowUp(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.aiService.suggestFollowUp(user.organizationId, id);
  }
}
