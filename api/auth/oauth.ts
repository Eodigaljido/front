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

// ── 소셜 계정 연동/해제 (LOCAL 가입 계정에 소셜 로그인 추가) ──────────

export interface KakaoLinkRequest {
  /** 카카오 인가 코드 (webview redirect 에서 추출) */
  code: string;
  /** 인가 코드 발급 시 사용한 redirect_uri (생략 시 서버 설정값) */
  redirectUri?: string;
}

/** POST /auth/oauth/kakao/link — 카카오 계정 연동 (204) */
export async function linkKakao(data: KakaoLinkRequest): Promise<void> {
  await authApi.post('auth/oauth/kakao/link', data);
}

/** DELETE /auth/oauth/kakao/link — 카카오 연동 해제 (204) */
export async function unlinkKakao(): Promise<void> {
  await authApi.delete('auth/oauth/kakao/link');
}

export interface GoogleLinkRequest {
  /** Android Google Sign-In SDK 에서 발급받은 ID Token */
  idToken: string;
}

/** POST /auth/oauth/google/link — 구글 계정 연동 (204) */
export async function linkGoogle(data: GoogleLinkRequest): Promise<void> {
  await authApi.post('auth/oauth/google/link', data);
}

/** DELETE /auth/oauth/google/link — 구글 연동 해제 (204) */
export async function unlinkGoogle(): Promise<void> {
  await authApi.delete('auth/oauth/google/link');
}
