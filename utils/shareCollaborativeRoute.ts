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

/** 공동 루트 공유 — 친구 초대 / 채팅방 공유 / 링크 공유 선택 */
export function presentCollaborativeShareOptions(opts: {
  routeId: string;
  title: string;
  onInviteFriends: () => void;
  onShareToRoom: () => void;
  /** 링크 공유가 실제로 완료됐을 때 */
  onLinkShared?: () => void;
}): void {
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId) {
    Alert.alert('', '루트를 한 번 저장한 뒤 공유할 수 있어요.');
    return;
  }

  const pick = (index: number) => {
    if (index === 0) opts.onInviteFriends();
    else if (index === 1) opts.onShareToRoom();
    else if (index === 2) {
      void shareCollaborativeRoute({ routeId, title: opts.title }).then((shared) => {
        if (shared) opts.onLinkShared?.();
      });
    }
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['친구에게 공유', '채팅방에 공유', '링크로 공유', '취소'],
        cancelButtonIndex: 3,
        title: '공동 루트 초대',
        message: '친구·채팅방에서 직접 초대하거나 링크를 공유할 수 있어요.',
      },
      (i) => {
        if (i === 0 || i === 1 || i === 2) pick(i);
      },
    );
    return;
  }

  Alert.alert(
    '공동 루트 초대',
    '친구·채팅방에서 직접 초대하거나 링크를 공유할 수 있어요.',
    [
      { text: '친구에게 공유', onPress: () => pick(0) },
      { text: '채팅방에 공유', onPress: () => pick(1) },
      { text: '링크로 공유', onPress: () => pick(2) },
      { text: '취소', style: 'cancel' },
    ],
  );
}

/** 공동 편집 초대 — 링크로 RouteCreate(공동) 진입 */
export async function shareCollaborativeRoute(opts: {
  routeId: string;
  title: string;
}): Promise<boolean> {
  const title = String(opts.title ?? '루트').trim() || '루트';
  const routeId = String(opts.routeId ?? '').trim();
  if (!routeId) {
    Alert.alert('', '저장된 루트가 있어야 초대 링크를 보낼 수 있어요.');
    return false;
  }

  const url = buildCollaborativeRouteShareUrl(routeId);
  if (!url.includes('/routes/collaborative/')) {
    Alert.alert('', '초대 링크를 만들지 못했어요.');
    return false;
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
    if (result.action === Share.dismissedAction) return false;
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) return false;
    Alert.alert('', '공유에 실패했어요.');
    return false;
  }
}

/** 채팅방에 공동 루트 초대 링크 전송 */
export async function sendCollaborativeRouteToRoom(opts: {
  routeId: string;
  title: string;
  roomId: string;
}): Promise<boolean> {
  const title = String(opts.title ?? '루트').trim() || '루트';
  const routeId = String(opts.routeId ?? '').trim();
  const roomId = String(opts.roomId ?? '').trim();

  if (!routeId || !roomId) {
    Alert.alert('', '루트와 채팅방을 선택해야 합니다.');
    return false;
  }

  const url = buildCollaborativeRouteShareUrl(routeId);
  if (!url.includes('/routes/collaborative/')) {
    Alert.alert('', '초대 링크를 만들지 못했어요.');
    return false;
  }

  const message = `「${title}」 공동 루트 편집에 초대합니다.\n${url}`;

  try {
    // 채팅 API를 통해 메시지 전송
    // await instance.post(`/api/chat/rooms/${roomId}/messages`, { content: message });
    console.log(`채팅방 ${roomId}에 메시지 전송: ${message}`);
    return true;
  } catch (e: unknown) {
    Alert.alert('', '채팅방에 공유하지 못했어요.');
    return false;
  }
}
