import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRouteMembers,
  getRouteMembers,
  routeMemberDisplayNames,
  type RouteMember,
} from '../data/collaborativeRoute';
import { useAuthStore } from '../store/authStore';

const MEMBERS_POLL_MS = 12_000;

type Options = {
  routeId: string;
  chatRoomUuid?: string | null;
  enabled?: boolean;
  refreshKey?: number;
  /** 편집·멤버 화면에서 주기적으로 members API 재조회 */
  pollMembers?: boolean;
};

function markSelfOnline(
  members: RouteMember[],
  myUuid: string | null | undefined,
): RouteMember[] {
  const me = String(myUuid ?? '').trim();
  if (!me) return members;
  return members.map((m) =>
    m.id === me ? { ...m, online: true } : m,
  );
}

export function useCollaborativeRouteMembers({
  routeId,
  chatRoomUuid,
  enabled = true,
  refreshKey = 0,
  pollMembers = false,
}: Options): {
  members: RouteMember[];
  memberNames: string[];
  loading: boolean;
  refresh: () => void;
} {
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [members, setMembers] = useState<RouteMember[]>(() =>
    getRouteMembers(routeId, {
      hostName: authUser?.nickname ?? '나',
      hostAvatarUri: authUser?.profileImageUrl,
    }),
  );
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const canFetch =
    enabled &&
    Boolean(String(routeId ?? '').trim()) &&
    routeId !== 'new' &&
    !routeId.startsWith('ur-');

  const loadMembers = useCallback(async () => {
    if (!canFetch) {
      setMembers(
        getRouteMembers(routeId, {
          hostName: authUser?.nickname ?? '나',
          hostAvatarUri: authUser?.profileImageUrl,
        }),
      );
      return;
    }

    const next = await fetchRouteMembers({
      routeId,
      chatRoomUuid,
      accessToken,
      myUuid: authUser?.uuid,
      hostName: authUser?.nickname ?? '나',
      hostAvatarUri: authUser?.profileImageUrl,
    });
    setMembers(markSelfOnline(next, authUser?.uuid));
  }, [
    canFetch,
    routeId,
    chatRoomUuid,
    accessToken,
    authUser?.uuid,
    authUser?.nickname,
    authUser?.profileImageUrl,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loadMembers()
      .catch(() => {
        if (!cancelled) {
          setMembers(
            getRouteMembers(routeId, {
              hostName: authUser?.nickname ?? '나',
              hostAvatarUri: authUser?.profileImageUrl,
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadMembers, refreshKey, tick]);

  useEffect(() => {
    if (!canFetch || !pollMembers) return;
    const interval = setInterval(() => {
      void loadMembers();
    }, MEMBERS_POLL_MS);
    return () => clearInterval(interval);
  }, [canFetch, pollMembers, loadMembers]);

  const memberNames = useMemo(
    () => routeMemberDisplayNames(members),
    [members],
  );

  return { members, memberNames, loading, refresh };
}
