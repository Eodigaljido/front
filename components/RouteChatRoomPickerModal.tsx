import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getChatRooms, type ChatRoom } from '../api/chat/chat';
import { formatBadgeCount } from '../hooks/useUnreadBadgeCounts';

export type SelectedRouteChatRoom = {
  uuid: string;
  name: string;
  memberCount: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  currentRoomUuid?: string | null;
  onSelectRoom: (room: SelectedRouteChatRoom) => void;
};

function formatLastMessagePreview(room: ChatRoom): string {
  const msg = String(room.lastMessage ?? '').trim();
  if (msg) return msg.length > 42 ? `${msg.slice(0, 42)}…` : msg;
  return '메시지 없음';
}

export function RouteChatRoomPickerModal({
  visible,
  onClose,
  accessToken,
  currentRoomUuid,
  onSelectRoom,
}: Props): React.JSX.Element {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!accessToken) {
      setRooms([]);
      return;
    }
    setLoading(true);
    try {
      const list = await getChatRooms(accessToken);
      setRooms(Array.isArray(list) ? list : []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!visible) return;
    void loadRooms();
  }, [visible, loadRooms]);

  const activeId = String(currentRoomUuid ?? '').trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Pressable
          className="max-h-[52%] rounded-t-2xl bg-white px-4 pb-6 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-gray-900">채팅방 선택</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>
          <Text className="mb-2 text-[11px] text-gray-500">
            방을 고르면 아래 루트 채팅 창에서 대화할 수 있어요.
          </Text>

          {loading ? (
            <ActivityIndicator className="py-8" color="#ea580c" />
          ) : rooms.length === 0 ? (
            <Text className="py-8 text-center text-sm text-gray-400">
              참여 중인 채팅방이 없어요.
            </Text>
          ) : (
            <ScrollView className="max-h-72" keyboardShouldPersistTaps="handled">
              {rooms.map((room) => {
                const id = String(room.uuid ?? '').trim();
                const isActive = Boolean(activeId && id === activeId);
                const unread = Math.max(0, room.unreadCount ?? 0);
                const badge = formatBadgeCount(unread);
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      if (!id) return;
                      onSelectRoom({
                        uuid: id,
                        name: String(room.name ?? '').trim() || '채팅',
                        memberCount: Math.max(2, room.memberCount ?? 2),
                      });
                      onClose();
                    }}
                    className={`mb-2 flex-row items-center rounded-xl border px-3 py-2.5 active:opacity-90 ${
                      isActive
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <View className="min-w-0 flex-1 pr-2">
                      <Text
                        className="text-sm font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        {room.name || '채팅'}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-gray-500" numberOfLines={1}>
                        {formatLastMessagePreview(room)}
                      </Text>
                    </View>
                    {badge ? (
                      <View className="mr-2 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold text-white">{badge}</Text>
                      </View>
                    ) : null}
                    {isActive ? (
                      <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
