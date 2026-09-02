import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QuotationStatus } from '@prisma/client';

export class QueryQuotationsDto {
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
