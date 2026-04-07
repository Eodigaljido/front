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
};

export const MOCK_RECENT_PLACES: MockPlace[] = [
  {
    id: 'r1',
    name: '강남역 2호선',
    distance: '1.2km',
    address: '서울특별시 강남구 강남대로 396',
    latitude: 37.498095,
    longitude: 127.02761,
  },
  {
    id: 'r2',
    name: '홍대입구역',
    distance: '3.4km',
    address: '서울특별시 마포구 양화로 188',
    latitude: 37.556724,
    longitude: 126.923607,
  },
  {
    id: 'r3',
    name: '잠실종합운동장',
    distance: '8.1km',
    address: '서울특별시 송파구 올림픽로 25',
    latitude: 37.513366,
    longitude: 127.071876,
  },
];

export const MOCK_SEARCH_POOL: MockPlace[] = [
  ...MOCK_RECENT_PLACES,
  {
    id: 's1',
    name: '매실 보육원',
    distance: '2.0km',
    address: '경기도 용인시 처인구 포곡읍 매실로 123',
    latitude: 37.2469,
    longitude: 127.2147,
  },
  {
    id: 's2',
    name: '수원역',
    distance: '12km',
    address: '경기도 수원시 팔달구 덕영대로 924',
    latitude: 37.2659,
    longitude: 126.9998,
  },
  {
    id: 's3',
    name: '판교역',
    distance: '15km',
    address: '경기도 성남시 분당구 판교역로 166',
    latitude: 37.3948,
    longitude: 127.1112,
  },
  {
    id: 's4',
    name: '남산타워',
    distance: '4.5km',
    address: '서울특별시 용산구 남산공원길 105',
    latitude: 37.5512,
    longitude: 126.9882,
  },
];

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

export const MOCK_COLLABORATORS: Collaborator[] = [
  { id: 'u1', name: '민지', color: '#f97316' },
  { id: 'u2', name: '현우', color: '#3b82f6' },
  { id: 'u3', name: '서연', color: '#22c55e' },
];
