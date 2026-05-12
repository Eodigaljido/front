import { instance } from "./axios";

export type UserProfile = {
  uuid: string;
  userId?: string;
  email?: string;
  nickname: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  introduction?: string | null;
  phone?: string | null;
  role?: string;
};

type UserSearchItem = {
  uuid: string;
  nickname: string;
  profileImageUrl?: string | null;
};

export async function getMyProfile(): Promise<UserProfile> {
  const res = await instance.get<UserProfile>("users/me");
  return res.data;
}

export async function patchMyProfile(input: {
  nickname?: string;
  bio?: string;
  introduction?: string;
}): Promise<UserProfile> {
  const res = await instance.patch<UserProfile>("users/me", input);
  return res.data;
}

export async function patchMyPhone(phone: string): Promise<UserProfile> {
  const res = await instance.patch<UserProfile>("users/me/phone", { phone });
  return res.data;
}

export async function patchMyProfileImage(asset: {
  uri: string;
  name?: string;
  type?: string;
}): Promise<UserProfile> {
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.name ?? "profile.jpg",
    type: asset.type ?? "image/jpeg",
  } as any);
  const res = await instance.patch<UserProfile>("users/me/profile-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteMyProfileImage(): Promise<UserProfile> {
  const res = await instance.delete<UserProfile>("users/me/profile-image");
  return res.data;
}

export async function deleteMyAccount(): Promise<void> {
  await instance.delete("users/me");
}

export async function getUserProfileByUuid(uuid: string): Promise<UserProfile> {
  const res = await instance.get<UserProfile>(`users/${uuid}`);
  return res.data;
}

export async function searchUsers(keyword: string): Promise<UserSearchItem[]> {
  const res = await instance.get<UserSearchItem[]>("users/search", {
    params: { nickname: keyword },
  });
  return Array.isArray(res.data) ? res.data : [];
}
