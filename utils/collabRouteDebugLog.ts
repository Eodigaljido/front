/** 공동 루트 실시간 동기화 디버그 — Expo Metro 콘솔에서 `[CollabSync]` 검색 */
const PREFIX = '[CollabSync]';

function isCollabDebugEnabled(): boolean {
  if (!__DEV__) return false;
  const flag = process.env.EXPO_PUBLIC_COLLAB_SYNC_DEBUG;
  return flag === undefined || flag === '' || flag === '1' || flag === 'true';
}

export function collabSyncLog(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!isCollabDebugEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.log(PREFIX, event, data);
  } else {
    console.log(PREFIX, event);
  }
}

export function collabSyncWarn(
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!isCollabDebugEnabled()) return;
  if (data && Object.keys(data).length > 0) {
    console.warn(PREFIX, event, data);
  } else {
    console.warn(PREFIX, event);
  }
}
