import { instance } from './axios';
import { fetchMultipart, fileNameFromUri, mimeFromUri } from './multipartFetch';
import { unwrapUserProfile } from '../utils/profileImageUri';

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
  /** 계정에 연결된 로그인 수단: 'LOCAL' | 'KAKAO' | 'GOOGLE' */
  loginMethods?: string[];
};

type UserSearchItem = {
  uuid: string;
  nickname: string;
  profileImageUrl?: string | null;
};

export async function getMyProfile(): Promise<UserProfile> {
  const res = await instance.get('users/me');
  return unwrapUserProfile<UserProfile>(res.data);
}

export async function patchMyProfile(input: {
  nickname?: string;
  bio?: string;
  introduction?: string;
}): Promise<UserProfile> {
  const res = await instance.patch('users/me', input);
  return unwrapUserProfile<UserProfile>(res.data);
}

export async function patchMyPhone(phone: string): Promise<UserProfile> {
  const res = await instance.patch('users/me/phone', { phone });
  return unwrapUserProfile<UserProfile>(res.data);
}

export async function patchMyProfileImage(asset: {
  uri: string;
  name?: string;
  type?: string;
}): Promise<UserProfile> {
  const form = new FormData();
  const rawType = String(asset.type ?? 'image/jpeg');
  const mime =
    rawType === 'image/heic' || rawType === 'image/heif'
      ? 'image/jpeg'
      : rawType.startsWith('image/')
        ? rawType
        : 'image/jpeg';
  let fileName = asset.name ?? 'profile.jpg';
  if (!/\.(jpe?g|png|webp)$/i.test(fileName)) {
    fileName = 'profile.jpg';
  }
  form.append('image', {
    uri: asset.uri,
    name: fileName,
    type: mime,
  } as any);
  const res = await instance.patch('users/me/profile-image', form, {
    transformRequest: (data, headers) => {
      if (headers) {
        delete headers['Content-Type'];
        delete headers['content-type'];
      }
      return data;
    },
  });
  return unwrapUserProfile<UserProfile>(res.data);
}

export async function deleteMyProfileImage(): Promise<UserProfile> {
  const res = await instance.delete('users/me/profile-image');
  return unwrapUserProfile<UserProfile>(res.data);
}

export async function deleteMyAccount(): Promise<void> {
  await instance.delete('users/me');
}

export async function getUserProfileByUuid(uuid: string): Promise<UserProfile> {
  const res = await instance.get<UserProfile>(`users/${uuid}`);
  return res.data;
}

export async function searchUsers(keyword: string): Promise<UserSearchItem[]> {
  const res = await instance.get<UserSearchItem[]>('users/search', {
    params: { nickname: keyword },
  });
  return Array.isArray(res.data) ? res.data : [];
}
