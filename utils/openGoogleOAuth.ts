import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_OAUTH_APP_DEEP_LINK_URI } from './googleOAuthConfig';
import {
  oauthRedirectMatches,
  parseOAuthCodeFromUrl,
  parseOAuthErrorFromUrl,
} from './oauthRedirect';

WebBrowser.maybeCompleteAuthSession();

export type GoogleOAuthOpenResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'cancelled' | 'config' | 'error' | 'awaiting_deep_link'; message?: string };

/**
 * Google OAuth — Custom Tab / ASWebAuthenticationSession.
 * redirect https URL 의 ?code= 를 앱이 직접 수신 (웹 브릿지·eodigaljido:// 불필요).
 */
export async function openGoogleOAuthSession(
  authUrl: string,
  redirectUri: string,
): Promise<GoogleOAuthOpenResult> {
  const redirect = String(redirectUri ?? '').trim();
  if (!redirect || !String(authUrl ?? '').trim()) {
    return { ok: false, reason: 'config', message: '구글 로그인 설정이 없습니다.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect, {
    ...(Platform.OS === 'android' ? { createTask: false, showInRecents: false } : {}),
    ...(Platform.OS === 'ios' ? { preferEphemeralSession: true } : {}),
  });

  if (result.type === 'cancel') {
    return { ok: false, reason: 'cancelled' };
  }

  if (result.type === 'success' && result.url) {
    const parsed = parseGoogleOAuthCallback(result.url, redirect);
    if (parsed.ok) {
      void WebBrowser.dismissBrowser();
      return parsed;
    }
    if (parsed.reason === 'error') {
      return parsed;
    }
  }

  if (result.type === 'dismiss' || result.type === 'success') {
    void WebBrowser.dismissBrowser();
    return { ok: false, reason: 'awaiting_deep_link' };
  }

  return { ok: false, reason: 'error', message: '구글 로그인을 완료하지 못했습니다.' };
}

function parseGoogleOAuthCallback(
  url: string,
  redirect: string,
):
  | { ok: true; code: string }
  | { ok: false; reason: 'error'; message: string }
  | { ok: false; reason: 'awaiting_deep_link' } {
  const matchesRedirect =
    oauthRedirectMatches(url, redirect) ||
    oauthRedirectMatches(url, GOOGLE_OAUTH_APP_DEEP_LINK_URI);

  if (!matchesRedirect) {
    return { ok: false, reason: 'awaiting_deep_link' };
  }

  const oauthError = parseOAuthErrorFromUrl(url);
  if (oauthError) {
    const hint =
      oauthError === 'redirect_uri_mismatch'
        ? ' Google Console에 리디렉션 URI가 등록됐는지 확인해 주세요.'
        : '';
    return {
      ok: false,
      reason: 'error',
      message: `구글 로그인 오류: ${oauthError}.${hint}`,
    };
  }

  const code = parseOAuthCodeFromUrl(url);
  if (!code) {
    return { ok: false, reason: 'awaiting_deep_link' };
  }

  return { ok: true, code };
}
