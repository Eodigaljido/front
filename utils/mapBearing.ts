/** 위도·경도 두 점 사이 방위각(도, 북=0, 시계방향) */
export function bearingBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/** GPS/나침반 heading(0–360), 없으면 null */
export function normalizeDeviceHeading(
  heading: number | null | undefined,
): number | null {
  if (heading == null || !Number.isFinite(heading) || heading < 0) return null;
  return ((heading % 360) + 360) % 360;
}

/** 안내 모드: 폰(나침반·GPS) 방향 우선, 없으면 목표 지점 방위 */
export function resolveGuideMapHeading(
  deviceHeading: number | null | undefined,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const h = normalizeDeviceHeading(deviceHeading);
  if (h != null) return h;
  return bearingBetween(from, to);
}

/** 입구 안내 ON일 때 지도 heading — 나침반 값만 쓸 때 */
export function guideMapHeadingFromDevice(
  deviceHeading: number | null | undefined,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number | undefined {
  const h = normalizeDeviceHeading(deviceHeading);
  if (h != null) return h;
  return bearingBetween(from, to);
}
