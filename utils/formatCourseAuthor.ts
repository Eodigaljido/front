import type { CourseItem } from '../data/mockData';

export type CourseAuthorContext = {
  myUuid?: string | null;
  myUserId?: string | null;
  myNickname?: string | null;
  /** 로컬에만 저장한 직접 제작 루트 */
  isLocalOwnRoute?: boolean;
};

type CourseAuthorFields = Pick<
  CourseItem,
  'authorUserId' | 'authorUuid' | 'authorProfilePublic'
>;

/** 코스 카드·목록용 제작자 표시 문자열 */
export function getCourseAuthorLabel(
  course: CourseAuthorFields,
  ctx?: CourseAuthorContext,
): string {
  if (ctx?.isLocalOwnRoute) {
    const nick = String(ctx.myNickname ?? '').trim();
    return nick ? `${nick} (나)` : '내가 제작';
  }

  const myUuid = String(ctx?.myUuid ?? '').trim();
  const myUserId = String(ctx?.myUserId ?? '').trim();
  const authorUuid = String(course.authorUuid ?? '').trim();
  const authorUserId = String(course.authorUserId ?? '').trim();
  const myNick = String(ctx?.myNickname ?? '').trim();

  if (myUuid && authorUuid && authorUuid === myUuid) {
    return myNick ? `${myNick} (나)` : '내가 제작';
  }
  if (myUserId && authorUserId && authorUserId === myUserId) {
    return myNick ? `${myNick} (나)` : '내가 제작';
  }
  if (authorUserId) return `@${authorUserId}`;
  return '제작자 미표시';
}

/** 서버에 올린 코스가 현재 사용자 소유인지 (저장만 한 타인 코스는 false) */
export function isOwnServerCourse(
  course: CourseAuthorFields,
  ctx?: Pick<CourseAuthorContext, 'myUuid' | 'myUserId'>,
): boolean {
  const myUuid = String(ctx?.myUuid ?? '').trim();
  const myUserId = String(ctx?.myUserId ?? '').trim();
  const authorUuid = String(course.authorUuid ?? '').trim();
  const authorUserId = String(course.authorUserId ?? '').trim();
  if (myUuid && authorUuid && authorUuid === myUuid) return true;
  if (myUserId && authorUserId && authorUserId === myUserId) return true;
  return false;
}

/** API 플래그만 반영 — 네트워크 조회는 useAuthorProfileVisible 사용 */
export function isCourseAuthorProfilePublicByApi(
  course: CourseAuthorFields,
  ctx?: CourseAuthorContext,
): boolean {
  if (isOwnServerCourse(course, ctx) || ctx?.isLocalOwnRoute) return true;
  return course.authorProfilePublic !== false;
}
