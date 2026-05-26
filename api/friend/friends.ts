import { instance } from '../axios';

export interface Friends {
  friendId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

// 친구 목록 조회
export async function getFriends(accessToken: string): Promise<Friends[]> {
  const res = await instance.get<Friends[]>('/api/friends', {
  const res = await instance.get<Friends[]>("/api/friends", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}

// 내 친구 코드 조회
export async function getMyFriendCode(): Promise<string> {
  const res = await instance.get<{ friendCode: string }>('/api/friends/code');
  return res.data.friendCode;
}

// 친구 코드로 친구 추가
export async function addFriendByCode(friendCode: string): Promise<void> {
  await instance.post('/api/friends/add', { friendCode });
}

// 최근 대화한 친구 목록 조회
export async function getFriendsRecent(accessToken: string): Promise<Friends[]> {
  const res = await instance.get<Friends[]>('/api/friends/recent', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * 친구 코드로 친구 추가 (공유 링크 수신 후 호출)
 * 백엔드 경로 확정 전: POST /friends/add — 명세 docs/share-link-backend-spec.md 참고
 */
export async function addFriendByCode(friendCode: string): Promise<void> {
  const code = String(friendCode ?? "").trim();
  if (!code) throw new Error("친구 코드가 비어 있습니다.");
  await instance.post("/api/friends/add", { friendCode: code });
}
