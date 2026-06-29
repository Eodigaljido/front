import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  Animated,
  Easing,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import {
  getRoomMessages,
  markAsRead,
  isChatApiNotFoundError,
  type ChatMessage,
} from "../api/chat/chat";
import { useChatSocket, type ChatSocketEvent } from "../hooks/useChatSocket";
import { useUnreadBadgeCounts } from "../hooks/useUnreadBadgeCounts";
import {
  dismissRouteChatSyncBanner,
  isRouteChatSyncBannerDismissed,
} from "../utils/routeChatSyncBanner";
import { ChatScrollToBottomFab } from "./chat/ChatScrollToBottomFab";
import { RouteShareMessageCard } from "./chat/RouteShareMessageCard";
import { useChatScrollToBottom } from "../hooks/useChatScrollToBottom";
import {
  RouteChatRoomPickerPanel,
  type SelectedRouteChatRoom,
} from "./RouteChatRoomPickerModal";
import { RouteHistoryFeed } from "./RouteHistoryFeed";

const SHEET_SLIDE = 420;
const MESSAGE_POLL_MS = 4000;
const MESSAGE_POLL_DISCONNECTED_MS = 2500;

type Props = {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  myUuid: string | undefined;
  chatRoomUuid: string | null | undefined;
  routeId?: string;
  routeTitle: string;
  roomName?: string;
  memberCount?: number;
  linkedChatRoom?: SelectedRouteChatRoom | null;
  onSelectChatRoom?: (room: SelectedRouteChatRoom) => void;
};

function messageBody(msg: ChatMessage): string {
  if (msg.messageType === "ROUTE") {
    return "";
  }
  if (msg.messageType === "IMAGE") {
    return msg.content?.trim() || "📷 사진";
  }
  return String(msg.content ?? "").trim();
}

function looksLikeImageUrl(value: string): boolean {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return false;
  return (
    v.includes("image") ||
    /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)(\?|$)/i.test(v)
  );
}

function isImageMessage(msg: ChatMessage): boolean {
  const messageType = String(msg.messageType ?? "")
    .trim()
    .toUpperCase();
  const attachment = String(msg.attachmentUrl ?? "").trim();
  const content = String(msg.content ?? "").trim();
  if (messageType === "IMAGE") return true;
  if (attachment && looksLikeImageUrl(attachment)) return true;
  // 일부 서버 응답에서 content에 이미지 URL이 들어오는 경우 대응
  if (content.startsWith("http") && looksLikeImageUrl(content)) return true;
  return false;
}

function mergeMessages(
  prev: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();

  // incoming 메시지 추가 (서버의 최신 데이터 우선)
  for (const m of incoming) {
    if (!m.isDeleted && m.uuid) {
      map.set(m.uuid, m);
    }
  }

  // prev의 pending 메시지만 추가 (아직 서버에 저장되지 않은 메시지)
  for (const m of prev) {
    if (m.uuid.startsWith("pending-") && !map.has(m.uuid)) {
      map.set(m.uuid, m);
    }
  }

  // 시간 순으로 정렬
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function replacePendingMessage(
  prev: ChatMessage[],
  pendingUuid: string,
  saved: ChatMessage,
): ChatMessage[] {
  // 중복 제거하며 업데이트
  const map = new Map<string, ChatMessage>();

  for (const m of prev) {
    if (m.uuid === pendingUuid) {
      // pending 메시지를 saved로 대체
      continue;
    }
    map.set(m.uuid, m);
  }

  // saved 메시지 추가 (기존에 같은 uuid가 있으면 덮어씀)
  if (saved.uuid) {
    map.set(saved.uuid, saved);
  }

  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function RouteCollaborativeChatSheet({
  visible,
  onClose,
  accessToken,
  myUuid,
  chatRoomUuid,
  routeId,
  routeTitle,
  roomName,
  memberCount = 2,
  linkedChatRoom = null,
  onSelectChatRoom,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get("window").height;
  const sheetMaxHeight = Math.min(
    windowH * 0.92,
    windowH - Math.max(insets.top, 8),
  );
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const scrollRef = useRef<ScrollView>(null);
  const messageCountRef = useRef(0);
  const lastSendTimeRef = useRef(0);
  const [rendered, setRendered] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [chatListPickerOpen, setChatListPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");

  const roomId = String(chatRoomUuid ?? "").trim();
  const useApi = Boolean(accessToken && roomId);
  const userId = String(myUuid ?? "").trim();

  const { chatUnread, refresh, onChatSocketEvent } = useUnreadBadgeCounts(
    accessToken,
    visible && useApi,
  );

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 50);
  }, []);

  const {
    showScrollToBottom,
    handleScrollPosition,
    scrollToBottomPress,
    maybeScrollToEnd,
    stickToBottom,
  } = useChatScrollToBottom(scrollToEnd);

  useEffect(() => {
    if (!visible || apiMessages.length === 0) return;
    if (apiMessages.length === messageCountRef.current) return;
    messageCountRef.current = apiMessages.length;
    maybeScrollToEnd(true);
  }, [visible, apiMessages.length, maybeScrollToEnd]);

  const applyIncomingMessages = useCallback(
    (incoming: ChatMessage[], scroll = false) => {
      setApiMessages((prev) => {
        const merged = mergeMessages(prev, incoming);

        // 최종 중복 제거 (백엔드 중복 대응)
        const seen = new Set<string>();
        const deduplicated = merged.filter((m) => {
          if (!m.uuid || seen.has(m.uuid)) return false;
          seen.add(m.uuid);
          return true;
        });

        const same =
          deduplicated.length === prev.length &&
          deduplicated.every((m, i) => m.uuid === prev[i]?.uuid);
        return same ? prev : deduplicated;
      });
      if (scroll) maybeScrollToEnd(false);
    },
    [maybeScrollToEnd],
  );

  const handleSocketEvent = useCallback(
    (event: ChatSocketEvent) => {
      onChatSocketEvent(event);
      if (event.eventType === "MESSAGE_CREATED") {
        setApiMessages((prev) => {
          if (prev.some((m) => m.uuid === event.payload.uuid)) return prev;
          if (event.payload.senderUuid === myUuid) {
            const pendingIdx = prev.findIndex((m) =>
              m.uuid.startsWith("pending-"),
            );
            if (pendingIdx >= 0) {
              return prev.map((m, i) => (i === pendingIdx ? event.payload : m));
            }
          }
          return [...prev, event.payload];
        });
        maybeScrollToEnd();
        return;
      }
      if (event.eventType === "MESSAGE_EDITED") {
        setApiMessages((prev) =>
          prev.map((m) => (m.uuid === event.payload.uuid ? event.payload : m)),
        );
        return;
      }
      if (event.eventType === "MESSAGE_DELETED") {
        setApiMessages((prev) =>
          prev.filter((m) => m.uuid !== event.payload.uuid),
        );
      }
    },
    [myUuid, maybeScrollToEnd, onChatSocketEvent],
  );

  const { sendMessage: socketSend, isConnected } = useChatSocket(
    useApi ? roomId : "",
    handleSocketEvent,
  );

  const runOpen = useCallback(() => {
    backdrop.setValue(0);
    sheetY.setValue(SHEET_SLIDE);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, sheetY]);

  const runClose = useCallback(
    (done?: () => void) => {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: SHEET_SLIDE,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => done?.());
    },
    [backdrop, sheetY],
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      runOpen();
    } else if (rendered) {
      runClose(() => setRendered(false));
    }
  }, [visible, rendered, runOpen, runClose]);

  const handleClose = () => {
    runClose(onClose);
  };

  const fetchMessagesFromApi = useCallback(
    async (opts?: { showSpinner?: boolean }) => {
      if (!useApi || !accessToken || roomUnavailable) return;
      if (opts?.showSpinner) setLoadingMsgs(true);
      try {
        const fetched = await getRoomMessages(accessToken, roomId, {
          limit: 80,
        });
        const chronological = [...(Array.isArray(fetched) ? fetched : [])]
          .reverse()
          .filter((m) => !m.isDeleted);
        applyIncomingMessages(chronological, Boolean(opts?.showSpinner));
      } catch (err) {
        if (isChatApiNotFoundError(err)) {
          setRoomUnavailable(true);
          setApiMessages([]);
          return;
        }
        if (opts?.showSpinner) setApiMessages([]);
      } finally {
        if (opts?.showSpinner) setLoadingMsgs(false);
      }
    },
    [useApi, accessToken, roomId, roomUnavailable, applyIncomingMessages],
  );

  useEffect(() => {
    if (!visible || !useApi || !userId || !roomId) {
      setShowSyncBanner(false);
      return;
    }
    let cancelled = false;
    void isRouteChatSyncBannerDismissed(userId, roomId).then((dismissed) => {
      if (!cancelled) setShowSyncBanner(!dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, useApi, userId, roomId]);

  useEffect(() => {
    if (!visible) {
      messageCountRef.current = 0;
      setRoomUnavailable(false);
      setChatListPickerOpen(false);
      return;
    }
    if (!useApi || !accessToken) return;
    setRoomUnavailable(false);
    setApiMessages([]);
    messageCountRef.current = 0;
    void fetchMessagesFromApi({ showSpinner: true });
    void markAsRead(accessToken, roomId)
      .then(() => refresh())
      .catch((err) => {
        if (isChatApiNotFoundError(err)) setRoomUnavailable(true);
      });
  }, [visible, useApi, accessToken, roomId, fetchMessagesFromApi, refresh]);

  useEffect(() => {
    if (!visible || !useApi || roomUnavailable) return;
    const interval = isConnected
      ? MESSAGE_POLL_MS
      : MESSAGE_POLL_DISCONNECTED_MS;
    const timer = setInterval(() => {
      void fetchMessagesFromApi();
    }, interval);
    return () => clearInterval(timer);
  }, [visible, useApi, roomUnavailable, isConnected, fetchMessagesFromApi]);

  const dismissSyncBanner = () => {
    setShowSyncBanner(false);
    if (userId && roomId) {
      void dismissRouteChatSyncBanner(userId, roomId);
    }
  };

  const sendChat = async () => {
    const t = chatInput.trim();
    if (!t || !useApi) return;

    // 전송 속도 제한 (최소 300ms 간격)
    const now = Date.now();
    if (now - lastSendTimeRef.current < 300) {
      console.warn("[Chat] 메시지 전송 간격이 너무 짧습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    lastSendTimeRef.current = now;

    const pendingUuid = `pending-${now}`;
    const optimistic: ChatMessage = {
      uuid: pendingUuid,
      senderUuid: myUuid ?? "",
      senderNickname: "",
      senderProfileImageUrl: null,
      messageType: "TEXT",
      content: t,
      attachmentUrl: null,
      routeUuid: null,
      routeTitle: null,
      routeThumbnailUrl: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isDeleted: false,
    };
    setApiMessages((m) => [...m, optimistic]);
    setChatInput("");
    stickToBottom();

    setSending(true);
    try {
      const saved = await socketSend(t);
      if (saved) {
        setApiMessages((prev) =>
          replacePendingMessage(prev, pendingUuid, saved),
        );
        stickToBottom();
      } else {
        void fetchMessagesFromApi();
      }
    } catch {
      setApiMessages((m) => m.filter((msg) => msg.uuid !== pendingUuid));
      setChatInput(t);
    } finally {
      setSending(false);
    }
  };

  if (!rendered && !visible) return <></>;

  const backdropOpacity = backdrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const displayRoomName =
    String(roomName ?? "").trim() ||
    (routeTitle.trim() ? `공동 · ${routeTitle.trim()}` : "루트 채팅");

  const chatListBadge =
    chatUnread > 0 ? (chatUnread > 99 ? "99+" : String(chatUnread)) : null;

  return (
    <Modal
      visible={rendered || visible}
      transparent
      animationType="none"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalRoot} edges={["bottom"]}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]}
        >
          <View style={styles.backdropFill} />
        </Animated.View>
        <Pressable style={styles.backdropTap} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: sheetY }],
              maxHeight: sheetMaxHeight,
              zIndex: 2,
            },
          ]}
        >
          {Platform.OS === "ios" ? (
            <View className="items-center pb-1 pt-2">
              <View className="h-1 w-10 rounded-full bg-gray-200" />
            </View>
          ) : (
            <View style={styles.androidSheetTopPad} />
          )}
          <View style={styles.chatHeader}>
            <View className="flex-row items-center">
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-lg font-bold text-gray-900">
                  루트 채팅
                </Text>
                <Text
                  className="mt-0.5 text-[11px] text-gray-500"
                  numberOfLines={1}
                >
                  {displayRoomName}
                  {useApi ? ` · ${memberCount}명` : " · 연결 중…"}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                {onSelectChatRoom && accessToken ? (
                  <Pressable
                    onPress={() => setChatListPickerOpen(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    style={styles.headerListBtn}
                    accessibilityRole="button"
                    accessibilityLabel="채팅 목록"
                  >
                    <Text className="text-xs font-semibold text-sky-700">
                      목록
                    </Text>
                    {chatListBadge ? (
                      <View
                        pointerEvents="none"
                        className="absolute -right-1 -top-1 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1"
                        style={{ minHeight: 16 }}
                      >
                        <Text className="text-[9px] font-bold text-white">
                          {chatListBadge}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleClose}
                  hitSlop={10}
                  style={styles.headerCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel="채팅 닫기"
                >
                  <Ionicons name="close" size={22} color="#64748b" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* 탭 버튼 */}
          <View style={styles.headerDivider} />
          <View className="flex-row border-b border-gray-100">
            <Pressable
              onPress={() => setActiveTab("chat")}
              className={`flex-1 border-b-2 py-3 text-center ${
                activeTab === "chat" ? "border-blue-600" : "border-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === "chat" ? "text-blue-600" : "text-gray-500"
                }`}
              >
                채팅
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("history")}
              className={`flex-1 border-b-2 py-3 text-center ${
                activeTab === "history" ? "border-blue-600" : "border-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === "history" ? "text-blue-600" : "text-gray-500"
                }`}
              >
                기록
              </Text>
            </Pressable>
          </View>

          {activeTab === "chat" ? (
            <>
              {useApi && showSyncBanner ? (
                <View className="flex-row items-center border-b border-gray-50 bg-sky-50 px-3 py-2">
                  <Text className="flex-1 pr-2 text-[11px] leading-4 text-sky-900">
                    채팅 탭과 같은 방입니다. 여기서 보낸 메시지는 채팅 탭에서도 바로
                    보여요.
                  </Text>
                  <Pressable
                    onPress={dismissSyncBanner}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="안내 닫기"
                    className="rounded-full p-1 active:opacity-70"
                  >
                    <Ionicons name="close-circle" size={20} color="#0369a1" />
                  </Pressable>
                </View>
              ) : null}

              <View style={{ maxHeight: 360, position: "relative" }}>
            <KeyboardAwareScrollView
              ref={scrollRef}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              bottomOffset={72}
              scrollEventThrottle={16}
              onScroll={handleScrollPosition}
              onContentSizeChange={() => maybeScrollToEnd(false)}
            >
              {!useApi ? (
                <Text className="py-6 text-center text-xs text-gray-500">
                  채팅방을 선택하거나 루트를 저장한 뒤 다시 열어 주세요.
                </Text>
              ) : roomUnavailable ? (
                <Text className="py-6 text-center text-xs text-gray-500">
                  연결된 채팅방을 찾을 수 없어요.{"\n"}루트를 저장한 뒤 채팅방을
                  다시 연결해 주세요.
                </Text>
              ) : loadingMsgs ? (
                <ActivityIndicator className="py-6" color="#2563eb" />
              ) : (
                (() => {
                  // 메시지 중복 제거 (uuid 기반) - 두 번 검증
                  const seen = new Set<string>();
                  const uniqueMessages = apiMessages
                    .filter((m) => {
                      if (!m.uuid || seen.has(m.uuid)) return false;
                      if (m.isDeleted) return false;
                      seen.add(m.uuid);
                      return true;
                    });

                  return uniqueMessages
                    .filter((msg) => {
                      // 내용이 없는 텍스트 메시지 제외
                      const body = messageBody(msg);
                      if (
                        String(msg.messageType ?? "").trim().toUpperCase() ===
                          "TEXT" &&
                        !body
                      )
                        return false;
                      return true;
                    })
                    .map((msg, index) => {
                    const isMe = msg.senderUuid === myUuid;

                    // 이미지: 썸네일(작게) + 클릭 시 확대
                    if (isImageMessage(msg)) {
                      const uri =
                        String(msg.attachmentUrl ?? "").trim() ||
                        String(msg.content ?? "").trim();
                      if (!uri) return null;
                      return (
                        <View
                          key={msg.uuid}
                          style={{
                            alignSelf: isMe ? "flex-end" : "flex-start",
                            maxWidth: 260,
                            marginBottom: 10,
                          }}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setExpandedImageUrl(uri)}
                          >
                            <Image
                              source={{ uri }}
                              resizeMode="cover"
                              style={{
                                width: 170,
                                height: 130,
                                borderRadius: 14,
                                backgroundColor: "#e5e7eb",
                              }}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    // ROUTE 공유 카드
                    if (
                      String(msg.messageType ?? "")
                        .trim()
                        .toUpperCase() === "ROUTE"
                    ) {
                      return (
                        <View
                          key={msg.uuid}
                          style={{
                            alignSelf: isMe ? "flex-end" : "flex-start",
                            maxWidth: "92%",
                            marginBottom: 10,
                          }}
                        >
                          <Text className="mb-1 text-[10px] font-semibold text-gray-500">
                            {msg.senderNickname || (isMe ? "나" : "멤버")}
                          </Text>
                          <RouteShareMessageCard message={msg} isMine={isMe} />
                        </View>
                      );
                    }

                    // 텍스트
                    const body = messageBody(msg);
                    if (!body) return null;
                    return (
                      <View
                        key={msg.uuid}
                        className={`mb-2 rounded-xl px-3 py-2 ${
                          isMe ? "self-end bg-sky-100" : "self-start bg-gray-100"
                        }`}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                        }}
                      >
                        <Text className="text-[10px] font-semibold text-gray-500">
                          {msg.senderNickname || (isMe ? "나" : "멤버")}
                        </Text>
                        <Text className="text-sm text-gray-900">{body}</Text>
                      </View>
                    );
                    });
                })()
              )}
              {useApi && !loadingMsgs && apiMessages.length === 0 ? (
                <Text className="py-6 text-center text-xs text-gray-400">
                  아직 메시지가 없어요. 첫 메시지를 남겨 보세요.
                </Text>
              ) : null}
            </KeyboardAwareScrollView>
            <ChatScrollToBottomFab
              visible={showScrollToBottom && useApi && apiMessages.length > 0}
              onPress={scrollToBottomPress}
            />
          </View>
          <KeyboardStickyView
            offset={{ closed: 0, opened: Math.max(insets.bottom, 8) }}
          >
            <View
              className="flex-row items-center gap-2 border-t border-gray-100 bg-white px-3 py-2"
              style={{ paddingBottom: Math.max(insets.bottom, 8) }}
            >
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder={
                  roomUnavailable
                    ? "채팅방을 다시 연결해 주세요"
                    : useApi
                      ? "메시지 입력…"
                      : "채팅방을 선택해 주세요"
                }
                className="flex-1 rounded-xl bg-gray-50 px-3 py-2.5 text-base"
                placeholderTextColor="#9ca3af"
                onSubmitEditing={() => void sendChat()}
                editable={useApi && !sending && !roomUnavailable}
              />
              <Pressable
                onPress={() => void sendChat()}
                disabled={!useApi || sending || roomUnavailable}
                className="rounded-xl bg-blue-600 px-4 py-2.5 active:opacity-90"
              >
                <Text className="font-bold text-white">
                  {sending ? "…" : "전송"}
                </Text>
              </Pressable>
            </View>
          </KeyboardStickyView>
            </>
          ) : (
            /* 기록 탭 */
            <View style={{ flex: 1 }}>
              {accessToken && routeId ? (
                <RouteHistoryFeed
                  courseId={routeId}
                  accessToken={accessToken}
                  onClose={handleClose}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
                    루트 기록을 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {chatListPickerOpen && onSelectChatRoom && accessToken ? (
          <View
            style={[
              StyleSheetAbsolute,
              { backgroundColor: "rgba(0,0,0,0.35)", zIndex: 80 },
            ]}
          >
            <Pressable
              style={StyleSheetAbsolute}
              onPress={() => setChatListPickerOpen(false)}
              accessibilityLabel="채팅방 선택 닫기"
            />
            <RouteChatRoomPickerPanel
              embedded
              accessToken={accessToken}
              currentRoomUuid={roomId}
              linkedRoom={linkedChatRoom}
              onClose={() => setChatListPickerOpen(false)}
              onSelectRoom={(room) => {
                setChatListPickerOpen(false);
                onSelectChatRoom(room);
              }}
            />
          </View>
        ) : null}

        {expandedImageUrl ? (
          <View
            style={[
              StyleSheetAbsolute,
              {
                backgroundColor: "rgba(0,0,0,0.72)",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 90,
              },
            ]}
          >
            <Pressable
              style={StyleSheetAbsolute}
              onPress={() => setExpandedImageUrl(null)}
              accessibilityRole="button"
              accessibilityLabel="이미지 닫기"
            />
            <View accessibilityRole="image">
              <Image
                source={{ uri: expandedImageUrl }}
                resizeMode="contain"
                style={{
                  width: 340,
                  height: 420,
                  maxWidth: "92%",
                  maxHeight: "78%",
                }}
              />
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    ...Platform.select({
      android: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e2e8f0",
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
    }),
  },
  androidSheetTopPad: {
    height: 10,
    backgroundColor: "#ffffff",
  },
  chatHeader: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: Platform.OS === "android" ? 4 : 2,
  },
  headerListBtn: {
    position: "relative",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f9ff",
    ...Platform.select({
      android: {},
      default: {
        borderWidth: 1,
        borderColor: "#bae6fd",
      },
    }),
  },
  headerCloseBtn: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
  },
});
