import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { sendCoursePresenceHeartbeat } from '../api/collaborativeCourse';

const HEARTBEAT_MS = 25_000;

type Options = {
  courseId: string | null;
  enabled?: boolean;
  /** RouteCreate 등 편집 화면이 포커스일 때만 heartbeat */
  isEditorFocused?: boolean;
  /** heartbeat 성공 후 멤버 목록 재조회 */
  onAfterPing?: () => void;
};

/** 공동 루트 편집 중 본인 온라인 상태를 서버에 알림 */
export function useCollaborativeRoutePresence({
  courseId,
  enabled = true,
  isEditorFocused = true,
  onAfterPing,
}: Options): { pingNow: () => Promise<void> } {
  const courseIdRef = useRef(courseId);
  const onAfterPingRef = useRef(onAfterPing);
  courseIdRef.current = courseId;
  onAfterPingRef.current = onAfterPing;

  const pingNow = useCallback(async () => {
    const id = String(courseIdRef.current ?? '').trim();
    if (!id || id.startsWith('ur-')) return;
    const ok = await sendCoursePresenceHeartbeat(id);
    if (ok) onAfterPingRef.current?.();
  }, []);

  useEffect(() => {
    const id = String(courseId ?? '').trim();
    if (!enabled || !id || id.startsWith('ur-') || !isEditorFocused) return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void pingNow();
    };

    run();
    const interval = setInterval(run, HEARTBEAT_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && isEditorFocused) run();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [courseId, enabled, isEditorFocused, pingNow]);

  return { pingNow };
}
