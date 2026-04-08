import type { CourseItem } from './mockData';

/** 루트 제작 화면에서 저장되는 정류장 (목·로컬) */
export type UserSavedRouteStop = {
  id: string;
  kind: 'start' | 'via' | 'end';
  title: string;
  timeLine: string;
  lat?: number;
  lng?: number;
};

export type UserSavedRouteLeg = {
  id: string;
  mode: string;
  minutes: number;
};

export type UserSavedRoute = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  stops: UserSavedRouteStop[];
  legs: UserSavedRouteLeg[];
  /** true면 공동 수정(프로필·채팅 UI). 개인 루트는 false/미설정 */
  collaborative?: boolean;
};

export function userRouteToCourseItem(r: UserSavedRoute): CourseItem {
  const start = r.stops[0];
  const end = r.stops[r.stops.length - 1];
  const totalMin = r.legs.reduce((s, l) => s + (l.minutes || 0), 0);
  const dateStr = r.updatedAt.slice(0, 10);
  return {
    id: r.id,
    title: r.title,
    meta: `직접 제작 · ${dateStr}`,
    departure: start?.title ?? '',
    arrival: end?.title ?? '',
    thumbnail: null,
    category: '직접제작',
    region: '내 루트',
    createdAt: dateStr,
    views: 0,
    overallDurationMinutes: Math.max(1, totalMin),
    rating: 0,
    reviewCount: 0,
    routeSteps: r.stops.map((s, i) => ({
      id: `${r.id}-step-${i}`,
      name: s.title,
      stayMinutes: 0,
    })),
    reviews: [],
  };
}

export function userRouteMapPath(r: UserSavedRoute): { latitude: number; longitude: number }[] {
  const pts: { latitude: number; longitude: number }[] = [];
  for (const s of r.stops) {
    if (s.lat != null && s.lng != null) pts.push({ latitude: s.lat, longitude: s.lng });
  }
  return pts;
}

export function userRouteMapCenter(r: UserSavedRoute): { lat: number; lng: number } {
  const pts = userRouteMapPath(r);
  if (pts.length >= 1) return { lat: pts[0].latitude, lng: pts[0].longitude };
  return { lat: 35.1796, lng: 129.0756 };
}
