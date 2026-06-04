import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRouteMembers,
  getRouteMembers,
  routeMemberDisplayNames,
  type RouteMember,
} from '../data/collaborativeRoute';
import { useAuthStore } from '../store/authStore';

type Options = {
  routeId: string;
  chatRoomUuid?: string | null;
  enabled?: boolean;
  refreshKey?: number;
};

export function useCollaborativeRouteMembers({
  routeId,
  chatRoomUuid,
  enabled = true,
  refreshKey = 0,
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

  useEffect(() => {
    if (!canFetch) {
      setMembers(
        getRouteMembers(routeId, {
          hostName: authUser?.nickname ?? '나',
          hostAvatarUri: authUser?.profileImageUrl,
        }),
      );
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchRouteMembers({
      routeId,
      chatRoomUuid,
      accessToken,
      myUuid: authUser?.uuid,
      hostName: authUser?.nickname ?? '나',
      hostAvatarUri: authUser?.profileImageUrl,
    })
      .then((next) => {
        if (!cancelled) setMembers(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canFetch,
    routeId,
    chatRoomUuid,
    accessToken,
    authUser?.uuid,
    authUser?.nickname,
    authUser?.profileImageUrl,
    refreshKey,
    tick,
  ]);

  const memberNames = useMemo(
    () => routeMemberDisplayNames(members),
    [members],
  );

  return { members, memberNames, loading, refresh };
}
