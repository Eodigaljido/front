// @ts-nocheck
import React from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MOCK_CHAT_ROOMS } from '../data/mockData';

const CARD_STYLE = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginHorizontal: 16,
  marginBottom: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
  elevation: 2,
};

export default function ChatScreen(): React.JSX.Element {
  if (MOCK_CHAT_ROOMS.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="items-center justify-center flex-1 px-8">
          <View className="p-6 bg-gray-100 rounded-full">
            <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
            채팅이 없습니다
          </Text>
          <Text className="mt-2 text-sm text-center text-gray-500">
            코스를 공유하고 대화를 나눠 보세요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <FlatList
        data={MOCK_CHAT_ROOMS}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Pressable style={CARD_STYLE}>
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-gray-900">{item.name}</Text>
              {item.unread > 0 && (
                <View className="rounded-full bg-blue-500 px-2 py-0.5">
                  <Text className="text-xs font-medium text-white">{item.unread}</Text>
                </View>
              )}
            </View>
            <Text className="mt-1 text-sm text-gray-500" numberOfLines={1}>
              {item.lastMessage}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-400">{item.time}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
