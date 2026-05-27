// @ts-nocheck
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getFriendRequests,
  respondToFriendRequest,
  type FriendRequest,
} from '../api/friend/friends';
import ResultModal from '../components/ResultModal';

type ModalState = { visible: boolean; type: 'success' | 'error'; title: string; message: string };
const HIDDEN_MODAL: ModalState = { visible: false, type: 'success', title: '', message: '' };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function FriendRequestsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState<number | null>(null);
  const [tab, setTab] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [modal, setModal] = useState<ModalState>(HIDDEN_MODAL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFriendRequests();
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRespond = useCallback(
    async (requestId: number, accept: boolean) => {
      if (responding != null) return;
      setResponding(requestId);
      try {
        await respondToFriendRequest(requestId, accept);
        setRequests(prev => prev.filter(r => r.requestId !== requestId));
        if (accept) {
          setModal({ visible: true, type: 'success', title: '친구 추가 완료', message: '친구 요청을 수락했습니다.' });
        }
      } catch (e: any) {
        setModal({ visible: true, type: 'error', title: '오류', message: e?.response?.data?.message ?? e?.message ?? '처리에 실패했습니다.' });
      } finally {
        setResponding(null);
      }
    },
    [responding],
  );

  const filtered = requests.filter(r => r.direction === tab);

  const receivedCount = requests.filter(r => r.direction === 'RECEIVED').length;

  const renderItem = ({ item }: { item: FriendRequest }) => (
    <View
      className="flex-row items-center w-full px-4 py-4"
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
        <Text className="mt-0.5 text-xs text-gray-400">{timeAgo(item.createdAt)}</Text>
      </View>

      {item.direction === 'RECEIVED' ? (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleRespond(item.requestId, false)}
            disabled={responding === item.requestId}
            className="items-center justify-center px-4 py-2 border border-gray-200 rounded-xl active:opacity-70 disabled:opacity-40"
          >
            <Text className="text-sm font-semibold text-gray-500">거절</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRespond(item.requestId, true)}
            disabled={responding === item.requestId}
            className="items-center justify-center px-4 py-2 rounded-xl active:opacity-70 disabled:opacity-40"
            style={{ backgroundColor: '#2563eb' }}
          >
            {responding === item.requestId ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-semibold text-white">수락</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View className="rounded-xl bg-gray-100 px-3 py-1.5">
          <Text className="text-xs font-semibold text-gray-500">대기 중</Text>
        </View>
      )}
    </View>
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
        <Text className="flex-1 text-lg font-bold text-gray-900">친구 요청</Text>
        <Pressable onPress={load} className="p-2 active:opacity-70">
          <Ionicons name="refresh-outline" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {/* 탭 */}
      <View className="flex-row bg-white border-b border-gray-200">
        {(['RECEIVED', 'SENT'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className="items-center flex-1 py-3"
            style={tab === t ? { borderBottomWidth: 2, borderBottomColor: '#2563eb' } : undefined}
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className="text-sm font-semibold"
                style={{ color: tab === t ? '#2563eb' : '#9ca3af' }}
              >
                {t === 'RECEIVED' ? '받은 요청' : '보낸 요청'}
              </Text>
              {t === 'RECEIVED' && receivedCount > 0 && (
                <View className="min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1">
                  <Text className="text-[10px] font-bold text-white">{receivedCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      <ResultModal
        visible={modal.visible}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal(HIDDEN_MODAL)}
      />

      {loading ? (
        <ActivityIndicator className="mt-12" color="#2563eb" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.requestId)}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { backgroundColor: '#FFF' }}
          style={{ backgroundColor: '#F0F5FF' }}
          ListEmptyComponent={
            <View className="items-center justify-center flex-1">
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text className="mt-3 text-sm text-gray-400">
                {tab === 'RECEIVED' ? '받은 친구 요청이 없습니다.' : '보낸 친구 요청이 없습니다.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
