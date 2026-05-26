import { instance } from './axios';

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  referenceId?: string;
  referenceType?: string;
  senderUuid?: string;
  senderUserId?: string;
  isRead: boolean;
  createdAt: string;
};

function pickNotificationList(data: unknown): AppNotification[] {
  if (Array.isArray(data)) return data as AppNotification[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items as AppNotification[];
    if (Array.isArray(d.content)) return d.content as AppNotification[];
  }
  return [];
}

export async function fetchNotifications(
  accessToken: string,
): Promise<AppNotification[]> {
  const res = await instance.get('/notifications', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return pickNotificationList(res.data);
}
