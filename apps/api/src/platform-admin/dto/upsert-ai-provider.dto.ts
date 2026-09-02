import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertAiProviderDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  /** Overrides the provider's default model (see e.g. ANTHROPIC_DEFAULT_MODEL). */
  @IsOptional()
  @IsString()
  model?: string;
}
