/**
 * 이 프론트에서 지도·경로가 쓰는 API (요약)
 *
 * | 용도 | 구현 | Google API / 서비스 |
 * |------|------|----------------------|
 * | 지도 타일·마커·WebView 지도 | `GoogleMapWebView.tsx` 로드 `maps/api/js` | **Maps JavaScript API** (`EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`) |
 * | Android 개발 빌드 네이티브 지도 | `AppMapView.native.tsx` → `expo-maps` GoogleMaps.View | **Maps SDK for Android** (앱 서명·패키지에 묶인 키, `app.json` 등) |
 * | 구간 경로(폴리라인)·시간 | `data/googleDirectionsApi.ts` → `directions/json` REST | **Google Directions API** (`getGoogleMapsWebServiceKey()`) |
 * | 경로 보조(자동차 도로) | `data/kakaoNaviDirectionsApi.ts` | **카카오 길찾기**(Google 실패 시; 도보·자전거도 폴리라인 확보용) |
 * | 장소 검색(루트 제작) | `data/kakaoLocalApi.ts` | **카카오 로컬(키워드)** REST |
 *
 * 지도는 “보여주기”, 경로는 “Directions가 계산”. 키·제한이 지도용/웹서비스용으로 나뉘어 있으면 둘 다 확인.
 */

/**
 * Google Maps JavaScript API (WebView / 웹 iframe)
 * Cloud Console에서 Maps JavaScript API 활성화 후 브라우저 키 사용 권장.
 */
export const GOOGLE_MAPS_JS_API_KEY =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
    ? String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY).trim()
    : '';

/**
 * Directions 등 Maps Web Services(REST)용 키.
 * 콘솔에서 키 제한이 "HTTP 리퍼러"만 있으면 RN fetch()에는 리퍼러가 없어 REQUEST_DENIED 가 날 수 있음.
 * 해당 키는 "앱 제한 없음" 또는 IP 제한(서버 프록시)을 검토.
 */
export function getGoogleMapsWebServiceKey(): string {
  if (typeof process === 'undefined') return '';
  const e = process.env;
  return (
    String(e?.EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY ?? '').trim() ||
    String(e?.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ?? '').trim()
  );
}
