// @ts-nocheck
import React, { useCallback, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getFriendRequests,
  respondToFriendRequest,
  getMyFriendCode,
  addFriendByCode,
  type FriendRequest,
} from '../api/friend/friends';
import ResultModal from '../components/ResultModal';

// 백엔드 친구 코드 형식: 영문 대문자 + 숫자 조합 6자리 (예: A3K9B2)
const FRIEND_CODE_REGEX = /^[A-Z0-9]{6}$/;

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
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myCodeLoading, setMyCodeLoading] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

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

  const loadMyCode = useCallback(async () => {
    if (myCode) return;
    setMyCodeLoading(true);
    try {
      const code = await getMyFriendCode();
      setMyCode(code);
    } catch {
      setMyCode(null);
    } finally {
      setMyCodeLoading(false);
    }
  }, [myCode]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadMyCode();
    }, [load, loadMyCode]),
  );

  const handleCopyCode = useCallback(async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setModal({
      visible: true,
      type: 'success',
      title: '복사 완료',
      message: '친구 코드가 클립보드에 복사되었습니다.',
    });
  }, [myCode]);

  const handleChangeCode = useCallback(
    (text: string) => {
      setInputCode(text.toUpperCase());
      if (inputError) setInputError('');
    },
    [inputError],
  );

  const handleAddFriend = useCallback(async () => {
    if (!inputCode.trim()) {
      setInputError('친구 코드를 입력해주세요.');
      return;
    }
    if (!FRIEND_CODE_REGEX.test(inputCode)) {
      setInputError('올바른 형식이 아닙니다. (예: A3K9B2)');
      return;
    }
    setAddLoading(true);
    try {
      await addFriendByCode(inputCode);
      setInputCode('');
      setInputError('');
      setModal({
        visible: true,
        type: 'success',
        title: '친구 추가 완료',
        message: `${inputCode} 코드로 친구를 추가했습니다.`,
      });
      void load();
    } catch (e: any) {
      setInputError(e?.response?.data?.message ?? e?.message ?? '친구 추가에 실패했습니다.');
    } finally {
      setAddLoading(false);
    }
  }, [inputCode, load]);

  const handleRespond = useCallback(
    async (requestId: number, accept: boolean) => {
      if (responding != null) return;
      setResponding(requestId);
      try {
        await respondToFriendRequest(requestId, accept);
        setRequests(prev => prev.filter(r => r.requestId !== requestId));
        if (accept) {
          setModal({
            visible: true,
            type: 'success',
            title: '친구 추가 완료',
            message: '친구 요청을 수락했습니다.',
          });
        }
      } catch (e: any) {
        setModal({
          visible: true,
          type: 'error',
          title: '오류',
          message: e?.response?.data?.message ?? e?.message ?? '처리에 실패했습니다.',
        });
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
      </View>

      {/* 내 친구 코드 + 친구 코드 입력 */}
      <View className="bg-white border-b border-gray-200 px-4 py-4">
        <Text className="mb-2 text-sm font-semibold text-gray-700">내 친구 코드</Text>
        <View
          className="flex-row items-center justify-between rounded-xl px-4"
          style={{ backgroundColor: '#EFF6FF', height: 48 }}
        >
          {myCodeLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 6, color: '#2563eb' }}>
              {myCode ?? '------'}
            </Text>
          )}
          <Pressable
            onPress={handleCopyCode}
            disabled={!myCode}
            className="flex-row items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 active:opacity-80 disabled:opacity-40"
          >
            <Ionicons name="copy-outline" size={14} color="#2563eb" />
            <Text className="text-xs font-semibold text-blue-600">복사</Text>
          </Pressable>
        </View>

        <Text className="mt-4 mb-2 text-sm font-semibold text-gray-700">친구 코드 입력</Text>
        <View className="flex-row gap-2">
          <View
            className="flex-row items-center flex-1 px-3 border rounded-xl"
            style={{
              borderColor: inputError ? '#ef4444' : '#d1d5db',
              backgroundColor: '#f9fafb',
              height: 46,
            }}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#9ca3af"
              style={{ marginRight: 6 }}
            />
            <TextInput
              value={inputCode}
              onChangeText={handleChangeCode}
              placeholder="예) A3K9B2"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={6}
              style={{ flex: 1, fontSize: 15, color: '#111827', letterSpacing: 2 }}
            />
          </View>
          <Pressable
            onPress={handleAddFriend}
            disabled={addLoading}
            className="items-center justify-center rounded-xl active:opacity-80"
            style={{ backgroundColor: addLoading ? '#93c5fd' : '#2563eb', width: 46, height: 46 }}
          >
            {addLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-semibold text-white">추가</Text>
            )}
          </Pressable>
        </View>
        {inputError ? <Text className="mt-2 text-xs text-red-500">{inputError}</Text> : null}
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

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.requestId)}
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
              {tab === 'RECEIVED' ? '받은 친구 요청이 없습니다.' : '보낸 친구 요청이 없습니다.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
