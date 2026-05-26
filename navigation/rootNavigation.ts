import { createNavigationContainerRef } from '@react-navigation/native';
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
  navigationRef.navigate(name, params as never);
}
