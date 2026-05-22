import { Alert, Platform, Share } from 'react-native';
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
