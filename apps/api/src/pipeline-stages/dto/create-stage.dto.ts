import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
