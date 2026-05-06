import type { MockPlace } from './routeCreateMocks';
import { normalizeLatLngForDirections } from './googleDirectionsApi';

const KAKAO_LOCAL_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

export type KakaoKeywordSort = 'accuracy' | 'distance';

/** 카카오 로컬 API category_group_code (키워드 검색 필터) */
export const KAKAO_KEYWORD_CATEGORY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: '', label: '전체' },
  { code: 'MT1', label: '대형마트' },
  { code: 'CS2', label: '편의점' },
  { code: 'FD6', label: '음식점' },
  { code: 'CE7', label: '카페' },
  { code: 'SW8', label: '지하철' },
  { code: 'BK9', label: '은행' },
  { code: 'CT1', label: '문화시설' },
  { code: 'AT4', label: '관광명소' },
  { code: 'AD5', label: '숙박' },
  { code: 'HP8', label: '병원' },
  { code: 'PM9', label: '약국' },
  { code: 'OL7', label: '주유소' },
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

function formatDistance(distanceMeter?: string): string {
  const n = Number(distanceMeter ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1000) return `${Math.round(n)}m`;
  return `${(n / 1000).toFixed(1)}km`;
}

export async function searchKakaoPlacesByKeyword(
  query: string,
  options: KakaoKeywordSearchParams = {},
): Promise<MockPlace[]> {
  const opts = options;

  const restKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY?.trim();
  if (!restKey) {
    throw new Error('카카오 REST API 키가 설정되지 않았습니다.');
  }

  const q = query.trim();
  if (!q) return [];

  const sort = opts.sort ?? 'accuracy';
  const size = Math.min(15, Math.max(1, opts.size ?? 15));
  const page = Math.max(1, opts.page ?? 1);

  const searchParams = new URLSearchParams();
  searchParams.set('query', q);
  searchParams.set('size', String(size));
  searchParams.set('page', String(page));
  searchParams.set('sort', sort);

  if (opts.categoryGroupCode?.trim()) {
    searchParams.set('category_group_code', opts.categoryGroupCode.trim());
  }

  if (sort === 'distance') {
    const c = opts.center;
    if (
      c &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude)
    ) {
      searchParams.set('x', String(c.longitude));
      searchParams.set('y', String(c.latitude));
      const r = Math.min(20000, Math.max(1, opts.radiusMeters ?? 15000));
      searchParams.set('radius', String(r));
    } else {
      searchParams.set('sort', 'accuracy');
    }
  }

  const url = `${KAKAO_LOCAL_KEYWORD_URL}?${searchParams.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `KakaoAK ${restKey}`,
    },
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = String(err?.msg || err?.errorType || err?.message || '').trim();
      const message = String(err?.message || '').trim();
      if (message.includes('disabled OPEN_MAP_AND_LOCAL service')) {
        throw new Error(
          '카카오 개발자 콘솔에서 OPEN_MAP_AND_LOCAL(카카오맵/로컬) 서비스를 활성화해 주세요.',
        );
      }
    } catch {
      detail = '';
    }
    throw new Error(
      detail
        ? `카카오 장소 검색 실패 (${res.status}): ${detail}`
        : `카카오 장소 검색 실패 (${res.status})`,
    );
  }

  const data = await res.json();
  const docs = Array.isArray(data?.documents) ? data.documents : [];

  return docs
    .map((d: any, idx: number): MockPlace | null => {
      const rawLat = Number(d?.y);
      const rawLng = Number(d?.x);
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;
      const { latitude: lat, longitude: lng } = normalizeLatLngForDirections(rawLat, rawLng);

      const rawId = String(d?.id ?? '').trim();
      const id = rawId ? `kakao-${rawId}` : `kakao-${idx}-${d?.place_name ?? 'place'}`;
      const name = String(d?.place_name ?? '').trim();
      const address = String(d?.road_address_name || d?.address_name || '').trim();
      if (!name || !address) return null;

      const cat = String(d?.category_name ?? d?.place_category_name ?? '').trim();

      return {
        id,
        name,
        distance: formatDistance(d?.distance),
        address,
        latitude: lat,
        longitude: lng,
        category: cat || undefined,
      };
    })
    .filter(Boolean) as MockPlace[];
}
