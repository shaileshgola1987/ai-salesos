import { IsEnum, ValidateIf } from 'class-validator';
import { AiProviderName } from '@prisma/client';

export class SetActiveProviderDto {
  /** null reverts every organization to the deterministic rule-based stub. */
  @ValidateIf((dto: SetActiveProviderDto) => dto.provider !== null)
  @IsEnum(AiProviderName)
  provider: AiProviderName | null;
}
