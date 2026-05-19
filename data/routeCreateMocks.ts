export type TransportMode = 'walk' | 'transit' | 'car' | 'bike';

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  walk: '도보',
  transit: '대중교통',
  car: '개인차량',
  bike: '자전거',
};

export type MockPlace = {
  id: string;
  name: string;
  distance: string;
  address: string;
  latitude: number;
  longitude: number;
  /** 카카오 place_category_name 등 */
  category?: string;
};

/** 목 장소 제거 — 검색은 카카오 키워드 API만 사용 */
export const MOCK_RECENT_PLACES: MockPlace[] = [];

export const MOCK_SEARCH_POOL: MockPlace[] = [];

export function findPlaceById(id: string): MockPlace | undefined {
  return MOCK_SEARCH_POOL.find((p) => p.id === id);
}

export function filterPlaces(query: string): MockPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MOCK_SEARCH_POOL.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q),
  );
}

export function estimateMinutes(mode: TransportMode, placeId: string): number {
  let h = 0;
  for (let i = 0; i < placeId.length; i++) h = (h + placeId.charCodeAt(i) * (i + 1)) % 97;
  const base = 12 + (h % 28);
  const mult: Record<TransportMode, number> = {
    walk: 2.2,
    transit: 1.1,
    car: 0.75,
    bike: 1.4,
  };
  return Math.max(5, Math.round(base * mult[mode]));
}

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  isTyping?: boolean;
};

/** 공동 편집 멤버는 서버 연동 전까지 비움 */
export const MOCK_COLLABORATORS: Collaborator[] = [];
