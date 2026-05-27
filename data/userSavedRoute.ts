import type { CourseItem } from './mockData';
import { resolveCourseRegionLabel } from '../utils/inferCourseRegionLabel';
import { sameCourseId } from '../utils/sameCourseId';

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
  transitType?: 'bus' | 'subway' | 'train';
  /** Google Directions 기반 한 줄 요약 */
  directionsSummary?: string;
  /** 단계별 안내(줄바꿈) */
  directionsDetail?: string;
  distanceMeters?: number;
};

export type UserSavedRoute = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  stops: UserSavedRouteStop[];
  legs: UserSavedRouteLeg[];
  /** 홈·목록용 태그, 최대 2개 */
  tags?: string[];
  /** true면 공동 수정(프로필·채팅 UI). 개인 루트는 false/미설정 */
  collaborative?: boolean;
  /** 공동 루트 단체 채팅방 uuid (채팅 탭 목록과 연동) */
  chatRoomUuid?: string;
  /** 루트 카드·목록용 대표 이미지 (로컬 uri) */
  coverImageUri?: string | null;
  /** 사용자가 공개(공유)로 둔 경우 true — 서버 PATCH 후 공개가 풀리면 저장 시 다시 맞춤 */
  publishedToPublic?: boolean;
  /** 공유 루트를 복사·수정해 만든 개인 루트일 때 원본 공유 코스 id */
  forkedFromSharedId?: string | null;
};

/** 공유 코스에서 이미 만든 개인 루트 서버 id (있으면 copy 재호출 방지) */
export function findPersonalRouteIdForForkSource(
  sharedCourseId: string,
  userSavedRoutes: UserSavedRoute[],
): string | null {
  const source = String(sharedCourseId ?? '').trim();
  if (!source) return null;
  const hit = userSavedRoutes.find(
    (r) => String(r.forkedFromSharedId ?? '').trim() === source,
  );
  const id = String(hit?.id ?? '').trim();
  if (id && !id.startsWith('ur-')) return id;
  return null;
}

export function userRouteToCourseItem(r: UserSavedRoute): CourseItem {
  const start = r.stops[0];
  const end = r.stops[r.stops.length - 1];
  const totalMin = r.legs.reduce((s, l) => s + (l.minutes || 0), 0);
  const dateStr = r.updatedAt.slice(0, 10);
  const tags = (r.tags ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 2);
  const region = resolveCourseRegionLabel(
    undefined,
    start?.title ?? '',
    end?.title ?? '',
    r.stops.map((s) => s.title),
  );
  const meta =
    tags.length > 0 ? tags.join(' · ') : `직접 제작 · ${dateStr}`;
  return {
    id: r.id,
    title: r.title,
    meta,
    tags,
    departure: start?.title ?? '',
    arrival: end?.title ?? '',
    thumbnail: r.coverImageUri ? String(r.coverImageUri) : null,
    category: '직접제작',
    region: region || '',
    createdAt: dateStr,
    views: 0,
    saveCount: 0,
    overallDurationMinutes: Math.max(1, totalMin),
    rating: 0,
    reviewCount: 0,
    routeSteps: r.stops.map((s, i) => ({
      id: `${r.id}-step-${i}`,
      name: s.title,
      stayMinutes: 0,
    })),
    routeLegs: r.legs.map((l, i) => ({
      id: l.id || `${r.id}-leg-${i}`,
      mode: (l.mode as any) || 'walk',
      minutes: Number(l.minutes || 0),
      transitType: l.transitType,
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
