/** Google Cloud Console OAuth 클라이언트 (동일 프로젝트 658554777625) */

/** Android Sign-In `webClientId` — idToken `aud` 값 (웹 애플리케이션 타입) */
export const GOOGLE_OAUTH_WEB_CLIENT_ID =
  '658554777625-ssds5atn1lpo91sccghm3ph8dvipqhtj.apps.googleusercontent.com';

/** Android 앱 OAuth 클라이언트 — Console SHA-1·패키지 등록용 (idToken aud 아님) */
export const GOOGLE_OAUTH_ANDROID_CLIENT_ID =
  '658554777625-s9u6c5ou7jecu6kt8qg9208c31t14o76.apps.googleusercontent.com';

export function resolveGoogleWebClientId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (fromEnv && !fromEnv.includes('s9u6c5ou7jecu6kt8qg9208c31t14o76')) {
    return fromEnv;
  }
  return GOOGLE_OAUTH_WEB_CLIENT_ID;
}

export function decodeGoogleIdTokenAud(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1];
    if (!payload || typeof atob !== 'function') return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json) as { aud?: string };
    return typeof data.aud === 'string' ? data.aud : null;
  } catch {
    return null;
  }
}

export function googleIdTokenAudienceMismatchHint(idToken: string): string | null {
  const aud = decodeGoogleIdTokenAud(idToken);
  if (!aud || aud === GOOGLE_OAUTH_WEB_CLIENT_ID) return null;
  return (
    `토큰 audience(${aud.slice(0, 20)}…)와 백엔드 검증용 클라이언트 ID가 다를 수 있습니다. ` +
    `백엔드 google.oauth.client-id 를 웹 클라이언트 ID(${GOOGLE_OAUTH_WEB_CLIENT_ID})로 맞춰 주세요.`
  );
}
