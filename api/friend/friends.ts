import { instance } from "../axios";

export interface FriendRequest {
  requestId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
  direction: "SENT" | "RECEIVED";
  createdAt: string;
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const res = await instance.get<FriendRequest[]>("/api/friends/requests");
  return Array.isArray(res.data) ? res.data : [];
}

export async function respondToFriendRequest(
  requestId: number,
  accept: boolean,
): Promise<void> {
  await instance.patch(`/api/friends/requests/${requestId}`, { accept });
}

export interface Friends {
  friendId: number;
  userId: string;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

export async function getFriends(accessToken: string): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/api/friends");
  return Array.isArray(res.data) ? res.data : [];
}

export async function getMyFriendCode(): Promise<string> {
  const res = await instance.get<{ friendCode: string }>("/api/friends/code");
  return res.data.friendCode;
}

export async function addFriendByCode(friendCode: string): Promise<void> {
  await instance.post("/api/friends/add", { friendCode });
}

export async function getFriendsRecent(
  accessToken: string,
): Promise<Friends[]> {
  const res = await instance.get<Friends[]>("/api/friends/recent");
  return Array.isArray(res.data) ? res.data : [];
}

export async function addFriendByCodeLink(friendCode: string): Promise<void> {
  const code = String(friendCode ?? "").trim();
  if (!code) throw new Error("친구 코드가 비어 있습니다.");
  await instance.post("/api/friends/add", { friendCode: code });
}

export async function deleteFriend(friendId: number): Promise<void> {
  await instance.delete(`/api/friends/${friendId}`);
}
