import { useCallback, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuthStore } from "@/store/authStore";
import { ChatMessage, sendMessage as sendMessageHttp } from "@/api/chat/chat";

// SockJS는 http/https URL 사용 (ws:// 아님)
const STOMP_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://3.36.85.213:8080") +
  "/ws/chat";

export type ChatSocketEvent =
  | { eventType: "MESSAGE_CREATED"; payload: ChatMessage }
  | { eventType: "MESSAGE_EDITED"; payload: ChatMessage }
  | { eventType: "MESSAGE_DELETED"; payload: ChatMessage };

export function useChatSocket(
  roomUuid: string | string[],
  onEvent: (event: ChatSocketEvent) => void,
) {
  const clientRef = useRef<Client | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  // Stable string key so the effect only re-runs when UUIDs actually change
  const roomUuidKey = Array.isArray(roomUuid)
    ? [...roomUuid].filter(Boolean).sort().join(",")
    : roomUuid ?? "";

  useEffect(() => {
    if (!accessToken || !roomUuidKey) return;
    const uuids = roomUuidKey.split(",");

    const client = new Client({
      webSocketFactory: () => new SockJS(STOMP_URL),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: () => {
        uuids.forEach((uuid) => {
          console.log("[STOMP] 연결됨 →", `/topic/chat/${uuid}`);
          client.subscribe(`/topic/chat/${uuid}`, (frame) => {
            try {
              const event: ChatSocketEvent = JSON.parse(frame.body);
              onEventRef.current(event);
            } catch {
              console.warn("[STOMP] 메시지 파싱 오류:", frame.body);
            }
          });
        });
        client.subscribe("/user/queue/errors", (frame) => {
          console.warn("[STOMP] 서버 에러:", frame.body);
        });
      },
      onStompError: (frame) => {
        console.warn("[STOMP] STOMP 오류:", frame.headers["message"]);
      },
      onWebSocketError: (event) => {
        console.warn("[STOMP] WebSocket 오류:", event);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [accessToken, roomUuidKey]);

  // sendMessage is only meaningful for a single-room connection
  const singleRoomUuid = Array.isArray(roomUuid) ? "" : roomUuid;

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!singleRoomUuid) {
        throw new Error("메시지를 전송할 수 없습니다: 채팅방이 지정되지 않았습니다.");
      }
      if (clientRef.current?.connected) {
        clientRef.current.publish({
          destination: `/app/chat/${singleRoomUuid}`,
          body: JSON.stringify({ content, mentionedUserUuids: [] }),
        });
      } else if (accessToken) {
        await sendMessageHttp(accessToken, singleRoomUuid, content);
      } else {
        throw new Error("메시지를 전송할 수 없습니다: 연결이 끊어졌습니다.");
      }
    },
    [accessToken, singleRoomUuid],
  );

  return { sendMessage };
}
