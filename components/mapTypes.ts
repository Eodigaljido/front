export type MapPathPoint = { latitude: number; longitude: number };

export type MapMarkerPoint = {
  latitude: number;
  longitude: number;
  /** 핀 안에 표기할 숫자/텍스트 (예: 1,2,3) */
  label?: string;
  /** 출발/경유/도착 구분 */
  kind?: "start" | "waypoint" | "end";
  /** 마커 강조 색상 (hex) */
  color?: string;
};

export type MapRouteSegment = {
  id: string;
  points: MapPathPoint[];
  color: string;
  width?: number;
  dashed?: boolean;
  /** 렌더 순서 — 낮을수록 아래(도보), 높을수록 위(철도·지하철) */
  zIndex?: number;
  /** 교통수단 구분(범례·스타일) */
  visualMode?: string;
};
