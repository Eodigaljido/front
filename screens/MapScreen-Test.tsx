// @ts-nocheck
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KakaoMapWebView from '../components/KakaoMapWebView';

export default function MapScreen(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="border-b border-gray-100 px-4 py-3">
        <Text className="text-lg font-bold text-gray-900">지도</Text>
        <Text className="mt-0.5 text-sm text-gray-500">Kakao Maps (WebView + JS API)</Text>
      </View>
      <View className="flex-1">
        <KakaoMapWebView
          latitude={37.5665}
          longitude={126.978}
          level={3}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}
