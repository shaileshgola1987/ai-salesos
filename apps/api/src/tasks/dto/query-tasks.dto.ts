import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class QueryTasksDto {
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** "true" to return only PENDING tasks past their dueAt. */
  @IsOptional()
  @IsBooleanString()
  overdue?: string;
}
