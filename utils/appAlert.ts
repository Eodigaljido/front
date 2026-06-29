import { useAlertStore, type AppAlertButton, type AppAlertType } from '../store/alertStore';

function inferType(
  title: string,
  message: string | undefined,
  buttons?: AppAlertButton[],
): AppAlertType {
  const text = `${title} ${message ?? ''}`;
  if (/(오류|실패|에러|error|불가|없습니다|틀렸)/i.test(text)) return 'error';
  if (/(완료|성공|저장|복사|추가되었|success)/i.test(text)) return 'success';
  if (buttons?.some(b => b.style === 'destructive')) return 'warning';
  return 'info';
}

/**
 * 앱 전역 커스텀 알림. React Native `Alert.alert` 과 동일한 시그니처.
 * `import { Alert } from 'react-native'` → `import { appAlert } from '../utils/appAlert'`
 * 후 `Alert.alert(` → `appAlert(` 로 교체하면 그대로 동작.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: { type?: AppAlertType },
): void {
  useAlertStore.getState().show({
    title,
    message,
    buttons,
    type: options?.type ?? inferType(title, message, buttons),
  });
}
