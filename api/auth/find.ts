import { authApi } from './client';

// 아이디 찾기

export interface SendFindIdCodeRequest {
  phone: string;
}

export async function sendFindIdCode(data: SendFindIdCodeRequest): Promise<void> {
  await authApi.post('auth/find-account/send', data);
}

export interface VerifyFindIdCodeRequest {
  phone: string;
  code: string;
}

export interface FindIdResult {
  userId: string;
  email: string;
  emailLinked: boolean;
}

export async function verifyFindIdCode(data: VerifyFindIdCodeRequest): Promise<FindIdResult> {
  const res = await authApi.post<FindIdResult>('auth/find-account/verify', data);
  return res.data;
}

// 비밀번호 재설정

export interface SendResetPasswordCodeRequest {
  identifier: string;
  phone: string;
}

export async function sendResetPasswordCode(
  data: SendResetPasswordCodeRequest,
): Promise<void> {
  await authApi.post('auth/reset-password/send', data);
}

export interface ResetPasswordRequest {
  phone: string;
  code: string;
  newPassword: string;
}

export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  await authApi.post('auth/reset-password/verify', data);
}
