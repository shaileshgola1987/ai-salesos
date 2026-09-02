import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { QuotationsService } from './quotations.service';
import { QuotationsPdfService } from './quotations-pdf.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';
import { QueryQuotationsDto } from './dto/query-quotations.dto';
import { SendQuotationWhatsAppDto } from './dto/send-quotation-whatsapp.dto';

@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly pdfService: QuotationsPdfService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  list(@CurrentUser() user: JwtPayload, @Query() query: QueryQuotationsDto) {
    return this.quotationsService.list(user.organizationId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.quotationsService.getOne(user.organizationId, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuotationDto) {
    return this.quotationsService.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationStatusDto,
  ) {
    return this.quotationsService.updateStatus(user.organizationId, id, dto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.quotationsService.remove(user.organizationId, id);
  }

  @Post(':id/send-whatsapp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  sendWhatsApp(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendQuotationWhatsAppDto,
  ) {
    return this.quotationsService.sendViaWhatsApp(
      user.organizationId,
      id,
      user.sub,
      dto.phone,
    );
  }

  /** Authenticated preview/download for the logged-in org's own users. */
  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async pdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const quotation = await this.quotationsService.getOne(user.organizationId, id);
    const organization = await this.quotationsService.getOrganizationBasics(user.organizationId);
    const buffer = await this.pdfService.render(organization, quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.number}.pdf"`);
    res.send(buffer);
  }

  /** Unauthenticated, signature-verified link so WhatsApp/Meta can fetch the PDF directly —
   * see QuotationsService.buildPublicPdfUrl / verifyPublicLink. */
  @Get(':id/pdf/public')
  async publicPdf(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!this.quotationsService.verifyPublicLink(id, exp, sig)) {
      throw new BadRequestException('This link has expired or is invalid');
    }
    const quotation = await this.quotationsService.getForPublicPdf(id);
    const buffer = await this.pdfService.render(quotation.organization, quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.number}.pdf"`);
    res.send(buffer);
  }
}
