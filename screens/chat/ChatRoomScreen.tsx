import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { appAlert } from "../../utils/appAlert";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { RouteProp, useRoute, CommonActions } from "@react-navigation/native";
import { navigationRef } from "@/navigation/rootNavigation";
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
} from "@/api/chat/chat";
import { useAuthStore } from "@/store/authStore";
import { useChatSocket, ChatSocketEvent } from "@/hooks/useChatSocket";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { RootStackParamList } from "@/App";
import { StatusBar } from "expo-status-bar";
import { MessageInput } from "@/stories/chat/MessageInput";
import React from "react";
import { ArrowDown } from "lucide-react-native";

type ChatRoomRouteProp = RouteProp<RootStackParamList, "ChatRoomScreen">;

export const ChatRoomScreen = () => {
  const route = useRoute<ChatRoomRouteProp>();
  const { roomUuid, roomName, memberCount = 2, parentRoomUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);
  const userUuid = useAuthStore((s) => s.user?.uuid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOnImageLoadRef = useRef<string | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const { handleTypingEvent, typingUsers } = useTypingIndicator(userUuid);

  const { sendMessage: socketSend, sendTyping } = useChatSocket(
    roomUuid,
    (event: ChatSocketEvent) => {
      if (event.eventType === "MESSAGE_CREATED") {
        setMessages((prev) => {
          if (prev.some((m) => m.uuid === event.payload.uuid)) return prev;

          if (event.payload.senderUuid === userUuid) {
            const pendingIdx = prev.findIndex((m) =>
              m.uuid.startsWith("pending-"),
            );
            if (pendingIdx === -1) {
              return [...prev, event.payload];
            }
            if (scrollOnImageLoadRef.current?.startsWith("pending-")) {
              scrollOnImageLoadRef.current = event.payload.uuid;
            }
            return prev.map((m, i) => (i === pendingIdx ? event.payload : m));
          }
          return [...prev, event.payload];
        });

        if (event.payload.senderUuid !== userUuid) {
          setTimeout(
            () => scrollViewRef.current?.scrollToEnd({ animated: true }),
            50,
          );
        }
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
    () => {
      console.log("[ChatRoomScreen] 토큰 만료 - 로그인 화면으로 이동");
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
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
        const chronological = [...fetched]
          .reverse()
          .filter((m) => !m.isDeleted);
        if (beforeUuid) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.uuid));
            const newMessages = chronological.filter(
              (m) => !existingIds.has(m.uuid)
            );
            return [...newMessages, ...prev];
          });
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

  useEffect(() => {
    if (typingUsers.size > 0) {
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        50,
      );
    }
  }, [typingUsers.size]);

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

    const pendingUuid = `pending-${Date.now()}-${Math.random()}`;
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

    try {
      const saved = await socketSend(text);
      setTimeout(() => {
        const messageToAdd: ChatMessage = saved ?? optimistic;
        setMessages((prev) => [...prev, messageToAdd]);
        setTimeout(
          () => scrollViewRef.current?.scrollToEnd({ animated: true }),
          50,
        );
      }, 200);
    } catch (err) {
      console.error("[Chat] 메시지 전송 실패:", err);
      setTimeout(() => {
        appAlert("전송 실패", "메시지를 보내지 못했습니다.");
      }, 200);
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

    const pendingUuid = `pending-${Date.now()}-${Math.random()}`;
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
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      50,
    );

    try {
      await sendImageMessage(accessToken, roomUuid, imageUri);
    } catch (err: any) {
      console.warn(
        "[Chat] 이미지 전송 실패:",
        err?.response?.status,
        err?.response?.data,
      );
      setMessages((prev) => prev.filter((m) => m.uuid !== pendingUuid));
      const detail =
        err?.response?.data?.message ??
        err?.message ??
        "이미지를 보내지 못했습니다.";
      appAlert("이미지 전송 실패", String(detail));
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

    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    const distanceFromBottom =
      contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollToBottom(distanceFromBottom > 100);
  };

  if (loading) {
    return (
      <View className="items-center justify-center flex-1">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <View className="flex-1 bg-white">
        <RoomHeader roomName={roomName} roomUuid={roomUuid} parentRoomUuid={parentRoomUuid} />
        <View style={{ flex: 1 }}>
          <KeyboardAwareScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: 20,
            }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {loadingMore && (
              <ActivityIndicator size="small" style={{ marginBottom: 8 }} />
            )}
            {(() => {
              const seen = new Set<string>();
              return messages.filter((msg) => {
                if (seen.has(msg.uuid)) return false;
                seen.add(msg.uuid);
                return true;
              });
            })().map((msg) => {
              const isMine = msg.senderUuid === userUuid;
              if (
                String(msg.messageType ?? "")
                  .trim()
                  .toUpperCase() === "ROUTE"
              ) {
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
                          scrollViewRef.current?.scrollToEnd({
                            animated: true,
                          });
                        }
                      : undefined
                  }
                  onImagePress={
                    msg.messageType === "IMAGE" && msg.attachmentUrl
                      ? () => setSelectedImageUrl(msg.attachmentUrl)
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
          {showScrollToBottom && (
            <TouchableOpacity
              style={chatStyles.scrollToBottomBtn}
              onPress={() =>
                scrollViewRef.current?.scrollToEnd({ animated: false })
              }
            >
              <ArrowDown size={26} color="#333" />
            </TouchableOpacity>
          )}
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

      <Modal
        visible={!!selectedImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUrl(null)}
      >
        <Pressable
          style={imageViewerStyles.backdrop}
          onPress={() => setSelectedImageUrl(null)}
        >
          {selectedImageUrl && (
            <View style={imageViewerStyles.imageContainer}>
              <Image
                source={{ uri: selectedImageUrl }}
                style={imageViewerStyles.image}
                resizeMode="contain"
              />
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
};

const chatStyles = StyleSheet.create({
  scrollToBottomBtn: {
    position: "absolute",
    bottom: 12,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

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

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const imageViewerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: screenWidth * 0.95,
    height: screenHeight * 0.95,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
