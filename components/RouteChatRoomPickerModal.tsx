import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** 목록 API에 없어도 루트에 연결된 방이 있으면 상단에 표시 */
  linkedRoom?: SelectedRouteChatRoom | null;
  onSelectRoom: (room: SelectedRouteChatRoom) => void;
};

function formatLastMessagePreview(room: ChatRoom): string {
  const msg = String(room.lastMessage ?? '').trim();
  if (msg) return msg.length > 48 ? `${msg.slice(0, 48)}…` : msg;
  return '메시지 없음';
}

function formatRoomTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays}일`;
  return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

function RoomRow({
  room,
  isActive,
  onPress,
}: {
  room: ChatRoom;
  isActive: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const unread = Math.max(0, room.unreadCount ?? 0);
  const badge = formatBadgeCount(unread);
  const timeLabel = formatRoomTime(room.lastMessageAt);

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 flex-row items-center rounded-2xl border px-3 py-3 active:opacity-90 ${
        isActive ? 'border-sky-300 bg-sky-50' : 'border-gray-100 bg-white'
      }`}
      style={
        !isActive
          ? {
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }
          : undefined
      }
    >
      <View
        className="mr-3 items-center justify-center overflow-hidden rounded-full bg-sky-100"
        style={{ width: 46, height: 46 }}
      >
        {room.profileImageUrl ? (
          <Image
            source={{ uri: room.profileImageUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="chatbubbles" size={22} color="#2563eb" />
        )}
      </View>
      <View className="min-w-0 flex-1 pr-2">
        <View className="flex-row items-center">
          <Text
            className="flex-1 text-[15px] font-semibold text-gray-900"
            numberOfLines={1}
          >
            {room.name || '채팅'}
          </Text>
          {timeLabel ? (
            <Text className="ml-2 text-[10px] text-gray-400">{timeLabel}</Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
          {formatLastMessagePreview(room)}
        </Text>
        <Text className="mt-1 text-[10px] text-gray-400">
          {Math.max(2, room.memberCount ?? 2)}명
        </Text>
      </View>
      {badge ? (
        <View className="mr-2 min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-white">{badge}</Text>
        </View>
      ) : null}
      {isActive ? (
        <Ionicons name="checkmark-circle" size={22} color="#2563eb" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

export function RouteChatRoomPickerModal({
  visible,
  onClose,
  accessToken,
  currentRoomUuid,
  linkedRoom,
  onSelectRoom,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
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

  const linkedNotInList = useMemo(() => {
    const linkedId = String(linkedRoom?.uuid ?? '').trim();
    if (!linkedId) return false;
    return !rooms.some((r) => String(r.uuid ?? '').trim() === linkedId);
  }, [linkedRoom?.uuid, rooms]);

  const pickRoom = (room: SelectedRouteChatRoom) => {
    if (!room.uuid) return;
    onSelectRoom(room);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="닫기" />
        <View
          className="rounded-t-3xl bg-white"
          style={{
            maxHeight: '72%',
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-gray-200" />
          </View>
          <View className="flex-row items-center justify-between px-4 pb-2">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-bold text-gray-900">채팅방 선택</Text>
              <Text className="mt-0.5 text-xs text-gray-500">
                대화할 방을 고르면 루트 채팅에서 바로 이어서 볼 수 있어요.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full bg-gray-100 p-2 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator className="py-12" color="#2563eb" />
          ) : (
            <ScrollView
              className="px-4"
              style={{ maxHeight: 420 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {linkedRoom && linkedNotInList ? (
                <View className="mb-3">
                  <Text className="mb-2 text-[11px] font-semibold text-sky-800">
                    이 루트에 연결된 채팅방
                  </Text>
                  <Pressable
                    onPress={() => pickRoom(linkedRoom)}
                    className={`flex-row items-center rounded-2xl border px-3 py-3 active:opacity-90 ${
                      activeId === linkedRoom.uuid
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-sky-200 bg-sky-50/60'
                    }`}
                  >
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-sky-200">
                      <Ionicons name="link" size={20} color="#1d4ed8" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-[15px] font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        {linkedRoom.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-gray-500">
                        {linkedRoom.memberCount}명 · 연결됨
                      </Text>
                    </View>
                    {activeId === linkedRoom.uuid ? (
                      <Ionicons name="checkmark-circle" size={22} color="#2563eb" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    )}
                  </Pressable>
                </View>
              ) : null}

              {rooms.length === 0 && !(linkedRoom && linkedNotInList) ? (
                <View className="items-center py-12">
                  <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-sky-50">
                    <Ionicons name="chatbubbles-outline" size={28} color="#93c5fd" />
                  </View>
                  <Text className="text-sm font-semibold text-gray-700">
                    참여 중인 채팅방이 없어요
                  </Text>
                  <Text className="mt-1 text-center text-xs text-gray-400">
                    채팅 탭에서 방을 만든 뒤 다시 선택해 주세요.
                  </Text>
                </View>
              ) : rooms.length > 0 ? (
                <>
                  <Text className="mb-2 text-[11px] font-semibold text-gray-500">
                    내 채팅방
                  </Text>
                  {rooms.map((room) => {
                    const id = String(room.uuid ?? '').trim();
                    if (!id) return null;
                    const isActive = Boolean(activeId && id === activeId);
                    return (
                      <RoomRow
                        key={id}
                        room={room}
                        isActive={isActive}
                        onPress={() =>
                          pickRoom({
                            uuid: id,
                            name: String(room.name ?? '').trim() || '채팅',
                            memberCount: Math.max(2, room.memberCount ?? 2),
                          })
                        }
                      />
                    );
                  })}
                </>
              ) : null}
              <View className="h-2" />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
