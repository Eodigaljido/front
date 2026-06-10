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
  lastSeenAt?: string;
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
    return nick || '나';
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
    lastSeenAt: m.lastSeenAt,
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
      online: undefined,
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

export function isRouteMemberOnline(member: RouteMember): boolean {
  return member.online === true;
}

export function getOnlineMembers(members: RouteMember[]): RouteMember[] {
  return members.filter((m) => isRouteMemberOnline(m));
}

export function memberPresenceLabel(member: RouteMember): string {
  if (isRouteMemberOnline(member)) return '온라인';
  return '오프라인';
}

/** 방장 외 참여자가 있을 때만 멤버 UI 표시 */
export function hasCollaboratorPeers(members: RouteMember[]): boolean {
  const list = (members ?? []).filter((m) => String(m.id ?? '').trim());
  if (list.length <= 1) return false;
  return list.some((m) => m.role !== 'host');
}

/** collaborative 플래그만으로는 부족 — 실제 공유·참여가 있을 때만 공동 루트 */
export function isEffectivelyCollaborativeRoute(opts?: {
  collaborative?: boolean;
  members?: RouteMember[];
  memberCount?: number;
  chatRoomUuid?: string | null;
  /** 초대 링크로 들어온 편집 세션 */
  forceCollaborative?: boolean;
}): boolean {
  if (opts?.forceCollaborative) return true;
  if (hasCollaboratorPeers(opts?.members ?? [])) return true;
  if (typeof opts?.memberCount === 'number' && opts.memberCount > 1) return true;
  if (opts?.collaborative === true && String(opts?.chatRoomUuid ?? '').trim()) {
    return true;
  }
  return false;
}
