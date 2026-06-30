import type { MockPlace } from "./routeCreateMocks";
import { normalizeLatLngForDirections } from "./googleDirectionsApi";
import { getGoogleMapsWebServiceKey } from "../constants/googleMaps";
import {
  getKakaoLocalRestApiKey,
  isPlaceSearchGoogleFallbackEnabled,
} from "../constants/kakao";
import { ROUTE_USER_MESSAGES } from "../utils/routeCopy";

const KAKAO_LOCAL_KEYWORD_URL =
  "https://dapi.kakao.com/v2/local/search/keyword.json";
const GOOGLE_PLACE_TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";

/** 카카오 category_group_code → Google Places type (폴백 검색용) */
const KAKAO_CATEGORY_TO_GOOGLE_TYPE: Record<string, string> = {
  MT1: "supermarket",
  CS2: "convenience_store",
  FD6: "restaurant",
  CE7: "cafe",
  SW8: "subway_station",
  BK9: "bank",
  CT1: "tourist_attraction",
  AT4: "tourist_attraction",
  AD5: "lodging",
  HP8: "hospital",
  PM9: "pharmacy",
  OL7: "gas_station",
};

export type KakaoKeywordSort = "accuracy" | "distance";

/** 카카오 로컬 API category_group_code (키워드 검색 필터) */
export const KAKAO_KEYWORD_CATEGORY_OPTIONS: Array<{
  code: string;
  label: string;
}> = [
  { code: "", label: "전체" },
  { code: "MT1", label: "대형마트" },
  { code: "CS2", label: "편의점" },
  { code: "FD6", label: "음식점" },
  { code: "CE7", label: "카페" },
  { code: "SW8", label: "지하철" },
  { code: "BK9", label: "은행" },
  { code: "CT1", label: "문화시설" },
  { code: "AT4", label: "관광명소" },
  { code: "AD5", label: "숙박" },
  { code: "HP8", label: "병원" },
  { code: "PM9", label: "약국" },
  { code: "OL7", label: "주유소" },
];

export type KakaoKeywordSearchParams = {
  signal?: AbortSignal;
  /** accuracy: 키워드 일치 우선, distance: 기준점과의 거리 (x,y,radius 필수) */
  sort?: KakaoKeywordSort;
  /** 거리순 기준점 WGS84 */
  center?: { latitude: number; longitude: number };
  /** 거리순 반경(m). 최대 20000 */
  radiusMeters?: number;
  categoryGroupCode?: string;
  page?: number;
  size?: number;
};

function formatDistance(distanceMeter?: string | number): string {
  const n = Number(distanceMeter ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n < 1000) return `${Math.round(n)}m`;
  return `${(n / 1000).toFixed(1)}km`;
}

function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}


function mapKakaoDocument(d: any, idx: number): MockPlace | null {
  const rawLat = Number(d?.y);
  const rawLng = Number(d?.x);
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;
  const { latitude: lat, longitude: lng } = normalizeLatLngForDirections(
    rawLat,
    rawLng,
  );

  const rawId = String(d?.id ?? "").trim();
  const id = rawId
    ? `kakao-${rawId}`
    : `kakao-${idx}-${d?.place_name ?? "place"}`;
  const name = String(d?.place_name ?? "").trim();
  const address = String(
    d?.road_address_name || d?.address_name || "",
  ).trim();
  if (!name || !address) return null;

  const cat = String(
    d?.category_name ?? d?.place_category_name ?? "",
  ).trim();

  return {
    id,
    name,
    distance: formatDistance(d?.distance),
    address,
    latitude: lat,
    longitude: lng,
    category: cat || undefined,
  };
}

function mapGooglePlace(
  place: any,
  idx: number,
  center?: { latitude: number; longitude: number },
): MockPlace | null {
  const loc = place?.geometry?.location;
  const rawLat = Number(loc?.lat);
  const rawLng = Number(loc?.lng);
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;
  const { latitude: lat, longitude: lng } = normalizeLatLngForDirections(
    rawLat,
    rawLng,
  );

  const placeId = String(place?.place_id ?? "").trim();
  const id = placeId ? `gplace-${placeId}` : `gplace-${idx}`;
  const name = String(place?.name ?? "").trim();
  const address = String(
    place?.formatted_address ?? place?.vicinity ?? "",
  ).trim();
  if (!name || !address) return null;

  const types = Array.isArray(place?.types) ? place.types : [];
  const category = types.find((t: string) => t && t !== "point_of_interest");

  const distanceMeters =
    center != null ? metersBetween(center, { latitude: lat, longitude: lng }) : 0;

  return {
    id,
    name,
    distance: distanceMeters > 0 ? formatDistance(distanceMeters) : "-",
    address,
    latitude: lat,
    longitude: lng,
    category: category ? String(category) : undefined,
  };
}

async function searchGooglePlacesByKeyword(
  query: string,
  options: KakaoKeywordSearchParams = {},
): Promise<MockPlace[]> {
  const key = getGoogleMapsWebServiceKey();
  if (!key) return [];

  const q = query.trim();
  if (!q) return [];

  const size = Math.min(15, Math.max(1, options.size ?? 15));
  const params = new URLSearchParams();
  params.set("query", q);
  params.set("language", "ko");
  params.set("region", "kr");
  params.set("key", key);

  const googleType = options.categoryGroupCode
    ? KAKAO_CATEGORY_TO_GOOGLE_TYPE[options.categoryGroupCode.trim()]
    : undefined;
  if (googleType) params.set("type", googleType);

  const center = options.center;
  if (
    center &&
    Number.isFinite(center.latitude) &&
    Number.isFinite(center.longitude)
  ) {
    params.set("location", `${center.latitude},${center.longitude}`);
    const radius = Math.min(
      50000,
      Math.max(1, options.radiusMeters ?? 15000),
    );
    params.set("radius", String(radius));
  }

  const res = await fetch(`${GOOGLE_PLACE_TEXT_SEARCH_URL}?${params}`, {
    method: "GET",
    signal: options.signal,
  });
  if (!res.ok) return [];

  const data = await res.json();
  const status = String(data?.status ?? "");
  if (status !== "OK" && status !== "ZERO_RESULTS") return [];

  let rows = (Array.isArray(data?.results) ? data.results : [])
    .map((place: any, idx: number) => mapGooglePlace(place, idx, center))
    .filter(Boolean) as MockPlace[];

  if (options.sort === "distance" && center) {
    rows = rows.sort(
      (a, b) =>
        metersBetween(center, a) - metersBetween(center, b),
    );
  }

  return rows.slice(0, size);
}

async function tryGooglePlaceSearchFallback(
  query: string,
  options: KakaoKeywordSearchParams,
): Promise<MockPlace[] | null> {
  if (!isPlaceSearchGoogleFallbackEnabled()) return null;
  const rows = await searchGooglePlacesByKeyword(query, options);
  return rows.length > 0 ? rows : null;
}

async function searchKakaoPlacesDirect(
  query: string,
  options: KakaoKeywordSearchParams,
  restKey: string,
): Promise<MockPlace[]> {
  const sort = options.sort ?? "accuracy";
  const size = Math.min(15, Math.max(1, options.size ?? 15));
  const page = Math.max(1, options.page ?? 1);

  const searchParams = new URLSearchParams();
  searchParams.set("query", query);
  searchParams.set("size", String(size));
  searchParams.set("page", String(page));
  searchParams.set("sort", sort);

  if (options.categoryGroupCode?.trim()) {
    searchParams.set("category_group_code", options.categoryGroupCode.trim());
  }

  if (sort === "distance") {
    const c = options.center;
    if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
      searchParams.set("x", String(c.longitude));
      searchParams.set("y", String(c.latitude));
      const r = Math.min(20000, Math.max(1, options.radiusMeters ?? 15000));
      searchParams.set("radius", String(r));
    } else {
      searchParams.set("sort", "accuracy");
    }
  }

  const url = `${KAKAO_LOCAL_KEYWORD_URL}?${searchParams.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${restKey}`,
    },
    signal: options.signal,
  });

  if (!res.ok) {
    let message = "";
    try {
      const err = await res.json();
      message = String(err?.message || "").trim();
      if (message.includes("disabled OPEN_MAP_AND_LOCAL service")) {
        throw new Error(ROUTE_USER_MESSAGES.placeSearchUnavailable);
      }
    } catch (e) {
      if (
        e instanceof Error &&
        e.message === ROUTE_USER_MESSAGES.placeSearchUnavailable
      ) {
        throw e;
      }
    }

    throw new Error(ROUTE_USER_MESSAGES.placeSearchFailed);
  }

  const data = await res.json();
  const docs = Array.isArray(data?.documents) ? data.documents : [];
  return docs
    .map((d: any, idx: number) => mapKakaoDocument(d, idx))
    .filter(Boolean) as MockPlace[];
}

export async function searchKakaoPlacesByKeyword(
  query: string,
  options: KakaoKeywordSearchParams = {},
): Promise<MockPlace[]> {
  const opts = options;
  const q = query.trim();
  if (!q) return [];

  const restKey = getKakaoLocalRestApiKey();
  if (restKey) {
    try {
      // 카카오 로컬 API를 항상 먼저 사용 (성공·빈 결과 모두 그대로 반환)
      return await searchKakaoPlacesDirect(q, opts, restKey);
    } catch (e) {
      const fallback = await tryGooglePlaceSearchFallback(q, opts);
      if (fallback) return fallback;
      throw e;
    }
  }

  const fallback = await tryGooglePlaceSearchFallback(q, opts);
  if (fallback) return fallback;
  throw new Error(ROUTE_USER_MESSAGES.placeSearchUnavailable);
}
