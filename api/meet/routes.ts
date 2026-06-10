import { instance } from '../axios';
import type { GroupRoute, PageResponse } from './types';

/** GET /api/groups/{groupUuid}/routes — 모임 내 루트 목록 (모임 멤버만) */
export async function getGroupRoutes(
  accessToken: string,
  groupUuid: string,
): Promise<GroupRoute[]> {
  const res = await instance.get<GroupRoute[] | PageResponse<GroupRoute>>(
    `/api/groups/${groupUuid}/routes`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray((res.data as PageResponse<GroupRoute>).content)) {
    return (res.data as PageResponse<GroupRoute>).content;
  }
  return [];
}
