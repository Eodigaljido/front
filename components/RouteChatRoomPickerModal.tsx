import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
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

type PanelProps = {
  onClose: () => void;
  accessToken: string | null;
  currentRoomUuid?: string | null;
  linkedRoom?: SelectedRouteChatRoom | null;
  onSelectRoom: (room: SelectedRouteChatRoom) => void;
  /** 시트 안 오버레이일 때 하단 safe area만 패널에 적용 */
  embedded?: boolean;
};

function formatLastMessagePreview(room: ChatRoom): string {
  const msg = String(room.lastMessage ?? '').trim();
  if (msg) return msg.length > 36 ? `${msg.slice(0, 36)}…` : msg;
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
  const memberLabel = `${Math.max(2, room.memberCount ?? 2)}명`;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      className={`mb-1.5 flex-row items-center rounded-xl border px-2.5 py-2 active:opacity-90 ${
        isActive ? 'border-sky-300 bg-sky-50' : 'border-gray-100 bg-white'
      }`}
    >
      <View
        className="mr-2.5 items-center justify-center overflow-hidden rounded-full bg-sky-100"
        style={{ width: 36, height: 36 }}
      >
        {room.profileImageUrl ? (
          <Image
            source={{ uri: room.profileImageUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="chatbubbles" size={18} color="#2563eb" />
        )}
      </View>
      <View className="min-w-0 flex-1 pr-1">
        <View className="flex-row items-center">
          <Text
            className="flex-1 text-[13px] font-semibold text-gray-900"
            numberOfLines={1}
          >
            {room.name || '채팅'}
          </Text>
          {timeLabel ? (
            <Text className="ml-1.5 text-[9px] text-gray-400">{timeLabel}</Text>
          ) : null}
        </View>
        <Text className="mt-0.5 text-[11px] text-gray-500" numberOfLines={1}>
          {formatLastMessagePreview(room)} · {memberLabel}
        </Text>
      </View>
      {badge ? (
        <View
          className="mr-1.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5"
          pointerEvents="none"
        >
          <Text className="text-[9px] font-bold text-white">{badge}</Text>
        </View>
      ) : null}
      {isActive ? (
        <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

export function RouteChatRoomPickerPanel({
  onClose,
  accessToken,
  currentRoomUuid,
  linkedRoom,
  onSelectRoom,
  embedded = false,
}: PanelProps): React.JSX.Element {
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
    void loadRooms();
  }, [loadRooms]);

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

  const bottomPad = embedded ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 12);

  return (
    <View
      className={embedded ? 'justify-end' : 'rounded-t-3xl bg-white'}
      style={embedded ? { flex: 1, justifyContent: 'flex-end' } : { maxHeight: '72%', paddingBottom: bottomPad }}
    >
      {!embedded ? (
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-full bg-gray-200" />
        </View>
      ) : null}
      <View
        className="rounded-t-2xl bg-white"
        style={embedded ? { maxHeight: '58%', paddingBottom: bottomPad } : undefined}
      >
        <View className="flex-row items-center justify-between px-3 pb-1.5 pt-2">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-base font-bold text-gray-900">채팅방 선택</Text>
            <Text className="mt-0.5 text-[11px] text-gray-500" numberOfLines={1}>
              대화할 방을 고르면 루트 채팅에서 바로 이어서 볼 수 있어요.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="rounded-full bg-gray-100 p-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator className="py-8" color="#2563eb" />
        ) : (
          <ScrollView
            className="px-3"
            style={{ maxHeight: embedded ? 280 : 360 }}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {linkedRoom && linkedNotInList ? (
              <View className="mb-2">
                <Text className="mb-1 text-[10px] font-semibold text-sky-800">
                  이 루트에 연결된 채팅방
                </Text>
                <Pressable
                  onPress={() => pickRoom(linkedRoom)}
                  hitSlop={4}
                  className={`flex-row items-center rounded-xl border px-2.5 py-2 active:opacity-90 ${
                    activeId === linkedRoom.uuid
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-sky-200 bg-sky-50/60'
                  }`}
                >
                  <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-full bg-sky-200">
                    <Ionicons name="link" size={16} color="#1d4ed8" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[13px] font-semibold text-gray-900"
                      numberOfLines={1}
                    >
                      {linkedRoom.name}
                    </Text>
                    <Text className="text-[11px] text-gray-500">
                      {linkedRoom.memberCount}명 · 연결됨
                    </Text>
                  </View>
                  {activeId === linkedRoom.uuid ? (
                    <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            ) : null}

            {rooms.length === 0 && !(linkedRoom && linkedNotInList) ? (
              <View className="items-center py-10">
                <Ionicons name="chatbubbles-outline" size={24} color="#93c5fd" />
                <Text className="mt-2 text-sm font-semibold text-gray-700">
                  참여 중인 채팅방이 없어요
                </Text>
              </View>
            ) : rooms.length > 0 ? (
              <>
                <Text className="mb-1 text-[10px] font-semibold text-gray-500">
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
            <View className="h-1" />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

type ModalProps = Omit<PanelProps, 'embedded'> & {
  visible: boolean;
};

export function RouteChatRoomPickerModal({
  visible,
  onClose,
  ...panelProps
}: ModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/45">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <RouteChatRoomPickerPanel onClose={onClose} embedded={false} {...panelProps} />
      </View>
    </Modal>
  );
}
