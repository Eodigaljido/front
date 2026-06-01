import type { NavigationContainerRef, NavigationProp } from '@react-navigation/native';
import type { ParsedSharePath } from './parseSharePath';

let pending: ParsedSharePath | null = null;

export function setPendingShareLink(link: ParsedSharePath | null): void {
  pending = link;
}

export function getPendingShareLink(): ParsedSharePath | null {
  return pending;
}

export function clearPendingShareLink(): void {
  pending = null;
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
          params: { editRouteId: link.routeId, collaborative: true },
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
