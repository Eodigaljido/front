import type { MapRouteSegment } from '../components/mapTypes';

/**
 * 코스 지도 폴리라인 상한.
 * Directions 병합 경로는 수백~수천 점이 될 수 있어, 과도한 점은 기기 부하를 줄이기 위해 샘플링한다.
 * 값이 클수록 실제 도로 형태에 가깝게 보인다.
 */
export const COURSE_MAP_POLYLINE_MAX_POINTS = 6000;

export function simplifyRoutePath(
  path: { latitude: number; longitude: number }[] | null | undefined,
  maxPoints: number = COURSE_MAP_POLYLINE_MAX_POINTS,
): { latitude: number; longitude: number }[] | undefined {
  if (!path || path.length === 0) return undefined;
  if (path.length <= maxPoints) return path;
  const first = path[0];
  const last = path[path.length - 1];
  const inner = path.slice(1, -1);
  const keepInner = Math.max(0, maxPoints - 2);
  if (keepInner <= 0) return [first, last];
  const step = Math.max(1, Math.ceil(inner.length / keepInner));
  const sampled = inner.filter((_, idx) => idx % step === 0).slice(0, keepInner);
  return [first, ...sampled, last];
}

export function simplifyRouteSegments(
  segments: MapRouteSegment[] | null | undefined,
  maxPoints: number = COURSE_MAP_POLYLINE_MAX_POINTS,
): MapRouteSegment[] | undefined {
  if (!segments?.length) return undefined;
  return segments.map((seg) => ({
    ...seg,
    points: simplifyRoutePath(seg.points, maxPoints) ?? seg.points,
  }));
}
