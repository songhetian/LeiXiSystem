import { createHmac, timingSafeEqual } from 'crypto';

export interface PreviewTokenPayload {
  fileUrl: string;
  fileName: string;
  exp: number;
}

export interface SignResult {
  token: string;
  previewUrl: string;
  expiresAt: number;
}

export interface VerifyResult {
  valid: boolean;
  payload?: PreviewTokenPayload;
  error?: 'expired' | 'invalid';
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signPreviewUrl(params: {
  fileUrl: string;
  fileName: string;
  secret: string;
  expiresIn: number;
  kkFileViewBaseUrl?: string;
}): SignResult {
  const { fileUrl, fileName, secret, expiresIn, kkFileViewBaseUrl = '/preview' } = params;
  const exp = Math.floor(Date.now() / 1000) + expiresIn;

  const payload: PreviewTokenPayload = { fileUrl, fileName, exp };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadStr, secret);
  const token = `${payloadStr}.${signature}`;

  const encodedFileUrl = encodeURIComponent(fileUrl);
  const previewUrl = `${kkFileViewBaseUrl}/onlinePreview?url=${encodeURIComponent(encodedFileUrl)}&token=${token}`;

  return { token, previewUrl, expiresAt: exp * 1000 };
}

export function verifyPreviewToken(token: string, secret: string): VerifyResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'invalid' };
    }

    const [payloadStr, signature] = parts;
    const expectedSignature = sign(payloadStr, secret);

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'invalid' };
    }

    const payload: PreviewTokenPayload = JSON.parse(base64UrlDecode(payloadStr));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'invalid' };
  }
}
