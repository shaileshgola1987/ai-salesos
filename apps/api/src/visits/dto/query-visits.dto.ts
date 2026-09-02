import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryVisitsDto {
  /** Managers only — a non-manager is always restricted to their own visits regardless. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}
