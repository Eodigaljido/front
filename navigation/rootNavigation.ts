import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../App';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** 탭 화면 등에서 루트 스택 화면으로 이동 (NavigationContainer ref) */
export function rootNavigate<Name extends keyof RootStackParamList>(
  name: Name,
  params?: RootStackParamList[Name],
): void {
  if (!navigationRef.isReady()) {
    if (__DEV__) {
      console.warn('[rootNavigate] NavigationContainer not ready:', name);
    }
    return;
  }
  navigationRef.navigate({ name, params } as never);
}

/** 하단 탭 · 채팅 목록(메세지 홈) */
export function rootNavigateToChatTab(): void {
  if (!navigationRef.isReady()) {
    if (__DEV__) {
      console.warn('[rootNavigateToChatTab] NavigationContainer not ready');
    }
    return;
  }
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'Tabs',
      params: { screen: 'Chat' },
    }),
  );
}

export function rootNavigateToNotificationCenter(): void {
  rootNavigate('NotificationCenter');
}

type NavLike = {
  goBack: () => void;
  canGoBack?: () => boolean;
};

/** 스택에 이전 화면이 없을 때(딥링크·rootNavigate 직후 등) GO_BACK 경고 방지 */
export function safeGoBack(
  navigation?: NavLike,
  fallbackRoute: keyof RootStackParamList = 'Tabs',
): void {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  if (!navigationRef.isReady()) return;
  if (navigationRef.canGoBack()) {
    navigationRef.goBack();
    return;
  }
  navigationRef.navigate(fallbackRoute as never);
}
