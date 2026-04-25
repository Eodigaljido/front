import { instance } from "../axios";

export interface ChatRoom {
  uuid: string;
  name: string;
  profileImageUrl: string;
  memberCount: number;
  ownerUuid: string;
  ownerUserId: string;
  memberUuids: string[];
  memberUserIds: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  uuid: string;
  senderUuid: string;
  senderNickname: string;
  senderProfileImageUrl: string | null;
  messageType: string;
  content: string;
  routeUuid: string;
  routeTitle: string;
  routeThumbnailUrl: string;
  createdAt: string;
  editedAt: string;
  isDeleted: boolean;
  mentionedUserUuids?: string[];
}

// 채팅방 목록 조회
export async function getChatRooms(accessToken: string): Promise<ChatRoom[]> {
  const res = await instance.get<ChatRoom[]>("/chats", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

// 채팅방 메시지 조회
export async function getRoomMessages(
  accessToken: string,
  roomUuid: string,
  options?: { beforeMessageUuid?: string; limit?: number },
): Promise<ChatMessage[]> {
  const res = await instance.get<ChatMessage[]>(`/chats/${roomUuid}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: options,
  });
  return res.data;
}

// 메세지  전송
export async function sendMessage(
  accessToken: string,
  roomUuid: string,
  content: string,
  mentionedUserUuids?: string[],
): Promise<ChatMessage> {
  const res = await instance.post<ChatMessage>(
    `/chats/${roomUuid}/messages`,
    { content, mentionedUserUuids },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}
