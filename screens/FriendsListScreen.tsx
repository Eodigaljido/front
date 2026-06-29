// @ts-nocheck
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getFriends, deleteFriend, type Friends } from '../api/friend/friends';
import { appAlert } from '../utils/appAlert';

export default function FriendsListScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friends[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFriends();
      setFriends(data);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(f => f.nickname.toLowerCase().includes(q));
  }, [friends, keyword]);

  const handleRemove = useCallback((item: Friends) => {
    appAlert('친구 삭제', `${item.nickname} 님을 친구에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setRemoving(item.friendId);
          try {
            await deleteFriend(item.friendId);
            setFriends(prev => prev.filter(f => f.friendId !== item.friendId));
          } catch (e: any) {
            appAlert('오류', e?.response?.data?.message ?? e?.message ?? '삭제에 실패했습니다.');
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  }, []);

  const renderItem = ({ item }: { item: Friends }) => (
    <Pressable
      onPress={() =>
        navigation.navigate('UserProfile', {
          uuid: item.uuid,
          userUuid: item.uuid,
          nickname: item.nickname,
          profileImageUrl: item.profileImageUrl,
        })
      }
      className="flex-row items-center w-full px-4 py-4 active:opacity-70"
      style={{ borderBottomWidth: 0.5, borderBottomColor: 'rgba(37,99,235,0.08)' }}
    >
      {item.profileImageUrl && !item.isDefaultImage ? (
        <Image
          source={{ uri: item.profileImageUrl }}
          style={{ width: 46, height: 46, borderRadius: 23 }}
        />
      ) : (
        <View
          className="h-[46px] w-[46px] items-center justify-center rounded-full"
          style={{ backgroundColor: '#DBEAFE' }}
        >
          <Ionicons name="person" size={22} color="#2563EB" />
        </View>
      )}

      <View className="flex-1 ml-3">
        <Text className="text-[15px] font-semibold text-gray-900">{item.nickname}</Text>
      </View>

      <Pressable
        onPress={() => handleRemove(item)}
        disabled={removing === item.friendId}
        hitSlop={8}
        className="items-center justify-center w-9 h-9 rounded-full active:opacity-60 disabled:opacity-40"
      >
        {removing === item.friendId ? (
          <ActivityIndicator size="small" color="#9ca3af" />
        ) : (
          <Ionicons name="person-remove-outline" size={20} color="#9ca3af" />
        )}
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top']}>
      <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#F0F5FF] px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">친구 목록</Text>
        <Pressable
          onPress={() => navigation.navigate('FriendRequests')}
          className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1.5 active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="person-add-outline" size={14} color="#2563eb" />
          <Text className="text-xs font-semibold text-blue-600">친구 요청</Text>
        </Pressable>
      </View>

      {/* 검색 */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View
          className="flex-row items-center px-3 rounded-xl"
          style={{ backgroundColor: '#f9fafb', height: 44 }}
        >
          <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="닉네임 검색"
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, fontSize: 15, color: '#111827' }}
          />
          {keyword.length > 0 && (
            <Pressable onPress={() => setKeyword('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#cbd5e1" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.friendId)}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { backgroundColor: '#FFF' }}
        style={{ backgroundColor: '#F0F5FF' }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center flex-1">
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text className="mt-3 text-sm text-gray-400">
              {keyword ? '검색 결과가 없습니다.' : '아직 친구가 없습니다.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
