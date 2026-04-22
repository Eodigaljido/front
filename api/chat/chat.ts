import { instance } from "../axios";

export interface ChatRoom {
  uuid: string;
  name: string;
  memberCount: string;
  memberUuids: string[];
  memberUserIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// 채팅방 목록 조회
export async function getChatRooms(accessToken: string): Promise<ChatRoom[]> {
  const res = await instance.get<ChatRoom[]>("/chat/rooms", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
