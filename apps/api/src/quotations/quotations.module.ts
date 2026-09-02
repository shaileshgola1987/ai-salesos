import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationsPdfService } from './quotations-pdf.service';

@Module({
  imports: [ConfigModule, WhatsAppModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationsPdfService],
})
export class QuotationsModule {}
