export type TransportMode = 'walk' | 'transit' | 'car' | 'bike';

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  walk: '도보',
  transit: '대중교통',
  car: '개인차량',
  bike: '자전거',
};

/** 장소 검색 결과 (카카오 키워드 API) */
export type MockPlace = {
  id: string;
  name: string;
  distance: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
};

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
