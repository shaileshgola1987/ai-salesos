import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class AssignLeadDto {
  /** Pass a userId to assign, or null to unassign. */
  @ValidateIf((o: AssignLeadDto) => o.assignedToId !== null)
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
