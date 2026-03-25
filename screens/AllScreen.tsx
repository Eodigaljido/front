// @ts-nocheck
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AllScreen(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="items-center justify-center flex-1">
        <Text className="text-2xl font-semibold">전체</Text>
      </View>
    </SafeAreaView>
  );
}
