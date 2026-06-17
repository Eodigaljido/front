import type { MapPathPoint, MapRouteSegment } from '../components/mapTypes';

export type DirectionSegmentInput = {
  mode: 'walk' | 'ride';
  points: MapPathPoint[];
  lineLabel?: string;
  vehicleType?: string;
};

export type RouteVisualMode =
  | 'walk'
  | 'bike'
  | 'car'
  | 'bus'
  | 'subway'
  | 'train'
  | 'transit';

export const MAP_ROUTE_COLORS: Record<RouteVisualMode, string> = {
  walk: '#f59e0b',
  bike: '#16a34a',
  car: '#1d4ed8',
  bus: '#dc2626',
  subway: '#7c3aed',
  train: '#0f766e',
  transit: '#2563eb',
};

const GOOGLE_VEHICLE_TO_VISUAL: Record<string, RouteVisualMode> = {
  BUS: 'bus',
  SUBWAY: 'subway',
  TRAIN: 'train',
  TRAM: 'train',
  HEAVY_RAIL: 'train',
  LIGHT_RAIL: 'subway',
  MONORAIL: 'subway',
  FERRY: 'transit',
};

export function inferTransitVisualMode(
  lineLabel?: string,
  vehicleType?: string,
  transitType?: 'bus' | 'subway' | 'train',
): RouteVisualMode {
  const vt = String(vehicleType ?? '').trim().toUpperCase();
  if (vt && GOOGLE_VEHICLE_TO_VISUAL[vt]) return GOOGLE_VEHICLE_TO_VISUAL[vt];

  const label = String(lineLabel ?? '').trim();
  if (/기차|KTX|SRT|ITX|무궁화|새마을|철도/.test(label)) return 'train';
  if (/지하철|호선|역\s*\(|역→/.test(label)) return 'subway';
  if (/버스/.test(label)) return 'bus';

  if (transitType === 'train') return 'train';
  if (transitType === 'subway') return 'subway';
  if (transitType === 'bus') return 'bus';
  return 'transit';
}

export function transportModeToVisual(
  mode: 'walk' | 'transit' | 'car' | 'bike' | string,
  transitType?: 'bus' | 'subway' | 'train',
): RouteVisualMode {
  if (mode === 'walk') return 'walk';
  if (mode === 'bike') return 'bike';
  if (mode === 'car') return 'car';
  if (mode === 'transit') return inferTransitVisualMode(undefined, undefined, transitType);
  return 'transit';
}

type SegmentStyleSpec = {
  color: string;
  width: number;
  dashed: boolean;
  zIndex: number;
  casingWidth: number;
};

export function visualModeStyle(visual: RouteVisualMode, isWalkSegment: boolean): SegmentStyleSpec {
  if (isWalkSegment) {
    return {
      color: MAP_ROUTE_COLORS.walk,
      width: 4,
      dashed: true,
      zIndex: 10,
      casingWidth: 0,
    };
  }
  switch (visual) {
    case 'walk':
      return {
        color: MAP_ROUTE_COLORS.walk,
        width: 4,
        dashed: true,
        zIndex: 10,
        casingWidth: 0,
      };
    case 'bike':
      return {
        color: MAP_ROUTE_COLORS.bike,
        width: 4,
        dashed: false,
        zIndex: 20,
        casingWidth: 6,
      };
    case 'car':
      return {
        color: MAP_ROUTE_COLORS.car,
        width: 5,
        dashed: false,
        zIndex: 25,
        casingWidth: 7,
      };
    case 'bus':
      return {
        color: MAP_ROUTE_COLORS.bus,
        width: 5,
        dashed: false,
        zIndex: 30,
        casingWidth: 7,
      };
    case 'subway':
      return {
        color: MAP_ROUTE_COLORS.subway,
        width: 5,
        dashed: false,
        zIndex: 35,
        casingWidth: 7,
      };
    case 'train':
      return {
        color: MAP_ROUTE_COLORS.train,
        width: 5,
        dashed: false,
        zIndex: 40,
        casingWidth: 7,
      };
    default:
      return {
        color: MAP_ROUTE_COLORS.transit,
        width: 4,
        dashed: false,
        zIndex: 22,
        casingWidth: 6,
      };
  }
}

const CASING_COLOR = '#ffffff';

function withCasing(
  id: string,
  points: MapPathPoint[],
  style: SegmentStyleSpec,
  visualMode: RouteVisualMode,
): MapRouteSegment[] {
  if (points.length < 2) return [];
  const main: MapRouteSegment = {
    id,
    points,
    color: style.color,
    width: style.width,
    dashed: style.dashed,
    zIndex: style.zIndex,
    visualMode,
  };
  if (style.dashed || style.casingWidth <= 0) return [main];
  return [
    {
      id: `${id}-casing`,
      points,
      color: CASING_COLOR,
      width: style.casingWidth,
      zIndex: style.zIndex - 1,
      visualMode,
    },
    main,
  ];
}

export function buildStyledMapSegments(opts: {
  idPrefix: string;
  points: MapPathPoint[];
  legMode: 'walk' | 'transit' | 'car' | 'bike' | string;
  transitType?: 'bus' | 'subway' | 'train';
  isWalkSegment?: boolean;
  lineLabel?: string;
  vehicleType?: string;
}): MapRouteSegment[] {
  const visual = opts.isWalkSegment
    ? 'walk'
    : opts.legMode === 'transit'
      ? inferTransitVisualMode(opts.lineLabel, opts.vehicleType, opts.transitType)
      : transportModeToVisual(opts.legMode, opts.transitType);
  const style = visualModeStyle(visual, Boolean(opts.isWalkSegment));
  return withCasing(opts.idPrefix, opts.points, style, visual);
}

export function directionsSegmentsToMapSegments(
  rawSegs: DirectionSegmentInput[] | undefined,
  legIndex: number,
  legMode: 'walk' | 'transit' | 'car' | 'bike' | string,
  transitType?: 'bus' | 'subway' | 'train',
): MapRouteSegment[] {
  if (!rawSegs?.length) return [];
  const out: MapRouteSegment[] = [];
  rawSegs.forEach((seg, segIdx) => {
    const pts = (seg.points ?? [])
      .filter(
        (p) =>
          p &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude),
      )
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (pts.length < 2) return;
    const isWalk = seg.mode === 'walk' || legMode === 'walk';
    out.push(
      ...buildStyledMapSegments({
        idPrefix: `leg-${legIndex}-seg-${segIdx}`,
        points: pts,
        legMode: isWalk ? 'walk' : legMode,
        transitType,
        isWalkSegment: isWalk,
        lineLabel: seg.lineLabel,
        vehicleType: seg.vehicleType,
      }),
    );
  });
  return out;
}

export function sortMapSegmentsForRender(segments: MapRouteSegment[]): MapRouteSegment[] {
  return [...segments].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}
