import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import {
  RouteProp,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { RoomHeader } from "@/components/chat/RoomHeader";
import { RouteShareMessageCard } from "@/components/chat/RouteShareMessageCard";
import { BubbleChat } from "@/stories/chat/BubbleChat";
import {
  getRoomMessages,
  ChatMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  sendImageMessage,
  isChatApiNotFoundError,
} from "@/api/chat/chat";
import { useAuthStore } from "@/store/authStore";
import { useChatSocket, ChatSocketEvent } from "@/hooks/useChatSocket";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { RootStackParamList } from "@/App";
import { StatusBar } from "expo-status-bar";
import { MessageInput } from "@/stories/chat/MessageInput";
import { ChatScrollToBottomFab } from "@/components/chat/ChatScrollToBottomFab";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import React from "react";

type ChatRoomRouteProp = RouteProp<RootStackParamList, "ChatRoomScreen">;

export const ChatRoomScreen = () => {
  const route = useRoute<ChatRoomRouteProp>();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { roomUuid, roomName, memberCount = 2 } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);
  const userUuid = useAuthStore((s) => s.user?.uuid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOnImageLoadRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated }),
      50,
    );
  }, []);

  const {
    showScrollToBottom,
    handleScrollPosition,
    scrollToBottomPress,
    maybeScrollToEnd,
    stickToBottom,
  } = useChatScrollToBottom(scrollToEnd);

  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );

  const { handleTypingEvent, typingUsers } = useTypingIndicator(userUuid);

  const handleRoomNotFound = useCallback(() => {
    setRoomUnavailable(true);
    setMessages([]);
    setHasMore(false);
    setLoading(false);
  }, []);

  const { sendMessage: socketSend, sendTyping } = useChatSocket(
    isFocused && !roomUnavailable ? roomUuid : "",
    (event: ChatSocketEvent) => {
      if (event.eventType === "MESSAGE_CREATED") {
        if (event.payload.senderUuid === userUuid) {
          setMessages((prev) => {
            const pendingIdx = prev.findIndex((m) =>
              m.uuid.startsWith("pending-"),
            );
            if (pendingIdx === -1) {
              if (prev.some((m) => m.uuid === event.payload.uuid)) return prev;
              return [...prev, event.payload];
            }
            if (scrollOnImageLoadRef.current?.startsWith("pending-")) {
              scrollOnImageLoadRef.current = event.payload.uuid;
            }
            return prev.map((m, i) => (i === pendingIdx ? event.payload : m));
          });
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.uuid === event.payload.uuid)) return prev;
          return [...prev, event.payload];
        });
        maybeScrollToEnd(true);
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
    handleTypingEvent,
  );

  const fetchMessages = useCallback(
    async (beforeUuid?: string) => {
      if (!accessToken || !isFocused || roomUnavailable) return;
      try {
        const fetched = await getRoomMessages(accessToken, roomUuid, {
          beforeMessageUuid: beforeUuid,
          limit: 50,
        });
        // API는 최신순 반환 -> 역순으로 정렬해 오래된 메시지가 위에 오도록
        const chronological = [...fetched]
          .reverse()
          .filter((m) => !m.isDeleted);
        if (beforeUuid) {
          setMessages((prev) => [...chronological, ...prev]);
        } else {
          setMessages(chronological);
        }
        if (fetched.length === 0) setHasMore(false);
      } catch (err) {
        if (isChatApiNotFoundError(err)) {
          handleRoomNotFound();
          return;
        }
        if (__DEV__) {
          console.warn("메시지를 불러오는 데 실패했습니다:", err);
        }
      }
    },
    [accessToken, roomUuid, isFocused, roomUnavailable, handleRoomNotFound],
  );

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      setRoomUnavailable(false);
      setLoading(true);
      messageCountRef.current = 0;
      let cancelled = false;

      void (async () => {
        try {
          await markAsRead(accessToken, roomUuid);
        } catch (err) {
          if (isChatApiNotFoundError(err)) {
            if (!cancelled) handleRoomNotFound();
            return;
          }
        }
        if (cancelled) return;
        await fetchMessages();
        if (!cancelled) {
          setTimeout(
            () => scrollViewRef.current?.scrollToEnd({ animated: false }),
            100,
          );
        }
      })().finally(() => {
        if (!cancelled) setLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }, [accessToken, roomUuid, fetchMessages, handleRoomNotFound]),
  );

  useEffect(() => {
    if (typingUsers.size > 0) {
      maybeScrollToEnd(true);
    }
  }, [typingUsers.size, maybeScrollToEnd]);

  useEffect(() => {
    if (loading || messages.length === 0) return;
    if (messages.length === messageCountRef.current) return;
    messageCountRef.current = messages.length;
    maybeScrollToEnd(true);
  }, [loading, messages.length, maybeScrollToEnd]);

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
      attachmentUrl: null,
      routeUuid: null,
      routeTitle: null,
      routeThumbnailUrl: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isDeleted: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    stickToBottom();
    try {
      const saved = await socketSend(text);
      if (saved) {
        setMessages((prev) => {
          const pendingIdx = prev.findIndex((m) => m.uuid === pendingUuid);
          if (pendingIdx === -1) {
            if (prev.some((m) => m.uuid === saved.uuid)) return prev;
            return [...prev, saved];
          }
          return prev.map((m, i) => (i === pendingIdx ? saved : m));
        });
      }
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

  const handleImageSend = async (imageUri: string) => {
    if (!accessToken) return;

    const pendingUuid = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      uuid: pendingUuid,
      senderUuid: userUuid ?? "",
      senderNickname: "",
      senderProfileImageUrl: "",
      messageType: "IMAGE",
      content: null,
      attachmentUrl: imageUri,
      routeUuid: null,
      routeTitle: null,
      routeThumbnailUrl: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isDeleted: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollOnImageLoadRef.current = pendingUuid;
    stickToBottom();
    try {
      await sendImageMessage(accessToken, roomUuid, imageUri);
    } catch (err: any) {
      console.warn("[Chat] 이미지 전송 실패:", err?.response?.status, err?.response?.data);
      setMessages((prev) => prev.filter((m) => m.uuid !== pendingUuid));
      const detail =
        err?.response?.data?.message ??
        err?.message ??
        "이미지를 보내지 못했습니다.";
      Alert.alert("이미지 전송 실패", String(detail));
    }
  };

  const handleEditStart = (msg: ChatMessage) => {
    setSelectedMessage(null);
    setEditingMessage(msg);
  };

  const handleScroll = async (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    handleScrollPosition(event);
    const { nativeEvent } = event;
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

  if (roomUnavailable) {
    return (
      <View className="flex-1 bg-white">
        <StatusBar style="dark" />
        <RoomHeader roomName={roomName} roomUuid={roomUuid} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base font-semibold text-gray-800">
            이 채팅방을 찾을 수 없어요
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-500">
            삭제되었거나 더 이상 참여할 수 없는 방이에요.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 active:opacity-90"
          >
            <Text className="font-semibold text-white">목록으로</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <View className="flex-1 bg-white">
        <RoomHeader roomName={roomName} roomUuid={roomUuid} />
        <View className="flex-1" style={{ position: "relative" }}>
          <KeyboardAwareScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: 20,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={80}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => maybeScrollToEnd(true)}
          >
          {loadingMore && (
            <ActivityIndicator size="small" style={{ marginBottom: 8 }} />
          )}
          {messages.map((msg) => {
            const isMine = msg.senderUuid === userUuid;
            if (String(msg.messageType ?? "").trim().toUpperCase() === "ROUTE") {
              return (
                <View
                  key={msg.uuid}
                  style={{
                    alignSelf: isMine ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    marginVertical: 4,
                  }}
                >
                  {!isMine && memberCount >= 3 ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#8E8E93",
                        marginBottom: 4,
                        marginLeft: 2,
                      }}
                    >
                      {msg.senderNickname}
                    </Text>
                  ) : null}
                  <RouteShareMessageCard message={msg} isMine={isMine} />
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#8E8E93",
                      marginTop: 4,
                      alignSelf: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            }
            return (
              <BubbleChat
                key={msg.uuid}
                text={
                  msg.messageType === "IMAGE"
                    ? undefined
                    : (msg.content ?? undefined)
                }
                imageUrl={
                  msg.messageType === "IMAGE" ? msg.attachmentUrl : undefined
                }
                isMine={isMine}
                sentAt={new Date(msg.createdAt)}
                userName={msg.senderNickname}
                profileImageUrl={
                  !isMine ? msg.senderProfileImageUrl : undefined
                }
                showSender={!isMine && memberCount >= 3}
                isEdited={!!msg.editedAt}
                onLongPress={
                  isMine && !msg.uuid.startsWith("pending-")
                    ? () => setSelectedMessage(msg)
                    : undefined
                }
                onImageLoad={
                  msg.uuid === scrollOnImageLoadRef.current
                    ? () => {
                        scrollOnImageLoadRef.current = null;
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }
                    : undefined
                }
              />
            );
          })}
          {Array.from(typingUsers.entries()).map(([uuid, name]) => (
            <BubbleChat
              key={`typing-${uuid}`}
              isMine={false}
              isTyping={true}
              userName={memberCount >= 3 ? name : undefined}
            />
          ))}
          </KeyboardAwareScrollView>
          <ChatScrollToBottomFab
            visible={showScrollToBottom && messages.length > 0}
            onPress={scrollToBottomPress}
            style={{ bottom: 8 }}
          />
        </View>
        <KeyboardStickyView offset={{ closed: 0, opened: 15 }}>
          <MessageInput
            onSend={handleSend}
            onImageSend={handleImageSend}
            editingText={editingMessage ? editingMessage.content : null}
            onCancelEdit={() => setEditingMessage(null)}
            onTypingChange={sendTyping}
          />
        </KeyboardStickyView>
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

