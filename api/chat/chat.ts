import { isAxiosError } from "axios";
import { instance } from "../axios";

/** 삭제·만료된 채팅방 (404) */
export function isChatApiNotFoundError(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404;
}
import {
  fetchMultipart,
  fileNameFromUri,
  mimeFromUri,
} from "../multipartFetch";

export type ChatMemberSummary = {
  uuid: string;
  userId?: string;
  nickname?: string;
  profileImageUrl?: string | null;
};

export interface ChatRoom {
  uuid: string;
  name: string;
  profileImageUrl: string;
  memberCount: number;
  ownerUuid: string;
  ownerUserId: string;
  memberUuids?: string[];
  memberUserIds?: string[];
  members?: ChatMemberSummary[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

/** Swagger: GET /chats/{roomUuid} */
export async function getChatRoom(
  accessToken: string,
  roomUuid: string,
): Promise<ChatRoom | null> {
  try {
    const res = await instance.get<ChatRoom>(`/chats/${roomUuid}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

export interface ChatMessage {
  uuid: string;
  senderUuid: string;
  senderNickname: string;
  senderProfileImageUrl: string | null;
  messageType: "TEXT" | "IMAGE" | "ROUTE" | string;
  content: string | null;
  attachmentUrl: string | null;
  routeUuid: string | null;
  routeTitle: string | null;
  routeThumbnailUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  mentionedUserUuids?: string[];
}

function normalizeChatMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.uuid === "string") return raw as ChatMessage;
  const inner = o.data;
  if (inner && typeof inner === "object" && typeof (inner as ChatMessage).uuid === "string") {
    return inner as ChatMessage;
  }
  return null;
}

function normalizeChatMessageList(raw: unknown): ChatMessage[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeChatMessage(item))
      .filter((m): m is ChatMessage => Boolean(m));
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["data", "items", "content"] as const) {
      const nested = o[key];
      if (Array.isArray(nested)) return normalizeChatMessageList(nested);
    }
  }
  return [];
}

// 채팅방 목록 조회
export async function getChatRooms(accessToken: string): Promise<ChatRoom[]> {
  const res = await instance.get<ChatRoom[]>("/chats", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}

// 채팅방 상세 조회 (멤버 목록 포함)
export async function getChatRoomDetails(
  roomUuid: string,
  accessToken: string,
): Promise<ChatRoom> {
  const res = await instance.get<ChatRoom>(`/chats/${roomUuid}`, {
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
  return normalizeChatMessageList(res.data);
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
  const msg = normalizeChatMessage(res.data);
  if (!msg) {
    throw new Error("메시지 전송 응답을 해석하지 못했습니다.");
  }
  return msg;
}

// 읽음 처리
export async function markAsRead(
  accessToken: string,
  roomUuid: string,
): Promise<void> {
  await instance.post(`/chats/${roomUuid}/read`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// 메세지 삭제
export async function deleteMessage(
  accessToken: string,
  roomUuid: string,
  messageUuid: string,
): Promise<void> {
  await instance.delete(`/chats/${roomUuid}/messages/${messageUuid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// 메세지 수정
export async function editMessage(
  accessToken: string,
  roomUuid: string,
  messageUuid: string,
  content: string,
): Promise<ChatMessage> {
  const res = await instance.patch<ChatMessage>(
    `/chats/${roomUuid}/messages/${messageUuid}`,
    { content },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

// 채팅방 나가기
export async function leaveChatRoom(
  accessToken: string,
  roomUuid: string,
): Promise<void> {
  await instance.delete(`/chats/${roomUuid}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// 채팅방 생성
export async function createChatRoom(
  accessToken: string,
  memberUuids: string[],
  name: string,
  image: string | null,
): Promise<ChatRoom> {
  const body: Record<string, unknown> = { name, memberUuids };
  if (image != null) body.image = image;
  const res = await instance.post<ChatRoom>("/chats", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

// 채팅방 삭제 (방장만 가능)
export async function deleteChatRoom(
  accessToken: string,
  roomUuid: string,
): Promise<void> {
  await instance.delete(`/chats/${roomUuid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// 채팅방 이름 변경
export async function renameChatRoom(
  accessToken: string,
  roomUuid: string,
  newName: string,
): Promise<void> {
  await instance.patch(
    `/chats/${roomUuid}/name`,
    { name: newName },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

/** Swagger: POST /chats/{roomUuid}/members — 친구(userId) 초대 */
export async function inviteChatMember(
  accessToken: string,
  roomUuid: string,
  userId: string,
): Promise<ChatRoom> {
  const res = await instance.post<ChatRoom>(
    `/chats/${roomUuid}/members`,
    { userId: String(userId ?? "").trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

// 이미지 메시지 전송
export async function sendImageMessage(
  accessToken: string,
  roomUuid: string,
  imageUri: string,
): Promise<ChatMessage> {
  const filename = fileNameFromUri(imageUri, "image.jpg");
  const mime = mimeFromUri(imageUri);
  const { data } = await fetchMultipart(
    `chats/${roomUuid}/images`,
    "POST",
    [{ field: "image", file: { uri: imageUri, name: filename, type: mime } }],
    { accessToken },
  );
  return data as ChatMessage;
}

/** PATCH /chats/{roomUuid}/image — 채팅방 프로필 이미지 업로드 */
export async function updateChatRoomImage(
  accessToken: string,
  roomUuid: string,
  imageUri: string,
): Promise<void> {
  const filename = fileNameFromUri(imageUri, "image.png");
  const mime = mimeFromUri(imageUri);
  await fetchMultipart(
    `chats/${roomUuid}/profile-image`,
    "PATCH",
    [{ field: "image", file: { uri: imageUri, name: filename, type: mime } }],
    { accessToken },
  );
}

// ── 루트 기록 ──────────────────────────────────────────────────────────────────

export interface RouteHistoryItem {
  courseUuid: string;
  routeChatRoomUuid: string;
  name: string;
  participantCount: number;
}

export interface RouteFeedItem {
  type: "CHAT" | "COURSE";
  itemId: number;
  actorUuid: string;
  actorNickname: string;
  actorProfileImageUrl: string | null;
  content: string | null;
  action: "CHAT" | "CHAT_EDITED" | "CHAT_DELETED" | "ROUTE_UPDATED";
  editDescription: string | null;
  createdAt: string;
}

export interface RouteFeedPage {
  items: RouteFeedItem[];
  pageInfo: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

/** GET /api/route-history?chatRoomUuid=... */
export async function getRouteHistory(
  accessToken: string,
  chatRoomUuid: string,
): Promise<RouteHistoryItem[]> {
  const res = await instance.get<RouteHistoryItem[]>("/api/route-history", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { chatRoomUuid },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** GET /api/route-history/{courseId}/feed */
export async function getRouteFeed(
  accessToken: string,
  courseId: string,
  page = 0,
  size = 30,
): Promise<RouteFeedPage> {
  const res = await instance.get<RouteFeedPage>(
    `/api/route-history/${courseId}/feed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, size },
    },
  );
  return res.data;
}

/** Swagger: POST /chats/{roomUuid}/route — 루트 공유 메시지(ROUTE 타입) */
export async function shareRouteToChat(
  accessToken: string,
  roomUuid: string,
  routeUuid: string,
): Promise<ChatMessage> {
  const res = await instance.post<ChatMessage>(
    `/chats/${roomUuid}/route`,
    { routeUuid: String(routeUuid ?? "").trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}
