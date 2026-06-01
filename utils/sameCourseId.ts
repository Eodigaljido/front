import type { CourseItem } from '../data/mockData';

/** 카드 id(문자열/숫자)와 목록·상세 재조회 id 불일치 방지 */
export function sameCourseId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  return String(a ?? '') === String(b ?? '');
}

/** FlatList key 충돌 방지 — 동일 id 코스는 첫 항목만 유지 */
export function dedupeCoursesById(courses: CourseItem[]): CourseItem[] {
  const byId = new Map<string, CourseItem>();
  for (const c of courses) {
    const id = String(c.id ?? '').trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, c);
  }
  return Array.from(byId.values());
}
