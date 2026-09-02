import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CheckInDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  /** Client-generated idempotency key — see Visit.clientId. Optional but recommended for
   * every check-in so a retried request (offline queue or a double-tap) never duplicates. */
  @IsOptional()
  @IsString()
  clientId?: string;
}
