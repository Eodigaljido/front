import type { CourseItem } from "../data/mockData";
import { hasDistinctCourseModifier } from "./formatCourseAuthor";

export type CourseAuthorCredits = Pick<
  CourseItem,
  | "authorUuid"
  | "authorUserId"
  | "authorProfilePublic"
  | "modifierUuid"
  | "modifierUserId"
  | "modifierProfilePublic"
  | "forkSourceCourseId"
  | "rootForkSourceCourseId"
>;

const sessionCache = new Map<string, CourseAuthorCredits>();

function courseKey(id: string): string {
  return String(id ?? "").trim();
}

export function pickCourseAuthorCredits(
  course: CourseItem,
): CourseAuthorCredits | null {
  const id = courseKey(course.id);
  if (!id) return null;

  const authorUuid = String(course.authorUuid ?? "").trim();
  const authorUserId = String(course.authorUserId ?? "").trim();
  const modifierUuid = String(course.modifierUuid ?? "").trim();
  const modifierUserId = String(course.modifierUserId ?? "").trim();
  const forkSource = String(course.forkSourceCourseId ?? "").trim();
  const rootFork = String(course.rootForkSourceCourseId ?? "").trim();

  const hasAuthor = Boolean(authorUuid || authorUserId);
  const hasModifier = hasDistinctCourseModifier(course);
  const isFork = Boolean(forkSource || rootFork);

  if (!hasAuthor && !hasModifier && !isFork) return null;

  return {
    ...(authorUuid ? { authorUuid } : {}),
    ...(authorUserId ? { authorUserId } : {}),
    ...(course.authorProfilePublic !== undefined
      ? { authorProfilePublic: course.authorProfilePublic }
      : {}),
    ...(modifierUuid ? { modifierUuid } : {}),
    ...(modifierUserId ? { modifierUserId } : {}),
    ...(course.modifierProfilePublic !== undefined
      ? { modifierProfilePublic: course.modifierProfilePublic }
      : {}),
    ...(forkSource ? { forkSourceCourseId: forkSource } : {}),
    ...(rootFork ? { rootForkSourceCourseId: rootFork } : {}),
  };
}

export function rememberCourseAuthorCredits(courses: CourseItem[]): void {
  for (const c of courses) {
    const credits = pickCourseAuthorCredits(c);
    const id = courseKey(c.id);
    if (id && credits) sessionCache.set(id, credits);
  }
}

export function applyCachedAuthorCredits(courses: CourseItem[]): CourseItem[] {
  return courses.map((c) => {
    const cached = sessionCache.get(courseKey(c.id));
    if (!cached) return c;
    return { ...c, ...cached };
  });
}

/** 재조회·재보강 후에도 이전에 알고 있던 제작자·수정자 유지 */
export function mergeCourseAuthorCredits(
  next: CourseItem[],
  prev: CourseItem[] | CourseAuthorCredits[],
): CourseItem[] {
  const prevById = new Map<string, CourseAuthorCredits>();

  for (const item of prev) {
    const id = courseKey(
      "id" in item ? String((item as CourseItem).id ?? "") : "",
    );
    if (!id) continue;
    const credits =
      "authorUuid" in item && !("title" in item)
        ? (item as CourseAuthorCredits)
        : pickCourseAuthorCredits(item as CourseItem);
    if (credits) prevById.set(id, credits);
  }

  return next.map((c) => {
    const fresh = pickCourseAuthorCredits(c);
    const old = prevById.get(courseKey(c.id));
    if (!old) return fresh ? { ...c, ...fresh } : c;
    if (fresh && (fresh.modifierUuid || fresh.modifierUserId)) {
      return { ...c, ...fresh };
    }
    return { ...c, ...old, ...fresh };
  });
}
