import { instance } from '../axios';
import type { GroupMember, JoinRequest, JoinRequestAction } from './types';

/** GET /api/groups/{groupUuid}/members — 모임 멤버 목록 (인증 없이 접근 가능) */
export async function getGroupMembers(
  groupUuid: string,
  page = 0,
  size = 20,
): Promise<GroupMember[]> {
  const res = await instance.get<GroupMember[]>(
    `/api/groups/${groupUuid}/members`,
    { params: { page, size } },
  );
  return Array.isArray(res.data) ? res.data : [];
}

/** DELETE /api/groups/{groupUuid}/members/me — 모임 탈퇴 (방장 불가) */
export async function leaveGroup(
  accessToken: string,
  groupUuid: string,
): Promise<void> {
  await instance.delete(`/groups/${groupUuid}/members/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** GET /api/groups/{groupUuid}/join-requests — 가입 요청 목록 (방장만) */
export async function getJoinRequests(
  accessToken: string,
  groupUuid: string,
  page = 0,
  size = 20,
): Promise<JoinRequest[]> {
  const res = await instance.get<JoinRequest[]>(
    `/api/groups/${groupUuid}/join-requests`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, size },
    },
  );
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /api/groups/join-requests/{requestId} — 가입 요청 승인/거절 (방장만) */
export async function processJoinRequest(
  accessToken: string,
  requestId: number,
  action: JoinRequestAction,
): Promise<void> {
  await instance.post(
    `/api/groups/join-requests/${requestId}`,
    { action },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
