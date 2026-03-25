// @ts-nocheck - NativeWind(className) 타입이 @types/react-native와 병합되지 않아 일시 비활성화
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="items-center justify-center flex-1">
        <Text className="text-2xl font-semibold">채팅</Text>
      </View>
    </SafeAreaView>
  );
}
