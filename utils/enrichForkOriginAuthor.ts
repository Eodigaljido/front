import type { CourseItem } from "../data/mockData";
import type { UserSavedRoute } from "../data/userSavedRoute";
import { fetchSharedCourseDetail } from "../api/courses";
import { hasDistinctCourseModifier } from "./formatCourseAuthor";
import { sameCourseId } from "./sameCourseId";
import { pickCourseAuthorFromRaw } from "./pickCourseAuthorFromRaw";
import {
  applyCachedAuthorCredits,
  rememberCourseAuthorCredits,
} from "./courseAuthorCredits";
import {
  pickForkChainFromRaw,
  pickRootAuthorFromRaw,
} from "./pickForkChainFromRaw";

export type ForkOriginAuthor = {
  authorUuid?: string;
  authorUserId?: string;
  authorProfilePublic?: boolean;
  rootForkSourceCourseId?: string;
};

type ForkModifierAuthor = {
  modifierUuid?: string;
  modifierUserId?: string;
  modifierProfilePublic?: boolean;
};

type ResolvedRoot = ForkOriginAuthor & { rootForkSourceCourseId: string };

const ROOT_CACHE = new Map<string, ResolvedRoot | null>();
const MAX_FORK_WALK_DEPTH = 16;

function authorFromSavedRoute(r: UserSavedRoute): ForkOriginAuthor | null {
  const uuid = String(r.forkSourceAuthorUuid ?? "").trim();
  const userId = String(r.forkSourceAuthorUserId ?? "").trim();
  const rootId = String(r.rootForkSourceCourseId ?? r.forkedFromSharedId ?? "").trim();
  if (!uuid && !userId && !rootId) return null;
  return {
    ...(uuid ? { authorUuid: uuid } : {}),
    ...(userId ? { authorUserId: userId } : {}),
    ...(rootId ? { rootForkSourceCourseId: rootId } : {}),
  };
}

function modifierFromSavedRoute(r: UserSavedRoute): ForkModifierAuthor | null {
  const uuid = String(r.forkModifierAuthorUuid ?? "").trim();
  const userId = String(r.forkModifierAuthorUserId ?? "").trim();
  if (!uuid && !userId) return null;
  return {
    ...(uuid ? { modifierUuid: uuid } : {}),
    ...(userId ? { modifierUserId: userId } : {}),
  };
}

function mergeOrigin(
  a: ForkOriginAuthor | null | undefined,
  b: ForkOriginAuthor | null | undefined,
): ForkOriginAuthor | null {
  if (!a && !b) return null;
  return {
    authorUuid: a?.authorUuid ?? b?.authorUuid,
    authorUserId: a?.authorUserId ?? b?.authorUserId,
    authorProfilePublic: a?.authorProfilePublic ?? b?.authorProfilePublic,
    rootForkSourceCourseId:
      a?.rootForkSourceCourseId ?? b?.rootForkSourceCourseId,
  };
}

/** 공유 코스가 포크·재공유 파생본인지 */
export function isForkDerivedCourse(course: CourseItem): boolean {
  const rootId = String(course.rootForkSourceCourseId ?? "").trim();
  const parentId = String(course.forkSourceCourseId ?? "").trim();
  const courseId = String(course.id ?? "").trim();
  if (rootId && courseId && !sameCourseId(rootId, courseId)) return true;
  if (parentId && courseId && !sameCourseId(parentId, courseId)) return true;
  if (hasDistinctCourseModifier(course)) return true;
  return false;
}

/** 포크 체인을 따라 최초 원작자·루트 코스 id 해석 */
export async function resolveRootOriginAuthor(
  courseId: string,
  depth = 0,
): Promise<ResolvedRoot | null> {
  const id = String(courseId ?? "").trim();
  if (!id || depth > MAX_FORK_WALK_DEPTH) return null;

  const cached = ROOT_CACHE.get(id);
  if (cached !== undefined) return cached;

  const pending = (async (): Promise<ResolvedRoot | null> => {
    try {
      const detail = await fetchSharedCourseDetail(id);
      if (!detail) return null;

      const raw = detail as unknown as Record<string, unknown>;
      const fromApiRoot = pickRootAuthorFromRaw(raw);
      const chain = pickForkChainFromRaw(raw);
      const picked = pickCourseAuthorFromRaw(raw);

      if (fromApiRoot.authorUuid || fromApiRoot.authorUserId) {
        return {
          ...fromApiRoot,
          rootForkSourceCourseId:
            chain.rootForkSourceCourseId ?? chain.forkSourceCourseId ?? id,
        };
      }

      const parentId = String(
        chain.forkSourceCourseId ??
          detail.forkSourceCourseId ??
          "",
      ).trim();

      if (parentId && !sameCourseId(parentId, id)) {
        const parentRoot = await resolveRootOriginAuthor(parentId, depth + 1);
        if (parentRoot) return parentRoot;
      }

      if (hasDistinctCourseModifier(detail)) {
        const authorUuid = String(detail.authorUuid ?? "").trim();
        const authorUserId = String(detail.authorUserId ?? "").trim();
        if (authorUuid || authorUserId) {
          return {
            authorUuid: authorUuid || undefined,
            authorUserId: authorUserId || undefined,
            authorProfilePublic: detail.authorProfilePublic,
            rootForkSourceCourseId:
              chain.rootForkSourceCourseId ?? parentId ?? id,
          };
        }
      }

      const authorUuid = String(
        picked.authorUuid ?? detail.authorUuid ?? "",
      ).trim();
      const authorUserId = String(
        picked.authorUserId ?? detail.authorUserId ?? "",
      ).trim();
      if (!authorUuid && !authorUserId) return null;

      return {
        authorUuid: authorUuid || undefined,
        authorUserId: authorUserId || undefined,
        authorProfilePublic:
          picked.authorProfilePublic ?? detail.authorProfilePublic,
        rootForkSourceCourseId:
          chain.rootForkSourceCourseId ?? parentId ?? id,
      };
    } catch {
      return null;
    }
  })();

  const result = await pending;
  ROOT_CACHE.set(id, result);
  return result;
}

type RouteForkIndex = {
  parentForkId: string;
  rootAuthor: ForkOriginAuthor;
  modifier: ForkModifierAuthor | null;
};

function buildRouteForkIndex(
  userSavedRoutes: UserSavedRoute[],
): Map<string, RouteForkIndex> {
  const index = new Map<string, RouteForkIndex>();

  for (const r of userSavedRoutes) {
    const id = String(r.id ?? "").trim();
    const parentFork = String(r.forkedFromSharedId ?? "").trim();
    if (!id || id.startsWith("ur-") || !parentFork) continue;

    const rootAuthor = authorFromSavedRoute(r);
    const modifier = modifierFromSavedRoute(r);
    if (!rootAuthor?.authorUuid && !rootAuthor?.authorUserId) continue;

    index.set(id, {
      parentForkId: parentFork,
      rootAuthor,
      modifier,
    });
  }

  return index;
}

function publisherFromCourse(c: CourseItem): ForkModifierAuthor {
  const publisherUuid = String(c.authorUuid ?? "").trim();
  const publisherUserId = String(c.authorUserId ?? "").trim();
  return {
    ...(publisherUuid ? { modifierUuid: publisherUuid } : {}),
    ...(publisherUserId ? { modifierUserId: publisherUserId } : {}),
    modifierProfilePublic: c.authorProfilePublic,
  };
}

function applyForkCredits(
  course: CourseItem,
  root: ForkOriginAuthor,
  modifier: ForkModifierAuthor,
  parentForkId?: string,
): CourseItem {
  const parent = String(parentForkId ?? course.forkSourceCourseId ?? "").trim();
  return {
    ...course,
    authorUuid: root.authorUuid ?? course.authorUuid,
    authorUserId: root.authorUserId ?? course.authorUserId,
    authorProfilePublic: root.authorProfilePublic ?? course.authorProfilePublic,
    modifierUuid: modifier.modifierUuid ?? course.modifierUuid,
    modifierUserId: modifier.modifierUserId ?? course.modifierUserId,
    modifierProfilePublic:
      modifier.modifierProfilePublic ?? course.modifierProfilePublic,
    forkSourceCourseId: parent || course.forkSourceCourseId || null,
    rootForkSourceCourseId:
      root.rootForkSourceCourseId ??
      course.rootForkSourceCourseId ??
      null,
  };
}

/** 공개 목록·상세 — 최초 원작자 유지 + 최근 수정자 표시 */
export async function enrichCoursesWithForkOriginAuthors(
  courses: CourseItem[],
  userSavedRoutes: UserSavedRoute[],
): Promise<CourseItem[]> {
  const routeIndex = buildRouteForkIndex(userSavedRoutes);
  const parentIdsToResolve = new Set<string>();

  for (const c of courses) {
    const id = String(c.id ?? "").trim();
    const hit = routeIndex.get(id);
    if (hit) {
      parentIdsToResolve.add(hit.parentForkId);
      continue;
    }
    const parentFromCourse = String(c.forkSourceCourseId ?? "").trim();
    if (parentFromCourse) parentIdsToResolve.add(parentFromCourse);
    const raw = c as unknown as Record<string, unknown>;
    const chain = pickForkChainFromRaw(raw);
    if (chain.forkSourceCourseId) {
      parentIdsToResolve.add(chain.forkSourceCourseId);
    }
  }

  await Promise.all(
    [...parentIdsToResolve].map((pid) => resolveRootOriginAuthor(pid)),
  );

  const withCache = applyCachedAuthorCredits(courses);

  const enriched = await Promise.all(
    withCache.map(async (c) => {
      const id = String(c.id ?? "").trim();
      const local = routeIndex.get(id);
      const publisher = publisherFromCourse(c);

      if (local) {
        const root =
          mergeOrigin(local.rootAuthor, null) ??
          (await resolveRootOriginAuthor(local.parentForkId));
        if (!root?.authorUuid && !root?.authorUserId) return c;
        const modifier =
          local.modifier ??
          publisher;
        return applyForkCredits(
          c,
          {
            ...root,
            rootForkSourceCourseId:
              root.rootForkSourceCourseId ??
              local.rootAuthor.rootForkSourceCourseId ??
              local.parentForkId,
          },
          modifier,
          local.parentForkId,
        );
      }

      const parentId = String(
        c.forkSourceCourseId ??
          pickForkChainFromRaw(c as unknown as Record<string, unknown>)
            .forkSourceCourseId ??
          "",
      ).trim();

      if (!parentId || sameCourseId(parentId, id)) {
        const rootFromApi = pickRootAuthorFromRaw(
          c as unknown as Record<string, unknown>,
        );
        if (rootFromApi.authorUuid || rootFromApi.authorUserId) {
          return applyForkCredits(c, rootFromApi, publisher);
        }
        return c;
      }

      const root = await resolveRootOriginAuthor(parentId);
      if (!root?.authorUuid && !root?.authorUserId) return c;

      return applyForkCredits(c, root, publisher, parentId);
    }),
  );

  rememberCourseAuthorCredits(enriched);
  return applyCachedAuthorCredits(enriched);
}

export async function enrichCourseWithForkOriginAuthor(
  course: CourseItem | null,
  userSavedRoutes: UserSavedRoute[],
): Promise<CourseItem | null> {
  if (!course) return null;
  const [enriched] = await enrichCoursesWithForkOriginAuthors(
    [course],
    userSavedRoutes,
  );
  return enriched ?? course;
}

/** 포크 시 저장할 최초 원작자 (이미 파생본이면 author=원작자로 간주) */
export function forkOriginAuthorFromCourse(
  course: CourseItem,
): Pick<
  UserSavedRoute,
  "forkSourceAuthorUuid" | "forkSourceAuthorUserId" | "rootForkSourceCourseId"
> {
  if (hasDistinctCourseModifier(course)) {
    const uuid = String(course.authorUuid ?? "").trim();
    const userId = String(course.authorUserId ?? "").trim();
    const rootId = String(
      course.rootForkSourceCourseId ?? course.forkSourceCourseId ?? "",
    ).trim();
    return {
      ...(uuid ? { forkSourceAuthorUuid: uuid } : {}),
      ...(userId ? { forkSourceAuthorUserId: userId } : {}),
      ...(rootId ? { rootForkSourceCourseId: rootId } : {}),
    };
  }

  const fromApi = pickRootAuthorFromRaw(
    course as unknown as Record<string, unknown>,
  );
  if (fromApi.authorUuid || fromApi.authorUserId) {
    const rootId = String(
      course.rootForkSourceCourseId ??
        pickForkChainFromRaw(course as unknown as Record<string, unknown>)
          .rootForkSourceCourseId ??
        course.forkSourceCourseId ??
        "",
    ).trim();
    return {
      ...(fromApi.authorUuid
        ? { forkSourceAuthorUuid: fromApi.authorUuid }
        : {}),
      ...(fromApi.authorUserId
        ? { forkSourceAuthorUserId: fromApi.authorUserId }
        : {}),
      ...(rootId ? { rootForkSourceCourseId: rootId } : {}),
    };
  }

  const uuid = String(course.authorUuid ?? "").trim();
  const userId = String(course.authorUserId ?? "").trim();
  const rootId = String(
    course.rootForkSourceCourseId ?? course.id ?? "",
  ).trim();
  return {
    ...(uuid ? { forkSourceAuthorUuid: uuid } : {}),
    ...(userId ? { forkSourceAuthorUserId: userId } : {}),
    ...(rootId ? { rootForkSourceCourseId: rootId } : {}),
  };
}

export async function resolveForkOriginForSave(
  forkSourceCourseId: string,
  courseHint?: CourseItem | null,
): Promise<
  Pick<
    UserSavedRoute,
    | "forkSourceAuthorUuid"
    | "forkSourceAuthorUserId"
    | "rootForkSourceCourseId"
  >
> {
  const forkId = String(forkSourceCourseId ?? "").trim();
  const fromHint = courseHint ? forkOriginAuthorFromCourse(courseHint) : {};
  if (fromHint.forkSourceAuthorUuid || fromHint.forkSourceAuthorUserId) {
    return {
      ...fromHint,
      rootForkSourceCourseId:
        fromHint.rootForkSourceCourseId ?? forkId,
    };
  }
  const root = await resolveRootOriginAuthor(forkId);
  if (!root) return { rootForkSourceCourseId: forkId };
  return {
    ...(root.authorUuid ? { forkSourceAuthorUuid: root.authorUuid } : {}),
    ...(root.authorUserId ? { forkSourceAuthorUserId: root.authorUserId } : {}),
    rootForkSourceCourseId: root.rootForkSourceCourseId ?? forkId,
  };
}

export function findForkSourceIdForCourse(
  courseId: string,
  userSavedRoutes: UserSavedRoute[],
): string | null {
  const id = String(courseId ?? "").trim();
  if (!id) return null;
  const hit = userSavedRoutes.find((r) => sameCourseId(r.id, id));
  const fork = String(hit?.forkedFromSharedId ?? "").trim();
  return fork || null;
}
