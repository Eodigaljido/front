import { instance } from './axios';

/**
 * 알림 설정 — 서버는 key→boolean 맵을 반환한다.
 * 프론트가 모르는 신규 key가 추가될 수 있으므로 Record로 받는다.
 */
export type NotificationSettingsMap = Record<string, boolean>;

/** 로그인 사용자의 전체 알림 설정 조회 (값 없는 key는 서버가 기본값 true로 채워 반환) */
export async function getNotificationSettings(): Promise<NotificationSettingsMap> {
  const res = await instance.get<NotificationSettingsMap>('/notification-settings');
  return res.data && typeof res.data === 'object' ? res.data : {};
}

/** 변경할 key만 부분 전달. 변경 반영된 전체 설정을 반환한다. */
export async function patchNotificationSettings(
  partial: NotificationSettingsMap,
): Promise<NotificationSettingsMap> {
  const res = await instance.patch<NotificationSettingsMap>(
    '/notification-settings',
    partial,
  );
  return res.data && typeof res.data === 'object' ? res.data : {};
}
