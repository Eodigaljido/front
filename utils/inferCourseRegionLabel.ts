/**
 * 출발·도착·경유 지명(주소/장소명)에서 대략적인 지역 라벨을 뽑습니다.
 */

const PLACEHOLDER_REGION =
  /^(지역\s*미정|내\s*루트|지역미정|지역|미정)?\s*$/iu;

function extractDistrictFromAddressPool(pool: string): string | null {
  if (!pool) return null;
  const m = pool.match(
    /([\uac00-\ud7a3]{2,10}(?:특별시|광역시))\s+([\uac00-\ud7a3]{1,10}(?:시|군|구))/u,
  );
  if (m) {
    const city = m[1].replace(/특별시|광역시/gu, "");
    return `${city} ${m[2]}`.trim();
  }
  const gu = pool.match(/([\uac00-\ud7a3]{2,14}구)(?=\s|,|$|[\d])/u);
  if (gu) return gu[1];
  return null;
}

export function inferCourseRegionLabel(
  departure: string,
  arrival: string,
  extraPlaceNames: string[] = [],
): string | null {
  const pool = [departure, arrival, ...extraPlaceNames]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!pool) return null;

  const fromAddr = extractDistrictFromAddressPool(pool);
  if (fromAddr) return fromAddr;

  const m1 = pool.match(
    /(서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남)(?:특별시|광역시|특별자치시|도|특별자치도)?\s*([\uac00-\ud7a3]{1,8}(?:시|군|구))?/u,
  );
  if (m1) {
    const city = m1[1];
    const sub = m1[2];
    if (sub) return `${city} ${sub}`;
    return city;
  }

  const m2 = pool.match(/([\uac00-\ud7a3]{2,10}(?:시|군|구))/u);
  if (m2) return m2[1];

  return null;
}

/** 서버 region이 비어 있거나 플레이스홀더면 주소 기반으로 채움 */
export function resolveCourseRegionLabel(
  serverRegion: string | null | undefined,
  departure: string,
  arrival: string,
  extraPlaceNames: string[] = [],
): string {
  const inferred = inferCourseRegionLabel(departure, arrival, extraPlaceNames);
  if (inferred) return inferred;
  const r = String(serverRegion ?? "").trim();
  if (r && !PLACEHOLDER_REGION.test(r)) return r;
  const BAD_PLACE = /^(출발지|도착지)$/u;
  const candidates = [
    String(departure ?? "").trim(),
    String(arrival ?? "").trim(),
    ...extraPlaceNames.map((s) => String(s ?? "").trim()),
  ];
  for (const piece of candidates) {
    if (!piece || BAD_PLACE.test(piece)) continue;
    return piece.length > 16 ? `${piece.slice(0, 16)}…` : piece;
  }
  return "";
}

/** 목록용: '기타' 등 무분류 문구 제거 */
export function sanitizeCourseCategory(raw: string | null | undefined): string {
  const c = String(raw ?? "").trim();
  if (!c || c === "기타") return "";
  return c;
}

/** 회색 칩 UI — 비어 있으면 짧은 안내 문구 */
export function displayCourseRegionChip(
  serverRegion: string | null | undefined,
  departure: string,
  arrival: string,
  extraPlaceNames: string[] = [],
): string {
  const r = resolveCourseRegionLabel(
    serverRegion,
    departure,
    arrival,
    extraPlaceNames,
  );
  return r || "미지정";
}
