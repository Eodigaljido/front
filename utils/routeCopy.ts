/** 유저 노출용 경로·장소 검색 문구 (외부 지도/내비 브랜드 미표기) */

export function formatRouteDistanceDuration(
  distanceMeters: number,
  durationMinutes: number,
): string {
  const d = Math.max(0, Math.round(distanceMeters));
  const m = Math.max(1, Math.round(durationMinutes));
  if (d > 0) {
    return d < 1000
      ? `약 ${d}m · 약 ${m}분`
      : `약 ${(d / 1000).toFixed(1)}km · 약 ${m}분`;
  }
  return `약 ${m}분`;
}

export const ROUTE_USER_MESSAGES = {
  placeSearchUnavailable: '장소 검색을 사용할 수 없습니다.',
  placeSearchFailed: '장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  directionsUnavailable: '경로 정보를 불러올 수 없습니다.',
  directionsKeyMissing: '경로 안내를 사용할 수 없습니다.',
  straightLineSummary: '경로를 불러오지 못해 직선으로 표시했어요',
  straightLineDetail:
    '일부 구간의 상세 경로를 가져오지 못했습니다. 장소를 확인하거나 이동 수단을 바꿔 보세요.',
  routeDetailFallback: '경로 안내',
} as const;

/** API 원문에 섞인 기술 식별자·브랜드명은 유저에게 노출하지 않음 */
export function toUserFacingErrorMessage(
  raw: string | undefined | null,
  fallback: string,
): string {
  const text = String(raw ?? '').trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (
    lower.includes('accessdenied') ||
    lower.includes('open_map_and_local') ||
    lower.includes('request_denied') ||
    lower.includes('카카오') ||
    lower.includes('kakao') ||
    lower.includes('tmap') ||
    lower.includes('t맵') ||
    lower.includes('google directions') ||
    lower.includes('expo_public_')
  ) {
    return fallback;
  }
  return text;
}

const LEGACY_STRAIGHT_SUMMARY = '직선으로 표시 · 상세 경로 없음';

/** 저장·API에 남은 예전 provider 문구를 화면용으로 정리 */
export function sanitizeRouteDisplayText(text: string | undefined | null): string {
  let s = String(text ?? '').trim();
  if (!s) return '';
  if (s === LEGACY_STRAIGHT_SUMMARY) {
    return ROUTE_USER_MESSAGES.straightLineSummary;
  }
  s = s.replace(/^(카카오|Kakao)\s*·\s*/i, '');
  s = s.replace(/^Tmap\s*(도보|자동차)?\s*·\s*/i, '');
  s = s.replace(/※\s*카카오[\s\S]*/g, '').trim();
  if (
    /카카오|kakao|tmap|t맵|google directions|open_map|모빌리티|kakao_nav/i.test(
      s,
    )
  ) {
    return '';
  }
  return s;
}
