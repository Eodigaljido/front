/**
 * Android Google Maps는 네이티브 빌드 시 API 키가 필요합니다.
 * .env: EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY (또는 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
 * @see https://docs.expo.dev/versions/latest/sdk/maps/
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
          '',
      },
    },
  },
});
