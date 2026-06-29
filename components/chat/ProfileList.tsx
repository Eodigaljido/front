import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getFriends } from '@/api/friend/index';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import React from 'react';
import { UserPlus } from 'lucide-react-native';
import { rootNavigate } from '@/navigation/rootNavigation';
import { useFocusEffect } from '@react-navigation/native';

export interface FriendListItem {
  friendId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

export const ProfileList = ({ size = 60 }: { size?: number }) => {
  const [friends, setFriends] = useState<Awaited<ReturnType<typeof getFriends>>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const accessToken = useAuthStore(s => s.accessToken);

  const loadFriends = React.useCallback(() => {
    if (!accessToken) return;
    setIsLoading(true);
    getFriends(accessToken)
      .then(setFriends)
      .catch(err => {
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        console.error('친구 목록 불러오기 실패:', message);
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useFocusEffect(
    React.useCallback(() => {
      loadFriends();
    }, [loadFriends])
  );

  if (isLoading) {
    return (
      <View style={{ paddingLeft: 16, paddingVertical: 20 }}>
        <ActivityIndicator size="small" color="#9CA3AF" />
      </View>
    );
  }

  const list = Array.isArray(friends) ? friends : [];

  if (list.length === 0) {
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginTop: 8,
          borderRadius: 16,
          backgroundColor: '#F9FAFB',
          borderWidth: 1.5,
          borderColor: '#E5E7EB',
          borderStyle: 'dashed',
          paddingVertical: 22,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#EFF6FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserPlus color="#3B82F6" size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 }}>
            아직 친구가 없어요
          </Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 18 }}>
            친구를 추가하면 여기서 빠르게 확인할 수 있어요
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        alignItems: 'flex-start',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <View className="flex-row" style={{ gap: 20 }}>
        {list.map(friend => (
          <TouchableOpacity
            key={friend.friendId}
            className="items-center"
            activeOpacity={0.7}
            onPress={() => rootNavigate('UserProfile', { uuid: friend.uuid })}
          >
            <Image
              source={{
                uri: friend.profileImageUrl,
              }}
              className="mt-5 bg-gray-200 rounded-full"
              style={{ width: size, height: size }}
            />
            <Text className="mt-3 text-sm font-semibold text-gray-700">{friend.nickname}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};
