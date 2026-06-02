/**
 * Android 네이티브(expo-maps GoogleMaps.View): Maps SDK for Android 키
 * iOS·웹·Expo Go(WebView): Maps JavaScript API — EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
 * @see https://docs.expo.dev/versions/latest/sdk/maps/
 */
const shareHost =
  (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '') || 'eodigaljido.uk';

module.exports = ({ config }) => ({
  ...config,
  scheme: 'eodigaljido',
  /** 빌드 시 .env의 TEST_LOGIN 또는 EXPO_PUBLIC_TEST_LOGIN → LoginScreen 자동 로그인 */
  extra: {
    ...(config.extra ?? {}),
    testLogin:
      String(process.env.TEST_LOGIN ?? process.env.EXPO_PUBLIC_TEST_LOGIN ?? '')
        .trim(),
    shareBaseUrl: String(process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '').trim(),
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  ios: {
    ...(config.ios ?? {}),
    associatedDomains: [`applinks:${shareHost}`],
  },
  android: {
    ...config.android,
    /** EAS production API가 http:// 이므로 릴리스 APK/AAB에서도 요청 허용 */
    usesCleartextTraffic: true,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: shareHost,
            pathPrefix: '/courses/public',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: shareHost,
            pathPrefix: '/friends/add',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: shareHost,
            pathPrefix: '/routes/collaborative',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() || '',
      },
    },
  },
});
