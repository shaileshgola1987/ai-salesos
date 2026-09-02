import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CheckOutDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
