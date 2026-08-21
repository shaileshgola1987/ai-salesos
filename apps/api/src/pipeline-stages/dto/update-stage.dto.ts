import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
