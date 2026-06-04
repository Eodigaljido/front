import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef, NavigationProp } from '@react-navigation/native';
import type { ParsedSharePath } from './parseSharePath';

const STORAGE_KEY = 'pending_share_link_v1';

let pending: ParsedSharePath | null = null;

function isParsedSharePath(value: unknown): value is ParsedSharePath {
  if (!value || typeof value !== 'object') return false;
  const t = (value as ParsedSharePath).type;
  if (t === 'course') {
    return Boolean(String((value as { courseId?: string }).courseId ?? '').trim());
  }
  if (t === 'friend') {
    return Boolean(String((value as { friendCode?: string }).friendCode ?? '').trim());
  }
  if (t === 'collab') {
    return Boolean(String((value as { routeId?: string }).routeId ?? '').trim());
  }
  return false;
}

export function setPendingShareLink(link: ParsedSharePath | null): void {
  pending = link;
  if (link) {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(link)).catch(() => {});
  } else {
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
}

export function getPendingShareLink(): ParsedSharePath | null {
  return pending;
}

export function clearPendingShareLink(): void {
  pending = null;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/** 앱 재시작 후에도 로그인 전에 받은 공유 링크 복구 */
export async function restorePendingShareLinkFromStorage(): Promise<ParsedSharePath | null> {
  if (pending) return pending;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isParsedSharePath(parsed)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    pending = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/** 로그인·온보딩 완료 후 Tabs로 이동 + 공유/친구 화면으로 연결 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResetNavigation = Pick<NavigationProp<any>, 'reset'>;

export function consumePendingShareNavigation(
  navigation: NavigationContainerRef<Record<string, unknown>> | ResetNavigation,
): boolean {
  const link = getPendingShareLink();
  if (!link) return false;
  clearPendingShareLink();

  if (link.type === 'collab') {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'RouteCreate',
          params: buildCollaborativeRouteCreateParams(link.routeId),
        },
      ],
    });
    return true;
  }

  if (link.type === 'course') {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Tabs',
          state: {
            index: 1,
            routes: [
              { name: 'Home' },
              {
                name: 'Route',
                params: { section: 'shared', viewCourseId: link.courseId },
              },
              { name: 'Chat' },
              { name: 'All' },
            ],
          },
        },
      ],
    });
    return true;
  }

  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'Tabs',
        state: {
          index: 3,
          routes: [
            { name: 'Home' },
            { name: 'Route' },
            { name: 'Chat' },
            { name: 'All', params: { friendCode: link.friendCode } },
          ],
        },
      },
    ],
  });
  return true;
}

/** 로그인·온보딩 후 메인 진입 (보류 중인 공유 링크가 있으면 해당 탭으로) */
export function resetToMainAfterAuth(navigation: ResetNavigation): void {
  if (consumePendingShareNavigation(navigation)) return;
  navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
}

/** 공동 루트 딥링크 params (shareLinking · pendingShareLink 공통) */
export function buildCollaborativeRouteCreateParams(routeId: string): {
  editRouteId: string;
  collaborative: true;
} {
  return {
    editRouteId: String(routeId ?? '').trim(),
    collaborative: true,
  };
}
