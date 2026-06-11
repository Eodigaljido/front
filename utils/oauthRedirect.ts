/** OAuth redirect URL에 code가 있는지 (빈 redirectUri는 절대 매칭하지 않음) */
export function oauthRedirectMatches(url: string, redirectUri: string): boolean {
  const redirect = String(redirectUri ?? '').trim();
  if (!redirect) return false;

  // eodigaljido://oauth/google — URL 파서가 host를 잘못 나누므로 prefix로 비교
  if (!redirect.startsWith('http://') && !redirect.startsWith('https://')) {
    const base = redirect.split('?')[0];
    const current = String(url).split('?')[0];
    return current === base || current.startsWith(`${base}/`);
  }

  try {
    const target = new URL(redirect);
    const current = new URL(url);
    if (current.origin !== target.origin) return false;
    const path = target.pathname.replace(/\/$/, '') || '/';
    const currentPath = current.pathname.replace(/\/$/, '') || '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  } catch {
    return url.startsWith(redirect);
  }
}

export function parseOAuthCodeFromUrl(url: string): string | null {
  const match = String(url).match(/[?&]code=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseOAuthErrorFromUrl(url: string): string | null {
  const match = String(url).match(/[?&]error=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
