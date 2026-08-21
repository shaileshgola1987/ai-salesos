import { IsNotEmpty, IsString } from 'class-validator';

export class MoveLeadDto {
  @IsString()
  @IsNotEmpty()
  pipelineStageId: string;
}
