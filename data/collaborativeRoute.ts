/** 공동 루트 편집 멤버 — API 연동 전까지 방장(본인)만 표시 */

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

/** 방장만 반환 (가짜 멤버 목 데이터 제거). 백엔드 members API 연동 시 확장 */
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

export function getOnlineMembers(members: RouteMember[]): RouteMember[] {
  return members.filter((m) => m.online !== false);
}

/** 방장 외 참여자가 있을 때만 멤버 UI 표시 */
export function hasCollaboratorPeers(members: RouteMember[]): boolean {
  return members.some((m) => m.role !== 'host');
}
