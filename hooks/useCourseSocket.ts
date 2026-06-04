import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuthStore } from '@/store/authStore';
import { collabSyncLog, collabSyncWarn } from '../utils/collabRouteDebugLog';

const STOMP_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.EXPO_SOCKET_URL) +
  '/ws/chat';

export type CourseSocketEvent =
  | {
      eventType: 'COURSE_UPDATED';
      payload: {
        courseUuid: string;
        version: number;
        updatedAt?: string;
        editorUuid: string;
        editorNickname?: string;
      };
    }
  | {
      eventType: 'COURSE_MEMBER_JOINED';
      payload: { courseUuid: string; userUuid: string };
    }
  | {
      eventType: 'COURSE_MEMBER_LEFT';
      payload: { courseUuid: string; userUuid: string };
    };

export function useCourseSocket(
  courseUuid: string | null | undefined,
  onEvent: (event: CourseSocketEvent) => void,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const courseId = String(courseUuid ?? '').trim();

  useEffect(() => {
    if (!accessToken || !courseId || courseId.startsWith('ur-')) {
      collabSyncLog('stomp_skip', {
        reason: !accessToken
          ? 'no_token'
          : !courseId
            ? 'no_course_id'
            : 'local_draft',
        courseId: courseId || null,
      });
      setIsConnected(false);
      return;
    }

    collabSyncLog('stomp_connecting', { url: STOMP_URL, courseId });

    const client = new Client({
      webSocketFactory: () => new SockJS(STOMP_URL),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setIsConnected(true);
        collabSyncLog('stomp_connected', {
          topic: `/topic/course/${courseId}`,
        });
        client.subscribe(`/topic/course/${courseId}`, (frame) => {
          try {
            const event: CourseSocketEvent = JSON.parse(frame.body);
            collabSyncLog('stomp_event', {
              eventType: event.eventType,
              courseUuid:
                'courseUuid' in event.payload
                  ? event.payload.courseUuid
                  : undefined,
              version:
                event.eventType === 'COURSE_UPDATED'
                  ? event.payload.version
                  : undefined,
            });
            onEventRef.current(event);
          } catch {
            collabSyncWarn('stomp_parse_error', {
              bodyPreview: String(frame.body ?? '').slice(0, 200),
            });
          }
        });
      },
      onDisconnect: () => {
        collabSyncLog('stomp_disconnected', { courseId });
        setIsConnected(false);
      },
      onStompError: (frame) => {
        collabSyncWarn('stomp_error', {
          message: frame.headers['message'],
        });
      },
      onWebSocketError: () => {
        collabSyncWarn('stomp_websocket_error', { courseId });
        setIsConnected(false);
      },
    });

    client.activate();
    return () => {
      collabSyncLog('stomp_cleanup', { courseId });
      setIsConnected(false);
      void client.deactivate();
    };
  }, [accessToken, courseId]);

  return { isConnected };
}
