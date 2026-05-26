import type { MapMarkerPoint, MapPathPoint } from '../components/mapTypes';

const OVERLAP_METERS = 30;
const SEPARATION_METERS = 28;

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function offsetPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distM: number,
): { latitude: number; longitude: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dNorth = distM * Math.cos(rad);
  const dEast = distM * Math.sin(rad);
  const dLat = dNorth / 111_320;
  const dLng = dEast / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { latitude: lat + dLat, longitude: lng + dLng };
}

/** 같은 좌표(또는 매우 가까운) 마커를 살짝 벌려 핀이 겹치지 않게 함 */
export function spreadOverlappingMapMarkers(
  markers: MapMarkerPoint[],
  options?: { overlapMeters?: number; separationMeters?: number },
): MapMarkerPoint[] {
  const overlapM = options?.overlapMeters ?? OVERLAP_METERS;
  const sepM = options?.separationMeters ?? SEPARATION_METERS;
  if (markers.length < 2) return markers;

  const out = markers.map((m) => ({ ...m }));
  const visited = new Set<number>();

  for (let i = 0; i < out.length; i++) {
    if (visited.has(i)) continue;

    const cluster: number[] = [i];
    for (let j = i + 1; j < out.length; j++) {
      if (visited.has(j)) continue;
      const nearCluster = cluster.some(
        (idx) => haversineMeters(out[idx], out[j]) < overlapM,
      );
      if (nearCluster) cluster.push(j);
    }

    if (cluster.length < 2) continue;

    const centroidLat =
      cluster.reduce((s, idx) => s + out[idx].latitude, 0) / cluster.length;
    const centroidLng =
      cluster.reduce((s, idx) => s + out[idx].longitude, 0) / cluster.length;

    const startIdx = cluster.find((idx) => out[idx].kind === 'start');
    const endIdx = cluster.find((idx) => out[idx].kind === 'end');

    if (cluster.length === 2 && startIdx != null && endIdx != null) {
      out[startIdx] = {
        ...out[startIdx],
        ...offsetPoint(centroidLat, centroidLng, 45, sepM),
      };
      out[endIdx] = {
        ...out[endIdx],
        ...offsetPoint(centroidLat, centroidLng, 225, sepM),
      };
    } else {
      const radius = Math.max(sepM, sepM * 0.85 * cluster.length);
      cluster.forEach((idx, k) => {
        const bearing = (360 / cluster.length) * k - 90;
        out[idx] = {
          ...out[idx],
          ...offsetPoint(centroidLat, centroidLng, bearing, radius),
        };
      });
    }

    cluster.forEach((idx) => visited.add(idx));
  }

  return out;
}

export function buildMapMarkersFromRouteStops(
  stops: Array<{
    lat?: number | null;
    lng?: number | null;
    kind: 'start' | 'via' | 'end';
  }>,
): MapMarkerPoint[] {
  let viaIndex = 0;
  const raw: MapMarkerPoint[] = [];
  for (const s of stops) {
    if (s.lat == null || s.lng == null) continue;
    if (s.kind === 'via') viaIndex += 1;
    const isStart = s.kind === 'start';
    const isEnd = s.kind === 'end';
    raw.push({
      latitude: s.lat,
      longitude: s.lng,
      label: isStart ? '출' : isEnd ? '도' : String(viaIndex),
      kind: isStart ? 'start' : isEnd ? 'end' : 'waypoint',
      color: isStart ? '#2563EB' : isEnd ? '#EF4444' : '#64748B',
    });
  }
  return spreadOverlappingMapMarkers(raw);
}

export function buildMapMarkersFromPathPoints(
  pathPts: MapPathPoint[],
): MapMarkerPoint[] {
  if (pathPts.length < 1) return [];
  const raw = pathPts.map((pt, i) => {
    const isStart = i === 0;
    const isEnd = i === pathPts.length - 1;
    return {
      latitude: pt.latitude,
      longitude: pt.longitude,
      label: isStart ? '출' : isEnd ? '도' : String(i),
      kind: (isStart ? 'start' : isEnd ? 'end' : 'waypoint') as MapMarkerPoint['kind'],
      color: isStart ? '#2563EB' : isEnd ? '#EF4444' : '#64748B',
    };
  });
  return spreadOverlappingMapMarkers(raw);
}
