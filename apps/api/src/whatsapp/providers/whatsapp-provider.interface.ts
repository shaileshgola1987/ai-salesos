export type WhatsAppMediaType = 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';

export interface WhatsAppMedia {
  type: WhatsAppMediaType;
  /** A publicly reachable URL Meta can fetch the file from (link-based media send). */
  url: string;
}

export interface WhatsAppSendParams {
  /** The org's Meta WABA phone_number_id. Unused by the stub provider. */
  phoneNumberId: string | null;
  to: string;
  /** Text body, or the caption for a media message. */
  body?: string;
  media?: WhatsAppMedia;
}

export interface WhatsAppSendResult {
  externalId: string;
}

export interface WhatsAppDownloadResult {
  buffer: Buffer;
  mimeType: string;
}

export interface WhatsAppProvider {
  sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult>;

  /**
   * Fetches raw bytes for an inbound media message by the provider's media id.
   * Meta media URLs are short-lived and require an authenticated fetch, so callers
   * (see MediaController) proxy through this instead of storing/serving a public URL.
   */
  downloadMedia(mediaProviderId: string): Promise<WhatsAppDownloadResult>;
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
