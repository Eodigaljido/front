import { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuthStore } from "@/store/authStore";
import { ChatMessage, sendMessage as sendMessageHttp } from "@/api/chat/chat";

// SockJS는 http/https URL 사용 (ws:// 아님)
const getStompUrl = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_SOCKET_URL ?? "";
  const cleanUrl = baseUrl.replace(/\/$/, ""); // trailing slash 제거
  return `${cleanUrl}/ws/chat`;
};

export type ChatSocketEvent =
  | { eventType: "MESSAGE_CREATED"; payload: ChatMessage }
  | { eventType: "MESSAGE_EDITED"; payload: ChatMessage }
  | { eventType: "MESSAGE_DELETED"; payload: ChatMessage };

export interface TypingEvent {
  senderUuid: string;
  senderNickname: string;
  isTyping: boolean;
}

export function useChatSocket(
  roomUuid: string | string[],
  onEvent: (event: ChatSocketEvent) => void,
  onTypingEvent?: (event: TypingEvent) => void,
  onAuthError?: () => void,
) {
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const readyRef = useRef(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const onEventRef = useRef(onEvent);
  const onTypingEventRef = useRef(onTypingEvent);
  const onAuthErrorRef = useRef(onAuthError);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    onTypingEventRef.current = onTypingEvent;
  });

  useEffect(() => {
    onAuthErrorRef.current = onAuthError;
  });

  const roomUuidKey = Array.isArray(roomUuid)
    ? [...roomUuid].filter(Boolean).sort().join(",")
    : (roomUuid ?? "");

  useEffect(() => {
    if (!accessToken || !roomUuidKey) return;
    const uuids = roomUuidKey.split(",").filter(Boolean);

    // 기존 구독 정리
    const unsubscribeAll = () => {
      subscriptionsRef.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.warn("[STOMP] 구독 해제 오류:", e);
        }
      });
      subscriptionsRef.current.clear();
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(getStompUrl()),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("[STOMP] 연결 성공:", getStompUrl());
        setIsConnected(true);
        readyRef.current = false;

        // 기존 구독 정리 (재연결 시)
        unsubscribeAll();

        // 새로운 구독 시작 (연결 확인 후 즉시)
        try {
          uuids.forEach((uuid) => {
            if (!client.connected) {
              console.warn("[STOMP] 클라이언트 미연결 상태, 구독 취소");
              return;
            }

            console.log("[STOMP] 구독 시작 →", `/topic/chat/${uuid}`);

            try {
              const sub1 = client.subscribe(`/topic/chat/${uuid}`, (frame) => {
                try {
                  const event: ChatSocketEvent = JSON.parse(frame.body);
                  onEventRef.current(event);
                } catch {
                  console.warn("[STOMP] 메시지 파싱 오류:", frame.body);
                }
              });
              subscriptionsRef.current.set(`chat-${uuid}`, sub1);

              const sub2 = client.subscribe(`/topic/chat/${uuid}/typing`, (frame) => {
                try {
                  const event: TypingEvent = JSON.parse(frame.body);
                  onTypingEventRef.current?.(event);
                } catch {
                  console.warn("[STOMP] 타이핑 이벤트 파싱 오류:", frame.body);
                }
              });
              subscriptionsRef.current.set(`typing-${uuid}`, sub2);
            } catch (err) {
              console.error("[STOMP] 구독 실패:", err);
            }
          });

          const errorSub = client.subscribe("/user/queue/errors", (frame) => {
            console.warn("[STOMP] 서버 에러:", frame.body);
          });
          subscriptionsRef.current.set("errors", errorSub);

          readyRef.current = true;
        } catch (err) {
          console.error("[STOMP] onConnect 중 오류:", err);
          setIsConnected(false);
          readyRef.current = false;
        }
      },
      onDisconnect: () => {
        console.log("[STOMP] 연결 해제됨");
        setIsConnected(false);
        readyRef.current = false;
      },
      onStompError: (frame) => {
        const errorMessage = frame.headers["message"] as string || '';
        console.error("[STOMP] STOMP 오류:", errorMessage, frame);
        setIsConnected(false);
        readyRef.current = false;

        // 토큰 만료 감지
        if (errorMessage.includes('token_expired') || errorMessage.includes('authentication failed')) {
          console.warn("[STOMP] 토큰 만료 - 로그아웃 처리");
          logout();
          onAuthErrorRef.current?.();
        }
      },
      onWebSocketError: (event) => {
        console.error("[STOMP] WebSocket 오류:", event);
        setIsConnected(false);
        readyRef.current = false;
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      setIsConnected(false);
      readyRef.current = false;
      unsubscribeAll();
      try {
        client.deactivate();
      } catch (e) {
        console.warn("[STOMP] 연결 해제 오류:", e);
      }
      clientRef.current = null;
    };
  }, [accessToken, roomUuidKey]);

  // sendMessage / sendTyping are only meaningful for a single-room connection
  const singleRoomUuid = Array.isArray(roomUuid) ? "" : roomUuid;

  const sendMessage = useCallback(
    async (content: string): Promise<ChatMessage | null> => {
      if (!singleRoomUuid) {
        throw new Error(
          "메시지를 전송할 수 없습니다: 채팅방이 지정되지 않았습니다.",
        );
      }
      if (!accessToken) {
        throw new Error("메시지를 전송할 수 없습니다: 연결이 끊어졌습니다.");
      }
      return sendMessageHttp(accessToken, singleRoomUuid, content);
    },
    [accessToken, singleRoomUuid],
  );

  const sendTyping = useCallback(
    (isTyping: boolean): void => {
      if (!singleRoomUuid || !clientRef.current?.connected || !readyRef.current) return;
      clientRef.current.publish({
        destination: `/app/chat/${singleRoomUuid}/typing`,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isTyping }),
      });
    },
    [singleRoomUuid, accessToken],
  );

  return { sendMessage, sendTyping, isConnected };
}
