import { getGoogleMapsWebServiceKey } from '../constants/googleMaps';
import {
  fetchKakaoNaviCarDirectionsLeg,
} from './kakaoNaviDirectionsApi';
import { fetchTmapDirectionsLeg } from './tmapDirectionsApi';

export type DirectionsMode = 'walking' | 'transit' | 'driving' | 'bicycling';
export type DirectionsTransitType = 'bus' | 'subway' | 'train';

type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;

function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const la1 = a.latitude * rad;
  const la2 = b.latitude * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Google Directions는 위도 ∈ [-90,90]. 경도를 위도 칸에 넣으면 ZERO_RESULTS 가 연쇄로 날 수 있음.
 * 한국 근처에서 흔한 x/y 혼동도 보정.
 */
export function normalizeLatLngForDirections(lat: number, lng: number): LatLng {
  let la = Number(lat);
  let ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { latitude: la, longitude: ln };
  }
  if (Math.abs(la) > 90 && Math.abs(ln) <= 90) {
    return { latitude: ln, longitude: la };
  }
  if (la >= 120 && la <= 132 && ln >= 33 && ln <= 43) {
    return { latitude: ln, longitude: la };
  }
  return { latitude: la, longitude: ln };
}

function trivialDirectionsLeg(from: LatLng, to: LatLng, mode: DirectionsMode): DirectionsLegResult {
  const d = Math.max(0, Math.round(haversineMeters(from, to)));
  const path: LatLng[] = [from, to];
  const walkish = mode === 'walking';
  return {
    path,
    segments: walkish
      ? [{ mode: 'walk' as const, points: path.slice() }]
      : [{ mode: 'ride' as const, points: path.slice() }],
    durationMinutes: 1,
    distanceMeters: d,
    summary: d < 30 ? '거의 같은 위치' : `약 ${d}m`,
    detail: '출발지와 도착지가 매우 가깝습니다.',
    source: 'fallback',
  };
}

function roughMinutesStraightLine(mode: DirectionsMode, meters: number): number {
  const km = Math.max(0, meters) / 1000;
  const minPerKm: Record<DirectionsMode, number> = {
    walking: 12,
    bicycling: 4,
    driving: 2,
    transit: 8,
  };
  return Math.max(1, Math.round(km * minPerKm[mode]));
}

/** Google이 경로를 못 줄 때 예외 대신 직선(거리 기준 추정 시간) — 앱은 동작, 요약에 안내 */
function straightLineFallbackLeg(from: LatLng, to: LatLng, mode: DirectionsMode): DirectionsLegResult {
  const path: LatLng[] = [from, to];
  const d = Math.max(0, Math.round(haversineMeters(from, to)));
  const walkish = mode === 'walking';
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[Directions] ZERO_RESULTS/NOT_FOUND → 직선 폴백', mode, `약 ${d}m`);
  }
  return {
    path,
    segments: walkish
      ? [{ mode: 'walk' as const, points: path.slice() }]
      : [{ mode: 'ride' as const, points: path.slice() }],
    durationMinutes: roughMinutesStraightLine(mode, d),
    distanceMeters: d,
    summary: '직선으로 표시 · 상세 경로 없음',
    detail:
      'Google Directions에서 이 구간을 찾지 못했습니다. 장소를 다시 검색하거나, 해상·폐쇄구역 등은 다른 이동수단으로 나눠 보세요. (카카오·T맵 내비 API는 별도 연동)',
    source: 'fallback',
  };
}

function toLatLngFromLocation(loc: any): LatLng | null {
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

/** Directions step.polyline 이 { points } 또는 인코딩 문자열로 올 수 있음 */
function encodedPointsFromPolylineField(polyline: unknown): string {
  if (typeof polyline === 'string') return polyline.trim();
  if (polyline && typeof polyline === 'object' && 'points' in (polyline as object)) {
    return String((polyline as { points?: string }).points ?? '').trim();
  }
  return '';
}

function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const out: LatLng[] = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return out;
}

/** 더 촘촘한 좌표열을 선택 (step 폴리라인이 비어 짧은 직선만 나올 때 overview가 더 나음) */
function pickRicherPolylinePath(a: LatLng[], b: LatLng[]): LatLng[] {
  const al = a.length;
  const bl = b.length;
  if (al >= 2 && bl >= 2) return al >= bl ? a : b;
  if (al >= 2) return a;
  if (bl >= 2) return b;
  return [];
}

/** leg.steps[].polyline 을 이어 붙여 도로/노선을 따라가는 상세 경로 (overview보다 점이 많음) */
function mergeLegStepPolylines(leg: any): LatLng[] {
  const steps = Array.isArray(leg?.steps) ? leg.steps : [];
  const merged: LatLng[] = [];
  for (const step of steps) {
    const enc = encodedPointsFromPolylineField(step?.polyline);
    if (!enc) continue;
    const part = decodePolyline(enc);
    if (part.length === 0) continue;
    if (merged.length === 0) merged.push(...part);
    else merged.push(...part.slice(1));
  }
  return merged;
}

function collectStepPolylinePoints(step: any): LatLng[] {
  const subSteps = Array.isArray(step?.steps) ? step.steps : [];
  if (subSteps.length > 0) {
    const merged: LatLng[] = [];
    for (const s of subSteps) {
      const pts = collectStepPolylinePoints(s);
      if (pts.length === 0) continue;
      if (merged.length === 0) merged.push(...pts);
      else merged.push(...pts.slice(1));
    }
    if (merged.length >= 2) return merged;
  }
  const enc = encodedPointsFromPolylineField(step?.polyline);
  if (enc) {
    const pts = decodePolyline(enc);
    if (pts.length >= 2) return pts;
  }
  const a = toLatLngFromLocation(step?.start_location);
  const b = toLatLngFromLocation(step?.end_location);
  if (a && b) return [a, b];
  return [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function vehicleTypeKo(type: string | undefined): string {
  const m: Record<string, string> = {
    BUS: '버스',
    SUBWAY: '지하철',
    TRAIN: '기차',
    TRAM: '트램',
    HEAVY_RAIL: '철도',
    LIGHT_RAIL: '경전철',
    FERRY: '페리',
    CABLE_CAR: '케이블카',
    GONDOLA_LIFT: '곤돌라',
    FUNICULAR: '케이블카',
    MONORAIL: '모노레일',
  };
  return m[type ?? ''] ?? '대중교통';
}

export type DirectionsLegResult = {
  path: LatLng[];
  segments: Array<{
    mode: 'walk' | 'ride';
    points: LatLng[];
    lineLabel?: string;
  }>;
  durationMinutes: number;
  distanceMeters: number;
  /** 한 줄 요약 (목록용) */
  summary: string;
  /** 단계별 안내 (모달용, 줄바꿈) */
  detail: string;
  source?: 'google' | 'tmap' | 'kakao' | 'fallback';
};

function travelModeToSegmentMode(mode: string): 'walk' | 'ride' {
  return mode === 'WALKING' ? 'walk' : 'ride';
}

function mergeSegmentsToPath(
  segments: Array<{ mode: 'walk' | 'ride'; points: LatLng[]; lineLabel?: string }>,
): LatLng[] {
  const merged: LatLng[] = [];
  for (const seg of segments) {
    if (!Array.isArray(seg.points) || seg.points.length < 2) continue;
    if (merged.length === 0) merged.push(...seg.points);
    else merged.push(...seg.points.slice(1));
  }
  return merged;
}

async function enrichTransitWalkSegmentsWithTmap(
  result: DirectionsLegResult,
  signal?: AbortSignal,
): Promise<DirectionsLegResult> {
  if (!Array.isArray(result.segments) || result.segments.length === 0) return result;
  const walkIdx: number[] = [];
  for (let i = 0; i < result.segments.length; i++) {
    const seg = result.segments[i];
    if (seg.mode !== 'walk' || seg.points.length < 2) continue;
    walkIdx.push(i);
  }
  if (walkIdx.length === 0) return result;

  const nextSegments = result.segments.map((s) => ({ ...s, points: s.points.slice() }));
  await Promise.all(
    walkIdx.map(async (idx) => {
      const seg = nextSegments[idx];
      const start = seg.points[0];
      const end = seg.points[seg.points.length - 1];
      const tmapWalk = await fetchTmapDirectionsLeg({
        from: start,
        to: end,
        requestedMode: 'walking',
        signal,
      });
      if (tmapWalk?.path && tmapWalk.path.length >= 2) {
        nextSegments[idx] = {
          ...seg,
          mode: 'walk',
          points: tmapWalk.path,
        };
      }
    }),
  );

  const nextPath = mergeSegmentsToPath(nextSegments);
  if (nextPath.length < 2) return result;
  return {
    ...result,
    path: nextPath,
    segments: nextSegments,
  };
}

export function parseDirectionsLeg(body: any): DirectionsLegResult {
  const route = body?.routes?.[0];
  if (!route) throw new Error('NO_ROUTE');
  const leg = route.legs?.[0];
  if (!leg) throw new Error('NO_LEG');

  const overviewEnc = encodedPointsFromPolylineField(route.overview_polyline);
  const overviewPath = overviewEnc ? decodePolyline(overviewEnc) : [];
  const stepsPath = mergeLegStepPolylines(leg);
  const path: LatLng[] = pickRicherPolylinePath(stepsPath, overviewPath);

  const totalSec = Number(leg?.duration?.value ?? 0);
  const durationMinutes = Math.max(1, Math.round(totalSec / 60));
  const distanceMeters = Number(leg?.distance?.value ?? 0);

  const steps = Array.isArray(leg?.steps) ? leg.steps : [];
  const transitOneLiners: string[] = [];
  const detailLines: string[] = [];
  const segments: DirectionsLegResult['segments'] = [];

  for (const step of steps) {
    const mode = String(step?.travel_mode ?? '');
    const segPts = collectStepPolylinePoints(step);
    if (mode === 'TRANSIT' && step.transit_details) {
      const td = step.transit_details;
      const line = td.line || {};
      const vType = vehicleTypeKo(line.vehicle?.type);
      const lineName = String(line.short_name || line.name || '').trim();
      const headsign = String(td.headsign || '').trim();
      const dep = String(td.departure_stop?.name || '').trim();
      const arr = String(td.arrival_stop?.name || '').trim();
      const base = lineName ? `${vType} ${lineName}` : vType;
      let lineDetail = base;
      if (dep && arr) lineDetail = `${base} · ${dep} → ${arr}`;
      else if (headsign) lineDetail = `${base} · ${headsign}`;
      transitOneLiners.push(base);
      detailLines.push(lineDetail);
      if (segPts.length >= 2) {
        segments.push({
          mode: 'ride',
          points: segPts,
          lineLabel: base,
        });
      }
    } else {
      const distText = String(step?.distance?.text || '').trim();
      const instr = stripHtml(String(step.html_instructions || ''));
      if (mode === 'WALKING') {
        detailLines.push(distText ? `도보 ${distText}${instr ? ` · ${instr}` : ''}` : instr || '도보');
      } else if (mode === 'DRIVING') {
        detailLines.push(distText ? `운전 ${distText}${instr ? ` · ${instr}` : ''}` : instr || '운전');
      } else if (mode === 'BICYCLING') {
        detailLines.push(distText ? `자전거 ${distText}${instr ? ` · ${instr}` : ''}` : instr || '자전거');
      } else if (instr) {
        detailLines.push(instr);
      }
      if (segPts.length >= 2) {
        segments.push({
          mode: travelModeToSegmentMode(mode),
          points: segPts,
        });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueTransit: string[] = [];
  for (const t of transitOneLiners) {
    if (!seen.has(t)) {
      seen.add(t);
      uniqueTransit.push(t);
    }
  }

  let summary = '';
  if (uniqueTransit.length > 0) {
    summary = uniqueTransit.join(' → ');
  } else if (distanceMeters > 0) {
    summary =
      distanceMeters < 1000
        ? `약 ${distanceMeters}m · 약 ${durationMinutes}분`
        : `약 ${(distanceMeters / 1000).toFixed(1)}km · 약 ${durationMinutes}분`;
  } else {
    summary = `약 ${durationMinutes}분`;
  }

  const detail = detailLines.length > 0 ? detailLines.join('\n') : summary;

  /**
   * 도보-only leg: 지도는 항상 합쳐진 path 한 세그먼트로 전달.
   * (step별 점선 세그먼트가 끊기거나, step 폴리라인이 짧을 때 overview/merge path와 어긋나 보이는 경우 방지)
   */
  if (path.length >= 2 && segments.length >= 1 && segments.every((s) => s.mode === 'walk')) {
    return {
      path,
      segments: [{ mode: 'walk' as const, points: path.slice() }],
      durationMinutes,
      distanceMeters,
      summary,
      detail,
      source: 'google',
    };
  }

  return { path, segments, durationMinutes, distanceMeters, summary, detail, source: 'google' };
}

async function fetchDirectionsJson(
  from: LatLng,
  to: LatLng,
  mode: DirectionsMode,
  key: string,
  signal: AbortSignal | undefined,
  region: string | undefined,
  transitType?: DirectionsTransitType,
): Promise<any> {
  const q = new URLSearchParams({
    origin: `${from.latitude},${from.longitude}`,
    destination: `${to.latitude},${to.longitude}`,
    mode,
    key,
    language: 'ko',
  });
  if (region) q.set('region', region);
  if (mode === 'transit' && transitType) q.set('transit_mode', transitType);
  const url = `https://maps.googleapis.com/maps/api/directions/json?${q.toString()}`;
  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok) throw new Error(`Directions 요청 실패 (${res.status})`);
  return res.json();
}

/**
 * ZERO_RESULTS 시 보조 재시도. 도보↔자전거 후에도 안 되면 운전 경로로 폴리라인 확보(지도는 여전히 도보/자전거 스타일).
 */
const DIRECTIONS_ZERO_FALLBACKS: Record<
  Exclude<DirectionsMode, 'transit'>,
  Array<{ mode: DirectionsMode; region?: string }>
> = {
  walking: [
    { mode: 'walking', region: undefined },
    { mode: 'bicycling', region: 'kr' },
    { mode: 'driving', region: 'kr' },
    { mode: 'driving', region: undefined },
  ],
  bicycling: [
    { mode: 'bicycling', region: undefined },
    { mode: 'walking', region: 'kr' },
    { mode: 'driving', region: 'kr' },
    { mode: 'driving', region: undefined },
  ],
  driving: [
    { mode: 'driving', region: undefined },
    { mode: 'bicycling', region: 'kr' },
    { mode: 'walking', region: 'kr' },
  ],
};

export async function fetchGoogleDirectionsLeg(params: {
  from: LatLng;
  to: LatLng;
  mode: DirectionsMode;
  transitType?: DirectionsTransitType;
  signal?: AbortSignal;
}): Promise<DirectionsLegResult> {
  const key = getGoogleMapsWebServiceKey();
  if (!key) throw new Error('Google Directions API 키가 없습니다. (.env에 WEB/API 키 확인, expo 재시작)');

  const from = normalizeLatLngForDirections(params.from.latitude, params.from.longitude);
  const to = normalizeLatLngForDirections(params.to.latitude, params.to.longitude);

  if (haversineMeters(from, to) < 12) {
    return trivialDirectionsLeg(from, to, params.mode);
  }

  /** Tmap 우선: 도보/자동차는 한국 경로 품질이 좋아 우선 시도 */
  if (params.mode === 'walking' || params.mode === 'driving') {
    const tmapFirst = await fetchTmapDirectionsLeg({
      from,
      to,
      requestedMode: params.mode,
      signal: params.signal,
    });
    if (tmapFirst) return { ...tmapFirst, source: 'tmap' };
  }

  /** 카카오는 자동차 길찾기 보조 경로로 사용 */
  if (params.mode === 'driving') {
    const kakaoFirst = await fetchKakaoNaviCarDirectionsLeg({
      from,
      to,
      requestedMode: params.mode,
      signal: params.signal,
    });
    if (kakaoFirst) return { ...kakaoFirst, source: 'kakao' };
  }

  let body = await fetchDirectionsJson(
    from,
    to,
    params.mode,
    key,
    params.signal,
    'kr',
    params.transitType,
  );

  if (body?.status !== 'OK' && params.mode === 'transit' && params.transitType) {
    const b2 = await fetchDirectionsJson(
      from,
      to,
      'transit',
      key,
      params.signal,
      'kr',
      undefined,
    );
    if (b2?.status === 'OK') body = b2;
  }

  /** 대중교통 그래프 실패 시 지도용으로 도로/도보 폴리라인만 확보 */
  if (body?.status === 'ZERO_RESULTS' && params.mode === 'transit') {
    const geomTries: Array<{ mode: DirectionsMode; region?: string }> = [
      { mode: 'driving', region: 'kr' },
      { mode: 'driving', region: undefined },
      { mode: 'walking', region: 'kr' },
      { mode: 'bicycling', region: 'kr' },
    ];
    for (const fb of geomTries) {
      const b = await fetchDirectionsJson(from, to, fb.mode, key, params.signal, fb.region, undefined);
      if (b?.status === 'OK') {
        body = b;
        break;
      }
    }
  }

  if (body?.status === 'ZERO_RESULTS' && params.mode !== 'transit') {
    const chain = DIRECTIONS_ZERO_FALLBACKS[params.mode];
    for (const fb of chain) {
      const b = await fetchDirectionsJson(from, to, fb.mode, key, params.signal, fb.region, undefined);
      if (b?.status === 'OK') {
        body = b;
        break;
      }
    }
  }

  if (body?.status !== 'OK') {
    const st = String(body?.status ?? '');
    if (st === 'ZERO_RESULTS' || st === 'NOT_FOUND') {
      const kakaoFb = await fetchKakaoNaviCarDirectionsLeg({
        from,
        to,
        requestedMode: params.mode,
        signal: params.signal,
      });
      if (kakaoFb) {
        return { ...kakaoFb, source: 'kakao' };
      }
      return straightLineFallbackLeg(from, to, params.mode);
    }
    const em = typeof body?.error_message === 'string' ? body.error_message.trim() : '';
    const detail = em ? `${body.status}: ${em}` : st || 'UNKNOWN';
    throw new Error(`Directions 오류: ${detail}`);
  }

  let parsed = parseDirectionsLeg(body);
  if (params.mode === 'transit') {
    parsed = await enrichTransitWalkSegmentsWithTmap(parsed, params.signal);
  }
  return parsed;
}

/** @deprecated 내부용 — polyline만 필요할 때 */
export async function fetchGoogleDirectionsPath(params: {
  from: LatLng;
  to: LatLng;
  mode: DirectionsMode;
  transitType?: DirectionsTransitType;
  signal?: AbortSignal;
}): Promise<LatLng[]> {
  const r = await fetchGoogleDirectionsLeg(params);
  return r.path.length >= 2 ? r.path : [params.from, params.to];
}

function dedupeConsecutivePolyline(pts: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (
      !last ||
      Math.abs(last.latitude - p.latitude) > 1e-8 ||
      Math.abs(last.longitude - p.longitude) > 1e-8
    ) {
      out.push(p);
    }
  }
  return out;
}

/**
 * 정류장(또는 코스 단계) 좌표들 사이마다 Directions를 호출해 이어 붙인 폴리라인.
 * 코스 카드 미리보기 등에서 직선 연결 대신 실제 경로 형태에 가깝게 표시할 때 사용.
 */
export async function fetchMergedDirectionsPolyline(opts: {
  points: LatLng[];
  mode?: DirectionsMode;
  transitType?: DirectionsTransitType;
  signal?: AbortSignal;
}): Promise<LatLng[]> {
  const pts = (opts.points ?? []).filter(
    (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (pts.length < 2) return pts;

  const mode = opts.mode ?? 'transit';
  const transitType = opts.transitType ?? 'subway';
  const signal = opts.signal;

  const merged: LatLng[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const from = pts[i];
    const to = pts[i + 1];
    try {
      const leg = await fetchGoogleDirectionsLeg({
        from,
        to,
        mode,
        transitType: mode === 'transit' ? transitType : undefined,
        signal,
      });
      const seg = leg.path ?? [];
      if (seg.length >= 2) {
        if (merged.length === 0) merged.push(...seg);
        else merged.push(...seg.slice(1));
      } else if (merged.length === 0) {
        merged.push(from, to);
      } else {
        const last = merged[merged.length - 1];
        if (last.latitude !== to.latitude || last.longitude !== to.longitude) merged.push(to);
      }
    } catch {
      if (merged.length === 0) merged.push(from, to);
      else {
        const last = merged[merged.length - 1];
        if (last.latitude !== to.latitude || last.longitude !== to.longitude) merged.push(to);
      }
    }
  }
  return dedupeConsecutivePolyline(merged);
}
