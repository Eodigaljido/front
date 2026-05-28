/** API·스냅샷에서 포크 체인(부모·루트 코스 id) 추출 */
export function pickForkChainFromRaw(
  raw: Record<string, unknown> | null | undefined,
): {
  forkSourceCourseId?: string;
  rootForkSourceCourseId?: string;
} {
  if (!raw || typeof raw !== "object") return {};

  const forkSourceCourseId = String(
    raw.forkSourceCourseId ??
      raw.sourceCourseId ??
      raw.parentCourseId ??
      raw.copiedFromCourseId ??
      raw.forkedFromCourseId ??
      raw.originalCourseId ??
      "",
  ).trim();

  const rootForkSourceCourseId = String(
    raw.rootForkSourceCourseId ??
      raw.rootCourseId ??
      raw.originalCourseUuid ??
      raw.originCourseId ??
      "",
  ).trim();

  return {
    ...(forkSourceCourseId ? { forkSourceCourseId } : {}),
    ...(rootForkSourceCourseId ? { rootForkSourceCourseId } : {}),
  };
}

/** API에 명시된 최초 원작자 필드 */
export function pickRootAuthorFromRaw(
  raw: Record<string, unknown> | null | undefined,
): {
  authorUuid?: string;
  authorUserId?: string;
} {
  if (!raw || typeof raw !== "object") return {};

  const authorUuid = String(
    raw.originalAuthorUuid ??
      raw.rootAuthorUuid ??
      raw.originAuthorUuid ??
      raw.forkSourceAuthorUuid ??
      "",
  ).trim();

  const authorUserId = String(
    raw.originalAuthorUserId ??
      raw.rootAuthorUserId ??
      raw.originAuthorUserId ??
      raw.forkSourceAuthorUserId ??
      "",
  ).trim();

  return {
    ...(authorUuid ? { authorUuid } : {}),
    ...(authorUserId ? { authorUserId } : {}),
  };
}
