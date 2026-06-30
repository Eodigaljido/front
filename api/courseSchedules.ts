import { instance } from "./axios";

export type ParticipantSummary = {
  uuid?: string;
  userId?: string;
  nickname?: string;
  profileImageUrl?: string | null;
};

export type CourseScheduleResponse = {
  uuid: string;
  title: string;
  scheduledAt: string;
  chatRoomUuid?: string | null;
  chatRoomName?: string | null;
  courseUuid?: string | null;
  courseTitle?: string | null;
  creatorUuid?: string;
  creatorNickname?: string;
  participants?: ParticipantSummary[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateCourseScheduleRequest = {
  title: string;
  scheduledAt: string;
  chatRoomUuid?: string | null;
  courseUuid?: string | null;
  notifyChat?: boolean;
};

export type UpdateCourseScheduleRequest = {
  title?: string;
  scheduledAt?: string;
  chatRoomUuid?: string;
  courseUuid?: string | null;
};

export type CourseScheduleListParams = {
  from?: string;
  to?: string;
  chatRoomUuid?: string;
  upcomingOnly?: boolean;
};

export type HomeCourseSchedule = {
  id: string;
  title: string;
  date: Date;
  participants: string[];
  chatRoomUuid?: string | null;
  chatRoomName?: string | null;
  courseUuid?: string | null;
  courseTitle?: string | null;
};

export function toKstIsoDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+09:00`;
}

export function mapCourseScheduleToHome(
  item: CourseScheduleResponse,
): HomeCourseSchedule {
  const participants = (item.participants ?? [])
    .map((member) =>
      String(member.nickname ?? member.userId ?? "").trim(),
    )
    .filter(Boolean);
  return {
    id: String(item.uuid ?? "").trim(),
    title: String(item.title ?? "").trim() || "코스 약속",
    date: new Date(item.scheduledAt),
    participants,
    chatRoomUuid: item.chatRoomUuid ?? null,
    chatRoomName: item.chatRoomName ?? null,
    courseUuid: item.courseUuid ?? null,
    courseTitle: item.courseTitle ?? null,
  };
}

export async function fetchCourseSchedules(
  params?: CourseScheduleListParams,
): Promise<{ items: CourseScheduleResponse[] }> {
  const res = await instance.get<{ items?: CourseScheduleResponse[] }>(
    "/api/course-schedules",
    { params },
  );
  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  return { items };
}

export async function fetchNearestCourseSchedule(): Promise<{
  item: CourseScheduleResponse | null;
}> {
  const res = await instance.get<{ item?: CourseScheduleResponse | null }>(
    "/api/course-schedules/nearest",
  );
  const item = res.data?.item ?? null;
  return { item: item && typeof item === "object" ? item : null };
}

export async function fetchCourseScheduleDetail(
  scheduleUuid: string,
): Promise<CourseScheduleResponse> {
  const id = String(scheduleUuid ?? "").trim();
  const res = await instance.get<CourseScheduleResponse>(
    `/api/course-schedules/${id}`,
  );
  return res.data;
}

export async function createCourseSchedule(
  body: CreateCourseScheduleRequest,
): Promise<CourseScheduleResponse> {
  const chatRoomUuid = String(body.chatRoomUuid ?? "").trim();
  const payload: Record<string, unknown> = {
    title: String(body.title ?? "").trim(),
    scheduledAt: body.scheduledAt,
  };
  if (chatRoomUuid) {
    payload.chatRoomUuid = chatRoomUuid;
    if (body.notifyChat) payload.notifyChat = true;
  }
  if (body.courseUuid) {
    payload.courseUuid = body.courseUuid;
  }
  const res = await instance.post<CourseScheduleResponse>(
    "/api/course-schedules",
    payload,
  );
  return res.data;
}

export async function updateCourseSchedule(
  scheduleUuid: string,
  body: UpdateCourseScheduleRequest,
): Promise<CourseScheduleResponse> {
  const id = String(scheduleUuid ?? "").trim();
  const res = await instance.patch<CourseScheduleResponse>(
    `/api/course-schedules/${id}`,
    body,
  );
  return res.data;
}

export async function deleteCourseSchedule(scheduleUuid: string): Promise<void> {
  const id = String(scheduleUuid ?? "").trim();
  await instance.delete(`/api/course-schedules/${id}`);
}
