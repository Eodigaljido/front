import { APP_SCHEME, SHARE_LINK_HOST } from '../constants/shareLinking';

/**
 * Google OAuth — expo-web-browser + authorization code flow.
 *
 * redirect 는 Google **웹** 클라이언트에 등록된 https:// URL 이어야 함.
 * `/auth/oauth/google` 은 POST 전용 API 이라 GET redirect 시 405 → 앱 OAuth 에 쓰면 안 됨.
 */
const ENV_GOOGLE_OAUTH_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '';

export const GOOGLE_OAUTH_WEB_CLIENT_ID =
  '658554777625-ssds5atn1lpo91sccghm3ph8dvipqhtj.apps.googleusercontent.com';

export const GOOGLE_OAUTH_CLIENT_ID = (() => {
  const fromEnv = ENV_GOOGLE_OAUTH_CLIENT_ID.trim();
  if (fromEnv && !fromEnv.includes('s9u6c5ou7jecu6kt8qg9208c31t14o76')) {
    return fromEnv;
  }
  return GOOGLE_OAUTH_WEB_CLIENT_ID;
})();

/** POST 전용 — Google redirect URI 로 쓰면 GET 405 */
export const GOOGLE_OAUTH_API_REDIRECT_URI =
  'https://api.eodigaljido.uk/auth/oauth/google';

/** 앱 OAuth redirect (GET 200, share-web → eodigaljido:// 브릿지) */
export const GOOGLE_OAUTH_SHARE_WEB_REDIRECT_URI = `https://${SHARE_LINK_HOST}/oauth/google`;

export const GOOGLE_OAUTH_APP_DEEP_LINK_URI = `${APP_SCHEME}://oauth/google`;

const NON_APP_GOOGLE_REDIRECT_URIS = new Set([
  GOOGLE_OAUTH_API_REDIRECT_URI,
  'https://api.eodigaljido.uk/test.html',
  'https://eodigaljido.uk/test.html',
]);

function resolveGoogleRedirectUri(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (fromEnv?.startsWith(`${APP_SCHEME}://`)) {
    return GOOGLE_OAUTH_SHARE_WEB_REDIRECT_URI;
  }
  if (fromEnv && !NON_APP_GOOGLE_REDIRECT_URIS.has(fromEnv.replace(/\/$/, ''))) {
    return fromEnv;
  }
  return GOOGLE_OAUTH_SHARE_WEB_REDIRECT_URI;
}

export const GOOGLE_OAUTH_REDIRECT_URI = resolveGoogleRedirectUri();

export function buildGoogleAuthUrl(): string {
  const clientId = GOOGLE_OAUTH_CLIENT_ID.trim();
  const redirectUri = GOOGLE_OAUTH_REDIRECT_URI.trim();
  return (
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('email profile')}` +
    `&prompt=select_account`
  );
}
