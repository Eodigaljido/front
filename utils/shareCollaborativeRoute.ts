import { Alert, ActionSheetIOS, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import { SHARE_LINK_HOST } from '../constants/shareLinking';

export function getShareBaseUrl(): string {
  const fromEnv = String(process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '').trim();
  const fromExtra = String(
    (Constants.expoConfig?.extra as { shareBaseUrl?: string } | undefined)?.shareBaseUrl ?? '',
  ).trim();
  const raw = fromEnv || fromExtra || `https://${SHARE_LINK_HOST}`;
  return raw.replace(/\/+$/, '');
}

export function buildCollaborativeRouteShareUrl(routeId: string): string {
  const id = String(routeId ?? '').trim();
  if (!id) return '';
  const base = getShareBaseUrl();
  return `${base}/routes/collaborative/${encodeURIComponent(id)}`;
}

/** 공동 루트 공유 — 친구 초대 / 링크 공유 선택 */
export function presentCollaborativeShareOptions(opts: {
  routeId: string;
  title: string;
  onInviteFriends: () => void;
}): void {
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId) {
    Alert.alert('', '루트를 한 번 저장한 뒤 공유할 수 있어요.');
    return;
  }

  const pick = (index: number) => {
    if (index === 0) opts.onInviteFriends();
    else if (index === 1) {
      void shareCollaborativeRoute({ routeId, title: opts.title });
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['친구에게 공유', '링크로 공유', '취소'],
        cancelButtonIndex: 2,
        title: '공동 루트 초대',
        message: '친구는 채팅방에서, 링크는 메신저·SNS로 보낼 수 있어요.',
      },
      (i) => {
        if (i === 0 || i === 1) pick(i);
      },
    );
    return;
  }

  Alert.alert(
    '공동 루트 초대',
    '친구는 채팅방에서, 링크는 메신저·SNS로 보낼 수 있어요.',
    [
      { text: '친구에게 공유', onPress: () => pick(0) },
      { text: '링크로 공유', onPress: () => pick(1) },
      { text: '취소', style: 'cancel' },
    ],
  );
}

/** 공동 편집 초대 — 링크로 RouteCreate(공동) 진입 */
export async function shareCollaborativeRoute(opts: {
  routeId: string;
  title: string;
}): Promise<void> {
  const title = String(opts.title ?? '루트').trim() || '루트';
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId) {
    Alert.alert('', '저장된 루트가 있어야 초대 링크를 보낼 수 있어요.');
    return;
  }

  const url = buildCollaborativeRouteShareUrl(routeId);
  if (!url.includes('/routes/collaborative/')) {
    Alert.alert('', '초대 링크를 만들지 못했어요.');
    return;
  }

  const message =
    `「${title}」 공동 루트 편집에 초대합니다.\n` +
    `앱을 설치한 뒤 링크를 열어 주세요.\n${url}`;

  try {
    const result = await Share.share(
      Platform.select({
        ios: { message, title: `${title} · 공동 편집` },
        android: { message, title: `${title} · 공동 편집` },
        default: { message, title: `${title} · 공동 편집` },
      }) ?? { message, title: `${title} · 공동 편집` },
    );
    if (result.action === Share.dismissedAction) return;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) return;
    Alert.alert('', '공유에 실패했어요.');
  }
}
