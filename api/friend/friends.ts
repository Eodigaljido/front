import { instance } from "../axios";

export interface Friends {
  friendId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

export async function getFriends(accessToken: string): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/friends", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function getFriendsRecent(
  accessToken: string,
): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/friends/recent", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
