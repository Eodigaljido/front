type LatLng = { latitude: number; longitude: number };

/** googleDirectionsApi.DirectionsMode 와 동일 (순환 import 방지) */
export type TmapDirectionsRequestMode = 'walking' | 'transit' | 'driving' | 'bicycling';

export type TmapDirectionsLegResult = {
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

const TMAP_CAR_URL = 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json';
const TMAP_WALK_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

function getTmapAppKey(): string {
  return String(process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '').trim();
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

function pickNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toLatLngListFromFeatures(features: any[]): LatLng[] {
  const points: LatLng[] = [];
  for (const f of features) {
    const geom = f?.geometry;
    const type = String(geom?.type ?? '');
    if (type === 'LineString' && Array.isArray(geom?.coordinates)) {
      for (const c of geom.coordinates) {
        const lng = Number(Array.isArray(c) ? c[0] : NaN);
        const lat = Number(Array.isArray(c) ? c[1] : NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          points.push({ latitude: lat, longitude: lng });
        }
      }
    } else if (type === 'Point' && Array.isArray(geom?.coordinates)) {
      const lng = Number(geom.coordinates[0]);
      const lat = Number(geom.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push({ latitude: lat, longitude: lng });
      }
    }
  }
  return dedupeConsecutive(points);
}

function tmapBody(mode: TmapDirectionsRequestMode, from: LatLng, to: LatLng) {
  const base = {
    startX: String(from.longitude),
    startY: String(from.latitude),
    endX: String(to.longitude),
    endY: String(to.latitude),
    startName: '출발지',
    endName: '도착지',
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
  };
  if (mode === 'walking') {
    return {
      ...base,
      searchOption: '0',
    };
  }
  return {
    ...base,
    searchOption: '0',
    trafficInfo: 'N',
  };
}

function parseTmapCommonResult(
  features: any[],
  fallbackMode: 'walk' | 'ride',
  sourceLabel: string,
): TmapDirectionsLegResult | null {
  const path = toLatLngListFromFeatures(features);
  if (path.length < 2) return null;

  const prop0 = features?.[0]?.properties ?? {};
  const totalDistance = Math.max(0, Math.round(pickNum(prop0.totalDistance)));
  const totalTimeSec = Math.max(0, pickNum(prop0.totalTime));
  const durationMinutes = Math.max(1, Math.round(totalTimeSec / 60));

  const detailLines: string[] = [];
  for (const f of features) {
    const p = f?.properties ?? {};
    const desc = String(p?.description ?? '').trim();
    const name = String(p?.name ?? '').trim();
    if (desc) detailLines.push(desc);
    else if (name) detailLines.push(name);
  }

  return {
    path,
    segments: [{ mode: fallbackMode, points: path.slice() }],
    durationMinutes,
    distanceMeters: totalDistance,
    summary:
      totalDistance < 1000
        ? `${sourceLabel} · 약 ${totalDistance}m · 약 ${durationMinutes}분`
        : `${sourceLabel} · 약 ${(totalDistance / 1000).toFixed(1)}km · 약 ${durationMinutes}분`,
    detail: detailLines.length > 0 ? detailLines.slice(0, 12).join('\n') : `${sourceLabel} 경로 안내`,
  };
}

async function fetchTmapJson(
  url: string,
  appKey: string,
  body: Record<string, string>,
  signal?: AbortSignal,
): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        appKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Tmap] 요청 실패 status=${res.status}`);
      }
      return null;
    }
    return res.json();
  } catch {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Tmap] 요청 예외 발생');
    }
    return null;
  }
}

/** 성공 시 결과, 실패·미설정 시 null */
export async function fetchTmapDirectionsLeg(params: {
  from: LatLng;
  to: LatLng;
  requestedMode: TmapDirectionsRequestMode;
  signal?: AbortSignal;
}): Promise<TmapDirectionsLegResult | null> {
  const appKey = getTmapAppKey();
  if (!appKey) return null;

  const mode = params.requestedMode;
  if (mode !== 'walking' && mode !== 'driving') return null;

  const isWalking = mode === 'walking';
  const url = isWalking ? TMAP_WALK_URL : TMAP_CAR_URL;
  const json = await fetchTmapJson(url, appKey, tmapBody(mode, params.from, params.to), params.signal);
  const features = Array.isArray(json?.features) ? json.features : [];
  if (features.length === 0) return null;

  return parseTmapCommonResult(features, isWalking ? 'walk' : 'ride', isWalking ? 'Tmap 도보' : 'Tmap 자동차');
}
