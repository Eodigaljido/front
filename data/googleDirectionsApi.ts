export type DirectionsMode = 'walking' | 'transit' | 'driving' | 'bicycling';
export type DirectionsTransitType = 'bus' | 'subway' | 'train';

type LatLng = { latitude: number; longitude: number };

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

/** leg.steps[].polyline 을 이어 붙여 도로/노선을 따라가는 상세 경로 (overview보다 점이 많음) */
function mergeLegStepPolylines(leg: any): LatLng[] {
  const steps = Array.isArray(leg?.steps) ? leg.steps : [];
  const merged: LatLng[] = [];
  for (const step of steps) {
    const enc = String(step?.polyline?.points ?? '').trim();
    if (!enc) continue;
    const part = decodePolyline(enc);
    if (part.length === 0) continue;
    if (merged.length === 0) merged.push(...part);
    else merged.push(...part.slice(1));
  }
  return merged;
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
  durationMinutes: number;
  distanceMeters: number;
  /** 한 줄 요약 (목록용) */
  summary: string;
  /** 단계별 안내 (모달용, 줄바꿈) */
  detail: string;
};

export function parseDirectionsLeg(body: any): DirectionsLegResult {
  const route = body?.routes?.[0];
  if (!route) throw new Error('NO_ROUTE');
  const leg = route.legs?.[0];
  if (!leg) throw new Error('NO_LEG');

  const overviewEnc = String(route.overview_polyline?.points ?? '').trim();
  const overviewPath = overviewEnc ? decodePolyline(overviewEnc) : [];
  const stepsPath = mergeLegStepPolylines(leg);
  const path: LatLng[] =
    stepsPath.length >= 2 ? stepsPath : overviewPath.length >= 2 ? overviewPath : [];

  const totalSec = Number(leg?.duration?.value ?? 0);
  const durationMinutes = Math.max(1, Math.round(totalSec / 60));
  const distanceMeters = Number(leg?.distance?.value ?? 0);

  const steps = Array.isArray(leg?.steps) ? leg.steps : [];
  const transitOneLiners: string[] = [];
  const detailLines: string[] = [];

  for (const step of steps) {
    const mode = String(step?.travel_mode ?? '');
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

  return { path, durationMinutes, distanceMeters, summary, detail };
}

export async function fetchGoogleDirectionsLeg(params: {
  from: LatLng;
  to: LatLng;
  mode: DirectionsMode;
  transitType?: DirectionsTransitType;
  signal?: AbortSignal;
}): Promise<DirectionsLegResult> {
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error('Google Directions API 키가 없습니다.');

  const q = new URLSearchParams({
    origin: `${params.from.latitude},${params.from.longitude}`,
    destination: `${params.to.latitude},${params.to.longitude}`,
    mode: params.mode,
    key,
    language: 'ko',
    region: 'kr',
  });
  if (params.mode === 'transit' && params.transitType) {
    q.set('transit_mode', params.transitType);
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?${q.toString()}`;
  let res = await fetch(url, { method: 'GET', signal: params.signal });
  if (!res.ok) throw new Error(`Directions 요청 실패 (${res.status})`);
  let body = await res.json();

  if (body?.status !== 'OK' && params.mode === 'transit' && params.transitType) {
    const q2 = new URLSearchParams({
      origin: `${params.from.latitude},${params.from.longitude}`,
      destination: `${params.to.latitude},${params.to.longitude}`,
      mode: 'transit',
      key,
      language: 'ko',
      region: 'kr',
    });
    res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${q2.toString()}`, {
      method: 'GET',
      signal: params.signal,
    });
    if (res.ok) body = await res.json();
  }

  if (body?.status !== 'OK') {
    throw new Error(`Directions 오류: ${body?.status ?? 'UNKNOWN'}`);
  }

  return parseDirectionsLeg(body);
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
