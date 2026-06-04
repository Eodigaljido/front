import { instance } from './axios';
import {
  courseItemFromApiPayload,
  fetchMyCourseDetail,
  fetchMyRouteCollaborativeFlag,
  hasMeaningfulRouteSteps,
  sanitizeUpsertMyRoutePayload,
  updateMyRoute,
  type UpsertMyRoutePayload,
} from './courses';
import type { CourseItem } from '../data/mockData';
import { collabSyncLog, collabSyncWarn } from '../utils/collabRouteDebugLog';

export type CourseMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export type CourseMemberDto = {
  userUuid: string;
  userId?: string;
  nickname?: string;
  profileImageUrl?: string | null;
  role: CourseMemberRole;
  online?: boolean;
};

export type CollaborativeAccess = {
  courseUuid: string;
  title: string;
  collaborative: boolean;
  chatRoomUuid: string | null;
  version: number;
  updatedAt?: string;
  myRole: CourseMemberRole;
  canEdit: boolean;
  ownerUuid?: string;
  ownerNickname?: string;
  memberCount?: number;
};

export type CollaborativeAccessResult =
  | { ok: true; access: CollaborativeAccess }
  | {
      ok: false;
      reason: 'FORBIDDEN' | 'NOT_FOUND' | 'NOT_COLLABORATIVE' | 'OTHER';
    };

function normalizeCourseId(courseUuid: string): string {
  return String(courseUuid ?? '').trim();
}

function mapAccess(raw: Record<string, unknown>, courseUuid: string): CollaborativeAccess {
  const role = String(raw.myRole ?? 'EDITOR').toUpperCase() as CourseMemberRole;
  const canEdit =
    raw.canEdit === true ||
    role === 'OWNER' ||
    role === 'EDITOR';
  return {
    courseUuid: String(raw.courseUuid ?? raw.uuid ?? courseUuid).trim(),
    title: String(raw.title ?? '루트').trim() || '루트',
    collaborative: raw.collaborative !== false,
    chatRoomUuid: raw.chatRoomUuid != null ? String(raw.chatRoomUuid).trim() : null,
    version: Number(raw.version ?? 0),
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : undefined,
    myRole: role === 'OWNER' || role === 'VIEWER' ? role : 'EDITOR',
    canEdit,
    ownerUuid: raw.ownerUuid != null ? String(raw.ownerUuid) : undefined,
    ownerNickname:
      raw.ownerNickname != null ? String(raw.ownerNickname) : undefined,
    memberCount:
      raw.memberCount != null ? Number(raw.memberCount) : undefined,
  };
}

function normalizeCourseMember(raw: Record<string, unknown>): CourseMemberDto | null {
  const userUuid = String(raw.userUuid ?? raw.uuid ?? '').trim();
  if (!userUuid) return null;
  const roleRaw = String(raw.role ?? 'EDITOR').toUpperCase();
  const role: CourseMemberRole =
    roleRaw === 'OWNER' || roleRaw === 'VIEWER' ? roleRaw : 'EDITOR';
  return {
    userUuid,
    userId: raw.userId != null ? String(raw.userId) : undefined,
    nickname: raw.nickname != null ? String(raw.nickname) : undefined,
    profileImageUrl:
      raw.profileImageUrl != null ? String(raw.profileImageUrl) : null,
    role,
    online: raw.online === true,
  };
}

/** GET /api/courses/my/{courseId}/members */
export async function fetchCourseMembers(
  courseUuid: string,
): Promise<CourseMemberDto[]> {
  const id = normalizeCourseId(courseUuid);
  if (!id || id.startsWith('ur-')) return [];
  try {
    const res = await instance.get(
      `/api/courses/my/${encodeURIComponent(id)}/members`,
    );
    const raw =
      res.data?.items ??
      res.data?.data?.items ??
      res.data?.data ??
      res.data;
    const items = Array.isArray(raw) ? raw : [];
    return items
      .map((item) =>
        normalizeCourseMember(
          item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : {},
        ),
      )
      .filter((m): m is CourseMemberDto => Boolean(m));
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        '[fetchCourseMembers]',
        id,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return [];
  }
}

async function fetchCollaborativeAccessFallback(
  courseUuid: string,
): Promise<CollaborativeAccessResult> {
  const [detail, collab] = await Promise.all([
    fetchMyCourseDetail(courseUuid),
    fetchMyRouteCollaborativeFlag(courseUuid),
  ]);
  if (!detail) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (!collab) {
    return { ok: false, reason: 'NOT_COLLABORATIVE' };
  }
  const version =
    detail.version != null && Number.isFinite(Number(detail.version))
      ? Number(detail.version)
      : 0;
  const room = String(detail.chatRoomUuid ?? '').trim() || null;
  return {
    ok: true,
    access: {
      courseUuid,
      title: String(detail.title ?? '루트').trim() || '루트',
      collaborative: true,
      chatRoomUuid: room,
      version,
      myRole: 'EDITOR',
      canEdit: true,
    },
  };
}

/**
 * 공동 루트 링크 진입 권한.
 * GET /api/courses/collaborative/{id} 미구현(404) 시 내 코스 조회로 폴백.
 */
export async function fetchCollaborativeAccess(
  courseUuid: string,
): Promise<CollaborativeAccessResult> {
  const id = normalizeCourseId(courseUuid);
  if (!id || id.startsWith('ur-')) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  try {
    const res = await instance.get(
      `/api/courses/collaborative/${encodeURIComponent(id)}`,
    );
    const data = (res.data?.data ?? res.data) as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return fetchCollaborativeAccessFallback(id);
    }
    const access = mapAccess(data, id);
    return { ok: true, access };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 403) {
      return { ok: false, reason: 'FORBIDDEN' };
    }
    if (status === 404) {
      return fetchCollaborativeAccessFallback(id);
    }
    return fetchCollaborativeAccessFallback(id);
  }
}

/** 공동 루트에 편집 멤버 추가 (초대 시 채팅방만 만들면 상대 목록에 안 보임) */
export async function addCollaborativeCourseMember(
  courseUuid: string,
  memberUserUuid: string,
): Promise<boolean> {
  const id = normalizeCourseId(courseUuid);
  const uuid = String(memberUserUuid ?? '').trim();
  if (!id || id.startsWith('ur-') || !uuid) return false;
  try {
    await instance.post(
      `/api/courses/my/${encodeURIComponent(id)}/members`,
      { userUuid: uuid },
    );
    return true;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 409) return true;
    if (__DEV__) {
      console.warn('[addCollaborativeCourseMember]', uuid, status, e?.response?.data);
    }
    return false;
  }
}

export async function addCollaborativeCourseMembers(
  courseUuid: string,
  memberUserUuids: string[],
): Promise<{ added: number; failed: number }> {
  const unique = [
    ...new Set(
      memberUserUuids.map((u) => String(u ?? '').trim()).filter(Boolean),
    ),
  ];
  let added = 0;
  let failed = 0;
  for (const uuid of unique) {
    const ok = await addCollaborativeCourseMember(courseUuid, uuid);
    if (ok) added += 1;
    else failed += 1;
  }
  return { added, failed };
}

/** 서버 코스 ↔ 채팅방 연결 (로컬 chatRoomUuid만으로는 상대방 동기화 불가) */
export async function linkCollaborativeCourseChatRoom(
  courseUuid: string,
  chatRoomUuid: string,
): Promise<boolean> {
  const id = normalizeCourseId(courseUuid);
  const room = String(chatRoomUuid ?? '').trim();
  if (!id || id.startsWith('ur-') || !room) return false;
  try {
    await instance.put(
      `/api/courses/my/${encodeURIComponent(id)}/chat-room`,
      { chatRoomUuid: room },
    );
    return true;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        '[linkCollaborativeCourseChatRoom]',
        id,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return false;
  }
}

export type PatchCourseResult =
  | { ok: true; version: number }
  | {
      ok: false;
      conflict: true;
      course: CourseItem | null;
      currentVersion: number;
    }
  | { ok: false; conflict: false };

/** 공동 편집 — version 포함 PATCH (409 시 충돌) */
export async function patchMyRouteWithVersion(
  courseUuid: string,
  payload: UpsertMyRoutePayload & { version: number },
): Promise<PatchCourseResult> {
  const id = normalizeCourseId(courseUuid);
  if (!id || id.startsWith('ur-')) {
    return { ok: false, conflict: false };
  }
  const body = sanitizeUpsertMyRoutePayload(payload);
  collabSyncLog('api_patch', {
    courseId: id,
    version: Number(payload.version ?? 0),
    stops: body.stops?.length ?? 0,
  });
  try {
    const res = await instance.patch(
      `/api/courses/my/${encodeURIComponent(id)}`,
      { ...body, version: Number(payload.version ?? 0) },
    );
    const data = (res.data?.data ?? res.data) as Record<string, unknown>;
    const nextVersion = Number(
      data?.version ?? (payload.version ?? 0) + 1,
    );
    collabSyncLog('api_patch_ok', { courseId: id, version: nextVersion });
    return { ok: true, version: nextVersion };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 409) {
      collabSyncWarn('api_patch_409', { courseId: id });
      const d = (e.response?.data ?? {}) as Record<string, unknown>;
      const rawCourse = (d.course ?? d.data ?? null) as Record<
        string,
        unknown
      > | null;
      let course: CourseItem | null = null;
      if (rawCourse && typeof rawCourse === 'object') {
        course = courseItemFromApiPayload(rawCourse);
        if (!course || !hasMeaningfulRouteSteps(course)) {
          course = await fetchMyCourseDetail(id);
        }
      } else {
        course = await fetchMyCourseDetail(id);
      }
      const nested = (d.data ?? {}) as Record<string, unknown>;
      return {
        ok: false,
        conflict: true,
        course,
        currentVersion: Number(
          d.currentVersion ??
            nested.currentVersion ??
            d.version ??
            nested.version ??
            payload.version ??
            0,
        ),
      };
    }
    const ok = await updateMyRoute(id, body);
    if (ok) {
      return { ok: true, version: Number(payload.version ?? 0) + 1 };
    }
    return { ok: false, conflict: false };
  }
}

export function collaborativeAccessDeniedMessage(
  reason: 'FORBIDDEN' | 'NOT_FOUND' | 'NOT_COLLABORATIVE' | 'OTHER',
): string {
  switch (reason) {
    case 'FORBIDDEN':
      return '이 공동 루트를 편집할 권한이 없어요';
    case 'NOT_COLLABORATIVE':
      return '공동 편집 루트가 아니에요';
    case 'NOT_FOUND':
      return '루트를 찾을 수 없어요';
    default:
      return '공동 루트에 들어가지 못했어요';
  }
}
