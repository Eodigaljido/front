import type { CourseItem } from "../data/mockData";

/** 필터·탭 칩 — category 필드 또는 tags(카드에 표시) 기준 매칭 */
export function courseMatchesTagOrCategory(
  course: Pick<CourseItem, "category" | "tags" | "meta">,
  label: string,
): boolean {
  const needle = String(label ?? "").trim();
  if (!needle) return true;

  if (String(course.category ?? "").trim() === needle) return true;

  const tags = Array.isArray(course.tags) ? course.tags : [];
  if (tags.some((t) => String(t ?? "").trim() === needle)) return true;

  const meta = String(course.meta ?? "").trim();
  if (meta === needle) return true;
  const metaParts = meta.split(/[·|,/\s]+/u).map((p) => p.trim()).filter(Boolean);
  if (metaParts.includes(needle)) return true;

  return false;
}
