import { pickAuthorProfilePublicFromRaw } from "./authorProfileVisibility";

export type PickedCourseAuthor = {
  authorUuid?: string;
  authorUserId?: string;
  authorProfilePublic?: boolean;
  modifierUuid?: string;
  modifierUserId?: string;
  modifierProfilePublic?: boolean;
};

/** Swagger `authorUuid` / `authorUserId` 및 중첩·별칭 필드에서 작성자 추출 */
export function pickCourseAuthorFromRaw(
  raw: Record<string, unknown> | null | undefined,
): PickedCourseAuthor {
  if (!raw || typeof raw !== "object") return {};

  const nestedKeys = ["author", "owner", "creator", "fromUser", "user"] as const;
  let fromNested: PickedCourseAuthor = {};
  for (const key of nestedKeys) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      fromNested = pickCourseAuthorFromRaw(nested as Record<string, unknown>);
      if (fromNested.authorUuid || fromNested.authorUserId) break;
    }
  }

  const authorUuid = String(
    raw.authorUuid ??
      raw.ownerUuid ??
      raw.creatorUuid ??
      raw.createdByUuid ??
      fromNested.authorUuid ??
      "",
  ).trim();

  const authorUserId = String(
    raw.authorUserId ??
      raw.authorId ??
      raw.ownerUserId ??
      raw.creatorUserId ??
      raw.createdByUserId ??
      raw.createdBy ??
      fromNested.authorUserId ??
      "",
  ).trim();

  const apiFlag =
    pickAuthorProfilePublicFromRaw(raw) ?? fromNested.authorProfilePublic;

  const modifierNestedKeys = ["modifier", "editor", "updatedBy", "lastModifiedBy"] as const;
  let modNested: PickedCourseAuthor = {};
  for (const key of modifierNestedKeys) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      modNested = pickCourseAuthorFromRaw(nested as Record<string, unknown>);
      if (modNested.authorUuid || modNested.authorUserId) {
        modNested = {
          modifierUuid: modNested.authorUuid,
          modifierUserId: modNested.authorUserId,
          modifierProfilePublic: modNested.authorProfilePublic,
        };
        break;
      }
    }
  }

  const modifierUuid = String(
    raw.modifierUuid ??
      raw.editorUuid ??
      raw.updatedByUuid ??
      raw.lastModifiedByUuid ??
      modNested.modifierUuid ??
      "",
  ).trim();

  const modifierUserId = String(
    raw.modifierUserId ??
      raw.editorUserId ??
      raw.updatedByUserId ??
      raw.lastModifiedByUserId ??
      modNested.modifierUserId ??
      "",
  ).trim();

  const modFlag =
    pickAuthorProfilePublicFromRaw({
      modifierProfilePublic: raw.modifierProfilePublic,
      authorProfilePublic: raw.editorProfilePublic,
    }) ?? modNested.modifierProfilePublic;

  return {
    ...(authorUuid ? { authorUuid } : {}),
    ...(authorUserId ? { authorUserId } : {}),
    ...(apiFlag !== undefined ? { authorProfilePublic: apiFlag } : {}),
    ...(modifierUuid ? { modifierUuid } : {}),
    ...(modifierUserId ? { modifierUserId } : {}),
    ...(modFlag !== undefined ? { modifierProfilePublic: modFlag } : {}),
  };
}
