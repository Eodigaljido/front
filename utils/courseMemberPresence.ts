/** 서버 lastSeenAt 기준 온라인 판정 (heartbeat 주기보다 여유 있게) */
export const COURSE_MEMBER_ONLINE_WINDOW_MS = 90_000;

export function parseLastSeenMs(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** API·STOMP raw → 온라인 여부 */
export function resolveMemberOnlineFromRaw(
  raw: Record<string, unknown>,
): boolean {
  if (raw.online === true || raw.isOnline === true) return true;
  if (raw.online === false || raw.isOnline === false) return false;

  const lastSeen =
    raw.lastSeenAt ?? raw.last_seen_at ?? raw.lastSeen ?? raw.last_seen;
  const seenMs = parseLastSeenMs(lastSeen);
  if (seenMs != null) {
    return Date.now() - seenMs <= COURSE_MEMBER_ONLINE_WINDOW_MS;
  }

  return false;
}
