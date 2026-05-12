// @ts-nocheck
import { instance } from "./axios";
import { MOCK_COURSES, type CourseItem } from "../data/mockData";

type ApiCourseLike = {
  id?: string | number;
  title?: string;
  name?: string;
  meta?: string;
  description?: string;
  departure?: string;
  startPlace?: string;
  arrival?: string;
  endPlace?: string;
  thumbnail?: string | null;
  imageUrl?: string | null;
  category?: string;
  region?: string;
  createdAt?: string;
  views?: number;
  durationMinutes?: number;
  overallDurationMinutes?: number;
  rating?: number;
  reviewCount?: number;
  steps?: Array<{ id?: string | number; name?: string; stayMinutes?: number }>;
  routeSteps?: Array<{ id?: string | number; name?: string; stayMinutes?: number }>;
  reviews?: Array<{
    id?: string | number;
    userName?: string;
    rating?: number;
    text?: string;
    date?: string;
  }>;
};

const CANDIDATE_ENDPOINTS = {
  home: [
    "/api/home/courses",
    "/api/courses/home",
    "/api/courses/popular",
    "/home/courses",
    "/courses/home",
    "/courses/popular",
  ],
  shared: [
    "/api/courses/public",
    "/api/shared/courses",
    "/api/courses",
    "/courses/public",
    "/shared/courses",
    "/courses",
  ],
  my: [
    "/api/courses/my",
    "/api/my/courses",
    "/api/courses/saved",
    "/courses/my",
    "/my/courses",
    "/courses/saved",
  ],
};

function pickArrayPayload(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

function toCourseItem(raw: ApiCourseLike, idx: number): CourseItem {
  const steps = (raw.routeSteps ?? raw.steps ?? []).map((s, sIdx) => ({
    id: String(s.id ?? `${raw.id ?? idx}-s-${sIdx}`),
    name: s.name ?? `경유지 ${sIdx + 1}`,
    stayMinutes: Number(s.stayMinutes ?? 30),
  }));
  return {
    id: String(raw.id ?? `api-${idx}`),
    title: raw.title ?? raw.name ?? "코스 제목",
    meta: raw.meta ?? raw.description ?? "API 연동 코스",
    departure: raw.departure ?? raw.startPlace ?? steps[0]?.name ?? "출발지",
    arrival:
      raw.arrival ?? raw.endPlace ?? steps[steps.length - 1]?.name ?? "도착지",
    thumbnail: raw.thumbnail ?? raw.imageUrl ?? null,
    category: raw.category ?? "기타",
    region: raw.region ?? "지역 미정",
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    views: Number(raw.views ?? 0),
    overallDurationMinutes: Number(
      raw.overallDurationMinutes ?? raw.durationMinutes ?? 120,
    ),
    rating: Number(raw.rating ?? 4.5),
    reviewCount: Number(raw.reviewCount ?? 0),
    routeSteps: steps.length > 0 ? steps : [{ id: `s-${idx}-0`, name: "경유지", stayMinutes: 30 }],
    reviews: (raw.reviews ?? []).map((r, rIdx) => ({
      id: String(r.id ?? `${raw.id ?? idx}-r-${rIdx}`),
      userName: r.userName ?? "사용자",
      rating: Number(r.rating ?? 5),
      text: r.text ?? "",
      date: r.date ?? new Date().toISOString().slice(0, 10),
    })),
  };
}

async function fetchCoursesFromCandidates(
  endpoints: string[],
  params?: Record<string, any>,
): Promise<CourseItem[]> {
  for (const endpoint of endpoints) {
    try {
      const res = await instance.get(endpoint, { params });
      const arr = pickArrayPayload(res.data);
      if (arr.length === 0) continue;
      return arr.map((item, idx) => toCourseItem(item, idx));
    } catch {
      // 다음 엔드포인트를 시도한다.
    }
  }
  return [];
}

export async function fetchHomeCourses(limit = 6): Promise<CourseItem[]> {
  const courses = await fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.home, {
    limit,
  });
  if (courses.length > 0) return courses;
  return [...MOCK_COURSES].sort((a, b) => b.views - a.views).slice(0, limit);
}

export async function fetchSharedCourses(): Promise<CourseItem[]> {
  const courses = await fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.shared);
  if (courses.length > 0) return courses;
  return MOCK_COURSES;
}

export async function fetchMyCourses(): Promise<CourseItem[]> {
  const courses = await fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.my);
  if (courses.length > 0) return courses;
  return [];
}

export async function saveSharedCourse(courseId: string): Promise<boolean> {
  const endpoints = [
    `/api/courses/${courseId}/save`,
    `/courses/${courseId}/save`,
    `/api/courses/${courseId}/bookmark`,
    `/courses/${courseId}/bookmark`,
  ];
  for (const endpoint of endpoints) {
    try {
      await instance.post(endpoint);
      return true;
    } catch {}
  }
  return false;
}

export async function submitSharedCourseReview(
  courseId: string,
  payload: { userName: string; rating: number; text: string },
): Promise<boolean> {
  const endpoints = [
    `/api/courses/${courseId}/reviews`,
    `/courses/${courseId}/reviews`,
    `/api/reviews/courses/${courseId}`,
    `/reviews/courses/${courseId}`,
  ];
  for (const endpoint of endpoints) {
    try {
      await instance.post(endpoint, payload);
      return true;
    } catch {}
  }
  return false;
}

export async function deleteMyCourse(courseId: string): Promise<boolean> {
  const endpoints = [
    `/api/courses/my/${courseId}`,
    `/courses/my/${courseId}`,
    `/api/courses/${courseId}`,
    `/courses/${courseId}`,
  ];
  for (const endpoint of endpoints) {
    try {
      await instance.delete(endpoint);
      return true;
    } catch {}
  }
  return false;
}

export type FollowingNewsItem = {
  id: string;
  user: string;
  action: string;
  courseName: string;
  ago: string;
};

export async function fetchFollowingNews(limit = 3): Promise<FollowingNewsItem[]> {
  const endpoints = ["/api/following/news", "/following/news", "/api/feed/following"];
  for (const endpoint of endpoints) {
    try {
      const res = await instance.get(endpoint, { params: { limit } });
      const arr = pickArrayPayload(res.data);
      if (arr.length === 0) continue;
      return arr.slice(0, limit).map((n: any, idx: number) => ({
        id: String(n.id ?? `news-${idx}`),
        user: String(n.user ?? n.nickname ?? "사용자"),
        action: String(n.action ?? "새 코스를 공개했어요"),
        courseName: String(n.courseName ?? n.title ?? "코스"),
        ago: String(n.ago ?? n.timeAgo ?? "방금"),
      }));
    } catch {}
  }
  return [];
}
