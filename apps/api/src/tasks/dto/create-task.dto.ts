import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  dueAt: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  /** Defaults to the creator if omitted. */
  @IsOptional()
  @IsString()
  assignedToId?: string;
}
