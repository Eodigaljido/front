import { instance } from '../axios';
import type { GroupChatRoom } from './types';

/** GET /api/groups/{groupUuid}/chat-rooms — 모임 채팅방 목록 */
export async function getGroupChatRooms(
  accessToken: string,
  groupUuid: string,
): Promise<GroupChatRoom[]> {
  const res = await instance.get<GroupChatRoom[]>(
    `/api/groups/${groupUuid}/chat-rooms`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /api/groups/{groupUuid}/chat-rooms — 모임 채팅방 생성 (방장만) */
export async function createGroupChatRoom(
  accessToken: string,
  groupUuid: string,
  name: string,
): Promise<GroupChatRoom> {
  const res = await instance.post<GroupChatRoom>(
    `/api/groups/${groupUuid}/chat-rooms`,
    { name },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}
