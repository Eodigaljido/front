import type { MockPlace } from './routeCreateMocks';

const KAKAO_LOCAL_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

function formatDistance(distanceMeter?: string): string {
  const n = Number(distanceMeter ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1000) return `${Math.round(n)}m`;
  return `${(n / 1000).toFixed(1)}km`;
}

export async function searchKakaoPlacesByKeyword(
  query: string,
  signal?: AbortSignal,
): Promise<MockPlace[]> {
  const restKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY?.trim();
  if (!restKey) {
    throw new Error('카카오 REST API 키가 설정되지 않았습니다.');
  }

  const q = query.trim();
  if (!q) return [];

  const url = `${KAKAO_LOCAL_KEYWORD_URL}?query=${encodeURIComponent(q)}&size=15`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `KakaoAK ${restKey}`,
    },
    signal,
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
      const lat = Number(d?.y);
      const lng = Number(d?.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const rawId = String(d?.id ?? '').trim();
      const id = rawId ? `kakao-${rawId}` : `kakao-${idx}-${d?.place_name ?? 'place'}`;
      const name = String(d?.place_name ?? '').trim();
      const address = String(d?.road_address_name || d?.address_name || '').trim();
      if (!name || !address) return null;

      return {
        id,
        name,
        distance: formatDistance(d?.distance),
        address,
        latitude: lat,
        longitude: lng,
      };
    })
    .filter(Boolean) as MockPlace[];
}
