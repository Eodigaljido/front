import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: 'rgba(37,99,235,0.12)',
  borderRadius: 16,
  backgroundColor: '#fff',
};

type Props = {
  nickname?: string;
  email?: string;
  avatarUri?: string;
  sharedRouteCount: number;
  onAddFriend: () => void;
  onProfileSettings: () => void;
};

export default function ProfileCard({
  nickname,
  email,
  avatarUri,
  sharedRouteCount,
  onAddFriend,
  onProfileSettings,
}: Props) {
  return (
    <View style={CARD_STYLE}>
      <View className="px-4 py-4">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={onProfileSettings}
          activeOpacity={0.5}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <View
              className="items-center justify-center rounded-full h-14 w-14"
              style={{ backgroundColor: '#DBEAFE' }}
            >
              <Ionicons name="person" size={28} color="#2563EB" />
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-[17px] font-bold text-gray-900">{nickname || '닉네임'}</Text>
            <Text className="mt-0.5 text-sm text-gray-500">{email || ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <View
          className="flex-row items-center justify-between pt-4 mt-4"
          style={{ borderTopWidth: 0.5, borderTopColor: 'rgba(37,99,235,0.08)' }}
        >
          <View className="flex-row items-center">
            <Ionicons name="paper-plane-outline" size={15} color="#2563EB" />
            <Text className="ml-2 text-[15px] font-bold text-gray-900">공유한 루트</Text>
            <Text className="ml-2 text-[15px] font-bold text-blue-600">{sharedRouteCount}개</Text>
          </View>
          <Pressable onPress={onAddFriend} className="active:opacity-80">
            <Text className="text-sm font-semibold text-blue-600">+ 친구 추가하기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
