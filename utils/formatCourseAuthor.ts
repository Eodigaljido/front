import type { CourseItem } from '../data/mockData';

export type CourseAuthorContext = {
  myUuid?: string | null;
  myUserId?: string | null;
  myNickname?: string | null;
  /** 로컬에만 저장한 직접 제작 루트 */
  isLocalOwnRoute?: boolean;
};

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
  if (authorUserId) return `@${authorUserId}`;
  return '제작자 미표시';
}
