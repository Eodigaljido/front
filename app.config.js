/**
 * Android 네이티브(expo-maps GoogleMaps.View): Maps SDK for Android 키
 * iOS·웹·Expo Go(WebView): Maps JavaScript API — EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY (또는 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
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
