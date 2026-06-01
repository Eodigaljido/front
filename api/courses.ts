// @ts-nocheck
import { instance } from "./axios";
import {
  fetchMultipart,
  fileNameFromUri,
  mimeFromUri,
  MultipartHttpError,
} from "./multipartFetch";
import type { CourseItem } from "../data/mockData";
import {
  resolveCourseRegionLabel,
  sanitizeCourseCategory,
} from "../utils/inferCourseRegionLabel";
import { pickAuthorProfilePublicFromRaw } from "../utils/authorProfileVisibility";
import { pickCourseAuthorFromRaw } from "../utils/pickCourseAuthorFromRaw";
import { pickForkChainFromRaw } from "../utils/pickForkChainFromRaw";
import { findPersonalRouteIdForForkSource } from "../data/userSavedRoute";
import { isLocalThumbnailUri, isRemoteThumbnailUri } from "../utils/courseThumbnailUri";
import { sameCourseId } from "../utils/sameCourseId";
import { getFriends } from "./friend/friends";
import { bustProfileImageUri } from "../utils/profileImageUri";
import { useAuthStore } from "../store/authStore";

type ApiCourseLike = {
  id?: string | number;
  uuid?: string;
  courseId?: string | number;
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
  saveCount?: number;
  savedCount?: number;
  bookmarkCount?: number;
  saves?: number;
  collectCount?: number;
  save_count?: number;
  durationMinutes?: number;
  overallDurationMinutes?: number;
  rating?: number;
  reviewCount?: number;
  steps?: Array<{
    id?: string | number;
    name?: string;
    title?: string;
    stayMinutes?: number;
    lat?: number;
    lng?: number;
  }>;
  routeSteps?: Array<{
    id?: string | number;
    name?: string;
    title?: string;
    stayMinutes?: number;
    lat?: number;
    lng?: number;
  }>;
  /** Swagger PATCH/POST 본문과 동일 — 목록·상세에서 자주 사용 */
  stops?: Array<{
    id?: string | number;
    sequence?: number;
    kind?: string;
    title?: string;
    name?: string;
    timeLine?: string;
    stayMinutes?: number;
    lat?: number;
    lng?: number;
  }>;
  legs?: Array<{
    id?: string | number;
    mode?: string;
    minutes?: number;
    transitType?: "bus" | "subway" | "train";
  }>;
  routeLegs?: Array<{
    id?: string | number;
    mode?: string;
    minutes?: number;
    transitType?: "bus" | "subway" | "train";
  }>;
  reviews?: Array<{
    id?: string | number;
    userName?: string;
    rating?: number;
    text?: string;
    date?: string;
  }>;
  /** 코스 태그 (서버·클라이언트 공통, 카드에 최대 2개 표시) */
  tags?: string[];
};

/** Swagger UI 기준 확정 경로만 사용 (빈 목록 시 fallback 호출로 404 로그가 쌓이지 않게 함) */
const CANDIDATE_ENDPOINTS = {
  home: ["/api/home/courses"],
  shared: ["/api/courses/public"],
  my: ["/api/courses/my"],
};

const DETAIL_CANDIDATE_ENDPOINTS = {
  /** Swagger: GET /api/courses/{courseId} */
  shared: (courseId: string) => [`/api/courses/${courseId}`],
  /** Swagger: GET /api/courses/my/{courseId} 권장 */
  my: (courseId: string) => [`/api/courses/my/${courseId}`],
};

function pickArrayPayload(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items;
    const id = data.id ?? data.uuid ?? data.courseId;
    if (id != null && (data.title != null || data.routeSteps != null)) {
      return [data];
    }
  }
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.courses)) return data.courses;
  return [];
}

/** Swagger `CourseItemResponse.id` / `MyCourseDetailResponse.uuid` */
function normalizeServerCourseId(
  raw: string | number | null | undefined,
): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.startsWith("ur-")) return null;
  return s;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function pickTagsFromApiRaw(
  raw: ApiCourseLike | Record<string, unknown>,
): string[] {
  if (!raw || typeof raw !== "object") return [];
  const anyRaw = raw as Record<string, unknown>;
  const collect = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.map((t) => String(t ?? "").trim()).filter((s) => s.length > 0)
      : [];
  const direct = anyRaw.tags;
  if (Array.isArray(direct)) {
    return collect(direct).slice(0, 4);
  }
  if (typeof direct === "string" && direct.trim()) {
    return direct
      .split(/[,#|\s]+/u)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);
  }
  const list = anyRaw.tagList;
  if (Array.isArray(list)) return collect(list).slice(0, 4);
  const labels = anyRaw.labels ?? anyRaw.courseTags ?? anyRaw.hashTags;
  if (Array.isArray(labels)) return collect(labels).slice(0, 4);
  return [];
}

/** API·스냅샷 — 로그인 사용자가 이 코스를 저장했는지 */
export function pickCourseSavedByMe(
  raw: ApiCourseLike | CourseItem | Record<string, unknown> | null | undefined,
): boolean {
  if (!raw || typeof raw !== "object") return false;
  const anyRaw = raw as Record<string, unknown>;
  if (anyRaw.savedByMe === true) return true;
  if (anyRaw.isSaved === true) return true;
  if (anyRaw.saved === true) return true;
  if (anyRaw.bookmarked === true) return true;
  if (anyRaw.savedByCurrentUser === true) return true;
  return false;
}

/** API·스냅샷 혼합 — 공유 코스 저장 횟수 */
export function pickCourseSaveCount(
  raw: ApiCourseLike | CourseItem | null | undefined,
): number {
  if (!raw || typeof raw !== "object") return 0;
  const n = Number(
    (raw as ApiCourseLike).saveCount ??
      (raw as ApiCourseLike).savedCount ??
      (raw as ApiCourseLike).bookmarkCount ??
      (raw as ApiCourseLike).saves ??
      (raw as ApiCourseLike).collectCount ??
      (raw as ApiCourseLike).save_count ??
      0,
  );
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** 저장 수 내림차순 — 동점이면 조회수 */
export function sortCoursesBySaveCount(courses: CourseItem[]): CourseItem[] {
  return [...courses].sort((a, b) => {
    const diff = pickCourseSaveCount(b) - pickCourseSaveCount(a);
    if (diff !== 0) return diff;
    return Number(b.views ?? 0) - Number(a.views ?? 0);
  });
}

/** API·스냅샷 혼합 목록을 UI에서 안전하게 쓰도록 보정 */
export function normalizeCourseList(
  courses: CourseItem[] | null | undefined,
): CourseItem[] {
  if (!Array.isArray(courses)) return [];
  return courses.filter(Boolean).map((c, idx) => {
    const steps =
      Array.isArray(c.routeSteps) && c.routeSteps.length > 0
        ? c.routeSteps
        : [{ id: `fb-${idx}`, name: "경유지", stayMinutes: 30 }];
    const tags = Array.isArray(c.tags)
      ? c.tags
          .map((t) => String(t).trim())
          .filter(Boolean)
          .slice(0, 2)
      : [];
    const metaBad =
      !c.meta || String(c.meta).trim() === "" || c.meta === "API 연동 코스";
    const catSan = sanitizeCourseCategory(c.category);
    const meta =
      tags.length > 0 ? tags.join(" · ") : metaBad ? catSan || "코스" : c.meta;
    const stepNames = steps
      .map((s) => String(s?.name ?? "").trim())
      .filter(Boolean);
    const region = resolveCourseRegionLabel(
      c.region,
      String(c.departure ?? "").trim(),
      String(c.arrival ?? "").trim(),
      stepNames,
    );
    return {
      ...c,
      tags,
      meta,
      category: catSan,
      region,
      departure: c.departure ?? "출발지",
      arrival: c.arrival ?? "도착지",
      routeSteps: steps,
      routeLegs: Array.isArray(c.routeLegs) ? c.routeLegs : [],
      reviews: Array.isArray(c.reviews) ? c.reviews : [],
    };
  });
}

function toCourseItem(raw: ApiCourseLike, idx: number): CourseItem {
  if (!raw || typeof raw !== "object") {
    return {
      id: `api-${idx}`,
      title: "코스 제목",
      meta: "코스",
      tags: [],
      departure: "출발지",
      arrival: "도착지",
      thumbnail: null,
      category: "",
      region: "",
      createdAt: new Date().toISOString().slice(0, 10),
      views: 0,
      saveCount: 0,
      overallDurationMinutes: 120,
      rating: 4.5,
      reviewCount: 0,
      routeSteps: [{ id: `s-${idx}-0`, name: "경유지", stayMinutes: 30 }],
      routeLegs: [],
      reviews: [],
    };
  }
  /** 목록은 `id`, 상세는 `uuid` — Swagger 기준 `id` 우선 */
  const rootId =
    normalizeServerCourseId(raw.id) ??
    normalizeServerCourseId(raw.uuid) ??
    normalizeServerCourseId(raw.courseId) ??
    `api-${idx}`;

  const routeStepSource =
    asArray(raw.routeSteps).length > 0
      ? asArray(raw.routeSteps)
      : asArray(raw.steps);
  const fromRouteSteps = routeStepSource.filter(Boolean).map((s, sIdx) => {
    const sAny = s as {
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
    };
    const latRaw = sAny.lat ?? sAny.latitude;
    const lngRaw = sAny.lng ?? sAny.longitude;
    return {
      id: String(s.id ?? `${rootId}-s-${sIdx}`),
      name: String(s.name ?? s.title ?? `경유지 ${sIdx + 1}`),
      stayMinutes: Number(s.stayMinutes ?? 30),
      lat:
        latRaw != null && !Number.isNaN(Number(latRaw))
          ? Number(latRaw)
          : undefined,
      lng:
        lngRaw != null && !Number.isNaN(Number(lngRaw))
          ? Number(lngRaw)
          : undefined,
    };
  });

  let steps = fromRouteSteps;
  if (steps.length === 0 && Array.isArray(raw.stops) && raw.stops.length > 0) {
    const sorted = [...raw.stops].sort(
      (a, b) => Number(a?.sequence ?? 0) - Number(b?.sequence ?? 0),
    );
    steps = sorted.map((s, sIdx) => ({
      id: String(s.id ?? `${rootId}-s-${s.sequence ?? sIdx}`),
      name: String(s.title ?? s.name ?? `경유지 ${sIdx + 1}`),
      stayMinutes: Number(s.stayMinutes ?? 0),
      lat:
        s.lat != null && !Number.isNaN(Number(s.lat))
          ? Number(s.lat)
          : undefined,
      lng:
        s.lng != null && !Number.isNaN(Number(s.lng))
          ? Number(s.lng)
          : undefined,
    }));
  }

  const legs = (
    asArray(raw.routeLegs).length > 0
      ? asArray(raw.routeLegs)
      : asArray(raw.legs)
  ).map((l, lIdx) => ({
    id: String(l.id ?? `${rootId}-l-${lIdx}`),
    mode:
      l.mode === "walk" ||
      l.mode === "car" ||
      l.mode === "bike" ||
      l.mode === "transit"
        ? l.mode
        : "walk",
    minutes: Math.max(1, Number(l.minutes ?? 10)),
    transitType: l.transitType,
  }));

  const sortedStops = Array.isArray(raw.stops)
    ? [...raw.stops].sort(
        (a, b) => Number(a?.sequence ?? 0) - Number(b?.sequence ?? 0),
      )
    : [];
  const startByKind = sortedStops.find(
    (s) => String(s?.kind ?? "").toLowerCase() === "start",
  );
  const endByKind = sortedStops.find(
    (s) => String(s?.kind ?? "").toLowerCase() === "end",
  );

  const legMinutesSum = legs.reduce(
    (acc, l) => acc + (Number.isFinite(l.minutes) ? l.minutes : 0),
    0,
  );
  const overallFromFields = Number(
    raw.overallDurationMinutes ?? raw.durationMinutes ?? NaN,
  );

  const depFromKind = startByKind
    ? String(startByKind.title ?? startByKind.name ?? "").trim()
    : "";
  const arrFromKind = endByKind
    ? String(endByKind.title ?? endByKind.name ?? "").trim()
    : "";
  const depField = String(raw.departure ?? raw.startPlace ?? "").trim();
  const arrField = String(raw.arrival ?? raw.endPlace ?? "").trim();

  const tags = pickTagsFromApiRaw(raw).slice(0, 2);
  const rawMeta = String(raw.meta ?? raw.description ?? "").trim();
  const meta =
    tags.length > 0
      ? tags.join(" · ")
      : rawMeta && rawMeta !== "API 연동 코스"
        ? rawMeta
        : sanitizeCourseCategory(raw.category) || "코스";

  const departureOut = depField || depFromKind || steps[0]?.name || "출발지";
  const arrivalOut =
    arrField || arrFromKind || steps[steps.length - 1]?.name || "도착지";
  const stepNamesForRegion = steps
    .map((s) => String(s?.name ?? "").trim())
    .filter(Boolean);
  const regionResolved = resolveCourseRegionLabel(
    raw.region,
    departureOut,
    arrivalOut,
    stepNamesForRegion,
  );
  const categoryResolved = sanitizeCourseCategory(raw.category);

  return {
    id: rootId,
    title: raw.title ?? raw.name ?? "코스 제목",
    meta,
    tags,
    departure: departureOut,
    arrival: arrivalOut,
    thumbnail: raw.thumbnail ?? raw.imageUrl ?? null,
    category: categoryResolved,
    region: regionResolved,
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    views: Number(raw.views ?? 0),
    saveCount: pickCourseSaveCount(raw),
    overallDurationMinutes: Number(
      Number.isFinite(overallFromFields) && overallFromFields > 0
        ? overallFromFields
        : legMinutesSum > 0
          ? legMinutesSum
          : 120,
    ),
    rating: Number(raw.rating ?? 4.5),
    reviewCount: Number(raw.reviewCount ?? 0),
    routeSteps:
      steps.length > 0
        ? steps
        : [{ id: `s-${idx}-0`, name: "경유지", stayMinutes: 30 }],
    routeLegs: legs,
    reviews: asArray(raw.reviews).map((r, rIdx) => ({
      id: String(r.id ?? `${rootId}-r-${rIdx}`),
      userName: r.userName ?? "사용자",
      rating: Number(r.rating ?? 5),
      text: r.text ?? "",
      date: r.date ?? new Date().toISOString().slice(0, 10),
    })),
    ...pickCourseAuthorFromRaw(raw as Record<string, unknown>),
    ...pickForkChainFromRaw(raw as Record<string, unknown>),
    savedByMe: pickCourseSavedByMe(raw),
  };
}

/** 내가 저장한 공유 코스 id 목록 — 홈·공유 탭 북마크 동기화 */
export async function fetchMySavedCourseIds(): Promise<string[]> {
  const myUuid = String(useAuthStore.getState().user?.uuid ?? "").trim();
  const paramVariants: Record<string, string | number>[] = [
    { sort: "latest", page: 0, size: 200 },
  ];
  if (myUuid) {
    paramVariants.push({
      userUuid: myUuid,
      sort: "latest",
      page: 0,
      size: 200,
    });
  }

  for (const params of paramVariants) {
    try {
      const res = await instance.get("/api/courses/saved", {
        params,
        _silentOptional: true,
      } as any);
      if (res.status === 404 || res.status === 501) continue;
      const arr = pickArrayPayload(res.data);
      const ids = arr
        .map((c) =>
          normalizeServerCourseId(
            (c as ApiCourseLike).id ??
              (c as ApiCourseLike).uuid ??
              (c as ApiCourseLike).courseId,
          ),
        )
        .filter((id): id is string => Boolean(id));
      if (ids.length > 0 || arr.length === 0) return [...new Set(ids)];
    } catch {
      // 다음 파라미터 조합 시도
    }
  }
  return [];
}

async function fetchCourseDetailFromCandidates(
  endpoints: string[],
): Promise<CourseItem | null> {
  for (const endpoint of endpoints) {
    try {
      const res = await instance.get(endpoint);
      const data =
        res.data?.data ??
        res.data?.item ??
        res.data?.result ??
        res.data?.course ??
        res.data;
      if (!data || Array.isArray(data)) continue;
      return toCourseItem(data, 0);
    } catch {
      // 다음 엔드포인트를 시도한다.
    }
  }
  return null;
}

async function fetchCoursesFromCandidates(
  endpoints: string[],
  params?: Record<string, any>,
): Promise<CourseItem[]> {
  for (const endpoint of endpoints) {
    try {
      const res = await instance.get(endpoint, { params });
      const arr = pickArrayPayload(res.data);
      // 200 + 빈 배열은 "데이터 없음"으로 확정. Swagger 단일 경로이므로 다음 후보를 호출하지 않는다.
      if (arr.length === 0) return [];
      return normalizeCourseList(
        arr
          .filter((item) => item != null && typeof item === "object")
          .map((item, idx) => {
            try {
              return toCourseItem(item, idx);
            } catch (e) {
              if (__DEV__) {
                console.warn("[toCourseItem] skip item", idx, e);
              }
              return null;
            }
          })
          .filter((item): item is CourseItem => item != null),
      );
    } catch {
      // 다음 엔드포인트를 시도한다.
    }
  }
  return [];
}

export async function fetchHomeCourses(limit = 6): Promise<CourseItem[]> {
  return fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.home, {
    limit,
  });
}

/** 홈·인기 섹션 — 저장 수 기준 상위 코스 */
export async function fetchPopularCoursesBySaves(
  limit = 6,
): Promise<CourseItem[]> {
  const size = Math.max(limit, 20);
  const fromPublic = await fetchCoursesFromCandidates(
    CANDIDATE_ENDPOINTS.shared,
    {
      tab: "popular",
      sort: "popular",
      size,
    },
  );
  const list =
    fromPublic.length > 0
      ? fromPublic
      : await fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.home, {
          limit: size,
          sort: "popular",
        });
  return sortCoursesBySaveCount(list).slice(0, limit);
}

export async function fetchSharedCourses(
  params?: Record<string, unknown>,
): Promise<CourseItem[]> {
  return fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.shared, params);
}

export async function fetchMyCourses(): Promise<CourseItem[]> {
  const courses = await fetchCoursesFromCandidates(CANDIDATE_ENDPOINTS.my);
  if (courses.length > 0) return courses;
  return [];
}

export async function fetchSharedCourseDetail(
  courseId: string,
): Promise<CourseItem | null> {
  return fetchCourseDetailFromCandidates(
    DETAIL_CANDIDATE_ENDPOINTS.shared(courseId),
  );
}

export async function fetchMyCourseDetail(
  courseId: string,
): Promise<CourseItem | null> {
  return fetchCourseDetailFromCandidates(
    DETAIL_CANDIDATE_ENDPOINTS.my(courseId),
  );
}

/** 내 코스 편집 API 원본 — 공동 루트 여부 등 */
export async function fetchMyRouteCollaborativeFlag(
  courseId: string,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  try {
    const res = await instance.get(`/api/courses/my/${encodeURIComponent(id)}`);
    const data = res.data?.data ?? res.data;
    return data?.collaborative === true;
  } catch {
    return false;
  }
}

export type SaveSharedCourseResult =
  | { ok: true }
  | { ok: false; reason: "NOT_ON_SERVER" | "OTHER" };

/**
 * Swagger: POST /api/courses/{courseId}/save
 * 서버에 해당 공유 코스가 없으면 404 → 목(mock) ID로 저장 시도 시 실패함.
 */
/** Swagger: DELETE /api/courses/{courseId}/save — 저장한 공유 코스 해제 */
export async function unsaveSharedCourse(courseId: string): Promise<boolean> {
  const id = String(courseId ?? "").trim();
  if (!id) return false;
  try {
    await instance.delete(`/api/courses/${encodeURIComponent(id)}/save`);
    return true;
  } catch {
    return false;
  }
}

/** Swagger: POST /api/courses/{courseId}/copy — 공유 코스를 내 루트로 복사 */
export async function copySharedCourseToMy(
  courseId: string,
): Promise<string | null> {
  const id = String(courseId ?? "").trim();
  if (!id) return null;
  try {
    const res = await instance.post(
      `/api/courses/${encodeURIComponent(id)}/copy`,
    );
    return extractMyCourseUuidFromResponse(res.data);
  } catch {
    return null;
  }
}

/** 목록 fallback(「경유지」 1개)만 있는 경우 편집·안내에 쓸 실제 경유 데이터가 없음 */
export function hasMeaningfulRouteSteps(
  course: CourseItem | null | undefined,
): boolean {
  const steps = course?.routeSteps;
  if (!Array.isArray(steps) || steps.length === 0) return false;
  if (steps.length >= 2) return true;
  const s = steps[0];
  if (s?.lat != null && s?.lng != null) return true;
  const name = String(s?.name ?? "").trim();
  return name.length > 0 && name !== "경유지";
}

/** 내 코스 상세 → 없으면 공유 코스 상세 (저장한 타인 루트 편집·안내용) */
export async function resolveCourseDetailForRoute(
  courseId: string,
): Promise<{ course: CourseItem | null; source: "my" | "shared" | "none" }> {
  const id = String(courseId ?? "").trim();
  if (!id) return { course: null, source: "none" };

  const my = await fetchMyCourseDetail(id);
  if (hasMeaningfulRouteSteps(my)) {
    return { course: my, source: "my" };
  }

  const shared = await fetchSharedCourseDetail(id);
  if (hasMeaningfulRouteSteps(shared)) {
    return { course: shared, source: "shared" };
  }

  const fallback = my ?? shared;
  if (!fallback) return { course: null, source: "none" };
  return {
    course: fallback,
    source: shared && fallback === shared ? "shared" : "my",
  };
}

/**
 * fork·수정 저장 시 쓸 개인 루트 id
 * (이미 내 코스이면 copy 없이 해당 id로 PATCH)
 */
export async function resolvePersonalRouteIdForForkSave(
  forkSourceId: string,
  userSavedRoutes: Array<{ id: string; forkedFromSharedId?: string | null }>,
  serverBackedId?: string | null,
): Promise<string | null> {
  const forkId = String(forkSourceId ?? "").trim();
  if (!forkId) return null;

  const fromMeta = findPersonalRouteIdForForkSource(forkId, userSavedRoutes);
  if (fromMeta) return fromMeta;

  const serverId = normalizeServerCourseId(serverBackedId);
  if (serverId && !sameCourseId(serverId, forkId)) return serverId;

  const my = await fetchMyCourseDetail(forkId);
  if (hasMeaningfulRouteSteps(my)) return forkId;

  return null;
}

/** 공유(저장) 코스를 복사한 뒤 편집 내용을 반영해 개인 루트 id 반환 */
export async function forkSharedCourseToPersonalRoute(
  sharedCourseId: string,
  payload: UpsertMyRoutePayload,
  existingPersonalId?: string | null,
): Promise<string | null> {
  const sourceId = String(sharedCourseId ?? "").trim();
  if (!sourceId) return createMyRoute(payload);

  const existing = normalizeServerCourseId(existingPersonalId);
  if (existing && !sameCourseId(existing, sourceId)) {
    const ok = await updateMyRoute(existing, payload);
    return ok ? existing : null;
  }

  const owned = await fetchMyCourseDetail(sourceId);
  if (hasMeaningfulRouteSteps(owned)) {
    const ok = await updateMyRoute(sourceId, payload);
    return ok ? sourceId : null;
  }

  const copiedId = await copySharedCourseToMy(sourceId);
  if (copiedId && !sameCourseId(copiedId, sourceId)) {
    const ok = await updateMyRoute(copiedId, payload);
    return ok ? copiedId : null;
  }

  const updated = await updateMyRoute(sourceId, payload);
  if (updated) return sourceId;

  return createMyRoute(payload);
}

export async function saveSharedCourse(
  courseId: string,
): Promise<SaveSharedCourseResult> {
  const id = String(courseId ?? "").trim();
  if (!id) return { ok: false, reason: "OTHER" };
  const encoded = encodeURIComponent(id);

  const candidates = [`/api/courses/${encoded}/save`];

  let saw404 = false;
  let sawOther = false;

  for (const endpoint of candidates) {
    try {
      await instance.post(endpoint, {});
      return { ok: true };
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) return { ok: true };
      if (status === 404) {
        saw404 = true;
        if (__DEV__) {
          console.warn(
            "[saveSharedCourse]",
            endpoint,
            status,
            e?.response?.data,
          );
        }
        continue;
      }
      sawOther = true;
      if (__DEV__) {
        console.warn("[saveSharedCourse]", endpoint, status, e?.response?.data);
      }
    }
  }

  if (sawOther) return { ok: false, reason: "OTHER" };
  if (saw404) return { ok: false, reason: "NOT_ON_SERVER" };
  return { ok: false, reason: "OTHER" };
}

export async function submitSharedCourseReview(
  courseId: string,
  payload: { userName: string; rating: number; text: string },
): Promise<boolean> {
  try {
    await instance.post(`/api/courses/${courseId}/reviews`, payload);
    return true;
  } catch {
    return false;
  }
}

export async function deleteMyCourse(courseId: string): Promise<boolean> {
  try {
    await instance.delete(`/api/courses/my/${courseId}`);
    return true;
  } catch {
    return false;
  }
}

/** Swagger: GET /api/courses/my/sharing — 현재 공유(공개) 중인 내 코스 id 목록 */
export async function fetchMySharingCourseIds(): Promise<string[]> {
  try {
    const res = await instance.get("/api/courses/my/sharing");
    const arr = pickArrayPayload(res.data);
    return arr
      .map((raw: any) =>
        normalizeServerCourseId(raw?.id ?? raw?.uuid ?? raw?.courseId),
      )
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

export type MyCourseStatus = "DRAFT" | "PUBLISHED";

/** Swagger: PATCH /api/courses/my/{courseId}/status — DRAFT | PUBLISHED */
export async function updateMyCourseStatus(
  courseId: string,
  status: MyCourseStatus,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  try {
    const res = await instance.patch(
      `/api/courses/my/${encodeURIComponent(id)}/status`,
      { status },
    );
    return res.status >= 200 && res.status < 300;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[updateMyCourseStatus]",
        status,
        id,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return false;
  }
}

/** Swagger: POST /api/courses/my/{courseId}/share — 내 루트 공유 활성화 (204) */
export async function enableMyCourseSharing(
  courseId: string,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  try {
    const res = await instance.post(
      `/api/courses/my/${encodeURIComponent(id)}/share`,
      {},
    );
    return res.status >= 200 && res.status < 300;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[enableMyCourseSharing]",
        id,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return false;
  }
}

/** Swagger: DELETE /api/courses/my/{courseId}/share — 내 루트 공유 비활성화 (204) */
export async function disableMyCourseSharing(
  courseId: string,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  try {
    const res = await instance.delete(
      `/api/courses/my/${encodeURIComponent(id)}/share`,
    );
    return res.status >= 200 && res.status < 300;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[disableMyCourseSharing]",
        id,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return false;
  }
}

/**
 * Swagger 공개 플로우: status → PUBLISHED 후 share 활성화
 * (공유 코스 탭 노출 + 친구 소식)
 */
export async function publishMyCourseToPublic(
  courseId: string,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  await updateMyCourseStatus(id, "PUBLISHED");
  return enableMyCourseSharing(id);
}

/** 비공개: share 해제 후 DRAFT */
export async function unpublishMyCourseFromPublic(
  courseId: string,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  const ok = await disableMyCourseSharing(id);
  await updateMyCourseStatus(id, "DRAFT");
  return ok;
}

export type UpsertMyRoutePayload = {
  title: string;
  collaborative: boolean;
  /** 최대 2개 — 홈·공유 목록 카드에 표시 */
  tags?: string[];
  stops: Array<{
    id: string;
    kind: "start" | "via" | "end";
    title: string;
    timeLine: string;
    lat?: number;
    lng?: number;
  }>;
  legs: Array<{
    id: string;
    mode: "walk" | "transit" | "car" | "bike";
    minutes: number;
    transitType?: "bus" | "subway" | "train";
    directionsSummary?: string;
    directionsDetail?: string;
    distanceMeters?: number;
  }>;
};

function extractMyCourseUuidFromResponse(data: any): string | null {
  if (data == null) return null;
  if (typeof data === "string" || typeof data === "number") {
    const s = String(data).trim();
    return s.length ? s : null;
  }
  const d = data?.data ?? data?.result ?? data?.course ?? data;
  if (!d || typeof d !== "object") return null;
  const v = d.id ?? d.uuid ?? d.courseId;
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** API 전송용 — 과도하게 긴 길안내 문자열 제거(요청 실패 방지) */
function trimLegTextForApi(value: string | undefined, max = 4000): string | undefined {
  const s = String(value ?? "").trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 좌표 없는 초안 저장 시 legs 제거 — 서버 500 방지 */
export function sanitizeUpsertMyRoutePayload(
  payload: UpsertMyRoutePayload,
): UpsertMyRoutePayload {
  const stops = payload.stops.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: String(s.title ?? "").trim() || "경유지",
    timeLine: String(s.timeLine ?? "").trim() || "",
    ...(s.lat != null &&
    s.lng != null &&
    !Number.isNaN(Number(s.lat)) &&
    !Number.isNaN(Number(s.lng))
      ? { lat: Number(s.lat), lng: Number(s.lng) }
      : {}),
  }));
  const hasCoords = stops.some(
    (s) => s.lat != null && s.lng != null,
  );
  const legs = hasCoords
    ? payload.legs.map((l) => ({
        id: l.id,
        mode:
          l.mode === "walk" ||
          l.mode === "car" ||
          l.mode === "bike" ||
          l.mode === "transit"
            ? l.mode
            : "walk",
        minutes: Math.max(1, Number(l.minutes ?? 10)),
        ...(l.transitType ? { transitType: l.transitType } : {}),
        ...(trimLegTextForApi(l.directionsSummary)
          ? { directionsSummary: trimLegTextForApi(l.directionsSummary) }
          : {}),
        ...(trimLegTextForApi(l.directionsDetail)
          ? { directionsDetail: trimLegTextForApi(l.directionsDetail) }
          : {}),
        ...(l.distanceMeters != null
          ? { distanceMeters: l.distanceMeters }
          : {}),
      }))
    : [];
  const tags = (payload.tags ?? [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 2);
  return {
    title: String(payload.title ?? "").trim() || "새 루트",
    collaborative: payload.collaborative === true,
    ...(tags.length > 0 ? { tags } : {}),
    stops,
    legs,
  };
}

/** Swagger: POST /api/courses/my → 201 + `MyCourseDetailResponse`(uuid). 실패 시 null */
export async function createMyRoute(
  payload: UpsertMyRoutePayload,
): Promise<string | null> {
  const body = sanitizeUpsertMyRoutePayload(payload);
  try {
    const res = await instance.post("/api/courses/my", body);
    const id = extractMyCourseUuidFromResponse(res.data);
    if (id) return id;
    if (res.status >= 200 && res.status < 300) {
      const list = await fetchMyCourses();
      const title = String(body.title ?? "").trim();
      const hit = list.find((c) => String(c.title ?? "").trim() === title);
      return hit?.id ?? null;
    }
    return null;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[createMyRoute]",
        e?.response?.status,
        e?.response?.data,
        e?.message,
      );
    }
    return null;
  }
}

export async function updateMyRoute(
  courseId: string,
  payload: UpsertMyRoutePayload,
): Promise<boolean> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return false;
  try {
    const body = sanitizeUpsertMyRoutePayload(payload);
    await instance.patch(`/api/courses/my/${encodeURIComponent(id)}`, body);
    return true;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[updateMyRoute]",
        id,
        e?.response?.status,
        e?.response?.data,
        e?.message,
      );
    }
    return false;
  }
}

/** 로컬·서버 루트 → PATCH/POST 본문 */
export function buildUpsertPayloadFromUserRoute(route: {
  title: string;
  collaborative?: boolean;
  tags?: string[];
  stops: UpsertMyRoutePayload["stops"];
  legs: UpsertMyRoutePayload["legs"];
}): UpsertMyRoutePayload {
  const tags = (route.tags ?? [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 2);
  return {
    title: route.title,
    collaborative: route.collaborative === true,
    ...(tags.length > 0 ? { tags } : {}),
    stops: route.stops.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      timeLine: s.timeLine,
      lat: s.lat,
      lng: s.lng,
    })),
    legs: route.legs.map((l) => ({
      id: l.id,
      mode:
        l.mode === "walk" ||
        l.mode === "car" ||
        l.mode === "bike" ||
        l.mode === "transit"
          ? l.mode
          : "walk",
      minutes: Math.max(1, Number(l.minutes ?? 10)),
      transitType: l.transitType,
      directionsSummary: l.directionsSummary,
      directionsDetail: l.directionsDetail,
      distanceMeters: l.distanceMeters,
    })),
  };
}

/** 기기 루트를 서버에 올리거나 갱신. 성공 시 서버 course id */
export async function syncUserRouteToServer(route: {
  id: string;
  title: string;
  collaborative?: boolean;
  tags?: string[];
  stops: UpsertMyRoutePayload["stops"];
  legs: UpsertMyRoutePayload["legs"];
}): Promise<string | null> {
  const payload = buildUpsertPayloadFromUserRoute(route);
  const id = String(route.id ?? "").trim();
  const looksLocalOnly = id.startsWith("ur-");
  if (id && !looksLocalOnly) {
    const updated = await updateMyRoute(id, payload);
    if (updated) return id;
  }
  return createMyRoute(payload);
}

export type ConvertToPublicResult =
  | { ok: true; serverId: string; migratedFromLocalId?: string }
  | { ok: false; reason: "UPLOAD_FAILED" | "SHARE_FAILED"; serverId?: string };

/** 개인(내) 코스를 서버에 반영한 뒤 공유(공개) 코스로 전환 */
export async function convertPersonalCourseToPublic(route: {
  id: string;
  title: string;
  collaborative?: boolean;
  tags?: string[];
  stops: UpsertMyRoutePayload["stops"];
  legs: UpsertMyRoutePayload["legs"];
}): Promise<ConvertToPublicResult> {
  const serverId = await syncUserRouteToServer(route);
  if (!serverId) return { ok: false, reason: "UPLOAD_FAILED" };
  const shared = await publishMyCourseToPublic(serverId);
  if (!shared) return { ok: false, reason: "SHARE_FAILED", serverId };
  const migratedFromLocalId =
    String(route.id).startsWith("ur-") && serverId !== route.id
      ? route.id
      : undefined;
  return { ok: true, serverId, migratedFromLocalId };
}

/** 이미 서버에 있는 내 코스만 공개 토글 (업로드 없음) */
export async function setMyCoursePublic(
  courseId: string,
  isPublic: boolean,
): Promise<boolean> {
  return isPublic
    ? publishMyCourseToPublic(courseId)
    : unpublishMyCourseFromPublic(courseId);
}

export type FollowingNewsItem = {
  id: string;
  user: string;
  action: string;
  courseName: string;
  ago: string;
  profileImageUrl?: string | null;
  userUuid?: string | null;
};

function pickFollowingNewsUserLabel(raw: Record<string, unknown>): string {
  const nested = raw.user ?? raw.actor ?? raw.author ?? raw.fromUser;
  if (nested && typeof nested === "object") {
    const u = nested as Record<string, unknown>;
    const fromNested = String(
      u.nickname ?? u.userName ?? u.name ?? u.userId ?? "",
    ).trim();
    if (fromNested) return fromNested;
  }
  return String(
    raw.user ??
      raw.nickname ??
      raw.userName ??
      raw.actorNickname ??
      raw.actorName ??
      "사용자",
  ).trim();
}

function pickFollowingNewsUserUuid(raw: Record<string, unknown>): string | null {
  const nested = raw.user ?? raw.actor ?? raw.author ?? raw.fromUser;
  if (nested && typeof nested === "object") {
    const u = nested as Record<string, unknown>;
    const fromNested = String(u.uuid ?? u.userUuid ?? "").trim();
    if (fromNested) return fromNested;
  }
  const direct = String(
    raw.userUuid ?? raw.actorUuid ?? raw.authorUuid ?? raw.uuid ?? "",
  ).trim();
  return direct || null;
}

function pickProfileImageFromFollowingNewsRaw(
  raw: Record<string, unknown>,
): string | null {
  const nested = raw.user ?? raw.actor ?? raw.author ?? raw.fromUser;
  const fromNested =
    nested && typeof nested === "object"
      ? pickProfileImageFromFollowingNewsRaw(nested as Record<string, unknown>)
      : null;

  const candidates = [
    raw.profileImageUrl,
    raw.userProfileImageUrl,
    raw.actorProfileImageUrl,
    raw.avatarUrl,
    raw.profileImage,
    raw.imageUrl,
    raw.thumbnail,
    fromNested,
  ];

  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (isRemoteThumbnailUri(s)) return s;
  }
  return null;
}

export async function fetchFollowingNews(
  limit = 3,
): Promise<FollowingNewsItem[]> {
  try {
    const [res, friends] = await Promise.all([
      instance.get("/api/following/news", { params: { limit } }),
      getFriends().catch(() => []),
    ]);
    const arr = pickArrayPayload(res.data);
    if (arr.length === 0) return [];

    const profileByUuid = new Map<string, string>();
    const profileByNickname = new Map<string, string>();
    for (const f of friends) {
      const url = String(f.profileImageUrl ?? "").trim();
      if (!url || f.isDefaultImage) continue;
      if (f.uuid) profileByUuid.set(String(f.uuid), url);
      const nick = String(f.nickname ?? "").trim().toLowerCase();
      if (nick) profileByNickname.set(nick, url);
    }

    return arr.slice(0, limit).map((n: any, idx: number) => {
      const raw =
        n && typeof n === "object" ? (n as Record<string, unknown>) : {};
      const user = pickFollowingNewsUserLabel(raw);
      const userUuid = pickFollowingNewsUserUuid(raw);

      let profileImageUrl = pickProfileImageFromFollowingNewsRaw(raw);
      if (!profileImageUrl && userUuid && profileByUuid.has(userUuid)) {
        profileImageUrl = profileByUuid.get(userUuid) ?? null;
      }
      if (!profileImageUrl) {
        const nickKey = user.trim().toLowerCase();
        if (nickKey && profileByNickname.has(nickKey)) {
          profileImageUrl = profileByNickname.get(nickKey) ?? null;
        }
      }

      const remote =
        profileImageUrl && isRemoteThumbnailUri(profileImageUrl)
          ? bustProfileImageUri(profileImageUrl)
          : null;

      return {
        id: String(raw.id ?? `news-${idx}`),
        user,
        action: String(raw.action ?? "새 코스를 공개했어요"),
        courseName: String(raw.courseName ?? raw.title ?? "코스"),
        ago: String(raw.ago ?? raw.timeAgo ?? "방금"),
        profileImageUrl: remote,
        userUuid,
      };
    });
  } catch {
    return [];
  }
}

/** Swagger: GET /api/courses/my/sharing — 현재 공유(공개) 중인 내 코스 전체 목록 */
export async function fetchMySharedCourses(): Promise<CourseItem[]> {
  return fetchCoursesFromCandidates(["/api/courses/my/sharing"]);
}

function pickThumbnailUrlFromUploadResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const inner =
    d.data && typeof d.data === "object"
      ? (d.data as Record<string, unknown>)
      : d;
  const raw =
    inner.thumbnail ??
    inner.imageUrl ??
    inner.url ??
    inner.profileImageUrl;
  const s = String(raw ?? "").trim();
  return isRemoteThumbnailUri(s) ? s : null;
}

function courseImageFilePart(asset: {
  uri: string;
  name?: string;
  type?: string;
}): { name: string; type: string } {
  const rawType = String(asset.type ?? mimeFromUri(asset.uri));
  const mime =
    rawType === "image/heic" || rawType === "image/heif"
      ? "image/jpeg"
      : rawType.startsWith("image/")
        ? rawType
        : "image/jpeg";
  let fileName = asset.name ?? fileNameFromUri(asset.uri, "cover.jpg");
  if (!/\.(jpe?g|png|webp)$/i.test(fileName)) {
    fileName = "cover.jpg";
  }
  return { name: fileName, type: mime };
}

type ThumbnailUploadAttempt = {
  method: "patch" | "post";
  path: string;
};

function thumbnailUploadAttempts(courseId: string): ThumbnailUploadAttempt[] {
  const enc = encodeURIComponent(courseId);
  return [
    { method: "patch", path: `/api/courses/my/${enc}/thumbnail` },
    { method: "post", path: `/api/courses/my/${enc}/thumbnail` },
    { method: "patch", path: `/api/courses/my/${enc}/profile-image` },
    { method: "patch", path: `/api/courses/my/${enc}/cover-image` },
  ];
}

async function uploadMultipartThumbnail(
  courseId: string,
  attempt: ThumbnailUploadAttempt,
  asset: { uri: string; name?: string; type?: string },
): Promise<string | null> {
  const fileMeta = courseImageFilePart(asset);
  const path = attempt.path.replace(/^\/+/, "");
  for (const field of ["image", "file"] as const) {
    try {
      const { data, status } = await fetchMultipart(
        path,
        attempt.method === "post" ? "POST" : "PATCH",
        [
          {
            field,
            file: {
              uri: asset.uri,
              name: fileMeta.name,
              type: fileMeta.type,
            },
          },
        ],
        { silent: true },
      );
      const url = pickThumbnailUrlFromUploadResponse(data);
      if (url) return url;
      if (status >= 200 && status < 300) {
        const detail = await fetchMyCourseDetail(courseId);
        const fromDetail = String(detail?.thumbnail ?? "").trim();
        if (isRemoteThumbnailUri(fromDetail)) return fromDetail;
      }
    } catch (e: unknown) {
      const status =
        e instanceof MultipartHttpError
          ? e.status
          : (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 405) return null;
      if (status === 400 && field === "image") continue;
      if (__DEV__) {
        console.warn(
          "[uploadMyCourseThumbnail]",
          attempt.method,
          attempt.path,
          field,
          status,
          e,
        );
      }
    }
  }
  return null;
}

async function patchThumbnailUrlOnCourse(
  courseId: string,
  thumbnailUrl: string,
): Promise<string | null> {
  const url = String(thumbnailUrl ?? "").trim();
  if (!isRemoteThumbnailUri(url)) return null;
  try {
    const res = await instance.patch(
      `/api/courses/my/${encodeURIComponent(courseId)}`,
      { thumbnail: url },
    );
    return pickThumbnailUrlFromUploadResponse(res.data) ?? url;
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[patchThumbnailUrlOnCourse]",
        courseId,
        e?.response?.status,
        e?.response?.data,
      );
    }
    return null;
  }
}

/**
 * 코스 대표 이미지 서버 업로드 (users/me/profile-image와 동일 multipart 패턴)
 * 성공 시 HTTPS thumbnail URL, 실패 시 null
 */
export async function uploadMyCourseThumbnail(
  courseId: string,
  asset: { uri: string; name?: string; type?: string },
): Promise<string | null> {
  const id = normalizeServerCourseId(courseId);
  if (!id) return null;
  const uri = String(asset.uri ?? "").trim();
  if (!uri) return null;

  if (isRemoteThumbnailUri(uri)) {
    return patchThumbnailUrlOnCourse(id, uri);
  }

  if (!isLocalThumbnailUri(uri)) return null;

  for (const attempt of thumbnailUploadAttempts(id)) {
    const uploaded = await uploadMultipartThumbnail(id, attempt, asset);
    if (uploaded) return uploaded;
  }

  const detail = await fetchMyCourseDetail(id);
  const fromDetail = String(detail?.thumbnail ?? "").trim();
  if (isRemoteThumbnailUri(fromDetail)) return fromDetail;

  return null;
}

/** 저장 직후 대표 이미지 동기화 — 이미 원격 URL이면 스킵 */
export async function syncMyCourseThumbnailToServer(
  courseId: string,
  coverUri: string | null | undefined,
): Promise<string | null> {
  const id = normalizeServerCourseId(courseId);
  const uri = String(coverUri ?? "").trim();
  if (!id || !uri) return null;
  if (isRemoteThumbnailUri(uri)) return uri;
  if (!isLocalThumbnailUri(uri)) return null;
  return uploadMyCourseThumbnail(id, { uri });
}
