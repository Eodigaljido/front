// @ts-nocheck
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../App';

type AllScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Tabs'>;

export default function AllScreen(): React.JSX.Element {
  const navigation = useNavigation<AllScreenNavigationProp>();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="items-center justify-center flex-1">
        <Text className="mb-4 text-2xl font-semibold">전체</Text>
        <TouchableOpacity
          className="px-6 py-3 bg-blue-500 rounded"
          onPress={() => navigation.navigate('OnBoardStart')}
        >
          <Text className="font-bold text-white">온보드 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
