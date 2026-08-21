export interface WhatsAppSendParams {
  /** The org's Meta WABA phone_number_id. Unused by the stub provider. */
  phoneNumberId: string | null;
  to: string;
  body: string;
}

export interface WhatsAppSendResult {
  externalId: string;
}

export interface WhatsAppProvider {
  sendMessage(params: WhatsAppSendParams): Promise<WhatsAppSendResult>;
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
