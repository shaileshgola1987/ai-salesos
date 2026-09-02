import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';

const ISSUER = 'AI SalesOS';
// Symmetric clock-drift tolerance of one 30s step each way — standard authenticator app
// leeway; without it a slightly-off device clock permanently locks a user out of 2FA.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export function buildTwoFactorOtpauthUri(
  accountEmail: string,
  secret: string,
): string {
  return generateURI({ issuer: ISSUER, label: accountEmail, secret });
}

export function buildTwoFactorQrCodeDataUrl(
  otpauthUri: string,
): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export async function verifyTwoFactorCode(
  code: string,
  secret: string,
): Promise<boolean> {
  const result = await verify({
    secret,
    token: code,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  });
  return result.valid;
}
