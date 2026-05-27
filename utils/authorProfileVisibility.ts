import { getUserProfileByUuid } from "../api/users";

const visibilityCache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

/** 코스 API에 실려 오는 작성자 프로필 공개 여부 (없으면 undefined) */
export function pickAuthorProfilePublicFromRaw(
  raw: Record<string, unknown> | null | undefined,
): boolean | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v =
    raw.authorProfilePublic ??
    raw.authorPublicProfile ??
    raw.authorProfileVisible ??
    raw.profilePublic ??
    raw.publicProfile;
  if (v === false || v === "false" || v === 0) return false;
  if (v === true || v === "true" || v === 1) return true;
  return undefined;
}

export function getCachedAuthorProfileVisible(
  authorUuid: string,
): boolean | undefined {
  const id = String(authorUuid ?? "").trim();
  if (!id) return undefined;
  return visibilityCache.get(id);
}

/** GET /users/{uuid} — 404·403이면 비공개 프로필로 간주 */
export async function resolveAuthorProfileVisible(
  authorUuid: string,
): Promise<boolean> {
  const id = String(authorUuid ?? "").trim();
  if (!id) return false;

  const cached = visibilityCache.get(id);
  if (cached !== undefined) return cached;

  const pending = inflight.get(id);
  if (pending) return pending;

  const task = getUserProfileByUuid(id)
    .then(() => {
      visibilityCache.set(id, true);
      return true;
    })
    .catch((e: { response?: { status?: number } }) => {
      const status = e?.response?.status;
      const hidden = status === 404 || status === 403;
      visibilityCache.set(id, !hidden);
      return !hidden;
    })
    .finally(() => {
      inflight.delete(id);
    });

  inflight.set(id, task);
  return task;
}
