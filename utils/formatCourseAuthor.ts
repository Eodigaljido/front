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
  | 'authorUserId'
  | 'authorUuid'
  | 'authorProfilePublic'
  | 'modifierUserId'
  | 'modifierUuid'
  | 'modifierProfilePublic'
>;

function labelForUser(
  userId: string,
  uuid: string,
  ctx: CourseAuthorContext | undefined,
  role: 'creator' | 'modifier',
): string {
  const myUuid = String(ctx?.myUuid ?? '').trim();
  const myUserId = String(ctx?.myUserId ?? '').trim();
  const myNick = String(ctx?.myNickname ?? '').trim();
  const selfLabel = role === 'modifier' ? '내가 수정' : '내가 제작';
  if (myUuid && uuid && uuid === myUuid) {
    return myNick ? `${myNick} (나)` : selfLabel;
  }
  if (myUserId && userId && userId === myUserId) {
    return myNick ? `${myNick} (나)` : selfLabel;
  }
  if (userId) return `@${userId}`;
  return role === 'modifier' ? '수정자 미표시' : '제작자 미표시';
}

/** 코스 카드·목록용 제작자 표시 문자열 */
export function getCourseAuthorLabel(
  course: Pick<CourseItem, 'authorUserId' | 'authorUuid'>,
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
  return labelForUser(authorUserId, authorUuid, ctx, 'creator');
}

/** 수정·재공유한 사용자 표시 문자열 */
export function getCourseModifierLabel(
  course: Pick<CourseItem, 'modifierUserId' | 'modifierUuid'>,
  ctx?: CourseAuthorContext,
): string {
  const userId = String(course.modifierUserId ?? '').trim();
  const uuid = String(course.modifierUuid ?? '').trim();
  if (!userId && !uuid) return '수정자 미표시';
  return labelForUser(userId, uuid, ctx, 'modifier');
}

/** 제작자와 수정자가 다른 사람인지 */
export function hasDistinctCourseModifier(
  course: Pick<
    CourseItem,
    'authorUuid' | 'authorUserId' | 'modifierUuid' | 'modifierUserId'
  >,
): boolean {
  const modUuid = String(course.modifierUuid ?? '').trim();
  const modUserId = String(course.modifierUserId ?? '').trim();
  if (!modUuid && !modUserId) return false;
  const authUuid = String(course.authorUuid ?? '').trim();
  const authUserId = String(course.authorUserId ?? '').trim();
  if (modUuid && authUuid && modUuid === authUuid) return false;
  if (modUserId && authUserId && modUserId === authUserId) return false;
  return true;
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
