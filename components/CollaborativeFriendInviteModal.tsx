import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFriends, type Friends } from '../api/friend/friends';

type Props = {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  onConfirm: (friendUuids: string[]) => void | Promise<void>;
  submitting?: boolean;
};

export function CollaborativeFriendInviteModal({
  visible,
  onClose,
  accessToken,
  onConfirm,
  submitting = false,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Friends[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !accessToken) return;
    setLoading(true);
    getFriends(accessToken)
      .then(list => setFriends(Array.isArray(list) ? list : []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [visible, accessToken]);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelected(new Set());
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return friends;
    return friends.filter(f => f.nickname.includes(q));
  }, [friends, search]);

  const toggle = (uuid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const handleConfirm = () => {
    void onConfirm([...selected]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="max-h-[78%] rounded-t-3xl bg-white"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
            <Text className="text-lg font-bold text-gray-900">친구에게 공유</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={26} color="#64748b" />
            </Pressable>
          </View>
          <Text className="px-4 pb-2 text-xs text-gray-500">
            선택한 친구에게 단체 채팅방이 열리고, 공동 루트 초대 메시지가 전송돼요.
          </Text>
          <View className="mx-4 mb-2 flex-row items-center rounded-xl bg-gray-100 px-3 py-2">
            <Ionicons name="search-outline" size={18} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="친구 검색"
              className="ml-2 flex-1 text-base text-gray-900"
              placeholderTextColor="#94a3b8"
            />
          </View>
          {loading ? (
            <ActivityIndicator className="py-8" color="#2563eb" />
          ) : (
            <ScrollView className="max-h-96 px-4">
              {filtered.length === 0 ? (
                <Text className="py-8 text-center text-sm text-gray-400">
                  초대할 친구가 없어요. 친구 탭에서 먼저 추가해 주세요.
                </Text>
              ) : (
                filtered.map(f => {
                  const on = selected.has(f.uuid);
                  return (
                    <Pressable
                      key={f.uuid}
                      onPress={() => toggle(f.uuid)}
                      className={`mb-2 flex-row items-center rounded-xl px-3 py-2.5 ${
                        on ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <Image
                        source={{ uri: f.profileImageUrl }}
                        className="h-10 w-10 rounded-full bg-gray-200"
                      />
                      <Text className="ml-3 flex-1 text-base font-medium text-gray-900">
                        {f.nickname}
                      </Text>
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={on ? '#2563eb' : '#cbd5e1'}
                      />
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
          <Pressable
            onPress={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className={`mx-4 mt-3 rounded-xl py-3.5 ${
              selected.size === 0 || submitting ? 'bg-blue-200' : 'bg-blue-600'
            }`}
          >
            <Text className="text-center text-base font-bold text-white">
              {submitting
                ? '보내는 중…'
                : selected.size > 0
                  ? `${selected.size}명에게 공유`
                  : '친구를 선택해 주세요'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
