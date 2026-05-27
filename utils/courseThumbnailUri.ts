import { bustProfileImageUri } from "./profileImageUri";

/** 서버에서 내려준 썸네일 URL */
export function isRemoteThumbnailUri(uri: string | null | undefined): boolean {
  const s = String(uri ?? "").trim();
  return /^https?:\/\//i.test(s);
}

/** 기기 갤러리 file:// · content:// */
export function isLocalThumbnailUri(uri: string | null | undefined): boolean {
  const s = String(uri ?? "").trim();
  return /^file:\/\//i.test(s) || /^content:\/\//i.test(s);
}

/** 목록·편집 UI — API URL 우선, 없으면 로컬 초안 */
export function resolveCourseThumbnailForDisplay(
  apiThumbnail: string | null | undefined,
  localCoverUri: string | null | undefined,
  cacheKey?: string | number | null,
): string | null {
  const remote = String(apiThumbnail ?? "").trim();
  if (isRemoteThumbnailUri(remote)) {
    return bustProfileImageUri(remote, cacheKey) || remote;
  }
  const local = String(localCoverUri ?? "").trim();
  if (local) return local;
  if (remote) return remote;
  return null;
}
