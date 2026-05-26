/** 카드 id(문자열/숫자)와 목록·상세 재조회 id 불일치 방지 */
export function sameCourseId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  return String(a ?? '') === String(b ?? '');
}
