/** 공동 루트 편집 멤버 (서버 연동 전 목 데이터) */

export type RouteMemberRole = 'host' | 'member';

export type RouteMember = {
  id: string;
  name: string;
  role: RouteMemberRole;
  avatarUri: string;
  /** 온라인 표시용 (3분마다 갱신 시뮬레이션) */
  online?: boolean;
};

const MOCK_POOL: Omit<RouteMember, 'role' | 'online'>[] = [
  { id: 'm1', name: '지수', avatarUri: 'https://i.pravatar.cc/96?u=collab-m1' },
  { id: 'm2', name: '민호', avatarUri: 'https://i.pravatar.cc/96?u=collab-m2' },
  { id: 'm3', name: '서연', avatarUri: 'https://i.pravatar.cc/96?u=collab-m3' },
  { id: 'm4', name: '준혁', avatarUri: 'https://i.pravatar.cc/96?u=collab-m4' },
  { id: 'm5', name: '하은', avatarUri: 'https://i.pravatar.cc/96?u=collab-m5' },
];

function hashRouteSeed(routeId: string, tick: number): number {
  const s = `${routeId}:${tick}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 3)) % 9973;
  return h;
}

/** 방장 + 참여 멤버 (tick마다 온라인 멤버 구성이 약간 바뀜 — 3분 주기 UI용) */
export function getRouteMembers(
  routeId: string,
  opts?: { hostName?: string; refreshTick?: number },
): RouteMember[] {
  const rid = String(routeId ?? '').trim() || 'new';
  const tick = opts?.refreshTick ?? 0;
  const hostName = String(opts?.hostName ?? '나').trim() || '나';
  const seed = hashRouteSeed(rid, tick);

  const extraCount = 2 + (seed % 3);
  const members: RouteMember[] = [
    {
      id: 'host-me',
      name: hostName,
      role: 'host',
      avatarUri: 'https://i.pravatar.cc/96?u=host-me',
      online: true,
    },
  ];

  for (let i = 0; i < extraCount; i++) {
    const p = MOCK_POOL[(seed + i * 7) % MOCK_POOL.length];
    if (members.some((m) => m.id === p.id)) continue;
    members.push({
      ...p,
      role: 'member',
      online: (seed + i + tick) % 3 !== 0,
    });
  }

  return members;
}

export function getOnlineMembers(members: RouteMember[]): RouteMember[] {
  return members.filter((m) => m.online !== false);
}
