/**
 * Android 네이티브(expo-maps GoogleMaps.View): Maps SDK for Android 키
 * iOS·웹·Expo Go(WebView): Maps JavaScript API — EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY
 * @see https://docs.expo.dev/versions/latest/sdk/maps/
 */
module.exports = ({ config }) => ({
  ...config,
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
