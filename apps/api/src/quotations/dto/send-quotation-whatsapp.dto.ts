import { IsOptional, IsString } from 'class-validator';

export class SendQuotationWhatsAppDto {
  /** Overrides the linked lead/customer's phone — required if the quotation has neither. */
  @IsOptional()
  @IsString()
  phone?: string;
}
