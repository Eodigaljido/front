import {
  createChatRoom,
  getChatRoom,
  inviteChatMember,
  shareRouteToChat,
  sendMessage,
  type ChatRoom,
} from '../api/chat/chat';
import { getUserProfileByUuid } from '../api/users';
import {
  addCollaborativeCourseMembers,
  linkCollaborativeCourseChatRoom,
} from '../api/collaborativeCourse';
import { buildCollaborativeRouteShareUrl } from '../utils/shareCollaborativeRoute';
import { Alert } from 'react-native';

export function buildRouteGroupChatName(routeTitle: string): string {
  const t = String(routeTitle ?? '').trim() || '루트';
  return t.startsWith('공동') ? t : `공동 · ${t}`;
}

/** 코스 공유·공개 시 채팅방 생성 여부 확인 */
export function promptCreateCourseChatRoom(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      '채팅방 만들기',
      '이 코스에 대한 채팅방을 만드시겠습니까?\n만들면 채팅 탭과 루트 제작 화면 팝업에서 같은 대화를 볼 수 있어요.',
      [
        { text: '아니오', style: 'cancel', onPress: () => resolve(false) },
        { text: '만들기', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
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

/** 서버에 실제 존재하는 채팅방인지 확인 (로컬에만 남은 uuid 제외) */
async function isChatRoomOnServer(
  accessToken: string,
  roomUuid: string,
): Promise<boolean> {
  const id = String(roomUuid ?? '').trim();
  if (!id) return false;
  const room = await getChatRoom(accessToken, id);
  return Boolean(String(room?.uuid ?? '').trim());
}

async function createRouteGroupChatRoom(opts: {
  accessToken: string;
  myUuid: string;
  routeTitle: string;
  memberUuids: string[];
}): Promise<string | null> {
  try {
    const room: ChatRoom = await createChatRoom(
      opts.accessToken,
      opts.memberUuids,
      buildRouteGroupChatName(opts.routeTitle),
      null,
    );
    return String(room.uuid ?? '').trim() || null;
  } catch (e) {
    console.warn('[createRouteGroupChatRoom]', e);
    return null;
  }
}

/**
 * 공동·코스용 채팅방 확보
 * - existing이 서버에 있으면 재사용
 * - 없거나 404(삭제·만료)면 새로 생성 후 uuid 반환
 */
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

  if (existing && (await isChatRoomOnServer(opts.accessToken, existing))) {
    if (extra.length > 0) {
      await inviteFriendsByUuid(opts.accessToken, existing, extra);
    }
    return existing;
  }

  return createRouteGroupChatRoom({
    accessToken: opts.accessToken,
    myUuid,
    routeTitle: opts.routeTitle,
    memberUuids,
  });
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

/** 채팅방에 ROUTE 공유 메시지 1회 전송 (방 없으면 생성 후 재시도) */
async function postRouteShareToChat(opts: {
  accessToken: string;
  myUuid: string;
  routeId: string;
  routeTitle: string;
  chatRoomUuid: string;
}): Promise<string | null> {
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId || routeId.startsWith('ur-')) return opts.chatRoomUuid;

  let chatRoomUuid = String(opts.chatRoomUuid ?? '').trim();
  if (!chatRoomUuid) return null;

  try {
    await shareRouteToChat(opts.accessToken, chatRoomUuid, routeId);
    return chatRoomUuid;
  } catch (e: any) {
    if (e?.response?.status !== 404) {
      console.warn('[postRouteShareToChat]', e);
      return chatRoomUuid;
    }
    chatRoomUuid =
      (await ensureRouteGroupChat({
        accessToken: opts.accessToken,
        myUuid: opts.myUuid,
        routeTitle: opts.routeTitle,
        existingChatRoomUuid: null,
      })) ?? '';
    if (!chatRoomUuid) return null;
    try {
      await shareRouteToChat(opts.accessToken, chatRoomUuid, routeId);
    } catch (retryErr) {
      console.warn('[postRouteShareToChat] retry', retryErr);
    }
    return chatRoomUuid;
  }
}

/** 공동 루트·코스 채팅방만 연결 (저장·채팅 열기용 — 루트 공유 메시지는 보내지 않음) */
export async function linkRouteToGroupChat(opts: {
  accessToken: string;
  myUuid: string;
  routeId: string;
  routeTitle: string;
  existingChatRoomUuid?: string | null;
}): Promise<string | null> {
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId || routeId.startsWith('ur-')) {
    return opts.existingChatRoomUuid ?? null;
  }

  const chatRoomUuid = await ensureRouteGroupChat({
    accessToken: opts.accessToken,
    myUuid: opts.myUuid,
    routeTitle: opts.routeTitle,
    existingChatRoomUuid: opts.existingChatRoomUuid,
  });

  if (chatRoomUuid) {
    try {
      await linkCollaborativeCourseChatRoom(routeId, chatRoomUuid);
    } catch (e) {
      console.warn('[linkRouteToGroupChat] 코스 협업 연결 실패:', e);
    }
  }

  return chatRoomUuid;
}

/** 링크·코스 공유 시 채팅방 연결 + 루트 공유 메시지 1회 */
export async function linkCourseChatRoomForShare(opts: {
  accessToken: string;
  myUuid: string;
  routeId: string;
  routeTitle: string;
  existingChatRoomUuid?: string | null;
}): Promise<string | null> {
  const chatRoomUuid = await linkRouteToGroupChat(opts);
  if (!chatRoomUuid) return null;
  const routeId = String(opts.routeId ?? '').trim();
  if (routeId && !routeId.startsWith('ur-')) {
    await linkCollaborativeCourseChatRoom(routeId, chatRoomUuid);
  }
  return postRouteShareToChat({
    accessToken: opts.accessToken,
    myUuid: opts.myUuid,
    routeId: opts.routeId,
    routeTitle: opts.routeTitle,
    chatRoomUuid,
  });
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

  let routeId = String(opts.routeId ?? '').trim();

  // 로컬 루트(ur-*)인 경우 먼저 서버에 업로드해야 ROUTE 기록방 연결 가능
  if (routeId.startsWith('ur-')) {
    console.warn('[inviteFriendsToRouteChat] 로컬 루트는 공동 편집을 위해 먼저 서버에 저장되어야 합니다');
    // 로컬 루트는 공동 편집 미지원 - 로컬에서만 사용 가능
    return { chatRoomUuid: null, sent: false };
  }

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

  try {
    const memberResult = await addCollaborativeCourseMembers(routeId, friends);
    if (memberResult.failed > 0) {
      console.warn('[inviteFriendsToRouteChat] 멤버 추가 부분 실패:', { added: memberResult.added, failed: memberResult.failed, friends: friends.length });
      // 주의: 멤버 추가가 실패해도 초대 메시지는 계속 보냄
    }
    // 루트와 채팅방 연결 - 자식 ROUTE 기록방 생성됨
    console.log('[inviteFriendsToRouteChat] 루트와 채팅방 연결 시작:', { routeId, chatRoomUuid });
    const linked = await linkCollaborativeCourseChatRoom(routeId, chatRoomUuid);
    console.log('[inviteFriendsToRouteChat] 루트와 채팅방 연결 결과:', { routeId, chatRoomUuid, linked });
  } catch (err: any) {
    // 루트가 collaborative 모드가 아니면 addCollaborativeCourseMembers 400 에러 발생
    // 이 경우 채팅방은 생성했으니 계속 진행 (협업 기능은 제한됨)
    console.warn('[inviteFriendsToRouteChat] 협업 멤버 설정 실패:', err?.response?.data ?? err);
  }

  const title = String(opts.routeTitle ?? '').trim() || '루트';
  const url = buildCollaborativeRouteShareUrl(routeId);

  const sendInvitePayload = async (roomId: string): Promise<boolean> => {
    console.log('[inviteFriendsToRouteChat] 초대 메시지 전송 시작:', {
      routeId,
      isLocal: routeId?.startsWith('ur-'),
    });

    if (routeId && !routeId.startsWith('ur-')) {
      console.log('[inviteFriendsToRouteChat] 루트 공유 메시지 전송 중...');
      const afterShare = await postRouteShareToChat({
        accessToken: opts.accessToken,
        myUuid: opts.myUuid,
        routeId,
        routeTitle: opts.routeTitle,
        chatRoomUuid: roomId,
      });
      if (!afterShare) {
        console.warn('[inviteFriendsToRouteChat] 루트 공유 메시지 전송 실패');
        throw new Error('route share failed');
      }
      console.log('[inviteFriendsToRouteChat] 루트 공유 메시지 전송 성공');
    } else {
      console.log('[inviteFriendsToRouteChat] 텍스트 초대 메시지 전송 중... (로컬 루트)');
      const content =
        `「${title}」 공동 루트에 초대합니다.\n함께 편집해 보세요.` +
        (url ? `\n${url}` : '');
      await sendMessage(opts.accessToken, roomId, content);
      console.log('[inviteFriendsToRouteChat] 텍스트 초대 메시지 전송 성공');
    }
    return true;
  };

  try {
    await sendInvitePayload(chatRoomUuid);
    console.log('[inviteFriendsToRouteChat] 초대 완료:', { chatRoomUuid, sent: true });
    return { chatRoomUuid, sent: true };
  } catch (e: any) {
    console.error('[inviteFriendsToRouteChat] 초대 메시지 전송 실패:', e?.response?.data ?? e?.message ?? e);
    if (e?.response?.status === 404) {
      console.log('[inviteFriendsToRouteChat] 채팅방 404 - 재생성 시도 중...');
      chatRoomUuid = await ensureRouteGroupChat({
        accessToken: opts.accessToken,
        myUuid: opts.myUuid,
        routeTitle: opts.routeTitle,
        existingChatRoomUuid: null,
        memberUuids: friends,
      });
      if (!chatRoomUuid) {
        console.error('[inviteFriendsToRouteChat] 채팅방 재생성 실패');
        return { chatRoomUuid: null, sent: false };
      }
      try {
        await sendInvitePayload(chatRoomUuid);
        console.log('[inviteFriendsToRouteChat] 재시도 초대 완료');
        return { chatRoomUuid, sent: true };
      } catch (retryErr) {
        console.warn('[inviteFriendsToRouteChat] 재시도 초대 실패:', retryErr?.response?.data ?? retryErr?.message ?? retryErr);
        return { chatRoomUuid, sent: false };
      }
    }
    return { chatRoomUuid, sent: false };
  }
}
