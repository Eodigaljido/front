import { authApi, AuthResponse } from './client';

// 로그인
export interface LoginRequest {
  identifier: string;
  password: string;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await authApi.post<AuthResponse>('auth/login', data);
  return res.data;
}

// 회원가입
export interface RegisterRequest {
  userId: string;
  email: string;
  password: string;
  nickname: string;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await authApi.post<AuthResponse>('auth/register', data);
  return res.data;
}
