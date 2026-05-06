/**
 * 카카오모빌리티 길찾기 API (자동차)
 * https://apis-navi.kakaomobility.com/v1/directions
 *
 * 카카오디벨로퍼스 REST API 키 사용, 앱에서 「길찾기」 등 네비 API 사용 설정 필요.
 * (로컬 검색과 동일 키: EXPO_PUBLIC_KAKAO_REST_API_KEY)
 */

type LatLng = { latitude: number; longitude: number };

/** googleDirectionsApi.DirectionsMode 와 동일 (순환 import 방지) */
export type KakaoDirectionsRequestMode = 'walking' | 'transit' | 'driving' | 'bicycling';

export type KakaoDirectionsLegResult = {
  path: LatLng[];
  segments: Array<{
    mode: 'walk' | 'ride';
    points: LatLng[];
    lineLabel?: string;
  }>;
  durationMinutes: number;
  distanceMeters: number;
  summary: string;
  detail: string;
};

const KAKAO_NAVI_DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions';

function getKakaoRestKey(): string {
  return String(process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '').trim();
}

function dedupeConsecutive(pts: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (
      !last ||
      Math.abs(last.latitude - p.latitude) > 1e-9 ||
      Math.abs(last.longitude - p.longitude) > 1e-9
    ) {
      out.push(p);
    }
  }
  return out;
}

/** roads[].vertexes: [lng, lat, lng, lat, ...] */
function vertexesFlatToPath(vertexes: unknown): LatLng[] {
  if (!Array.isArray(vertexes)) return [];
  const out: LatLng[] = [];
  const arr = vertexes as number[];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const lng = Number(arr[i]);
    const lat = Number(arr[i + 1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ latitude: lat, longitude: lng });
    }
  }
  return out;
}

function mergeRoadPaths(sections: any[]): LatLng[] {
  const merged: LatLng[] = [];
  for (const sec of sections) {
    const roads = Array.isArray(sec?.roads) ? sec.roads : [];
    for (const road of roads) {
      const part = dedupeConsecutive(vertexesFlatToPath(road?.vertexes));
      if (part.length === 0) continue;
      if (merged.length === 0) {
        merged.push(...part);
        continue;
      }
      const a = merged[merged.length - 1];
      const b = part[0];
      if (
        Math.abs(a.latitude - b.latitude) < 1e-8 &&
        Math.abs(a.longitude - b.longitude) < 1e-8
      ) {
        merged.push(...part.slice(1));
      } else {
        merged.push(...part);
      }
    }
  }
  return merged;
}

function scaleDurationForMode(carMinutes: number, requested: KakaoDirectionsRequestMode): number {
  if (requested === 'walking') return Math.max(1, Math.round(carMinutes * 2.8));
  if (requested === 'bicycling') return Math.max(1, Math.round(carMinutes * 1.35));
  if (requested === 'transit') return Math.max(1, Math.round(carMinutes * 1.15));
  return Math.max(1, carMinutes);
}

/**
 * 자동차 길찾기 성공 시 `DirectionsLegResult` 형태로 반환.
 * 요청 모드가 도보/자전거여도 geometry는 차도 기준이며, 시간은 대략 스케일만 조정.
 */
export function kakaoCarRouteToDirectionsLeg(
  path: LatLng[],
  distanceMeters: number,
  durationSec: number,
  requestedMode: KakaoDirectionsRequestMode,
  guidesSample: string[],
): KakaoDirectionsLegResult {
  const pathDeduped = dedupeConsecutive(path);
  if (pathDeduped.length < 2) {
    throw new Error('KAKAO_NAVI_EMPTY_PATH');
  }
  const carMinutes = Math.max(1, Math.round(durationSec / 60));
  const durationMinutes = scaleDurationForMode(carMinutes, requestedMode);
  const walkish = requestedMode === 'walking';
  const segMode = walkish ? ('walk' as const) : ('ride' as const);
  const guideLine = guidesSample.filter(Boolean).slice(0, 4).join(' → ');

  return {
    path: pathDeduped,
    segments: [{ mode: segMode, points: pathDeduped.slice() }],
    durationMinutes,
    distanceMeters,
    summary:
      distanceMeters < 1000
        ? `카카오 · 약 ${distanceMeters}m · 약 ${durationMinutes}분`
        : `카카오 · 약 ${(distanceMeters / 1000).toFixed(1)}km · 약 ${durationMinutes}분`,
    detail:
      (guideLine ? `${guideLine}\n` : '') +
      '※ 카카오 자동차 길찾기 기준 경로입니다. 도보/자전거 모드는 지도 표시용이며 실제와 다를 수 있습니다.',
  };
}

/** 성공 시 결과, 실패·미설정 시 null */
export async function fetchKakaoNaviCarDirectionsLeg(params: {
  from: LatLng;
  to: LatLng;
  requestedMode: KakaoDirectionsRequestMode;
  signal?: AbortSignal;
}): Promise<KakaoDirectionsLegResult | null> {
  const key = getKakaoRestKey();
  if (!key) return null;

  const ox = params.from.longitude;
  const oy = params.from.latitude;
  const dx = params.to.longitude;
  const dy = params.to.latitude;
  if (![ox, oy, dx, dy].every((n) => Number.isFinite(n))) return null;

  const q = new URLSearchParams({
    origin: `${ox},${oy}`,
    destination: `${dx},${dy}`,
    priority: 'RECOMMEND',
    summary: 'false',
    alternatives: 'false',
  });

  try {
    const res = await fetch(`${KAKAO_NAVI_DIRECTIONS_URL}?${q.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${key}`,
        'Content-Type': 'application/json',
      },
      signal: params.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route || Number(route.result_code) !== 0) return null;

    const summary = route.summary;
    const distanceMeters = Number(summary?.distance ?? 0);
    const durationSec = Number(summary?.duration ?? 0);
    const sections = Array.isArray(route.sections) ? route.sections : [];
    const path = mergeRoadPaths(sections);
    if (path.length < 2) return null;

    const guides: string[] = [];
    for (const sec of sections) {
      const gs = Array.isArray(sec?.guides) ? sec.guides : [];
      for (const g of gs) {
        const t = String(g?.guidance ?? '').trim();
        if (t && !guides.includes(t)) guides.push(t);
      }
    }

    return kakaoCarRouteToDirectionsLeg(
      path,
      distanceMeters,
      durationSec,
      params.requestedMode,
      guides,
    );
  } catch {
    return null;
  }
}

