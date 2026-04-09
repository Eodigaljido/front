/**
 * Google Maps JavaScript API (WebView / 웹 iframe)
 * Cloud Console에서 Maps JavaScript API 활성화 후 브라우저 키 사용 권장.
 */
export const GOOGLE_MAPS_JS_API_KEY =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY
    ? String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY).trim()
    : typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      ? String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).trim()
      : typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
        ? String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY).trim()
        : '';
