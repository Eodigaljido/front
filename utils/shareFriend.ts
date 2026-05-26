import { Alert, Platform, Share } from 'react-native';
import { getShareBaseUrl } from './shareCourse';

/** 딥링크·웹 경로 (백엔드·appLinking과 동일) */
export const FRIEND_ADD_PATH = 'friends/add';

/** 친구 추가 초대 링크. 앱·웹: /friends/add/{friendCode} */
export function buildFriendInviteUrl(friendCode: string): string {
  const code = String(friendCode ?? '').trim();
  const base = getShareBaseUrl();
  if (!base || !code) return '';
  return `${base}/${FRIEND_ADD_PATH}/${encodeURIComponent(code)}`;
}

export async function shareFriendInvite(opts: {
  friendCode: string;
  /** 공유 메시지에 표시할 이름 (본인 닉네임 등) */
  inviterName?: string;
}): Promise<void> {
  const friendCode = String(opts.friendCode ?? '').trim();
  const inviterName = String(opts.inviterName ?? '').trim();
  if (!friendCode) {
    Alert.alert('', '친구 코드 없음');
    return;
  }

  const url = buildFriendInviteUrl(friendCode);
  const title = inviterName ? `${inviterName}님의 친구 초대` : '친구 초대';
  const message = url
    ? `${title}\n링크를 열어 친구로 추가해 주세요.\n${url}`
    : `${title}\n친구 코드: ${friendCode}`;

  try {
    const result = await Share.share(
      Platform.select({
        ios: { message, url: url || undefined, title },
        android: { message, title },
        default: { message, title },
      }) ?? { message, title },
    );
    if (result.action === Share.dismissedAction) return;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
      return;
    }
    Alert.alert('', '공유 실패');
  }
}
