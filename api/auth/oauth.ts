import { authApi, AuthResponse } from './client';

export interface OAuthResponse extends AuthResponse {
  isNewUser: boolean;
}

export interface KakaoOAuthRequest {
  code: string;
  redirectUri?: string;
}

export interface GoogleOAuthRequest {
  idToken: string;
}

export async function kakaoOAuth(data: KakaoOAuthRequest): Promise<OAuthResponse> {
  const res = await authApi.post<OAuthResponse>('auth/oauth/kakao', data);
  return res.data;
}

export async function googleOAuth(data: GoogleOAuthRequest): Promise<OAuthResponse> {
  const res = await authApi.post<OAuthResponse>('auth/oauth/google', data);
  return res.data;
}
