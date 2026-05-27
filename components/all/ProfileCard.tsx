import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileAvatar from '../ProfileAvatar';

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
  friendCount: number;
  onAddFriend: () => void;
  onProfileSettings: () => void;
};

export default function ProfileCard({
  nickname,
  email,
  avatarUri,
  friendCount,
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
          <ProfileAvatar uri={avatarUri} size={56} />
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
            <Ionicons name="people-outline" size={15} color="#2563EB" />
            <Text className="ml-2 text-[15px] font-bold text-gray-900">함께하는 친구</Text>
            <Text className="ml-2 text-[15px] font-bold text-blue-600">{friendCount}명</Text>
          </View>
          <Pressable onPress={onAddFriend} className="active:opacity-80">
            <Text className="text-sm font-semibold text-blue-600">+ 친구 추가하기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
