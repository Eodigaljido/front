export type MapPathPoint = { latitude: number; longitude: number };

export type MapMarkerPoint = {
  latitude: number;
  longitude: number;
  /** 핀 안에 표기할 숫자/텍스트 (예: 1,2,3) */
  label?: string;
};

export type MapRouteSegment = {
  id: string;
  points: MapPathPoint[];
  color: string;
  width?: number;
  dashed?: boolean;
};
