/** 구글 OAuth code 중복 처리 방지 (openAuthSession + 딥링크 동시 수신) */
const consumedCodes = new Set<string>();

export function consumeGoogleOAuthCode(code: string): boolean {
  const key = String(code ?? '').trim();
  if (!key || consumedCodes.has(key)) return false;
  consumedCodes.add(key);
  return true;
}

export function resetGoogleOAuthCodeGate(): void {
  consumedCodes.clear();
}
