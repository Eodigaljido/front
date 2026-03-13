import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyRouteScreen(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-semibold">내 루트</Text>
      </View>
    </SafeAreaView>
  );
}
