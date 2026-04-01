// @ts-nocheck
import React from 'react';
import { View, Text, Pressable, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import type { RootTabParamList } from '../App';

type MenuItem = {
  id: string;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  onPress: () => void;
};

export default function AllScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();

  const routeMenus: MenuItem[] = [
    {
      id: 'make-route',
      title: '루트 제작하기',
      icon: 'create-outline',
      iconColor: '#2563eb',
      iconBg: '#dbeafe',
      onPress: () => navigation.navigate('MyRoute' as keyof RootTabParamList),
    },
    {
      id: 'share-route',
      title: '루트 공유하기',
      icon: 'paper-plane-outline',
      iconColor: '#ea580c',
      iconBg: '#ffedd5',
      onPress: () => navigation.navigate('SharedRoute' as keyof RootTabParamList),
    },
    {
      id: 'saved-route',
      title: '저장된 루트',
      icon: 'bookmark-outline',
      iconColor: '#16a34a',
      iconBg: '#dcfce7',
      onPress: () => navigation.navigate('MyRoute' as keyof RootTabParamList),
    },
    {
      id: 'near-popular',
      title: '내 근처 인기 루트',
      icon: 'location-outline',
      iconColor: '#9ca3af',
      iconBg: '#f3f4f6',
      onPress: () => navigation.navigate('SharedRoute' as keyof RootTabParamList, { openAsPopular: true }),
    },
  ];

  const settingMenus: MenuItem[] = [
    {
      id: 'app-setting',
      title: '앱 설정',
      icon: 'settings-outline',
      iconColor: '#60a5fa',
      iconBg: '#dbeafe',
      onPress: () => Alert.alert('준비 중', '앱 설정 기능은 곧 제공됩니다.'),
    },
    {
      id: 'help',
      title: '도움말',
      icon: 'help-circle-outline',
      iconColor: '#4b5563',
      iconBg: '#eef2ff',
      onPress: () => Alert.alert('도움말', '문의가 필요하면 고객센터로 연락해주세요.'),
    },
    {
      id: 'alarm',
      title: '알림 설정',
      icon: 'notifications-outline',
      iconColor: '#6b7280',
      iconBg: '#e5e7eb',
      onPress: () => Alert.alert('준비 중', '알림 설정 기능은 곧 제공됩니다.'),
    },
  ];

  const renderMenuSection = (items: MenuItem[]) => (
    <View className="px-4 py-2 mt-4 bg-white border border-gray-200 rounded-2xl">
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          onPress={item.onPress}
          className="flex-row items-center py-4 active:opacity-80"
          style={index !== items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' } : undefined}
        >
          <View
            className="items-center justify-center w-6 h-6 mr-3 rounded-md"
            style={{ backgroundColor: item.iconBg }}
          >
            <Ionicons name={item.icon} size={14} color={item.iconColor} />
          </View>
          <Text className="flex-1 text-base font-semibold text-gray-900">{item.title}</Text>
          <Feather name="chevron-right" size={16} color="#d1d5db" />
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#f5f5f9]" edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 120, marginTop: 80 }}>
        <View className="px-4 py-4 bg-white border border-gray-200 rounded-2xl">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center">
              <Image
                source={{ uri: 'https://i.pravatar.cc/100?img=5' }}
                className="rounded-full h-14 w-14"
              />
              <View className="ml-3">
                <Text className="text-lg font-bold text-gray-900">juyung</Text>
                <Text className="mt-0.5 text-sm text-gray-500">btm.email2769@gmail.com</Text>
              </View>
            </View>
            <Pressable
              onPress={() => navigation.navigate('ProfileSettings')}
              className="flex-row items-center active:opacity-80"
            >
              <Ionicons name="settings-outline" size={14} color="#111827" />
              <Text className="ml-1 text-xs font-medium text-gray-900">프로필 설정</Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between mt-4">
            <Text className="text-[17px] font-bold text-gray-900">공유한 루트 : 27개</Text>
            <Pressable onPress={() => Alert.alert('친구 추가', '친구 추가 기능을 준비 중입니다.')} className="active:opacity-80">
              <Text className="text-sm font-semibold text-blue-600">+ 친구 추가하기</Text>
            </Pressable>
          </View>
        </View>

        {renderMenuSection(routeMenus)}
        {renderMenuSection(settingMenus)}
      </ScrollView>
    </SafeAreaView>
  );
}