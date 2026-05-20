import { instance } from "../axios";

export interface Friends {
  friendId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

// 친구 목록 조회
export async function getFriends(accessToken: string): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/friends", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}

// 내 친구 코드 조회
export async function getMyFriendCode(): Promise<string> {
  const res = await instance.get<{ friendCode: string }>("/friends/code");
  return res.data.friendCode;
}

// 최근 대화한 친구 목록 조회
export async function getFriendsRecent(
  accessToken: string,
): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/friends/recent", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}
