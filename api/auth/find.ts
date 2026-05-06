import { authApi } from './client';

// 아이디 찾기

export interface SendFindIdCodeRequest {
  phone: string;
}

export async function sendFindIdCode(
  data: SendFindIdCodeRequest,
): Promise<{ expiresInSeconds: number }> {
  const res = await authApi.post<{ expiresInSeconds: number }>('auth/find-id/send-code', data);
  return res.data;
}

export interface VerifyFindIdCodeRequest {
  phone: string;
  code: string;
}

export interface FindIdResult {
  userId: string;
  email: string;
}

export async function verifyFindIdCode(data: VerifyFindIdCodeRequest): Promise<FindIdResult> {
  const res = await authApi.post<FindIdResult>('auth/find-id/verify', data);
  return res.data;
}

// 비밀번호 재설정

export interface SendResetPasswordCodeRequest {
  identifier: string;
}

export async function sendResetPasswordCode(
  data: SendResetPasswordCodeRequest,
): Promise<{ expiresInSeconds: number }> {
  const res = await authApi.post<{ expiresInSeconds: number }>(
    'auth/reset-password/send-code',
    data,
  );
  return res.data;
}

export interface VerifyResetPasswordCodeRequest {
  identifier: string;
  code: string;
}

export async function verifyResetPasswordCode(
  data: VerifyResetPasswordCodeRequest,
): Promise<void> {
  await authApi.post('auth/reset-password/verify-code', data);
}

export interface ResetPasswordRequest {
  identifier: string;
  code: string;
  newPassword: string;
}

export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  await authApi.post('auth/reset-password/reset', data);
}
