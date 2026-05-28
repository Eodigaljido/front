/**
 * 코스 도메인 타입 및 지도 보조 함수.
 * 코스 목 데이터는 사용하지 않으며, 목록·상세는 API만 사용한다.
 */

export type CourseRouteStep = {
  id: string;
  name: string;
  /** 이 장소에서 머무른 평균 시간(분) */
  stayMinutes: number;
  /** API 정류장 좌표가 있을 때 지도·경로에 사용 */
  lat?: number;
  lng?: number;
};

export type CourseRouteLeg = {
  id: string;
  mode: "walk" | "transit" | "car" | "bike";
  minutes: number;
  transitType?: "bus" | "subway" | "train";
};

export type CourseReview = {
  id: string;
  userName: string;
  rating: number;
  text: string;
  date: string; // YYYY-MM-DD
};

export type CourseItem = {
  id: string;
  title: string;
  meta: string;
  /** 홈·공유 루트 카드 등에 표시 (최대 2개) */
  tags: string[];
  departure: string;
  arrival: string;
  thumbnail: string | null;
  category: string;
  region: string;
  createdAt: string; // YYYY-MM-DD
  views: number;
  /** 다른 사용자가 내 루트에 저장한 횟수 — 인기 정렬 기준 */
  saveCount: number;
  /** 코스를 처음부터 끝까지 걸었을 때 평균 소요 시간(분) */
  overallDurationMinutes: number;
  /** 이용자 평균 별점 (1.0 ~ 5.0) */
  rating: number;
  reviewCount: number;
  routeSteps: CourseRouteStep[];
  /** 구간별 이동수단(생성자가 선택한 값). 없으면 프론트 기본값 사용 */
  routeLegs?: CourseRouteLeg[];
  /** 작성자 UUID — 공유 목록에서 내 코스 판별 */
  authorUuid?: string;
  authorUserId?: string;
  /** false면 공유 목록·상세에서 제작자 프로필 비노출 */
  authorProfilePublic?: boolean;
  /** 포크·재공유 시 직전 부모 공유 코스 id */
  forkSourceCourseId?: string | null;
  /** 포크 체인 최초 원본 공유 코스 id */
  rootForkSourceCourseId?: string | null;
  /** 포크·재공유 후 공개한 사용자(수정자) */
  modifierUuid?: string;
  modifierUserId?: string;
  modifierProfilePublic?: boolean;
  /** 로그인 사용자가 이 공유 코스를 저장(북마크)했는지 — API `savedByMe` 등 */
  savedByMe?: boolean;
};

/** 코스별 지도 중심 (API 좌표 없을 때 보간용 기본값) */
const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };
const COURSE_MAP_CENTER: Record<string, { lat: number; lng: number }> = {};

export function getCourseMapCenter(courseId: string): { lat: number; lng: number } {
  return COURSE_MAP_CENTER[courseId] ?? DEFAULT_MAP_CENTER;
}

/**
 * 경로 단계 좌표 생성 (단계 인덱스 선형 보간)
 */
/** API `routeSteps` 항목 — 실제 좌표가 있으면 우선 사용 */
export function getRouteStepMapPoint(
  step: CourseRouteStep,
  courseId: string,
  stepIndex: number,
  totalSteps?: number,
): { lat: number; lng: number } {
  if (step.lat != null && step.lng != null) {
    return { lat: step.lat, lng: step.lng };
  }
  return getCourseStepMapPoint(courseId, stepIndex, totalSteps);
}

export function courseRouteStepsToMapPath(
  courseId: string,
  steps: CourseRouteStep[],
): { latitude: number; longitude: number }[] {
  return steps.map((step, i) => {
    const p = getRouteStepMapPoint(step, courseId, i, steps.length);
    return { latitude: p.lat, longitude: p.lng };
  });
}

/** 코스 상세 지도 — level 숫자가 작을수록 확대 (AppMapView level prop) */
export type CourseDetailMapFocus = {
  lat: number;
  lng: number;
  level?: number;
};

/** 전체 경로가 보이는 기본 배율 */
export const COURSE_DETAIL_MAP_OVERVIEW_LEVEL = 5;
/** 경유지 탭 시 클로즈업 (Google zoom, 거리 단위 약 50–100m) */
export const COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM = 17;

export function focusMapOnCourseStep(
  step: CourseRouteStep,
  courseId: string,
  stepIndex: number,
  totalSteps: number,
): CourseDetailMapFocus {
  const p = getRouteStepMapPoint(step, courseId, stepIndex, totalSteps);
  return { lat: p.lat, lng: p.lng };
}

export type MapRouteFit = { lat: number; lng: number; zoom: number };

/** 코스 상세 등 — 경로 전체가 잘 보이도록 중심·줌 자동 계산 */
export function computeMapRouteFit(
  points: { latitude: number; longitude: number }[],
  opts?: {
    minZoom?: number;
    maxZoom?: number;
    /** 값이 클수록 더 넓게(축소) 보임 */
    paddingZoomOut?: number;
  },
): MapRouteFit | null {
  const valid = (points ?? []).filter(
    (p) =>
      p &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude),
  );
  if (valid.length === 0) return null;
  if (valid.length === 1) {
    return {
      lat: valid[0].latitude,
      lng: valid[0].longitude,
      zoom: opts?.maxZoom ?? 15,
    };
  }

  const lats = valid.map((p) => p.latitude);
  const lngs = valid.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const latSpan = Math.max(0.0008, maxLat - minLat);
  const lngSpan = Math.max(0.0008, maxLng - minLng);
  const cosLat = Math.cos((cLat * Math.PI) / 180);
  const spanM = Math.max(
    latSpan * 111_320,
    lngSpan * 111_320 * Math.max(0.35, cosLat),
    60,
  );

  let zoom = 16;
  if (spanM > 90_000) zoom = 9;
  else if (spanM > 45_000) zoom = 10;
  else if (spanM > 22_000) zoom = 11;
  else if (spanM > 11_000) zoom = 12;
  else if (spanM > 5_500) zoom = 13;
  else if (spanM > 2_800) zoom = 14;
  else if (spanM > 1_400) zoom = 15;
  else zoom = 16;

  const pad = opts?.paddingZoomOut ?? 0.85;
  zoom = Math.max(opts?.minZoom ?? 9, zoom - pad);
  if (opts?.maxZoom != null) zoom = Math.min(opts.maxZoom, zoom);

  return { lat: cLat, lng: cLng, zoom };
}

export function getCourseMapCenterFromSteps(
  course: Pick<CourseItem, "id" | "routeSteps">,
): { lat: number; lng: number } {
  for (const step of course.routeSteps ?? []) {
    if (step.lat != null && step.lng != null) {
      return { lat: step.lat, lng: step.lng };
    }
  }
  return getCourseMapCenter(course.id);
}

export function getCourseStepMapPoint(
  courseId: string,
  stepIndex: number,
  totalSteps?: number,
): { lat: number; lng: number } {
  const base = getCourseMapCenter(courseId);
  if (!totalSteps || totalSteps <= 1) {
    const fallbackDeltas = [
      { lat: 0, lng: 0 },
      { lat: 0.0012, lng: -0.0011 },
      { lat: -0.0014, lng: 0.0013 },
      { lat: 0.0018, lng: 0.0016 },
      { lat: -0.0019, lng: -0.0015 },
    ];
    const delta = fallbackDeltas[stepIndex % fallbackDeltas.length];
    return { lat: base.lat + delta.lat, lng: base.lng + delta.lng };
  }
  const total = Math.max(2, totalSteps ?? 2);
  const idx = Math.max(0, Math.min(stepIndex, total - 1));
  const t = total <= 1 ? 0 : idx / (total - 1);
  const startOffset = { lat: -0.0016, lng: -0.0014 };
  const endOffset = { lat: 0.0016, lng: 0.0014 };
  return {
    lat: base.lat + startOffset.lat + (endOffset.lat - startOffset.lat) * t,
    lng: base.lng + startOffset.lng + (endOffset.lng - startOffset.lng) * t,
  };
}

