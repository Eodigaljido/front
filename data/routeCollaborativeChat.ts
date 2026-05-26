import {
  createChatRoom,
  inviteChatMember,
  shareRouteToChat,
  sendMessage,
  type ChatRoom,
} from '../api/chat/chat';
import { getUserProfileByUuid } from '../api/users';
import { buildCollaborativeRouteShareUrl } from '../utils/shareCollaborativeRoute';

export function buildRouteGroupChatName(routeTitle: string): string {
  const t = String(routeTitle ?? '').trim() || '루트';
  return t.startsWith('공동') ? t : `공동 · ${t}`;
}

async function resolveLoginUserId(
  accessToken: string,
  userUuid: string,
): Promise<string | null> {
  try {
    const profile = await getUserProfileByUuid(userUuid);
    const uid = String(profile.userId ?? '').trim();
    return uid || null;
  } catch {
    return null;
  }
}

/** 공동 루트용 단체 채팅방 생성(이미 있으면 uuid만 반환) */
export async function ensureRouteGroupChat(opts: {
  accessToken: string;
  myUuid: string;
  routeTitle: string;
  existingChatRoomUuid?: string | null;
  memberUuids?: string[];
}): Promise<string | null> {
  const existing = String(opts.existingChatRoomUuid ?? '').trim();
  const myUuid = String(opts.myUuid ?? '').trim();
  if (!myUuid) return null;

  const extra = (opts.memberUuids ?? []).map((u) => String(u).trim()).filter(Boolean);
  const memberUuids = [...new Set([myUuid, ...extra])];

  if (existing && extra.length === 0) return existing;

  try {
    const room: ChatRoom = await createChatRoom(
      opts.accessToken,
      memberUuids,
      buildRouteGroupChatName(opts.routeTitle),
      null,
    );
    return String(room.uuid ?? '').trim() || null;
  } catch (e) {
    console.warn('[ensureRouteGroupChat]', e);
    return existing || null;
  }
}

/** 기존 채팅방에 친구 uuid 목록 초대 (Swagger: POST /chats/{roomUuid}/members) */
async function inviteFriendsByUuid(
  accessToken: string,
  roomUuid: string,
  friendUuids: string[],
): Promise<void> {
  for (const uuid of friendUuids) {
    const userId = await resolveLoginUserId(accessToken, uuid);
    if (!userId) continue;
    try {
      await inviteChatMember(accessToken, roomUuid, userId);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) continue;
      console.warn('[inviteFriendsByUuid]', uuid, e);
    }
  }
}

/** 공동 루트 저장 후 채팅방 연동 + 루트 공유 메시지 */
export async function linkRouteToGroupChat(opts: {
  accessToken: string;
  myUuid: string;
  routeId: string;
  routeTitle: string;
  existingChatRoomUuid?: string | null;
}): Promise<string | null> {
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId || routeId.startsWith('ur-')) return opts.existingChatRoomUuid ?? null;

  const chatRoomUuid = await ensureRouteGroupChat({
    accessToken: opts.accessToken,
    myUuid: opts.myUuid,
    routeTitle: opts.routeTitle,
    existingChatRoomUuid: opts.existingChatRoomUuid,
  });
  if (!chatRoomUuid) return null;

  try {
    await shareRouteToChat(opts.accessToken, chatRoomUuid, routeId);
  } catch (e) {
    console.warn('[linkRouteToGroupChat] shareRouteToChat', e);
  }
  return chatRoomUuid;
}

/** 친구 초대: 멤버 추가 + 루트 공유(또는 텍스트 초대) */
export async function inviteFriendsToRouteChat(opts: {
  accessToken: string;
  myUuid: string;
  routeId: string;
  routeTitle: string;
  friendUuids: string[];
  existingChatRoomUuid?: string | null;
}): Promise<{ chatRoomUuid: string | null; sent: boolean }> {
  const friends = [...new Set(opts.friendUuids.map((u) => String(u).trim()).filter(Boolean))];
  if (friends.length === 0) {
    return { chatRoomUuid: opts.existingChatRoomUuid ?? null, sent: false };
  }

  const routeId = String(opts.routeId ?? '').trim();
  let chatRoomUuid = await ensureRouteGroupChat({
    accessToken: opts.accessToken,
    myUuid: opts.myUuid,
    routeTitle: opts.routeTitle,
    existingChatRoomUuid: opts.existingChatRoomUuid,
    memberUuids: friends,
  });

  if (!chatRoomUuid) {
    return { chatRoomUuid: null, sent: false };
  }

  if (opts.existingChatRoomUuid && chatRoomUuid === opts.existingChatRoomUuid) {
    await inviteFriendsByUuid(opts.accessToken, chatRoomUuid, friends);
  }

  const title = String(opts.routeTitle ?? '').trim() || '루트';
  const url = buildCollaborativeRouteShareUrl(routeId);

  try {
    if (routeId && !routeId.startsWith('ur-')) {
      await shareRouteToChat(opts.accessToken, chatRoomUuid, routeId);
    } else {
      const content =
        `「${title}」 공동 루트에 초대합니다.\n함께 편집해 보세요.` +
        (url ? `\n${url}` : '');
      await sendMessage(opts.accessToken, chatRoomUuid, content);
    }
    return { chatRoomUuid, sent: true };
  } catch (e) {
    console.warn('[inviteFriendsToRouteChat]', e);
    return { chatRoomUuid, sent: false };
  }
}
