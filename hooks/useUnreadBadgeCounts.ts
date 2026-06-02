import { useCallback, useEffect, useState } from 'react';
import { getChatRooms } from '../api/chat/chat';
import { fetchNotifications } from '../api/notifications';
import type { ChatSocketEvent } from './useChatSocket';

export function useUnreadBadgeCounts(
  accessToken: string | null | undefined,
  enabled: boolean,
) {
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || !accessToken) {
      setNotificationUnread(0);
      setChatUnread(0);
      return;
    }
    await Promise.all([
      fetchNotifications(accessToken)
        .then((list) =>
          setNotificationUnread(list.filter((n) => !n.isRead).length),
        )
        .catch(() => setNotificationUnread(0)),
      getChatRooms(accessToken)
        .then((rooms) =>
          setChatUnread(
            rooms.reduce((sum, r) => sum + Math.max(0, r.unreadCount ?? 0), 0),
          ),
        )
        .catch(() => setChatUnread(0)),
    ]);
  }, [accessToken, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  const onChatSocketEvent = useCallback(
    (event: ChatSocketEvent) => {
      if (event.eventType === 'MESSAGE_CREATED') {
        void refresh();
      }
    },
    [refresh],
  );

  return { notificationUnread, chatUnread, refresh, onChatSocketEvent };
}

export function formatBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}
