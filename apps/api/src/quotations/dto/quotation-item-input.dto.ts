import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** One quotation line. Either productId (price/tax default from the catalog, both
 * overridable) or a standalone description + unitPrice must be given. */
export class QuotationItemInputDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePercent?: number;
}
