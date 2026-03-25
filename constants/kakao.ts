export const KAKAO_MAP_JS_KEY =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_KAKAO_MAP_JS_KEY
    ? String(process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY).trim()
    : '';

