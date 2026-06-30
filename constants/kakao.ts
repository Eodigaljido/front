export const KAKAO_MAP_JS_KEY =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_KAKAO_MAP_JS_KEY
    ? String(process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY).trim()
    : '';

/** 카카오 로그인 OAuth client_id (REST API 키) */
export function getKakaoOAuthRestApiKey(): string {
  return String(
    process.env.EXPO_PUBLIC_KAKAO_OAUTH_REST_API_KEY ??
      process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ??
      '',
  ).trim();
}

/** 카카오 로컬·길찾기 REST API 키 (장소 검색) */
export function getKakaoLocalRestApiKey(): string {
  return String(
    process.env.EXPO_PUBLIC_KAKAO_LOCAL_REST_API_KEY ??
      process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ??
      '',
  ).trim();
}

/** @deprecated getKakaoLocalRestApiKey 또는 getKakaoOAuthRestApiKey 사용 */
export function getKakaoRestApiKey(): string {
  return getKakaoLocalRestApiKey();
}

/** 카카오 장소 검색 실패 시 Google Places 폴백 (기본: 꺼짐, 카카오 우선) */
export function isPlaceSearchGoogleFallbackEnabled(): boolean {
  return (
    String(process.env.EXPO_PUBLIC_PLACE_SEARCH_GOOGLE_FALLBACK ?? '0').trim() ===
    '1'
  );
}
