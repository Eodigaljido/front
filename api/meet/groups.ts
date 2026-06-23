import { instance } from "../axios";
import {
  fetchMultipart,
  fileNameFromUri,
  mimeFromUri,
} from "../multipartFetch";
import type {
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  JoinStatus,
  PageResponse,
} from "./types";

/** GET /api/groups — 공개 모임 목록 (인증 없이 접근 가능) */
export async function getPublicGroups(
  page = 0,
  size = 20,
): Promise<PageResponse<Group>> {
  const res = await instance.get<PageResponse<Group>>("/api/groups", {
    params: { page, size },
  });
  return res.data;
}

/** GET /api/groups/my — 내가 가입한 모임 목록 (비공개 포함) */
export async function getMyGroups(
  accessToken: string,
  page = 0,
  size = 50,
): Promise<Group[]> {
  const res = await instance.get<Group[] | PageResponse<Group>>(
    "/api/groups/me",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, size },
    },
  );
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray((res.data as PageResponse<Group>).content)) {
    return (res.data as PageResponse<Group>).content;
  }
  return [];
}

/**
 * POST /api/groups — 모임 생성
 * 서버가 multipart/form-data 만 받으므로 이미지 유무와 관계없이 항상 multipart 로
 * 전송한다. request(JSON) 파트는 항상, image(파일) 파트는 선택했을 때만 포함.
 */
export async function createGroup(
  accessToken: string,
  data: CreateGroupRequest,
  image?: { uri: string; name?: string; type?: string } | null,
): Promise<Group> {
  const { data: res } = await fetchMultipart(
    "/api/groups",
    "POST",
    image?.uri
      ? [
          {
            field: "image",
            file: {
              uri: image.uri,
              name: image.name ?? fileNameFromUri(image.uri, "group.jpg"),
              type: image.type ?? mimeFromUri(image.uri),
            },
          },
        ]
      : [],
    {
      accessToken,
      fields: [{ field: "request", value: JSON.stringify(data) }],
    },
  );
  return res as Group;
}

/** GET /api/groups/{groupUuid} — 모임 상세 조회 */
export async function getGroup(groupUuid: string): Promise<Group> {
  const res = await instance.get<Group>(`/api/groups/${groupUuid}`);
  return res.data;
}

/** PATCH /api/groups/{groupUuid} — 모임 수정 (방장만) */
export async function updateGroup(
  accessToken: string,
  groupUuid: string,
  data: UpdateGroupRequest,
): Promise<Group> {
  const res = await instance.patch<Group>(`/api/groups/${groupUuid}`, data, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** DELETE /api/groups/{groupUuid} — 모임 삭제 (방장만) */
export async function deleteGroup(
  accessToken: string,
  groupUuid: string,
): Promise<void> {
  await instance.delete(`/api/groups/${groupUuid}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** POST /api/groups/{groupUuid}/join — 모임 가입 */
export async function joinGroup(
  accessToken: string,
  groupUuid: string,
): Promise<{ status: JoinStatus }> {
  const res = await instance.post<{ status: JoinStatus }>(
    `/api/groups/${groupUuid}/join`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}
