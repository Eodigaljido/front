import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  googleIdTokenAudienceMismatchHint,
  resolveGoogleWebClientId,
} from './googleOAuthClientIds';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: resolveGoogleWebClientId(),
    offlineAccess: false,
  });
  configured = true;
}

export type GoogleSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'error'; message?: string };

export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'unavailable',
      message: '웹에서는 구글 로그인을 지원하지 않습니다.',
    };
  }

  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, reason: 'cancelled' };
    }

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      return {
        ok: false,
        reason: 'error',
        message: 'Google ID Token을 받지 못했습니다. Google Console webClientId를 확인해 주세요.',
      };
    }

    const audienceHint = googleIdTokenAudienceMismatchHint(idToken);
    if (audienceHint && __DEV__) {
      console.warn('[Google Sign-In]', audienceHint);
    }

    return { ok: true, idToken };
  } catch (err: unknown) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, reason: 'cancelled' };
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          reason: 'unavailable',
          message: 'Google Play 서비스를 사용할 수 없습니다.',
        };
      }
      if (err.code === '10' || String(err.message ?? '').includes('DEVELOPER_ERROR')) {
        return {
          ok: false,
          reason: 'error',
          message:
            'Google Console에 com.eodigaljido.app + EAS SHA-1 이 등록됐는지 확인해 주세요.',
        };
      }
    }
    console.warn('Google Sign-In failed', err);
    return {
      ok: false,
      reason: 'error',
      message: '구글 로그인에 실패했습니다. 다시 시도해 주세요.',
    };
  }
}

export function formatGoogleOAuthBackendError(
  backendMessage: string | undefined,
  idToken?: string,
): string {
  if (backendMessage?.includes('유효하지 않은 Google ID 토큰')) {
    const hint = idToken ? googleIdTokenAudienceMismatchHint(idToken) : null;
    return (
      hint ??
      '백엔드가 Android 클라이언트 ID로 토큰을 검증 중일 수 있습니다. ' +
        '서버 google.oauth.client-id 를 웹 클라이언트 ID로 변경해 달라고 백엔드에 요청해 주세요.'
    );
  }
  return backendMessage ?? '소셜 로그인에 실패했습니다. 다시 시도해주세요.';
}
