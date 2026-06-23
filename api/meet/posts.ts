import { instance } from '../axios';
import {
  fetchMultipart,
  fileNameFromUri,
  mimeFromUri,
  type MultipartFilePart,
} from '../multipartFetch';
import type { GroupPost, CreatePostRequest, UpdatePostRequest, PageResponse } from './types';

export type PostImageAsset = { uri: string; name?: string; type?: string };

function toFilePart(img: PostImageAsset, idx: number): MultipartFilePart {
  return {
    uri: img.uri,
    name: img.name ?? fileNameFromUri(img.uri, `post_${idx}.jpg`),
    type: img.type ?? mimeFromUri(img.uri),
  };
}

/** GET /api/groups/{groupUuid}/posts — 모임 게시물 목록 (모임 멤버만) */
export async function getGroupPosts(
  accessToken: string,
  groupUuid: string,
  page = 0,
  size = 20,
): Promise<GroupPost[]> {
  const res = await instance.get<GroupPost[] | PageResponse<GroupPost>>(
    `/api/groups/${groupUuid}/posts`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, size },
    },
  );
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray((res.data as PageResponse<GroupPost>).content)) {
    return (res.data as PageResponse<GroupPost>).content;
  }
  return [];
}

/** GET /api/groups/{groupUuid}/posts/{postUuid} — 모임 게시물 상세 (모임 멤버만) */
export async function getGroupPostDetail(
  accessToken: string,
  groupUuid: string,
  postUuid: string,
): Promise<GroupPost> {
  const res = await instance.get<GroupPost>(
    `/api/groups/${groupUuid}/posts/${postUuid}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

/**
 * POST /api/groups/{groupUuid}/posts — 모임 게시물 작성 (모임 멤버만)
 * content 는 쿼리 파라미터, images 는 multipart 파일 파트(선택, 최대 10장)로 보낸다.
 */
export async function createGroupPost(
  accessToken: string,
  groupUuid: string,
  data: CreatePostRequest,
  images?: PostImageAsset[],
): Promise<GroupPost> {
  const parts = (images ?? [])
    .filter((img) => img?.uri)
    .slice(0, 10)
    .map((img, i) => ({ field: 'images', file: toFilePart(img, i) }));
  const query =
    `?title=${encodeURIComponent(data.title)}` +
    `&content=${encodeURIComponent(data.content)}`;
  const { data: res } = await fetchMultipart(
    `/api/groups/${groupUuid}/posts${query}`,
    'POST',
    parts,
    { accessToken },
  );
  return res as GroupPost;
}

/**
 * PATCH /api/groups/posts/{postUuid} — 게시물 수정 (작성자만)
 * title·content 는 쿼리, images 는 multipart 파일 파트.
 * images 를 전달하면 기존 이미지를 교체하고, 생략하면 기존 이미지를 유지한다.
 */
export async function updateGroupPost(
  accessToken: string,
  postUuid: string,
  data: UpdatePostRequest,
  images?: PostImageAsset[],
): Promise<GroupPost> {
  const parts = (images ?? [])
    .filter((img) => img?.uri)
    .slice(0, 10)
    .map((img, i) => ({ field: 'images', file: toFilePart(img, i) }));
  const query =
    `?title=${encodeURIComponent(data.title)}` +
    `&content=${encodeURIComponent(data.content)}`;
  const { data: res } = await fetchMultipart(
    `/api/groups/posts/${postUuid}${query}`,
    'PATCH',
    parts,
    { accessToken },
  );
  return res as GroupPost;
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
