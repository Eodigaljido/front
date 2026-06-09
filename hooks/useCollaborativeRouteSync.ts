import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMyCourseDetail,
  type UpsertMyRoutePayload,
} from '../api/courses';
import {
  patchMyRouteWithVersion,
  type PatchCourseResult,
} from '../api/collaborativeCourse';
import type { CourseItem } from '../data/mockData';
import {
  useCourseSocket,
  type CourseSocketEvent,
} from './useCourseSocket';
import { collabSyncLog, collabSyncWarn } from '../utils/collabRouteDebugLog';

const DEFAULT_DEBOUNCE_MS = 1200;
const DEFAULT_POLL_MS = 5000;
const TITLE_DEBOUNCE_MS = 800;
const MAX_CONFLICT_RETRIES = 3;

export type CollaborativeRemoteApplyContext = {
  /** 원격에서 제목 덮어쓰지 않음 (로컬 입력 중) */
  skipTitle?: boolean;
};

export type UseCollaborativeRouteSyncOptions = {
  enabled: boolean;
  canPush?: boolean;
  courseId: string | null;
  initialVersion?: number;
  myUuid?: string | null;
  syncKey: string;
  /** 제목만 변경됐을 때 — 입력 중 PATCH 지연용 별도 키 */
  titleSyncKey?: string;
  buildPayload: () => UpsertMyRoutePayload;
  onApplyRemote: (
    course: CourseItem,
    ctx?: CollaborativeRemoteApplyContext,
  ) => void;
  /** true면 원격 reload 시 제목 유지 */
  getRemoteSkip?: () => CollaborativeRemoteApplyContext;
  showToast?: (message: string) => void;
  onMembersChange?: () => void;
  debounceMs?: number;
  pollMs?: number;
};

export function useCollaborativeRouteSync({
  enabled,
  canPush = true,
  courseId,
  initialVersion = 0,
  myUuid,
  syncKey,
  titleSyncKey,
  buildPayload,
  onApplyRemote,
  getRemoteSkip,
  showToast: _showToast,
  onMembersChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  pollMs = DEFAULT_POLL_MS,
}: UseCollaborativeRouteSyncOptions): {
  serverVersion: number;
  setServerVersion: (v: number) => void;
  isCourseSocketConnected: boolean;
  reloadFromServer: () => Promise<void>;
} {
  const [serverVersion, setServerVersion] = useState(initialVersion);
  const serverVersionRef = useRef(serverVersion);
  const suppressPatchRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const patchInFlightRef = useRef(false);
  const patchQueuedRef = useRef(false);
  const lastReloadVersionRef = useRef(-1);
  const buildPayloadRef = useRef(buildPayload);
  const onApplyRemoteRef = useRef(onApplyRemote);
  const onMembersChangeRef = useRef(onMembersChange);
  const getRemoteSkipRef = useRef(getRemoteSkip);

  serverVersionRef.current = serverVersion;
  buildPayloadRef.current = buildPayload;
  onApplyRemoteRef.current = onApplyRemote;
  onMembersChangeRef.current = onMembersChange;
  getRemoteSkipRef.current = getRemoteSkip;

  useEffect(() => {
    setServerVersion(initialVersion);
    serverVersionRef.current = initialVersion;
    lastReloadVersionRef.current = -1;
  }, [courseId, initialVersion]);

  useEffect(() => {
    collabSyncLog('sync_state', {
      enabled,
      canPush,
      courseId: courseId ?? null,
      initialVersion,
      serverVersion,
    });
  }, [enabled, canPush, courseId, initialVersion, serverVersion]);

  const applyRemoteCourse = useCallback((course: CourseItem) => {
    const skip = getRemoteSkipRef.current?.() ?? {};
    onApplyRemoteRef.current(course, skip);
  }, []);

  const reloadFromServer = useCallback(
    async (opts?: { force?: boolean }) => {
      const id = String(courseId ?? '').trim();
      if (!id || id.startsWith('ur-')) return;
      collabSyncLog('reload_start', {
        courseId: id,
        force: opts?.force === true,
      });
      const detail = await fetchMyCourseDetail(id);
      if (!detail) {
        collabSyncWarn('reload_empty', { courseId: id });
        return;
      }
      const v = Number(detail.version ?? NaN);
      if (
        opts?.force !== true &&
        Number.isFinite(v) &&
        v >= 0 &&
        v === lastReloadVersionRef.current
      ) {
        collabSyncLog('reload_skip_unchanged', { version: v });
        if (v > serverVersionRef.current) {
          setServerVersion(v);
          serverVersionRef.current = v;
        }
        return;
      }
      if (Number.isFinite(v) && v >= 0) {
        lastReloadVersionRef.current = v;
      }
      suppressPatchRef.current = true;
      isApplyingRemoteRef.current = true;
      try {
        applyRemoteCourse(detail);
        if (Number.isFinite(v) && v >= 0) {
          setServerVersion(v);
          serverVersionRef.current = v;
        }
        collabSyncLog('reload_done', {
          courseId: id,
          version: detail.version ?? null,
          stops: detail.routeSteps?.length ?? 0,
          skipTitle: getRemoteSkipRef.current?.().skipTitle === true,
        });
      } finally {
        isApplyingRemoteRef.current = false;
      }
    },
    [courseId, applyRemoteCourse],
  );

  const healConflictAndRetry = useCallback(
    async (
      id: string,
      conflict: Extract<PatchCourseResult, { ok: false; conflict: true }>,
      depth = 0,
    ): Promise<boolean> => {
      if (depth >= MAX_CONFLICT_RETRIES) {
        collabSyncWarn('conflict_max_retries', { courseId: id });
        return false;
      }

      setServerVersion(conflict.currentVersion);
      serverVersionRef.current = conflict.currentVersion;
      lastReloadVersionRef.current = conflict.currentVersion;

      suppressPatchRef.current = true;
      isApplyingRemoteRef.current = true;
      try {
        if (conflict.course) {
          applyRemoteCourse(conflict.course);
        } else {
          await reloadFromServer({ force: true });
        }
      } finally {
        isApplyingRemoteRef.current = false;
      }

      const retry = await patchMyRouteWithVersion(id, {
        ...buildPayloadRef.current(),
        version: conflict.currentVersion,
      });

      if (retry.ok) {
        setServerVersion(retry.version);
        serverVersionRef.current = retry.version;
        lastReloadVersionRef.current = retry.version;
        collabSyncLog('patch_ok_after_conflict', {
          courseId: id,
          version: retry.version,
          depth,
        });
        return true;
      }
      if (retry.conflict) {
        return healConflictAndRetry(id, retry, depth + 1);
      }
      return false;
    },
    [applyRemoteCourse, reloadFromServer],
  );

  const pushLocalChanges = useCallback(async () => {
    const id = String(courseId ?? '').trim();
    if (!id || id.startsWith('ur-') || !enabled || !canPush) return;
    if (isApplyingRemoteRef.current) {
      collabSyncLog('patch_skip', { applyingRemote: true });
      return;
    }
    if (patchInFlightRef.current) {
      patchQueuedRef.current = true;
      collabSyncLog('patch_queued');
      return;
    }

    patchInFlightRef.current = true;
    try {
      const versionAtSend = serverVersionRef.current;
      const payload = buildPayloadRef.current();
      collabSyncLog('patch_send', {
        courseId: id,
        version: versionAtSend,
        stops: payload.stops?.length ?? 0,
        legs: payload.legs?.length ?? 0,
      });
      const res = await patchMyRouteWithVersion(id, {
        ...payload,
        version: versionAtSend,
      });

      if (res.ok) {
        setServerVersion(res.version);
        serverVersionRef.current = res.version;
        lastReloadVersionRef.current = res.version;
        collabSyncLog('patch_ok', { courseId: id, version: res.version });
        return;
      }
      if (res.conflict) {
        collabSyncLog('patch_conflict_auto', {
          courseId: id,
          sentVersion: versionAtSend,
          currentVersion: res.currentVersion,
        });
        await healConflictAndRetry(id, res);
        return;
      }
      collabSyncWarn('patch_failed', { courseId: id });
    } finally {
      patchInFlightRef.current = false;
      if (patchQueuedRef.current) {
        patchQueuedRef.current = false;
        void pushLocalChanges();
      }
    }
  }, [courseId, enabled, canPush, healConflictAndRetry]);

  const handleSocketEvent = useCallback(
    (event: CourseSocketEvent) => {
      if (!enabled) return;
      if (
        event.eventType === 'COURSE_MEMBER_JOINED' ||
        event.eventType === 'COURSE_MEMBER_LEFT'
      ) {
        const id = String(courseId ?? '').trim();
        if (!id || event.payload.courseUuid !== id) return;
        collabSyncLog('member_event', { type: event.eventType });
        onMembersChangeRef.current?.();
        return;
      }
      if (event.eventType !== 'COURSE_UPDATED') return;
      const id = String(courseId ?? '').trim();
      if (!id || event.payload.courseUuid !== id) return;
      const me = String(myUuid ?? '').trim();
      if (me && event.payload.editorUuid === me) {
        collabSyncLog('remote_skip_self', {
          version: event.payload.version,
        });
        return;
      }
      if (event.payload.version <= serverVersionRef.current) {
        collabSyncLog('remote_skip_stale', {
          eventVersion: event.payload.version,
          localVersion: serverVersionRef.current,
        });
        return;
      }

      collabSyncLog('remote_apply_start', {
        version: event.payload.version,
        editor: event.payload.editorNickname ?? event.payload.editorUuid,
      });
      void reloadFromServer({ force: true });
    },
    [enabled, courseId, myUuid, reloadFromServer],
  );

  const { isConnected: isCourseSocketConnected } = useCourseSocket(
    enabled ? courseId : null,
    handleSocketEvent,
  );

  useEffect(() => {
    collabSyncLog('socket_status', {
      connected: isCourseSocketConnected,
      courseId: courseId ?? null,
      mode: isCourseSocketConnected ? 'stomp' : enabled ? 'poll_5s' : 'off',
    });
  }, [isCourseSocketConnected, courseId, enabled]);

  useEffect(() => {
    if (!enabled || !canPush || !courseId) return;
    if (suppressPatchRef.current) {
      collabSyncLog('patch_suppressed_after_remote');
      suppressPatchRef.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) return;

    const t = setTimeout(() => {
      void pushLocalChanges();
    }, debounceMs);

    return () => clearTimeout(t);
  }, [syncKey, enabled, canPush, courseId, debounceMs, pushLocalChanges]);

  useEffect(() => {
    if (!enabled || !canPush || !courseId || titleSyncKey === undefined) {
      return;
    }
    if (suppressPatchRef.current) return;
    if (isApplyingRemoteRef.current) return;

    const t = setTimeout(() => {
      void pushLocalChanges();
    }, TITLE_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [titleSyncKey, enabled, canPush, courseId, pushLocalChanges]);

  useEffect(() => {
    if (!enabled || !courseId) return;
    if (isCourseSocketConnected) return;

    collabSyncLog('poll_start', { intervalMs: pollMs, courseId });
    const t = setInterval(() => {
      if (isApplyingRemoteRef.current || patchInFlightRef.current) return;
      collabSyncLog('poll_tick');
      void reloadFromServer();
    }, pollMs);

    return () => clearInterval(t);
  }, [
    enabled,
    courseId,
    isCourseSocketConnected,
    pollMs,
    reloadFromServer,
  ]);

  return {
    serverVersion,
    setServerVersion,
    isCourseSocketConnected,
    reloadFromServer,
  };
}
