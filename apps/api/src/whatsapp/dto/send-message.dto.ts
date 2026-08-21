import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string;

  /** If set, the template's body is sent and templateName is recorded on the message. */
  @IsOptional()
  @IsString()
  templateName?: string;
}

export class SimulateInboundDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
