import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

const MEDIA_TYPES = ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'] as const;
export type MediaTypeInput = (typeof MEDIA_TYPES)[number];

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string;

  /** If set, the template's body is sent and templateName is recorded on the message. */
  @IsOptional()
  @IsString()
  templateName?: string;

  /** A publicly reachable URL Meta (or the stub provider, for dev) sends as a link-based media message. */
  @ValidateIf((dto: SendMessageDto) => !!dto.mediaType)
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @ValidateIf((dto: SendMessageDto) => !!dto.mediaUrl)
  @IsIn(MEDIA_TYPES)
  mediaType?: MediaTypeInput;
}

export class SimulateInboundDto {
  @ValidateIf((dto: SimulateInboundDto) => !dto.mediaUrl)
  @IsString()
  @IsNotEmpty()
  body?: string;

  /** Dev-only: reference a plain URL directly, standing in for a downloaded provider media file. */
  @ValidateIf((dto: SimulateInboundDto) => !!dto.mediaType)
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @ValidateIf((dto: SimulateInboundDto) => !!dto.mediaUrl)
  @IsIn(MEDIA_TYPES)
  mediaType?: MediaTypeInput;
}
