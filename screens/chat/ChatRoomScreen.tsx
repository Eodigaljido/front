import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { BubbleChat } from "@/stories/chat/BubbleChat";
import {
  getRoomMessages,
  ChatMessage,
  markAsRead,
  deleteMessage,
  editMessage,
} from "@/api/chat/chat";
import { useAuthStore } from "@/store/authStore";
import { useChatSocket, ChatSocketEvent } from "@/hooks/useChatSocket";
import { RootStackParamList } from "@/App";
import { StatusBar } from "expo-status-bar";

type ChatRoomRouteProp = RouteProp<RootStackParamList, "ChatRoomScreen">;

export const ChatRoomScreen = () => {
  const route = useRoute<ChatRoomRouteProp>();
  const { roomUuid, roomName } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);
  const userUuid = useAuthStore((s) => s.user?.uuid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );

  const { sendMessage: socketSend } = useChatSocket(
    roomUuid,
    (event: ChatSocketEvent) => {
      if (event.eventType === "MESSAGE_CREATED") {
        if (event.payload.senderUuid === userUuid) {
          // 내가 보낸 메시지 에코: pending 메시지를 서버 응답(실제 UUID)으로 교체
          setMessages((prev) => {
            const pendingIdx = prev.findIndex((m) =>
              m.uuid.startsWith("pending-"),
            );
            if (pendingIdx === -1) return prev;
            return prev.map((m, i) => (i === pendingIdx ? event.payload : m));
          });
          return;
        }
        setMessages((prev) => [...prev, event.payload]);
        setTimeout(
          () => scrollViewRef.current?.scrollToEnd({ animated: true }),
          50,
        );
      } else if (event.eventType === "MESSAGE_EDITED") {
        setMessages((prev) =>
          prev.map((m) => (m.uuid === event.payload.uuid ? event.payload : m)),
        );
      } else if (event.eventType === "MESSAGE_DELETED") {
        setMessages((prev) =>
          prev.filter((m) => m.uuid !== event.payload.uuid),
        );
      }
    },
  );

  const fetchMessages = useCallback(
    async (beforeUuid?: string) => {
      if (!accessToken) return;
      try {
        const fetched = await getRoomMessages(accessToken, roomUuid, {
          beforeMessageUuid: beforeUuid,
          limit: 50,
        });
        // API는 최신순 반환 -> 역순으로 정렬해 오래된 메시지가 위에 오도록
        const chronological = [...fetched].reverse().filter((m) => !m.isDeleted);
        if (beforeUuid) {
          setMessages((prev) => [...chronological, ...prev]);
        } else {
          setMessages(chronological);
        }
        if (fetched.length === 0) setHasMore(false);
      } catch (err) {
        console.error("메시지를 불러오는 데 실패했습니다:", err);
      }
    },
    [accessToken, roomUuid],
  );

  // 채팅방 입장 시 읽음 처리
  useEffect(() => {
    if (!accessToken) return;

    try {
      markAsRead(accessToken, roomUuid);
      console.log("채팅방 읽음 처리 완료");
    } catch (err) {
      console.error("읽음 처리 실패:", err);
    }
  }, [accessToken, roomUuid]);

  useEffect(() => {
    fetchMessages().finally(() => {
      setLoading(false);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    });
  }, [fetchMessages]);

  const handleSend = async (text: string) => {
    if (editingMessage) {
      const targetUuid = editingMessage.uuid;
      setEditingMessage(null);
      if (!accessToken) return;
      try {
        await editMessage(accessToken, roomUuid, targetUuid, text);
      } catch (err) {
        console.error("[Chat] 메시지 수정 실패:", err);
      }
      return;
    }

    const pendingUuid = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      uuid: pendingUuid,
      senderUuid: userUuid ?? "",
      senderNickname: "",
      senderProfileImageUrl: "",
      messageType: "TEXT",
      content: text,
      routeUuid: "",
      routeTitle: "",
      routeThumbnailUrl: "",
      createdAt: new Date().toISOString(),
      editedAt: "",
      isDeleted: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      50,
    );
    try {
      await socketSend(text);
    } catch (err) {
      console.error("[Chat] 메시지 전송 실패:", err);
      setMessages((prev) => prev.filter((m) => m.uuid !== pendingUuid));
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    setSelectedMessage(null);
    if (!accessToken) return;
    setMessages((prev) => prev.filter((m) => m.uuid !== msg.uuid));
    try {
      await deleteMessage(accessToken, roomUuid, msg.uuid);
    } catch (err) {
      console.error("[Chat] 메시지 삭제 실패:", err);
      setMessages((prev) => {
        const inserted = [...prev, msg];
        inserted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return inserted;
      });
    }
  };

  const handleEditStart = (msg: ChatMessage) => {
    setSelectedMessage(null);
    setEditingMessage(msg);
  };

  const handleScroll = async ({ nativeEvent }: any) => {
    if (
      nativeEvent.contentOffset.y <= 0 &&
      hasMore &&
      !loadingMore &&
      messages.length > 0
    ) {
      setLoadingMore(true);
      await fetchMessages(messages[0].uuid);
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <View className="flex-1 bg-white">
        <RoomHeader roomName={roomName} />
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 180,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={400}
        >
          {loadingMore && (
            <ActivityIndicator size="small" style={{ marginBottom: 8 }} />
          )}
          {messages.map((msg) => {
            const isMine = msg.senderUuid === userUuid;
            return (
              <BubbleChat
                key={msg.uuid}
                text={msg.content}
                isMine={isMine}
                sentAt={new Date(msg.createdAt)}
                userName={msg.senderNickname}
                isEdited={!!msg.editedAt}
                onLongPress={isMine ? () => setSelectedMessage(msg) : undefined}
              />
            );
          })}
        </ScrollView>
        <RoomFooter
          onSend={handleSend}
          editingText={editingMessage ? editingMessage.content : null}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </View>

      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable
          style={modalStyles.backdrop}
          onPress={() => setSelectedMessage(null)}
        >
          <Pressable style={modalStyles.sheet}>
            <Text style={modalStyles.title}>메시지 옵션</Text>
            <TouchableOpacity
              style={modalStyles.button}
              onPress={() =>
                selectedMessage && handleEditStart(selectedMessage)
              }
            >
              <Text style={modalStyles.buttonTextEdit}>수정</Text>
            </TouchableOpacity>
            <View style={modalStyles.divider} />
            <TouchableOpacity
              style={modalStyles.button}
              onPress={() =>
                selectedMessage && handleDeleteMessage(selectedMessage)
              }
            >
              <Text style={modalStyles.buttonTextDelete}>삭제</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.button, modalStyles.cancelButton]}
              onPress={() => setSelectedMessage(null)}
            >
              <Text style={modalStyles.buttonTextCancel}>취소</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: 260,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    paddingVertical: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 16,
  },
  button: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButton: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    marginTop: 4,
  },
  buttonTextEdit: {
    fontSize: 16,
    color: "#0088FF",
    fontWeight: "500",
  },
  buttonTextDelete: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "500",
  },
  buttonTextCancel: {
    fontSize: 16,
    color: "#888",
  },
});
