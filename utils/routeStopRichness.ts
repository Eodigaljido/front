import type { CourseItem } from '../data/mockData';
import type { UserSavedRouteStop } from '../data/userSavedRoute';
import { hasMeaningfulRouteSteps } from '../api/courses';
import { isPlaceholderPlaceLabel } from './mergeCourseThumbnails';

export function countRichStops(
  items: Array<{
    title?: string;
    name?: string;
    lat?: number;
    lng?: number;
  }>,
): number {
  return items.filter((s) => {
    const t = String(s.title ?? s.name ?? '').trim();
    if (t && !isPlaceholderPlaceLabel(t)) return true;
    return s.lat != null && s.lng != null;
  }).length;
}

export function countSavedRouteStopRichness(stops: UserSavedRouteStop[]): number {
  return countRichStops(stops);
}

export function countCourseRouteStepRichness(
  course: Pick<CourseItem, 'routeSteps'> | null | undefined,
): number {
  return countRichStops(course?.routeSteps ?? []);
}

/** 미리보기·목록 — API·로컬 중 경유지가 더 많은 쪽 사용 */
export function pickRicherRouteSteps(
  api: CourseItem,
  local: CourseItem,
): CourseItem['routeSteps'] {
  const apiSteps = api.routeSteps ?? [];
  const localSteps = local.routeSteps ?? [];
  const apiOk = hasMeaningfulRouteSteps({ routeSteps: apiSteps });
  const localOk = hasMeaningfulRouteSteps({ routeSteps: localSteps });
  if (!apiOk) return localSteps;
  if (!localOk) return apiSteps;

  const apiRich = countRichStops(apiSteps);
  const localRich = countRichStops(localSteps);
  if (localRich > apiRich) return localSteps;
  if (apiRich > localRich) return apiSteps;
  return localSteps.length >= apiSteps.length ? localSteps : apiSteps;
}

export function shouldPreferApiRouteOverLocal(
  localStops: UserSavedRouteStop[],
  apiCourse: CourseItem | null | undefined,
): boolean {
  if (!apiCourse) return false;
  return (
    countCourseRouteStepRichness(apiCourse) >
    countSavedRouteStopRichness(localStops)
  );
}
