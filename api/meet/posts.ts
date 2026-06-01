import { instance } from '../axios';
import type { GroupPost, CreatePostRequest, UpdatePostRequest } from './types';

/** GET /api/groups/{groupUuid}/posts — 모임 게시물 목록 (모임 멤버만) */
export async function getGroupPosts(
  accessToken: string,
  groupUuid: string,
  page = 0,
  size = 20,
): Promise<GroupPost[]> {
  const res = await instance.get<GroupPost[]>(`/api/groups/${groupUuid}/posts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { page, size },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /api/groups/{groupUuid}/posts — 모임 게시물 작성 (모임 멤버만) */
export async function createGroupPost(
  accessToken: string,
  groupUuid: string,
  data: CreatePostRequest,
): Promise<GroupPost> {
  const res = await instance.post<GroupPost>(
    `/api/groups/${groupUuid}/posts`,
    data,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

/** PATCH /api/groups/posts/{postUuid} — 게시물 수정 (작성자만) */
export async function updateGroupPost(
  accessToken: string,
  postUuid: string,
  data: UpdatePostRequest,
): Promise<GroupPost> {
  const res = await instance.patch<GroupPost>(
    `/api/groups/posts/${postUuid}`,
    data,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

/** DELETE /api/groups/{groupUuid}/posts/{postUuid} — 게시물 삭제 (작성자 또는 방장) */
export async function deleteGroupPost(
  accessToken: string,
  groupUuid: string,
  postUuid: string,
): Promise<void> {
  await instance.delete(`/api/groups/${groupUuid}/posts/${postUuid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
