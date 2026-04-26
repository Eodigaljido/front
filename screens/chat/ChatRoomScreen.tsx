import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { BubbleChat } from "@/stories/chat/BubbleChat";
import { getRoomMessages, ChatMessage, markAsRead } from "@/api/chat/chat";
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
          prev.map((m) =>
            m.uuid === event.payload.uuid ? { ...m, isDeleted: true } : m,
          ),
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
        const chronological = [...fetched].reverse();
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
          {messages.map((msg) => (
            <BubbleChat
              key={msg.uuid}
              text={msg.isDeleted ? "(삭제된 메시지)" : (msg.content ?? "")}
              isMine={msg.senderUuid === userUuid}
              sentAt={new Date(msg.createdAt)}
              userName={msg.senderNickname}
            />
          ))}
        </ScrollView>
        <RoomFooter onSend={handleSend} />
      </View>
    </>
  );
};
