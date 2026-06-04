/** 공동 루트 편집 멤버 */

import type { CourseMemberDto } from '../api/collaborativeCourse';
import { fetchCourseMembers } from '../api/collaborativeCourse';
import type { ChatMemberSummary } from '../api/chat/chat';
import { getChatRoom } from '../api/chat/chat';

export type RouteMemberRole = 'host' | 'member';

export type RouteMember = {
  id: string;
  name: string;
  role: RouteMemberRole;
  avatarUri: string;
  online?: boolean;
};

const DEFAULT_HOST_AVATAR =
  'https://ui-avatars.com/api/?name=Host&background=e2e8f0&color=475569';

function avatarForName(name: string, uri?: string | null): string {
  const u = String(uri ?? '').trim();
  if (u) return u;
  const label = encodeURIComponent(String(name ?? 'M').trim() || 'M');
  return `https://ui-avatars.com/api/?name=${label}&background=e2e8f0&color=475569`;
}

function formatMemberDisplayName(
  nickname: string | undefined,
  userId: string | undefined,
  userUuid: string,
  myUuid?: string | null,
): string {
  const me = String(myUuid ?? '').trim();
  const nick = String(nickname ?? '').trim();
  const uid = String(userId ?? '').trim();
  const isMe = Boolean(me && userUuid === me);
  if (isMe) {
    return nick ? `${nick} (나)` : '나';
  }
  if (nick) return nick;
  if (uid) return `@${uid}`;
  return '멤버';
}

export function courseMembersToRouteMembers(
  dtos: CourseMemberDto[],
  myUuid?: string | null,
): RouteMember[] {
  return dtos.map((m) => ({
    id: m.userUuid,
    name: formatMemberDisplayName(m.nickname, m.userId, m.userUuid, myUuid),
    role: m.role === 'OWNER' ? 'host' : 'member',
    avatarUri: avatarForName(m.nickname ?? m.userId ?? 'M', m.profileImageUrl),
    online: m.online,
  }));
}

export function chatMembersToRouteMembers(
  members: ChatMemberSummary[],
  myUuid?: string | null,
  ownerUuid?: string | null,
): RouteMember[] {
  const me = String(myUuid ?? '').trim();
  const owner = String(ownerUuid ?? '').trim();
  return members.map((m, index) => {
    const id = String(m.uuid ?? '').trim() || `chat-${index}`;
    const isOwner = Boolean(owner && id === owner);
    const isMe = Boolean(me && id === me);
    return {
      id,
      name: formatMemberDisplayName(m.nickname, m.userId, id, myUuid),
      role: isOwner || isMe ? 'host' : 'member',
      avatarUri: avatarForName(m.nickname ?? m.userId ?? 'M', m.profileImageUrl),
      online: true,
    };
  });
}

/** API·채팅방 조회 전 즉시 표시용 — 방장(본인)만 */
export function getRouteMembers(
  _routeId: string,
  opts?: { hostName?: string; hostAvatarUri?: string | null },
): RouteMember[] {
  const hostName = String(opts?.hostName ?? '나').trim() || '나';
  const avatar =
    String(opts?.hostAvatarUri ?? '').trim() || DEFAULT_HOST_AVATAR;
  return [
    {
      id: 'host-me',
      name: hostName,
      role: 'host',
      avatarUri: avatar,
      online: true,
    },
  ];
}

export type FetchRouteMembersOpts = {
  routeId: string;
  chatRoomUuid?: string | null;
  accessToken?: string | null;
  myUuid?: string | null;
  hostName?: string;
  hostAvatarUri?: string | null;
};

/** 코스 members API → 없으면 연결된 채팅방 멤버 → 최종 폴백은 방장만 */
export async function fetchRouteMembers(
  opts: FetchRouteMembersOpts,
): Promise<RouteMember[]> {
  const routeId = String(opts.routeId ?? '').trim();
  const fallback = () =>
    getRouteMembers(routeId || 'new', {
      hostName: opts.hostName,
      hostAvatarUri: opts.hostAvatarUri,
    });

  if (!routeId || routeId === 'new' || routeId.startsWith('ur-')) {
    return fallback();
  }

  const courseMembers = await fetchCourseMembers(routeId);
  if (courseMembers.length > 0) {
    return courseMembersToRouteMembers(courseMembers, opts.myUuid);
  }

  const roomId = String(opts.chatRoomUuid ?? '').trim();
  const token = String(opts.accessToken ?? '').trim();
  if (roomId && token) {
    const room = await getChatRoom(token, roomId);
    const chatMembers = room?.members ?? [];
    if (chatMembers.length > 0) {
      return chatMembersToRouteMembers(
        chatMembers,
        opts.myUuid,
        room?.ownerUuid,
      );
    }
  }

  return fallback();
}

export function routeMemberDisplayNames(members: RouteMember[]): string[] {
  return members.map((m) => m.name).filter(Boolean);
}

export function getOnlineMembers(members: RouteMember[]): RouteMember[] {
  return members.filter((m) => m.online !== false);
}

/** 방장 외 참여자가 있을 때만 멤버 UI 표시 */
export function hasCollaboratorPeers(members: RouteMember[]): boolean {
  return members.some((m) => m.role !== 'host');
}
