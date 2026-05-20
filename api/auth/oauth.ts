import { authApi, AuthResponse } from './client';

export interface OAuthResponse extends AuthResponse {
  isNewUser: boolean;
}

export interface OAuthRequest {
  code: string;
  redirectUri?: string;
}

export async function kakaoOAuth(data: OAuthRequest): Promise<OAuthResponse> {
  const res = await authApi.post<OAuthResponse>('auth/oauth/kakao', data);
  return res.data;
}

export async function googleOAuth(data: OAuthRequest): Promise<OAuthResponse> {
  const res = await authApi.post<OAuthResponse>('auth/oauth/google', data);
  return res.data;
}
