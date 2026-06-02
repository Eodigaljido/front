import type { CourseItem } from "../data/mockData";
import type { UserSavedRoute } from "../data/userSavedRoute";
import { resolveCourseThumbnailForDisplay } from "./courseThumbnailUri";
import { sameCourseId } from "./sameCourseId";

export type MineAuthorContext = {
  myUuid?: string | null;
  myUserId?: string | null;
};

/** 로컬 저장 루트의 대표 이미지 URI — course id 기준 */
export function buildLocalThumbnailMap(
  userSavedRoutes: UserSavedRoute[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of userSavedRoutes) {
    const uri = String(r.coverImageUri ?? "").trim();
    if (!uri) continue;
    const id = String(r.id ?? "").trim();
    if (id) map.set(id, uri);
  }
  return map;
}

function pickLocalThumbnail(
  courseId: string,
  byId: Map<string, string>,
): string | null {
  for (const [localId, uri] of byId) {
    if (sameCourseId(courseId, localId)) return uri;
  }
  return null;
}

/** API 목록에 로컬 대표 이미지를 보강 (서버 thumbnail 없을 때만) */
export function mergeLocalThumbnailsIntoCourses(
  courses: CourseItem[],
  userSavedRoutes: UserSavedRoute[],
): CourseItem[] {
  const byId = buildLocalThumbnailMap(userSavedRoutes);
  if (byId.size === 0) return courses;
  return courses.map((c) => {
    const local = pickLocalThumbnail(String(c.id ?? ""), byId);
    const thumb = resolveCourseThumbnailForDisplay(c.thumbnail, local);
    return thumb && thumb !== c.thumbnail ? { ...c, thumbnail: thumb } : c;
  });
}

/** 내가 저장·제작한 루트는 API 작성자 필드가 남아 있어도 내 정보로 표시 */
export function applyMineAuthorToPersonalRoutes(
  courses: CourseItem[],
  userSavedRoutes: UserSavedRoute[],
  ctx?: MineAuthorContext,
): CourseItem[] {
  const uuid = String(ctx?.myUuid ?? "").trim();
  const userId = String(ctx?.myUserId ?? "").trim();
  if (!uuid && !userId) return courses;
  return courses.map((c) => {
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, c.id));
    if (!ur || ur.collaborative) return c;
    if (String(ur.forkedFromSharedId ?? "").trim()) return c;
    return {
      ...c,
      authorUuid: uuid || c.authorUuid,
      authorUserId: userId || c.authorUserId,
      authorProfilePublic: true,
    };
  });
}

/**
 * 공유 원본에 개인 복사본이 있으면 원본(북마크) 항목 제거,
 * 동일 fork 원본에서 생긴 중복 개인 코스는 1개만 유지
 */
export function dedupeMyCourseList(
  courses: CourseItem[],
  userSavedRoutes: UserSavedRoute[],
): CourseItem[] {
  const personalIdByFork = new Map<string, string>();
  for (const r of userSavedRoutes) {
    const fork = String(r.forkedFromSharedId ?? "").trim();
    const id = String(r.id ?? "").trim();
    if (fork && id && !id.startsWith("ur-")) {
      personalIdByFork.set(fork, id);
    }
  }

  const byId = new Map<string, CourseItem>();
  for (const c of courses) {
    const id = String(c.id ?? "").trim();
    if (!id) continue;
    if (personalIdByFork.has(id) && personalIdByFork.get(id) !== id) {
      continue;
    }
    byId.set(id, c);
  }

  const byFork = new Map<string, CourseItem[]>();
  for (const c of byId.values()) {
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, c.id));
    const fork = String(ur?.forkedFromSharedId ?? "").trim();
    if (!fork) continue;
    const list = byFork.get(fork) ?? [];
    list.push(c);
    byFork.set(fork, list);
  }

  for (const [fork, items] of byFork) {
    if (items.length <= 1) continue;
    const keepId = personalIdByFork.get(fork) ?? items[0]?.id;
    for (const item of items) {
      if (item.id !== keepId) {
        byId.delete(String(item.id));
      }
    }
  }

  return Array.from(byId.values());
}

/** API·로컬 목록 병합 — 동일 id면 로컬 썸네일 우선 보강 */
export function mergeApiAndLocalCourseLists(
  apiCourses: CourseItem[],
  localCourses: CourseItem[],
): CourseItem[] {
  const byId = new Map<string, CourseItem>();
  for (const c of apiCourses) {
    const id = String(c.id ?? "").trim();
    if (id) byId.set(id, c);
  }
  for (const c of localCourses) {
    const id = String(c.id ?? "").trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, c);
      continue;
    }
    const thumb = resolveCourseThumbnailForDisplay(prev.thumbnail, c.thumbnail);
    if (thumb) {
      byId.set(id, { ...prev, thumbnail: thumb });
    }
  }
  return Array.from(byId.values());
}
