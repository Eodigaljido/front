/** Supabase 등 동일 URL 덮어쓰기 시 RN Image 캐시 무효화 */
export function bustProfileImageUri(
  url: string | null | undefined,
  cacheKey?: number | string | null,
): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (cacheKey == null || cacheKey === "" || cacheKey === 0) return raw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}v=${encodeURIComponent(String(cacheKey))}`;
}

export function unwrapUserProfile<T extends Record<string, unknown>>(
  data: unknown,
): T {
  if (!data || typeof data !== "object") return data as T;
  const anyData = data as Record<string, unknown>;
  if (anyData.uuid != null || anyData.nickname != null) return data as T;
  const inner = anyData.data ?? anyData.result ?? anyData.user;
  if (inner && typeof inner === "object") return inner as T;
  return data as T;
}
