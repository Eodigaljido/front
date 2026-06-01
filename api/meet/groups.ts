import { instance } from '../axios';
import type {
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  JoinStatus,
  PageResponse,
} from './types';

/** GET /api/groups — 공개 모임 목록 (인증 없이 접근 가능) */
export async function getPublicGroups(
  page = 0,
  size = 20,
): Promise<PageResponse<Group>> {
  const res = await instance.get<PageResponse<Group>>('/api/groups', {
    params: { page, size },
  });
  return res.data;
}

/** POST /api/groups — 모임 생성 */
export async function createGroup(
  accessToken: string,
  data: CreateGroupRequest,
): Promise<Group> {
  const res = await instance.post<Group>('/api/groups', data, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
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
