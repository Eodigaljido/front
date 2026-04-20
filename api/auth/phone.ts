import { authApi } from './client';

// ── SMS 인증번호 발송 ─────────────────────────────────────────

export interface SendPhoneCodeRequest {
  phone: string;
  purpose: 'REGISTER' | 'CHANGE_PHONE';
}

export interface SendPhoneCodeResponse {
  expiresInSeconds: number;
}

export async function sendPhoneCode(
  data: SendPhoneCodeRequest,
  accessToken?: string,
): Promise<SendPhoneCodeResponse> {
  const res = await authApi.post<SendPhoneCodeResponse>('auth/phone/code', data, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  return res.data;
}

// ── SMS 인증번호 검증 ─────────────────────────────────────────

export interface VerifyPhoneCodeRequest {
  phone: string;
  code: string;
  purpose: 'REGISTER' | 'CHANGE_PHONE';
}

export async function verifyPhoneCode(
  data: VerifyPhoneCodeRequest,
  accessToken?: string,
): Promise<void> {
  await authApi.post('auth/phone/verify', data, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}
