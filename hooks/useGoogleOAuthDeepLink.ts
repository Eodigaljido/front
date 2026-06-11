import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  GOOGLE_OAUTH_APP_DEEP_LINK_URI,
  GOOGLE_OAUTH_REDIRECT_URI,
} from '../utils/googleOAuthConfig';
import { consumeGoogleOAuthCode } from '../utils/googleOAuthSessionGate';
import { oauthRedirectMatches, parseOAuthCodeFromUrl } from '../utils/oauthRedirect';

function isGoogleOAuthCallback(url: string): boolean {
  return (
    oauthRedirectMatches(url, GOOGLE_OAUTH_REDIRECT_URI) ||
    oauthRedirectMatches(url, GOOGLE_OAUTH_APP_DEEP_LINK_URI)
  );
}

/** HTTPS 브릿지 → eodigaljido:// 딥링크 로 code 수신 (보조 경로) */
export function useGoogleOAuthDeepLink(onCode: (code: string) => void | Promise<void>) {
  const busy = useRef(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    async function handle(url: string | null) {
      if (!url || busy.current) return;
      if (!isGoogleOAuthCallback(url)) return;
      const code = parseOAuthCodeFromUrl(url);
      if (!code || !consumeGoogleOAuthCode(code)) return;

      busy.current = true;
      void WebBrowser.dismissBrowser();
      try {
        await onCodeRef.current(code);
      } finally {
        busy.current = false;
      }
    }

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => sub.remove();
  }, []);
}
