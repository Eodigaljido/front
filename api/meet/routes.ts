import { instance } from '../axios';
import type { GroupRoute } from './types';

/** GET /api/groups/{groupUuid}/routes — 모임 내 루트 목록 (모임 멤버만) */
export async function getGroupRoutes(
  accessToken: string,
  groupUuid: string,
): Promise<GroupRoute[]> {
  const res = await instance.get<GroupRoute[]>(`/api/groups/${groupUuid}/routes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}
