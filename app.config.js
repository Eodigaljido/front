/**
 * Android 네이티브(expo-maps GoogleMaps.View): Maps SDK for Android 키
 * iOS·웹·Expo Go(WebView): Maps JavaScript API — EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
 * @see https://docs.expo.dev/versions/latest/sdk/maps/
 */
module.exports = ({ config }) => ({
  ...config,
  /** 빌드 시 .env의 TEST_LOGIN 또는 EXPO_PUBLIC_TEST_LOGIN → LoginScreen 자동 로그인 */
  extra: {
    ...(config.extra ?? {}),
    testLogin:
      String(process.env.TEST_LOGIN ?? process.env.EXPO_PUBLIC_TEST_LOGIN ?? '')
        .trim(),
  },
  plugins: [...(config.plugins ?? []), 'expo-secure-store'],
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() || '',
      },
    },
  },
});
