// @ts-nocheck
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AppMapView from '../components/AppMapView';
import type { MapMarkerPoint, MapRouteSegment } from '../components/mapTypes';
import { useMockData } from '../context/MockDataContext';
import {
  TRANSPORT_LABELS,
  type TransportMode,
  type MockPlace,
  estimateMinutes,
  MOCK_COLLABORATORS,
} from '../data/routeCreateMocks';
import {
  searchKakaoPlacesByKeyword,
  KAKAO_KEYWORD_CATEGORY_OPTIONS,
  type KakaoKeywordSort,
} from '../data/kakaoLocalApi';
import { fetchGoogleDirectionsLeg, type DirectionsMode } from '../data/googleDirectionsApi';
import type { CourseItem } from '../data/mockData';
import { MOCK_COURSES, getCourseStepMapPoint } from '../data/mockData';

type RouteStop = {
  id: string;
  kind: 'start' | 'via' | 'end';
  title: string;
  timeLine: string;
  lat?: number;
  lng?: number;
};

type RouteLeg = {
  id: string;
  mode: TransportMode;
  minutes: number;
  transitType?: 'bus' | 'subway' | 'train';
  directionsSummary?: string;
  directionsDetail?: string;
  distanceMeters?: number;
};

const WALK_SEGMENT_COLOR = '#f59e0b';
const RIDE_SEGMENT_COLOR = '#2563eb';

const ROUTE_CREATE_EMPTY_STOPS: RouteStop[] = [
  {
    id: 's0',
    kind: 'start',
    title: '출발지를 검색해 추가하세요',
    timeLine: '교통수단 + 장소를 함께 선택',
  },
  {
    id: 's-end',
    kind: 'end',
    title: '도착지를 검색해 추가하세요',
    timeLine: '교통수단 + 장소를 함께 선택',
  },
];

const ROUTE_CREATE_INITIAL_CHAT: { id: string; from: 'me' | 'other'; name: string; text: string; at: number }[] = [
  {
    id: 'm0',
    from: 'other',
    name: '민지',
    text: '출발 시간 8시 반으로 맞출까요?',
    at: Date.now() - 600000,
  },
  {
    id: 'm1',
    from: 'other',
    name: '현우',
    text: '네, 그때 보는 걸로 해요.',
    at: Date.now() - 300000,
  },
];

function normalizeLegMode(m: string): TransportMode {
  return (['walk', 'transit', 'car', 'bike'].includes(m) ? m : 'transit') as TransportMode;
}

function transportIcon(mode: TransportMode): string {
  const m: Record<TransportMode, string> = {
    walk: 'walk',
    transit: 'bus',
    car: 'car',
    bike: 'bicycle',
  };
  return m[mode];
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TRANSIT_TYPE_LABELS = {
  bus: '버스',
  subway: '지하철',
  train: '기차',
} as const;

type TransitType = keyof typeof TRANSIT_TYPE_LABELS;

function legTransportLabel(mode: TransportMode, transitType?: TransitType): string {
  if (mode !== 'transit') return TRANSPORT_LABELS[mode];
  return transitType ? `대중교통(${TRANSIT_TYPE_LABELS[transitType]})` : TRANSPORT_LABELS.transit;
}

/** 공유 루트 목 코스 → 루트 제작 정류장/구간 (저장 시 새 내 루트로 추가) */
function seedRouteFromMockCourse(course: CourseItem): { stops: RouteStop[]; legs: RouteLeg[] } {
  const steps = course.routeSteps;
  if (steps.length === 0) {
    return { stops: ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })), legs: [] };
  }
  if (steps.length === 1) {
    const s = steps[0];
    const { lat, lng } = getCourseStepMapPoint(course.id, 0);
    const stops: RouteStop[] = [
      {
        id: `seed-${uid()}-s`,
        kind: 'start',
        title: s.name,
        timeLine: `목 코스 · 약 ${s.stayMinutes}분`,
        lat,
        lng,
      },
      {
        id: `seed-${uid()}-e`,
        kind: 'end',
        title: s.name,
        timeLine: '도착 (목 데이터)',
        lat,
        lng,
      },
    ];
    return {
      stops,
      legs: [{ id: uid(), mode: 'walk', minutes: Math.max(5, Math.min(40, s.stayMinutes)) }],
    };
  }
  const stops: RouteStop[] = steps.map((step, index) => {
    const { lat, lng } = getCourseStepMapPoint(course.id, index);
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const kind = isFirst ? 'start' : isLast ? 'end' : 'via';
    return {
      id: `seed-${step.id}`,
      kind,
      title: step.name,
      timeLine: `목 코스 · 약 ${step.stayMinutes}분`,
      lat,
      lng,
    };
  });
  const legs: RouteLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    legs.push({
      id: uid(),
      mode: 'transit',
      minutes: Math.max(
        8,
        Math.min(45, Math.round((steps[i].stayMinutes + steps[i + 1].stayMinutes) / 3)),
      ),
    });
  }
  return { stops, legs };
}

function syntheticLegMinutes(aId: string, bId: string): number {
  const s = aId + bId;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 3)) % 91;
  return 10 + (h % 35);
}

/** 정류장 순서가 바뀐 뒤, 가능한 구간은 이전 legs의 모드·시간을 유지 */
function rebuildLegsForStops(
  newStops: RouteStop[],
  oldStops: RouteStop[],
  oldLegs: RouteLeg[],
): RouteLeg[] {
  if (newStops.length < 2) return [];
  const out: RouteLeg[] = [];
  for (let i = 0; i < newStops.length - 1; i++) {
    const a = newStops[i].id;
    const b = newStops[i + 1].id;
    let found: RouteLeg | null = null;
    for (let j = 0; j < oldStops.length - 1; j++) {
      if (oldStops[j].id === a && oldStops[j + 1].id === b) {
        found = oldLegs[j] ?? null;
        break;
      }
    }
    out.push(
      found
        ? {
            id: uid(),
            mode: found.mode,
            minutes: found.minutes,
            transitType: found.transitType,
          }
        : {
            id: uid(),
            mode: 'transit' as TransportMode,
            minutes: syntheticLegMinutes(a, b),
          },
    );
  }
  return out;
}

/** 사용자가 좌표를 넣은 정류장만 이음 — 2곳 이상일 때만 지도에 루트 선 표시 */
function buildMapPath(stops: RouteStop[]) {
  const pts: { latitude: number; longitude: number }[] = [];
  for (const s of stops) {
    if (s.lat != null && s.lng != null) {
      pts.push({ latitude: s.lat, longitude: s.lng });
    }
  }
  return pts;
}

function dedupePathPoints(pts: { latitude: number; longitude: number }[]) {
  const out: { latitude: number; longitude: number }[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (
      !last ||
      Math.abs(last.latitude - p.latitude) > 1e-8 ||
      Math.abs(last.longitude - p.longitude) > 1e-8
    ) {
      out.push(p);
    }
  }
  return out;
}

function snapPolylineToEndpoints(
  seg: { latitude: number; longitude: number }[],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  if (seg.length === 0) {
    return [
      { latitude: from.lat, longitude: from.lng },
      { latitude: to.lat, longitude: to.lng },
    ];
  }
  const next = seg.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  next[0] = { latitude: from.lat, longitude: from.lng };
  next[next.length - 1] = { latitude: to.lat, longitude: to.lng };
  return next;
}

function offsetPolylineForLegSeparation(
  points: { latitude: number; longitude: number }[],
  legIndex: number,
  segIndex: number,
) {
  if (points.length < 3) return points;
  const pattern = ((legIndex + segIndex) % 5) - 2; // -2,-1,0,1,2
  if (pattern === 0) return points;
  const amount = pattern * 0.00003;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.longitude - a.longitude;
  const dy = b.latitude - a.latitude;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return points.map((p, idx) => {
    if (idx === 0 || idx === points.length - 1) return p;
    return {
      latitude: p.latitude + ny * amount,
      longitude: p.longitude + nx * amount,
    };
  });
}

function buildModeAwareMapPath(stops: RouteStop[], legs: RouteLeg[]) {
  const validStops = stops.filter((s) => s.lat != null && s.lng != null);
  if (validStops.length < 2) return buildMapPath(stops);
  const out: { latitude: number; longitude: number }[] = [];

  for (let i = 0; i < validStops.length - 1; i++) {
    const a = validStops[i];
    const b = validStops[i + 1];
    const leg = legs[i];
    const start = { latitude: a.lat as number, longitude: a.lng as number };
    const end = { latitude: b.lat as number, longitude: b.lng as number };
    const mid = {
      latitude: (start.latitude + end.latitude) / 2,
      longitude: (start.longitude + end.longitude) / 2,
    };

    const latSpan = end.latitude - start.latitude;
    const lngSpan = end.longitude - start.longitude;
    const len = Math.max(0.0001, Math.hypot(latSpan, lngSpan));
    const normal = { lat: -lngSpan / len, lng: latSpan / len };

    let curve = 0.0008;
    if (leg?.mode === 'walk') curve = 0.0005;
    if (leg?.mode === 'bike') curve = 0.001;
    if (leg?.mode === 'car') curve = 0.00035;
    if (leg?.mode === 'transit') {
      curve =
        leg.transitType === 'bus' ? 0.0013 : leg.transitType === 'train' ? 0.0006 : 0.0009;
    }
    const p1 = {
      latitude: mid.latitude + normal.lat * curve,
      longitude: mid.longitude + normal.lng * curve,
    };
    const p2 = {
      latitude: mid.latitude - normal.lat * curve * 0.6,
      longitude: mid.longitude - normal.lng * curve * 0.6,
    };

    const seg: { latitude: number; longitude: number }[] = [];
    const samples = leg?.mode === 'transit' && leg.transitType === 'bus' ? 9 : 7;
    for (let t = 0; t <= samples; t++) {
      const u = t / samples;
      const one = 1 - u;
      const latitude =
        one * one * one * start.latitude +
        3 * one * one * u * p1.latitude +
        3 * one * u * u * p2.latitude +
        u * u * u * end.latitude;
      const longitude =
        one * one * one * start.longitude +
        3 * one * one * u * p1.longitude +
        3 * one * u * u * p2.longitude +
        u * u * u * end.longitude;
      seg.push({ latitude, longitude });
    }
    if (i === 0) out.push(...seg);
    else out.push(...seg.slice(1));
  }

  return out;
}

const MAP_DEFAULT_LAT = 35.1796;
const MAP_DEFAULT_LNG = 129.0756;
const SEARCH_RADIUS_OPTIONS: Array<{ meters: number | null; label: string }> = [
  { meters: 5000, label: '5km' },
  { meters: 10000, label: '10km' },
  { meters: 15000, label: '15km' },
  { meters: 20000, label: '20km' },
  { meters: 30000, label: '30km' },
  { meters: 50000, label: '50km' },
  { meters: null, label: '무제한' },
];

const VIA_LIFT_MS = 420;
const VIA_CANCEL_MOVE_BEFORE_LIFT_PX = 16;
const VIA_DRAG_START_MOVE_PX = 6;
const VIA_DRAG_EDGE_PX = 72;
const VIA_DRAG_SCROLL_STEP = 16;

type StopLayoutRect = { top: number; bottom: number };

/** 출발 → 경유들 → 도착 블록 사이 중점 Y (콘텐츠 좌표). 길이 = 경유 개수 + 1 */
function computeViaGapMids(
  stops: RouteStop[],
  layouts: Record<string, StopLayoutRect>,
): number[] | null {
  const blocks = [
    stops[0],
    ...stops.filter((s) => s.kind === 'via'),
    stops[stops.length - 1],
  ];
  if (blocks.length < 2) return null;
  const mids: number[] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const la = layouts[blocks[i].id];
    const lb = layouts[blocks[i + 1].id];
    if (!la || !lb) return null;
    mids.push((la.bottom + lb.top) / 2);
  }
  return mids;
}

function fingerContentYToViaSlot(contentY: number, mids: number[]): number {
  if (mids.length === 0) return 0;
  if (contentY < mids[0]) return 0;
  for (let s = 1; s < mids.length; s++) {
    if (contentY < mids[s]) return s;
  }
  return mids.length - 1;
}

function reorderStopsByViaSlot(
  stops: RouteStop[],
  fromViaIndex: number,
  toSlot: number,
): RouteStop[] {
  const vias = stops.filter((s) => s.kind === 'via');
  if (fromViaIndex < 0 || fromViaIndex >= vias.length) return stops;
  const item = vias[fromViaIndex];
  const rest = vias.filter((_, i) => i !== fromViaIndex);
  let ins = toSlot;
  if (toSlot > fromViaIndex) ins = toSlot - 1;
  ins = Math.max(0, Math.min(ins, rest.length));
  const nextVias = [...rest.slice(0, ins), item, ...rest.slice(ins)];
  return [stops[0], ...nextVias, stops[stops.length - 1]];
}

function clampViaGhostLayout(d: {
  ghostPageX: number;
  ghostPageY: number;
  ghostW: number;
  ghostH: number;
}) {
  const winW = Dimensions.get('window').width;
  const winH = Dimensions.get('window').height;
  const gw = Math.max(d.ghostW || 260, 220);
  const gh = Math.max(d.ghostH || 72, 64);
  return {
    left: Math.min(Math.max(10, d.ghostPageX), winW - gw - 10),
    top: Math.min(Math.max(52, d.ghostPageY), winH - gh - 24),
    width: gw,
    minHeight: gh,
  };
}

function parseDistanceLabelToMeters(distanceLabel: string): number {
  const raw = String(distanceLabel ?? '').trim().toLowerCase();
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
  if (raw.includes('km')) return Math.round(n * 1000);
  return Math.round(n);
}

type ViaDragHandleProps = {
  disabled: boolean;
  onLift: () => void;
  onLiftCancel: () => void;
  onDragBegin: (pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: () => void;
  onEdgeScroll: (pageY: number) => void;
};

/** ⋮⋮ 꾹 누르면 리프트 → 움직이면 드래그 (부모가 고스트·삽입선 처리) */
function ViaDragHandle({
  disabled,
  onLift,
  onLiftCancel,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onEdgeScroll,
}: ViaDragHandleProps) {
  const cbRef = useRef({
    onLift,
    onLiftCancel,
    onDragBegin,
    onDragMove,
    onDragEnd,
    onEdgeScroll,
  });
  cbRef.current = {
    onLift,
    onLiftCancel,
    onDragBegin,
    onDragMove,
    onDragEnd,
    onEdgeScroll,
  };

  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<'idle' | 'lift' | 'drag'>('idle');
  const grantTRef = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          phaseRef.current = 'idle';
          grantTRef.current = Date.now();
          if (liftTimerRef.current) clearTimeout(liftTimerRef.current);
          liftTimerRef.current = setTimeout(() => {
            liftTimerRef.current = null;
            phaseRef.current = 'lift';
            cbRef.current.onLift();
          }, VIA_LIFT_MS);
        },
        onPanResponderMove: (e, g) => {
          const dist = Math.hypot(g.dx, g.dy);
          const age = Date.now() - grantTRef.current;

          if (phaseRef.current === 'drag') {
            const px = e.nativeEvent.pageX;
            const py = e.nativeEvent.pageY;
            cbRef.current.onDragMove(px, py);
            cbRef.current.onEdgeScroll(py);
            return;
          }

          if (phaseRef.current === 'idle') {
            if (liftTimerRef.current && age < VIA_LIFT_MS && dist > VIA_CANCEL_MOVE_BEFORE_LIFT_PX) {
              clearTimeout(liftTimerRef.current);
              liftTimerRef.current = null;
            }
            return;
          }

          if (phaseRef.current === 'lift' && dist > VIA_DRAG_START_MOVE_PX) {
            phaseRef.current = 'drag';
            cbRef.current.onDragBegin(e.nativeEvent.pageX, e.nativeEvent.pageY);
          }
        },
        onPanResponderRelease: () => {
          if (liftTimerRef.current) {
            clearTimeout(liftTimerRef.current);
            liftTimerRef.current = null;
          }
          if (phaseRef.current === 'drag') cbRef.current.onDragEnd();
          else if (phaseRef.current === 'lift') cbRef.current.onLiftCancel();
          phaseRef.current = 'idle';
        },
        onPanResponderTerminate: () => {
          if (liftTimerRef.current) {
            clearTimeout(liftTimerRef.current);
            liftTimerRef.current = null;
          }
          if (phaseRef.current === 'drag') cbRef.current.onDragEnd();
          else if (phaseRef.current === 'lift') cbRef.current.onLiftCancel();
          phaseRef.current = 'idle';
        },
      }),
    [disabled],
  );

  return (
    <View
      {...pan.panHandlers}
      className="p-1"
      accessibilityLabel="길게 눌러 순서 변경"
      accessibilityHint="길게 누른 뒤 위아래로 드래그하세요"
    >
      <Ionicons name="reorder-three" size={24} color={disabled ? '#e2e8f0' : '#94a3b8'} />
    </View>
  );
}

export default function RouteCreateScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { upsertUserRoute, getUserRoute } = useMockData();

  const [stops, setStops] = useState<RouteStop[]>(() => ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })));

  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [persistedRouteId, setPersistedRouteId] = useState<string | null>(null);

  const itineraryScrollRef = useRef<ScrollView>(null);
  const itineraryListViewportRef = useRef<View>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const stopLayoutsRef = useRef<Record<string, StopLayoutRect>>({});
  const stopRowRefs = useRef<Record<string, View | null>>({});
  const stopsRef = useRef(stops);
  const legsRef = useRef(legs);
  stopsRef.current = stops;
  legsRef.current = legs;

  type ViaDragOverlay =
    | null
    | {
        phase: 'lift' | 'drag';
        viaId: string;
        fromViaIndex: number;
        insertSlot: number;
        insertLineY: number;
        ghostPageX: number;
        ghostPageY: number;
        ghostW: number;
        ghostH: number;
        grabOffsetX: number;
        grabOffsetY: number;
        previewTitle: string;
      };

  const [viaDrag, setViaDrag] = useState<ViaDragOverlay>(null);
  const viaDragRef = useRef<ViaDragOverlay>(null);
  viaDragRef.current = viaDrag;
  const viaDragRafRef = useRef<number | null>(null);
  const viaDragPendingRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const liftMetaRef = useRef({ viaId: '', from: 0, title: '' });
  const dragMetricsRef = useRef({ grabX: 36, grabY: 32 });
  const viaDragCommitLockRef = useRef(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MockPlace[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTransitType, setSelectedTransitType] = useState<TransitType>('subway');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [searchTargetStopId, setSearchTargetStopId] = useState<string | null>(null);
  const [searchSort, setSearchSort] = useState<KakaoKeywordSort>('accuracy');
  const [searchCategoryCode, setSearchCategoryCode] = useState('');
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number | null>(15000);
  const [currentSearchCenter, setCurrentSearchCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchCenterSource, setSearchCenterSource] = useState<'user' | 'route' | null>(null);
  const [mapRoutePath, setMapRoutePath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [mapRouteSegments, setMapRouteSegments] = useState<MapRouteSegment[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState(ROUTE_CREATE_INITIAL_CHAT);

  const [activity, setActivity] = useState<string[]>([
    '협업 세션 · 변경 사항은 저장 시 함께 반영됩니다.',
  ]);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [routeTitle, setRouteTitle] = useState('새 루트');
  const [editingLegId, setEditingLegId] = useState<string | null>(null);

  const isCollaborative = useMemo(() => {
    if (route.params?.collaborative === true) return true;
    const eid = route.params?.editRouteId as string | undefined;
    if (eid) {
      const r = getUserRoute(eid);
      if (r?.collaborative === true) return true;
    }
    return false;
  }, [route.params?.collaborative, route.params?.editRouteId, getUserRoute]);

  useFocusEffect(
    useCallback(() => {
      const editId = route.params?.editRouteId as string | undefined;
      const seedMockId = route.params?.seedMockCourseId as string | undefined;
      const collab =
        route.params?.collaborative === true ||
        (editId ? getUserRoute(editId)?.collaborative === true : false);
      if (editId) {
        const r = getUserRoute(editId);
        if (r) {
          setPersistedRouteId(r.id);
          setRouteTitle(r.title);
          setStops(r.stops.map((s) => ({ ...s })));
          setLegs(
            r.legs.map((l) => ({
              id: l.id,
              mode: normalizeLegMode(l.mode),
              minutes: l.minutes,
              transitType:
                normalizeLegMode(l.mode) === 'transit'
                  ? ((l as any).transitType ?? 'subway')
                  : undefined,
              directionsSummary: l.directionsSummary,
              directionsDetail: l.directionsDetail,
              distanceMeters: l.distanceMeters,
            })),
          );
          setActivity([
            collab ? '공동 수정 루트를 불러왔습니다.' : '저장된 개인 루트를 불러왔습니다.',
          ]);
          setChatMessages(collab ? ROUTE_CREATE_INITIAL_CHAT : []);
          return;
        }
      }
      if (seedMockId) {
        const c = MOCK_COURSES.find((x) => x.id === seedMockId);
        if (c) {
          const { stops: nextStops, legs: nextLegs } = seedRouteFromMockCourse(c);
          setPersistedRouteId(null);
          setRouteTitle(c.title);
          setStops(nextStops);
          setLegs(nextLegs);
          setActivity([
            '공유 루트에서 가져온 코스입니다. 수정 후 저장하면 내 루트에 새로 추가됩니다.',
          ]);
          setChatMessages([]);
          return;
        }
      }
      setPersistedRouteId(null);
      setRouteTitle('새 루트');
      setStops(ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })));
      setLegs([]);
      setActivity([
        collab
          ? '협업 세션 · 변경 사항은 저장 시 함께 반영됩니다.'
          : '개인 루트입니다. 변경 사항은 저장 시 목 데이터에만 반영됩니다.',
      ]);
      setChatMessages(collab ? ROUTE_CREATE_INITIAL_CHAT : []);
    }, [
      route.params?.collaborative,
      route.params?.editRouteId,
      route.params?.seedMockCourseId,
      getUserRoute,
    ]),
  );

  /** 거리순 정렬 기준: 현재 루트에 찍힌 정류장들의 무게중심 (없으면 거리순 비활성) */
  const searchMapCenter = useMemo(() => {
    const coords = stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
    if (coords.length === 0) return null;
    const lat = coords.reduce((a, c) => a + c.lat, 0) / coords.length;
    const lng = coords.reduce((a, c) => a + c.lng, 0) / coords.length;
    return { latitude: lat, longitude: lng };
  }, [stops]);

  const effectiveSearchCenter = currentSearchCenter ?? searchMapCenter;
  const canUseDistanceSort = effectiveSearchCenter != null;

  const selectedPlace = selectedPlaceId
    ? searchResults.find((p) => p.id === selectedPlaceId) ?? null
    : null;

  const mapPath = useMemo(() => buildModeAwareMapPath(stops, legs), [stops, legs]);
  const pathStopsForMap = useMemo(() => buildMapPath(stops), [stops]);
  const mapMarkers = useMemo<MapMarkerPoint[]>(
    () =>
      stops
        .filter((s) => s.lat != null && s.lng != null)
        .map((s, i) => ({
          latitude: s.lat as number,
          longitude: s.lng as number,
          label: `${i + 1}`,
        })),
    [stops],
  );

  /** 좌표·이동수단이 바뀔 때만 Directions 재호출 (응답으로 갱신되는 minutes/summary는 제외) */
  const directionsRouteKey = useMemo(
    () =>
      `${stops.length}|${stops.map((s) => `${s.lat ?? ''},${s.lng ?? ''}`).join('|')}@@${legs.length}|${legs.map((l) => `${l.mode}:${l.transitType ?? ''}`).join('|')}`,
    [stops, legs],
  );

  const viaStops = useMemo(() => stops.filter((s) => s.kind === 'via'), [stops]);
  const totalMinutes = useMemo(() => legs.reduce((sum, l) => sum + l.minutes, 0), [legs]);

  const showAddButton = Boolean(selectedPlace);

  const openSearch = useCallback((targetStopId?: string) => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSelectedPlaceId(null);
    setSelectedTransitType('subway');
    setSearchTargetStopId(typeof targetStopId === 'string' ? targetStopId : null);
    setSearchSort('accuracy');
    setSearchCategoryCode('');
    setSearchRadiusMeters(15000);
    setCurrentSearchCenter(null);
    setSearchCenterSource(null);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSelectedPlaceId(null);
    setSelectedTransitType('subway');
    setSearchTargetStopId(null);
    setSearchSort('accuracy');
    setSearchCategoryCode('');
    setSearchRadiusMeters(15000);
    setCurrentSearchCenter(null);
    setSearchCenterSource(null);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    const loadCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 60_000,
        });
        if (cancelled) return;
        setCurrentSearchCenter({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch {
        if (!cancelled) setCurrentSearchCenter(null);
      }
    };
    loadCurrentLocation();
    return () => {
      cancelled = true;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (currentSearchCenter) {
      setSearchCenterSource('user');
      return;
    }
    if (searchMapCenter) {
      setSearchCenterSource('route');
      return;
    }
    setSearchCenterSource(null);
  }, [currentSearchCenter, searchMapCenter]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    const categoryFallbackQuery =
      searchCategoryCode && !q
        ? KAKAO_KEYWORD_CATEGORY_OPTIONS.find((x) => x.code === searchCategoryCode)?.label ?? ''
        : '';
    const effectiveQuery = q || categoryFallbackQuery;
    if (!effectiveQuery) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const effectiveSort =
          searchSort === 'distance' && !canUseDistanceSort ? 'accuracy' : searchSort;
        const rows = await searchKakaoPlacesByKeyword(effectiveQuery, {
          signal: controller.signal,
          sort: effectiveSort,
          center: effectiveSort === 'distance' ? effectiveSearchCenter ?? undefined : undefined,
          radiusMeters: searchRadiusMeters == null ? undefined : Math.min(searchRadiusMeters, 20000),
          categoryGroupCode: searchCategoryCode || undefined,
        });
        setSearchResults(rows);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(e?.message ?? '장소 검색 중 오류가 발생했습니다.');
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [
    searchOpen,
    searchQuery,
    searchCategoryCode,
    searchSort,
    searchRadiusMeters,
    effectiveSearchCenter,
    canUseDistanceSort,
  ]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      const stopsSnap = stopsRef.current;
      const legsSnap = legsRef.current;
      const fallbackPath = buildModeAwareMapPath(stopsSnap, legsSnap);

      const canUseRealRoute = stopsSnap.length >= 2 && legsSnap.length >= 1;
      if (!canUseRealRoute) {
        if (!cancelled) setMapRoutePath(fallbackPath);
        if (!cancelled) {
          setMapRouteSegments(
            fallbackPath.length >= 2
              ? [{ id: 'fallback-all', points: fallbackPath, color: RIDE_SEGMENT_COLOR, width: 5 }]
              : [],
          );
        }
        return;
      }

      try {
        const results = await Promise.all(
          stopsSnap.slice(0, -1).map(async (s, i) => {
            const e = stopsSnap[i + 1];
            /** 정류장보다 leg가 짧으면 마지막 구간 모드로 채움 (없으면 Directions 스킵되어 직선만 남음) */
            const leg = legsSnap[i] ?? legsSnap[legsSnap.length - 1];
            if (!s || !e || !leg || s.lat == null || s.lng == null || e.lat == null || e.lng == null) {
              return null;
            }
            const modeMap: Record<TransportMode, DirectionsMode> = {
              walk: 'walking',
              bike: 'bicycling',
              car: 'driving',
              transit: 'transit',
            };
            try {
              const r = await fetchGoogleDirectionsLeg({
                from: { latitude: s.lat, longitude: s.lng },
                to: { latitude: e.lat, longitude: e.lng },
                mode: modeMap[leg.mode],
                transitType: leg.mode === 'transit' ? leg.transitType : undefined,
                signal: controller.signal,
              });
              const path = snapPolylineToEndpoints(
                r.path,
                { lat: s.lat, lng: s.lng },
                { lat: e.lat, lng: e.lng },
              );
              const rawSegs = Array.isArray(r.segments) && r.segments.length >= 1
                ? r.segments
                : [{ mode: leg.mode === 'walk' ? 'walk' : 'ride', points: path }];
              const segs = rawSegs
                .map((seg, segIdx) => {
                  const basePts = seg.points?.length >= 2 ? seg.points : path;
                  if (!basePts || basePts.length < 2) return null;
                  const pts = basePts.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
                  if (segIdx === 0) pts[0] = { latitude: s.lat as number, longitude: s.lng as number };
                  if (segIdx === rawSegs.length - 1)
                    pts[pts.length - 1] = { latitude: e.lat as number, longitude: e.lng as number };
                  const isTransitInnerWalk = leg.mode === 'transit' && seg.mode === 'walk';
                  const walkVisual = isTransitInnerWalk;
                  const shiftedPts = offsetPolylineForLegSeparation(pts, i, segIdx);
                  return {
                    id: `leg-${i}-seg-${segIdx}`,
                    points: shiftedPts,
                    color: walkVisual ? WALK_SEGMENT_COLOR : RIDE_SEGMENT_COLOR,
                    width: walkVisual ? 4 : 5,
                    dashed: walkVisual,
                  } as MapRouteSegment;
                })
                .filter(Boolean) as MapRouteSegment[];
              const transitChain = rawSegs
                .filter((x) => x.mode === 'ride' && typeof x.lineLabel === 'string' && x.lineLabel.trim() !== '')
                .map((x) => String(x.lineLabel).trim());
              const summaryCore = transitChain.length > 0 ? transitChain.join(' => ') : r.summary;
              const providerPrefix =
                r.source === 'tmap' ? 'Tmap · ' : r.source === 'kakao' ? 'Kakao · ' : '';
              const summary =
                providerPrefix && !summaryCore.startsWith(providerPrefix)
                  ? `${providerPrefix}${summaryCore}`
                  : summaryCore;
              if (__DEV__) {
                console.log(
                  `[Directions] leg ${i} OK mode=${leg.mode} provider=${r.source ?? 'google'} pathPoints=${path.length} mapSegs=${segs.length}`,
                );
              }
              if (leg.mode === 'walk' && path.length <= 2) {
                console.warn(
                  `[Directions] leg ${i} 도보: 서버 폴리라인이 거의 없어 직선에 가깝게 보일 수 있음 (pathPoints=${path.length})`,
                );
              }
              return {
                path,
                segments: segs,
                durationMinutes: r.durationMinutes,
                summary,
                detail: r.detail,
                distanceMeters: r.distanceMeters,
              };
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              const aborted =
                (e instanceof Error && e.name === 'AbortError') ||
                msg === 'Aborted' ||
                /abort/i.test(msg);
              if (!aborted) {
                console.warn(`[Directions] leg ${i} (${leg.mode}) 실패:`, msg);
              }
              return null;
            }
          }),
        );

        const merged: { latitude: number; longitude: number }[] = [];
        const mergedSegments: MapRouteSegment[] = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const s = stopsSnap[i];
          const e = stopsSnap[i + 1];
          let seg: { latitude: number; longitude: number }[] = [];
          if (r?.path && r.path.length >= 2) {
            seg = r.path;
          } else if (
            s?.lat != null &&
            s?.lng != null &&
            e?.lat != null &&
            e?.lng != null
          ) {
            seg = [
              { latitude: s.lat, longitude: s.lng },
              { latitude: e.lat, longitude: e.lng },
            ];
          }
          if (seg.length < 2) continue;
          if (merged.length === 0) merged.push(...seg);
          else merged.push(...seg.slice(1));
          if (r?.segments && r.segments.length >= 1) mergedSegments.push(...r.segments);
          else {
            mergedSegments.push({
              id: `fallback-${i}`,
              points: offsetPolylineForLegSeparation(seg, i, 0),
              color: RIDE_SEGMENT_COLOR,
              width: 5,
            });
          }
        }
        const cleaned = dedupePathPoints(merged);

        if (cancelled) return;
        setMapRoutePath(cleaned.length > 0 ? cleaned : fallbackPath);
        setMapRouteSegments(mergedSegments);
        setLegs((prev) => {
          if (prev.length !== results.length) return prev;
          return prev.map((leg, i) => {
            const r = results[i];
            if (!r) return leg;
            return {
              ...leg,
              minutes: r.durationMinutes,
              directionsSummary: r.summary,
              directionsDetail: r.detail,
              distanceMeters: r.distanceMeters,
            };
          });
        });
      } catch {
        if (!cancelled) {
          const fb = buildModeAwareMapPath(stopsRef.current, legsRef.current);
          setMapRoutePath(fb);
          setMapRouteSegments(
            fb.length >= 2 ? [{ id: 'fallback-catch', points: fb, color: RIDE_SEGMENT_COLOR, width: 5 }] : [],
          );
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [directionsRouteKey]);

  const pushActivity = useCallback((line: string) => {
    setActivity((a) => [line, ...a].slice(0, 8));
  }, []);

  const handleViaLift = useCallback((viaId: string, fromViaIndex: number, previewTitle: string) => {
    viaDragCommitLockRef.current = false;
    liftMetaRef.current = { viaId, from: fromViaIndex, title: previewTitle };
    const mids = computeViaGapMids(stopsRef.current, stopLayoutsRef.current);
    const lineY = mids ? mids[Math.min(fromViaIndex, mids.length - 1)] : 0;
    setViaDrag({
      phase: 'lift',
      viaId,
      fromViaIndex,
      insertSlot: fromViaIndex,
      insertLineY: lineY,
      ghostPageX: 0,
      ghostPageY: 0,
      ghostW: 0,
      ghostH: 0,
      grabOffsetX: 0,
      grabOffsetY: 0,
      previewTitle: previewTitle,
    });
  }, []);

  const handleViaLiftCancel = useCallback(() => {
    viaDragCommitLockRef.current = false;
    setViaDrag(null);
  }, []);

  const handleViaDragBegin = useCallback((pageX: number, pageY: number) => {
    viaDragCommitLockRef.current = false;
    const { viaId } = liftMetaRef.current;
    const row = stopRowRefs.current[viaId];
    const winW = Dimensions.get('window').width;
    const apply = (x: number, y: number, w: number, h: number) => {
      const gx = Math.max(0, Math.min(w, pageX - x));
      const gy = Math.max(0, Math.min(h, pageY - y));
      dragMetricsRef.current = { grabX: gx, grabY: gy };
      setViaDrag((prev) =>
        prev && prev.viaId === viaId
          ? {
              ...prev,
              phase: 'drag',
              ghostW: w,
              ghostH: h,
              ghostPageX: pageX - gx,
              ghostPageY: pageY - gy,
              grabOffsetX: gx,
              grabOffsetY: gy,
            }
          : prev,
      );
    };
    if (row && typeof row.measureInWindow === 'function') {
      row.measureInWindow((x, y, w, h) => {
        if (w < 8 || h < 8) apply(pageX - 140, pageY - 40, Math.min(320, winW - 40), 78);
        else apply(x, y, w, h);
      });
    } else {
      apply(pageX - 140, pageY - 40, Math.min(320, winW - 40), 78);
    }
  }, []);

  const flushViaDragMove = useCallback((pageX: number, pageY: number) => {
    if (viaDragRef.current?.phase !== 'drag') return;
    const mids = computeViaGapMids(stopsRef.current, stopLayoutsRef.current);
    if (!mids) return;
    itineraryListViewportRef.current?.measureInWindow((_vx, vy) => {
      const contentY = scrollOffsetYRef.current + (pageY - vy);
      const slot = fingerContentYToViaSlot(contentY, mids);
      const lineY = mids[Math.min(slot, mids.length - 1)];
      const { grabX, grabY } = dragMetricsRef.current;
      setViaDrag((p) =>
        p && p.phase === 'drag'
          ? {
              ...p,
              ghostPageX: pageX - grabX,
              ghostPageY: pageY - grabY,
              insertSlot: slot,
              insertLineY: lineY,
            }
          : p,
      );
    });
  }, []);

  const scheduleViaDragMove = useCallback(
    (pageX: number, pageY: number) => {
      viaDragPendingRef.current = { pageX, pageY };
      if (viaDragRafRef.current != null) return;
      viaDragRafRef.current = requestAnimationFrame(() => {
        viaDragRafRef.current = null;
        const pending = viaDragPendingRef.current;
        if (pending) flushViaDragMove(pending.pageX, pending.pageY);
      });
    },
    [flushViaDragMove],
  );

  const handleViaEdgeScroll = useCallback((pageY: number) => {
    const scrollRef = itineraryScrollRef.current;
    if (!scrollRef) return;
    itineraryListViewportRef.current?.measureInWindow((_x, winY, _w, winH) => {
      const maxY = Math.max(0, scrollContentHeightRef.current - scrollViewHeightRef.current);
      if (pageY < winY + VIA_DRAG_EDGE_PX) {
        const next = Math.max(0, scrollOffsetYRef.current - VIA_DRAG_SCROLL_STEP);
        scrollRef.scrollTo({ y: next, animated: false });
        scrollOffsetYRef.current = next;
      } else if (pageY > winY + winH - VIA_DRAG_EDGE_PX) {
        const next = Math.min(maxY, scrollOffsetYRef.current + VIA_DRAG_SCROLL_STEP);
        scrollRef.scrollTo({ y: next, animated: false });
        scrollOffsetYRef.current = next;
      }
    });
  }, []);

  const handleViaDragEnd = useCallback(() => {
    if (viaDragCommitLockRef.current) return;
    viaDragCommitLockRef.current = true;
    const snap = viaDragRef.current;
    setViaDrag(null);
    if (snap?.phase !== 'drag') {
      viaDragCommitLockRef.current = false;
      return;
    }
    const oldStops = stopsRef.current;
    const newStops = reorderStopsByViaSlot(oldStops, snap.fromViaIndex, snap.insertSlot);
    const changed = newStops.some((s, i) => s.id !== oldStops[i]?.id);
    if (changed) {
      setStops(newStops);
      setLegs(rebuildLegsForStops(newStops, oldStops, legsRef.current));
      pushActivity('경유 순서를 변경했습니다.');
    }
    requestAnimationFrame(() => {
      viaDragCommitLockRef.current = false;
    });
  }, [pushActivity]);

  const addStopToRoute = useCallback(() => {
    if (!selectedPlace) return;
    const selectedMode: TransportMode = 'transit';
    const m = estimateMinutes(selectedMode, selectedPlace.id);

    if (searchTargetStopId) {
      const target = stops.find((s) => s.id === searchTargetStopId);
      if (!target) {
        closeSearch();
        return;
      }
      const targetTitle = target.kind === 'start' ? '출발지' : target.kind === 'end' ? '도착지' : '경유지';
      const timeLine = target.kind === 'via' ? '경유지' : '';

      setStops((prev) =>
        prev.map((s) =>
          s.id === searchTargetStopId
            ? {
                ...s,
                title: selectedPlace.name,
                timeLine,
                lat: selectedPlace.latitude,
                lng: selectedPlace.longitude,
              }
            : s,
        ),
      );
      if (target.kind === 'start') {
        setLegs((prev) =>
          prev.length > 0
            ? [
                {
                  ...prev[0],
                  mode: selectedMode,
                  minutes: m,
                  transitType: selectedMode === 'transit' ? selectedTransitType : undefined,
                },
                ...prev.slice(1),
              ]
            : prev,
        );
      } else if (target.kind === 'end') {
        setLegs((prev) =>
          prev.length > 0
            ? [
                ...prev.slice(0, -1),
                {
                  ...prev[prev.length - 1],
                  mode: selectedMode,
                  minutes: m,
                  transitType: selectedMode === 'transit' ? selectedTransitType : undefined,
                },
              ]
            : prev,
        );
      }
      pushActivity(`${targetTitle}를 "${selectedPlace.name}"(으)로 변경했습니다.`);
      closeSearch();
      return;
    }

    const startFilled = stops[0]?.lat != null && stops[0]?.lng != null;
    const endFilled = stops[stops.length - 1]?.lat != null && stops[stops.length - 1]?.lng != null;

    if (!startFilled) {
      setStops((prev) => {
        if (prev.length < 2) return prev;
        const [, ...rest] = prev;
        const newStart: RouteStop = {
          ...prev[0],
          title: selectedPlace.name,
          timeLine: '',
          lat: selectedPlace.latitude,
          lng: selectedPlace.longitude,
        };
        return [newStart, ...rest];
      });
      setLegs([]);
      pushActivity(`출발지를 "${selectedPlace.name}"(으)로 설정했습니다.`);
      closeSearch();
      return;
    }

    if (!endFilled) {
      setStops((prev) => {
        if (prev.length < 2) return prev;
        const end = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          {
            ...end,
            title: selectedPlace.name,
            timeLine: '',
            lat: selectedPlace.latitude,
            lng: selectedPlace.longitude,
          },
        ];
      });
      setLegs([
        {
          id: uid(),
          mode: selectedMode,
          minutes: m,
          transitType: selectedMode === 'transit' ? selectedTransitType : undefined,
        },
      ]);
      pushActivity(`도착지를 "${selectedPlace.name}"(으)로 설정했습니다.`);
      closeSearch();
      return;
    }

    setStops((prev) => {
      if (prev.length < 2) return prev;
      const end = prev[prev.length - 1];
      const middle = prev.slice(0, -1);
      const newVia: RouteStop = {
        id: uid(),
        kind: 'via',
        title: selectedPlace.name,
        timeLine: '경유지',
        lat: selectedPlace.latitude,
        lng: selectedPlace.longitude,
      };
      return [...middle, newVia, end];
    });

    setLegs((prev) => {
      const mm = estimateMinutes(selectedMode, selectedPlace.id);
      if (prev.length === 0) {
        return [{ id: uid(), mode: selectedMode, minutes: mm }];
      }
      const last = prev[prev.length - 1];
      const firstHalf = Math.max(5, Math.round(last.minutes * 0.45));
      const secondHalf = Math.max(5, last.minutes - firstHalf);
      return [
        ...prev.slice(0, -1),
        {
          id: uid(),
          mode: selectedMode,
          minutes: firstHalf,
          transitType: selectedMode === 'transit' ? selectedTransitType : undefined,
        },
        {
          id: uid(),
          mode: selectedMode,
          minutes: secondHalf,
          transitType: selectedMode === 'transit' ? selectedTransitType : undefined,
        },
      ];
    });

    pushActivity(
      isCollaborative
        ? `${MOCK_COLLABORATORS[0].name}님이 경유지 "${selectedPlace.name}"을(를) 추가했습니다.`
        : `경유지 "${selectedPlace.name}"을(를) 추가했습니다.`,
    );
    closeSearch();
  }, [selectedPlace, searchTargetStopId, selectedTransitType, closeSearch, pushActivity, stops, isCollaborative]);

  const removeStop = (id: string) => {
    const idx = stops.findIndex((s) => s.id === id);
    if (idx <= 0 || idx >= stops.length - 1) {
      Alert.alert('알림', '출발·도착지는 삭제할 수 없습니다. 경유지만 삭제할 수 있어요.');
      return;
    }
    const target = stops[idx];
    const label = target.title || '이 경유지';
    Alert.alert('경유지 삭제', `"${label}"을(를) 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setStops((prev) => prev.filter((s) => s.id !== id));
          setLegs((prev) => {
            const i = idx - 1;
            if (i < 0 || i + 1 >= prev.length) return prev.slice(0, -1);
            const a = prev[i];
            const b = prev[i + 1];
            const merged: RouteLeg = {
              id: uid(),
              mode: a.mode,
              minutes: Math.max(5, a.minutes + b.minutes),
              transitType: a.mode === 'transit' ? a.transitType : undefined,
            };
            return [...prev.slice(0, i), merged, ...prev.slice(i + 2)];
          });
          pushActivity('경유지가 삭제되었습니다.');
        },
      },
    ]);
  };

  const editStop = (stop: RouteStop) => {
    if (stop.kind === 'start' || stop.kind === 'end') {
      openSearch(stop.id);
      return;
    }
    if (stop.lat == null || stop.lng == null) {
      openSearch();
      return;
    }
    setEditTitle(stop.title);
    setEditingStop(stop);
  };

  const applyEditTitle = () => {
    if (!editingStop) return;
    const t = editTitle.trim();
    if (!t) {
      setEditingStop(null);
      return;
    }
    const prevTitle = editingStop.title;
    setStops((prev) =>
      prev.map((s) => (s.id === editingStop.id ? { ...s, title: t } : s)),
    );
    pushActivity(`"${prevTitle}" 이름이 수정되었습니다.`);
    setEditingStop(null);
  };

  const sendChat = () => {
    if (!isCollaborative) return;
    const t = chatInput.trim();
    if (!t) return;
    setChatMessages((m) => [
      ...m,
      { id: uid(), from: 'me', name: '나', text: t, at: Date.now() },
    ]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages((m) => [
        ...m,
        {
          id: uid(),
          from: 'other',
          name: MOCK_COLLABORATORS[2].name,
          text: '확인했어요!',
          at: Date.now(),
        },
      ]);
    }, 1200);
  };

  const saveRoute = () => {
    if (stops[0]?.lat == null || stops[stops.length - 1]?.lat == null) {
      Alert.alert(
        '루트 미완성',
        '출발지와 도착지를 검색에서 교통수단과 함께 모두 설정한 뒤 저장할 수 있어요.',
      );
      return;
    }
    const title = routeTitle.trim() || '새 루트';
    const now = new Date().toISOString();
    const id = persistedRouteId ?? `ur-${uid()}`;
    const prev = getUserRoute(id);
    upsertUserRoute({
      id,
      title,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      collaborative: isCollaborative,
      stops: stops.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        timeLine: s.timeLine,
        lat: s.lat,
        lng: s.lng,
      })),
      legs: legs.map((l) => ({
        id: l.id,
        mode: l.mode,
        minutes: l.minutes,
        transitType: l.transitType,
        directionsSummary: l.directionsSummary,
        directionsDetail: l.directionsDetail,
        distanceMeters: l.distanceMeters,
      })),
    });
    setPersistedRouteId(id);
    Alert.alert(
      '저장됨 (목 데이터)',
      `"${title}"\n경유 ${Math.max(0, stops.length - 2)}곳 · 구간 ${legs.length}개 · 총 ${totalMinutes}분\n내 루트 탭에서 확인·수정할 수 있어요.`,
      [{ text: '확인', onPress: () => navigation.goBack() }],
    );
  };

  const updateLegMode = useCallback((legId: string, mode: TransportMode) => {
    setLegs((prev) =>
      prev.map((l) =>
        l.id === legId
          ? {
              ...l,
              mode,
              transitType: mode === 'transit' ? l.transitType ?? 'subway' : undefined,
              directionsSummary: undefined,
              directionsDetail: undefined,
              distanceMeters: undefined,
            }
          : l,
      ),
    );
    setEditingLegId(null);
    pushActivity(`이동 수단을 ${TRANSPORT_LABELS[mode]}(으)로 변경했습니다.`);
  }, [pushActivity]);

  const updateLegTransitType = useCallback((legId: string, transitType: TransitType) => {
    setLegs((prev) =>
      prev.map((l) =>
        l.id === legId && l.mode === 'transit'
          ? {
              ...l,
              transitType,
              directionsSummary: undefined,
              directionsDetail: undefined,
              distanceMeters: undefined,
            }
          : l,
      ),
    );
    pushActivity(`대중교통 유형을 ${TRANSIT_TYPE_LABELS[transitType]}(으)로 변경했습니다.`);
  }, [pushActivity]);

  const renderStopBadge = (kind: RouteStop['kind']) => {
    if (kind === 'start')
      return (
        <View className="rounded-md bg-green-600 px-2 py-0.5">
          <Text className="text-[11px] font-bold text-white">출발</Text>
        </View>
      );
    if (kind === 'end')
      return (
        <View className="rounded-md bg-red-500 px-2 py-0.5">
          <Text className="text-[11px] font-bold text-white">도착</Text>
        </View>
      );
    return (
      <View className="rounded-md bg-gray-400 px-2 py-0.5">
        <Text className="text-[11px] font-bold text-white">경유</Text>
      </View>
    );
  };

  const renderTimelineDot = (stop: RouteStop) => {
    if (stop.kind === 'start')
      return (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-green-600">
          <Text className="text-xs font-bold text-white">P</Text>
        </View>
      );
    if (stop.kind === 'end')
      return (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500">
          <Text className="text-[10px] font-bold text-white">P</Text>
        </View>
      );
    const vn = viaStops.findIndex((v) => v.id === stop.id) + 1;
    return (
      <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-300">
        <Text className="text-xs font-semibold text-gray-700">{vn}</Text>
      </View>
    );
  };

  /** 1개: 마커만, 2개 이상: 선 + 마커 (웹: 카카오 JS / 네이티브: expo-maps) */
  const mapPathProp = mapRoutePath.length >= 1 ? mapRoutePath : undefined;

  /** 하단 시트 둥근 모서리 뒤로 지도가 비치도록 살짝 겹침 (rounded-t-3xl ≈ 24px) */
  const ROUTE_SHEET_TOP_OVERLAP = 24;

  return (
    <View className="flex-1" style={{ backgroundColor: '#4b5563' }}>
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]} pointerEvents="auto">
        <AppMapView
          style={{ flex: 1 }}
          latitude={mapRoutePath[0]?.latitude ?? mapPath[0]?.latitude ?? MAP_DEFAULT_LAT}
          longitude={mapRoutePath[0]?.longitude ?? mapPath[0]?.longitude ?? MAP_DEFAULT_LNG}
          level={mapRoutePath.length >= 2 ? 6 : 8}
          path={mapPathProp}
          segments={mapRouteSegments}
          stops={pathStopsForMap.length >= 1 ? pathStopsForMap : undefined}
          markers={mapMarkers}
        />
      </View>

      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, zIndex: 1, pointerEvents: 'box-none' }}
      >
        <View className="flex-row items-center gap-2 px-3 pt-1" pointerEvents="box-none">
          <Pressable
            onPress={() => navigation.goBack()}
            className="z-10 h-11 w-11 items-center justify-center rounded-full bg-white shadow-md active:opacity-90"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#f97316" />
          </Pressable>

          <Pressable
            onPress={() => openSearch()}
            className="flex-1 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-md active:opacity-95"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              minHeight: 50,
            }}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
          >
            <Text className="flex-1 text-[15px] text-gray-400">
              주소나 카테고리를 검색해보세요!
            </Text>
            <Ionicons name="search-outline" size={22} color="#6b7280" />
          </Pressable>
        </View>

        <View style={{ flex: 2, minHeight: 120 }} pointerEvents="none" />

        <View
          className="rounded-t-3xl border-t border-gray-200 bg-white"
          style={{
            flex: 1,
            minHeight: 260,
            marginTop: -ROUTE_SHEET_TOP_OVERLAP,
            paddingBottom: Math.max(insets.bottom, 12),
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 20,
          }}
        >
        <View className="flex-row items-center border-b border-gray-50 px-4 pt-3 pb-2">
          <TextInput
            value={routeTitle}
            onChangeText={setRouteTitle}
            placeholder="루트 이름 입력"
            placeholderTextColor="#9ca3af"
            className="flex-1 text-[17px] font-bold text-gray-900"
            maxLength={30}
          />
          <Text className="ml-2 text-xs font-medium text-gray-400">
            총 {totalMinutes}분
          </Text>
        </View>

        <View className="flex-row items-center border-b border-gray-100 px-3 py-2.5">
          <View className="min-w-0 flex-1 flex-row items-center">
            {isCollaborative ? (
              <View className="flex-row items-center">
                {MOCK_COLLABORATORS.map((c, i) => (
                  <Image
                    key={c.id}
                    accessibilityLabel={`${c.name} 참여 중`}
                    source={{
                      uri: `https://i.pravatar.cc/96?u=${encodeURIComponent(c.id)}`,
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 2.5,
                      borderColor: '#ffffff',
                      marginLeft: i === 0 ? 0 : -12,
                    }}
                  />
                ))}
              </View>
            ) : (
              <Text className="text-xs font-medium text-gray-500">개인 루트</Text>
            )}
          </View>
          <View className="flex-row gap-2">
            {isCollaborative ? (
              <Pressable
                onPress={() => setChatOpen(true)}
                className="rounded-xl bg-orange-500 px-3.5 py-2 active:opacity-90"
              >
                <Text className="text-sm font-bold text-white">채팅</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={saveRoute}
              className="rounded-xl bg-green-600 px-3.5 py-2 active:opacity-90"
            >
              <Text className="text-sm font-bold text-white">저장</Text>
            </Pressable>
          </View>
        </View>

        <View ref={itineraryListViewportRef} className="flex-1" collapsable={false}>
          <ScrollView
            ref={itineraryScrollRef}
            className="flex-1 px-3"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
            }}
            onContentSizeChange={(_, h) => {
              scrollContentHeightRef.current = h;
            }}
            onLayout={(e) => {
              scrollViewHeightRef.current = e.nativeEvent.layout.height;
            }}
            contentContainerStyle={{ paddingBottom: 16, position: 'relative' }}
          >
          {activity.length > 0 && (
            <Text className="py-2 text-center text-[10px] text-gray-400" numberOfLines={2}>
              {activity[0]}
            </Text>
          )}

          {stops.map((stop, index) => {
            const isDragRow = viaDrag != null && viaDrag.viaId === stop.id;
            const cardOpacity = isDragRow ? (viaDrag.phase === 'lift' ? 0.4 : 0.18) : 1;
            const viaIdx = viaStops.findIndex((v) => v.id === stop.id);
            return (
              <View
                key={stop.id}
                ref={(r) => {
                  stopRowRefs.current[stop.id] = r;
                }}
                collapsable={false}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  stopLayoutsRef.current[stop.id] = { top: y, bottom: y + height };
                }}
              >
                <View className="flex-row">
                  <View className="w-10 items-center">
                    {index > 0 ? (
                      <View style={{ width: 3, height: 8, backgroundColor: '#2563eb', opacity: 0.75 }} />
                    ) : null}
                    {renderTimelineDot(stop)}
                    {index < stops.length - 1 ? (
                      <View
                        style={{
                          width: 3,
                          flex: 1,
                          minHeight: 20,
                          backgroundColor: '#2563eb',
                          opacity: 0.75,
                        }}
                      />
                    ) : null}
                  </View>

                  <View
                    className="mb-2 ml-2 flex-1 rounded-xl border border-gray-100 bg-gray-50/80 p-3"
                    style={{
                      opacity: cardOpacity,
                      borderStyle: isDragRow ? 'dashed' : 'solid',
                      borderColor: isDragRow ? '#60a5fa' : undefined,
                      borderWidth: isDragRow ? 2 : 1,
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 flex-row flex-wrap items-center gap-2">
                        {renderStopBadge(stop.kind)}
                        <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
                          {stop.title}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-0.5">
                        <Pressable onPress={() => editStop(stop)} hitSlop={6}>
                          <Ionicons name="pencil-outline" size={18} color="#6b7280" />
                        </Pressable>
                        {stop.kind === 'via' ? (
                          <Pressable onPress={() => removeStop(stop.id)} hitSlop={6}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </Pressable>
                        ) : null}
                        {stop.kind === 'via' ? (
                          <ViaDragHandle
                            disabled={viaStops.length < 1}
                            onLift={() => handleViaLift(stop.id, viaIdx, stop.title)}
                            onLiftCancel={handleViaLiftCancel}
                            onDragBegin={handleViaDragBegin}
                            onDragMove={scheduleViaDragMove}
                            onDragEnd={handleViaDragEnd}
                            onEdgeScroll={handleViaEdgeScroll}
                          />
                        ) : (
                          <View className="w-8" />
                        )}
                      </View>
                    </View>
                    {stop.kind === 'end' ? (
                      <Text className="mt-1 text-xs font-semibold text-blue-800">
                        총 예상 소요 {totalMinutes}분
                      </Text>
                    ) : stop.kind === 'via' ? (
                      <Text className="mt-1 text-xs text-gray-500">{stop.timeLine}</Text>
                    ) : null}
                  </View>
                </View>

                {index < stops.length - 1 && legs[index] && (
                  <Pressable
                    onPress={() => setEditingLegId(legs[index].id)}
                    className="ml-12 mb-2 py-1 pl-2 active:opacity-70"
                    style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(37, 99, 235, 0.35)' }}
                  >
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name={transportIcon(legs[index].mode) as any}
                        size={18}
                        color="#2563eb"
                      />
                      <Text className="ml-2 flex-1 text-xs font-medium text-blue-900/80">
                        {legTransportLabel(legs[index].mode, legs[index].transitType)} 수정
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color="#94a3b8" style={{ marginLeft: 4 }} />
                    </View>
                    {legs[index].directionsSummary ? (
                      <Text className="mt-0.5 pl-7 text-[11px] leading-4 text-slate-600" numberOfLines={2}>
                        {legs[index].directionsSummary}
                      </Text>
                    ) : null}
                  </Pressable>
                )}
              </View>
            );
          })}

          {viaDrag && (viaDrag.phase === 'lift' || viaDrag.phase === 'drag') ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 44,
                right: 12,
                top: Math.max(0, viaDrag.insertLineY - 2),
                height: 4,
                borderRadius: 2,
                backgroundColor: '#2563eb',
                zIndex: 20,
                shadowColor: '#2563eb',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.45,
                shadowRadius: 4,
                elevation: 4,
              }}
            />
          ) : null}
          </ScrollView>
        </View>
      </View>
      </SafeAreaView>

      <Modal visible={viaDrag?.phase === 'drag'} transparent animationType="none" statusBarTranslucent>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {viaDrag?.phase === 'drag' ? (
            <View
              style={{
                position: 'absolute',
                ...clampViaGhostLayout(viaDrag),
                opacity: 0.94,
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 2,
                borderColor: '#2563eb',
                paddingHorizontal: 12,
                paddingVertical: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.22,
                shadowRadius: 14,
                elevation: 16,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View className="rounded-md bg-gray-400 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-white">경유</Text>
                </View>
                <Text className="flex-1 text-sm font-bold text-gray-900" numberOfLines={2}>
                  {viaDrag.previewTitle}
                </Text>
              </View>
              <Text className="mt-1.5 text-[10px] leading-4 text-gray-500">
                파란 선 위치에 끼워 넣습니다 · 손을 떼면 확정
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={searchOpen} animationType="slide" onRequestClose={closeSearch}>
        <SafeAreaView className="flex-1 bg-[#f5f5f9]" edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              className="flex-row items-center gap-2 border-b border-gray-200 px-3 py-2"
              style={{ marginTop: 14 }}
            >
              <Pressable
                onPress={closeSearch}
                className="h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-80"
              >
                <Ionicons name="chevron-back" size={22} color="#f97316" />
              </Pressable>
              <View className="flex-1 flex-row items-center rounded-2xl bg-white px-3 py-2.5">
                <TextInput
                  value={searchQuery}
                  onChangeText={(t) => {
                    setSearchQuery(t);
                    setSelectedPlaceId(null);
                  }}
                  placeholder="장소 이름·주소 검색"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-base text-gray-900"
                  autoFocus
                  returnKeyType="search"
                />
                <Ionicons name="search-outline" size={22} color="#6b7280" />
              </View>
            </View>

            <View className="border-b border-gray-100 bg-white px-3 py-2.5">
              <Text className="mb-1 text-[11px] font-bold text-gray-800">검색 옵션</Text>
              <Text className="mb-2 text-[10px] leading-4 text-gray-500">
                카카오 키워드 검색 기준입니다. 정렬·반경·업종을 바꾸면 자동으로 다시 검색합니다.
              </Text>
              <Text className="mb-1 text-[10px] font-semibold text-gray-600">정렬</Text>
              <View className="mb-2 flex-row gap-2">
                <Pressable
                  onPress={() => setSearchSort('accuracy')}
                  className={`rounded-lg border px-3 py-1.5 ${
                    searchSort === 'accuracy' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${searchSort === 'accuracy' ? 'text-sky-800' : 'text-gray-700'}`}
                  >
                    정확도순
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!canUseDistanceSort}
                  onPress={() => setSearchSort('distance')}
                  className={`rounded-lg border px-3 py-1.5 ${
                    searchSort === 'distance' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-gray-50'
                  } ${!canUseDistanceSort ? 'opacity-40' : ''}`}
                >
                  <Text
                    className={`text-[11px] font-bold ${searchSort === 'distance' ? 'text-sky-800' : 'text-gray-700'}`}
                  >
                    거리순
                  </Text>
                </Pressable>
              </View>
              {searchSort === 'distance' && canUseDistanceSort ? (
                <View className="mb-2">
                  <Text className="mb-1 text-[10px] font-semibold text-gray-600">기준점 주변 반경</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {SEARCH_RADIUS_OPTIONS.map(({ meters, label }) => (
                      <Pressable
                        key={label}
                        onPress={() => setSearchRadiusMeters(meters)}
                        className={`rounded-lg border px-2.5 py-1 ${
                          searchRadiusMeters === meters
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            searchRadiusMeters === meters ? 'text-amber-900' : 'text-gray-700'
                          }`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="mt-1 text-[10px] text-gray-500">
                    30km 이상/무제한은 카카오 API 특성상 넓은 범위 정확도 기반으로 결과가 반환될 수 있어요.
                  </Text>
                </View>
              ) : null}
              <Text className="mb-1 text-[10px] font-semibold text-gray-600">업종 필터</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {KAKAO_KEYWORD_CATEGORY_OPTIONS.map((opt) => {
                  const on = searchCategoryCode === opt.code;
                  return (
                    <Pressable
                      key={opt.code || 'all'}
                      onPress={() => setSearchCategoryCode(opt.code)}
                      className={`rounded-full border px-3 py-1.5 ${
                        on ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-gray-100'
                      }`}
                    >
                      <Text className={`text-[11px] font-semibold ${on ? 'text-sky-800' : 'text-gray-700'}`}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {!canUseDistanceSort ? (
                <Text className="mt-2 text-[10px] leading-4 text-amber-900">
                  거리순은 현재 위치 권한 허용 또는 루트 좌표(출발/도착) 설정 후 사용할 수 있습니다.
                </Text>
              ) : null}
              {canUseDistanceSort ? (
                <Text className="mt-2 text-[10px] leading-4 text-slate-600">
                  기준점: {searchCenterSource === 'user' ? '현재 사용자 위치' : '루트 정류장 중심점'}
                </Text>
              ) : null}
            </View>

            <ScrollView className="flex-1 px-3" keyboardShouldPersistTaps="handled">
              <>
                  <Text className="mb-2 px-1 text-sm font-bold text-gray-800">
                    검색결과
                  </Text>
                  {searchLoading ? (
                    <Text className="py-8 text-center text-sm text-gray-500">검색 중...</Text>
                  ) : searchError ? (
                    <Text className="py-8 text-center text-sm text-rose-500">{searchError}</Text>
                  ) : searchResults.length === 0 ? (
                    <Text className="py-8 text-center text-sm text-gray-500">
                      {searchQuery.trim() === ''
                        ? '필터나 검색을 통해 찾아보세요!'
                        : '검색 결과가 없습니다. 필터나 다른 키워드로 찾아보세요!'}
                    </Text>
                  ) : (
                    searchResults.map((p) => {
                      const expanded = selectedPlaceId === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPlaceId(p.id)}
                          className={`mb-2 overflow-hidden rounded-xl border bg-white active:opacity-95 ${
                            expanded ? 'border-sky-500' : 'border-gray-200'
                          }`}
                        >
                          <View className="flex-row items-center p-3">
                            <View className="flex-1">
                              <Text className="text-base font-semibold text-gray-900">{p.name}</Text>
                              {p.category ? (
                                <Text className="text-[10px] font-medium text-sky-700" numberOfLines={1}>
                                  {p.category}
                                </Text>
                              ) : null}
                              <Text className="text-xs text-gray-500">{p.distance}</Text>
                              <Text className="text-xs text-gray-400" numberOfLines={2}>
                                {p.address}
                              </Text>
                            </View>
                            <Ionicons name="add-circle-outline" size={26} color="#3b82f6" />
                          </View>
                          {expanded && (
                            <View className="border-t border-gray-100 bg-gray-50 px-3 py-3">
                              <Text className="text-center text-sm text-gray-700">
                                선택하신 {TRANSPORT_LABELS.transit}(으)로 이동 시 약{' '}
                                {estimateMinutes('transit', p.id)}분
                              </Text>
                            </View>
                          )}
                          {expanded && showAddButton && selectedPlaceId === p.id && (
                            <Pressable
                              onPress={addStopToRoute}
                              className="items-center border-t border-gray-200 bg-white py-3.5 active:bg-gray-50"
                            >
                              <Text className="text-base font-bold text-gray-900">
                                {searchTargetStopId ? '이 위치로 변경' : '경로에 추가'}
                              </Text>
                            </Pressable>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={chatOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={() => setChatOpen(false)} />
          <View
            className="max-h-[70%] rounded-t-3xl bg-white"
            style={{ paddingBottom: insets.bottom }}
          >
            <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
              <Text className="text-lg font-bold text-gray-900">루트 협업 채팅</Text>
              <Pressable onPress={() => setChatOpen(false)}>
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>
            <Text className="border-b border-gray-50 bg-sky-50 px-4 py-2 text-center text-[11px] text-sky-900">
              같은 루트를 편집 중인 멤버와 실시간으로 조율할 수 있어요. (목업 · 서버 연동 전)
            </Text>
            <ScrollView className="max-h-80 px-3 py-2">
              {chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  className={`mb-2 rounded-xl px-3 py-2 ${
                    msg.from === 'me' ? 'self-end bg-sky-100' : 'self-start bg-gray-100'
                  }`}
                  style={{ alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}
                >
                  <Text className="text-[10px] font-semibold text-gray-500">{msg.name}</Text>
                  <Text className="text-sm text-gray-900">{msg.text}</Text>
                </View>
              ))}
            </ScrollView>
            <View className="flex-row items-center gap-2 border-t border-gray-100 px-3 py-2">
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="메시지 입력..."
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base"
                onSubmitEditing={sendChat}
              />
              <Pressable
                onPress={sendChat}
                className="rounded-xl bg-orange-500 px-4 py-2.5 active:opacity-90"
              >
                <Text className="font-bold text-white">전송</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingLegId} transparent animationType="fade">
        <View className="flex-1 justify-center px-6">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            className="bg-black/40"
            onPress={() => setEditingLegId(null)}
          />
          <View className="max-h-[85%] rounded-2xl bg-white p-5" style={{ zIndex: 1 }}>
            <Text className="mb-3 text-lg font-bold text-gray-900">이동 수단 변경</Text>
            {(() => {
              const leg = legs.find((l) => l.id === editingLegId);
              if (!leg?.directionsDetail) return null;
              return (
                <ScrollView
                  className="mb-3 max-h-40 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  nestedScrollEnabled
                >
                  <Text className="text-xs leading-5 text-slate-700">{leg.directionsDetail}</Text>
                </ScrollView>
              );
            })()}
            {(Object.keys(TRANSPORT_LABELS) as TransportMode[]).map((mode) => {
              const leg = legs.find((l) => l.id === editingLegId);
              const isSelected = leg?.mode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => editingLegId && updateLegMode(editingLegId, mode)}
                  className={`mb-2 flex-row items-center rounded-xl border-2 px-4 py-3 active:opacity-90 ${
                    isSelected ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <MaterialCommunityIcons
                    name={transportIcon(mode) as any}
                    size={22}
                    color={isSelected ? '#0284c7' : '#6b7280'}
                  />
                  <Text
                    className={`ml-3 text-base font-semibold ${
                      isSelected ? 'text-sky-700' : 'text-gray-700'
                    }`}
                  >
                    {TRANSPORT_LABELS[mode]}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#0284c7" style={{ marginLeft: 'auto' }} />
                  )}
                </Pressable>
              );
            })}
            {(() => {
              const leg = legs.find((l) => l.id === editingLegId);
              if (!leg || leg.mode !== 'transit') return null;
              return (
                <View className="mt-2">
                  <Text className="mb-2 text-sm font-semibold text-gray-800">대중교통 종류</Text>
                  <View className="flex-row gap-2">
                    {(Object.keys(TRANSIT_TYPE_LABELS) as TransitType[]).map((tt) => {
                      const on = (leg.transitType ?? 'subway') === tt;
                      return (
                        <Pressable
                          key={tt}
                          onPress={() => editingLegId && updateLegTransitType(editingLegId, tt)}
                          className={`flex-1 items-center rounded-xl border px-3 py-2.5 ${
                            on ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <Text className={`text-sm font-semibold ${on ? 'text-sky-700' : 'text-gray-700'}`}>
                            {TRANSIT_TYPE_LABELS[tt]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingStop} transparent animationType="fade">
        <View className="flex-1 justify-center px-6">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            className="bg-black/40"
            onPress={() => setEditingStop(null)}
          />
          <View className="rounded-2xl bg-white p-5" style={{ zIndex: 1 }}>
            <Text className="text-lg font-bold text-gray-900">장소 이름</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              className="mt-3 rounded-xl border border-gray-200 px-3 py-3 text-base text-gray-900"
              placeholder="표시할 이름"
              autoFocus
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable
                onPress={() => setEditingStop(null)}
                className="rounded-xl px-4 py-2.5 active:opacity-70"
              >
                <Text className="font-semibold text-gray-600">취소</Text>
              </Pressable>
              <Pressable
                onPress={applyEditTitle}
                className="rounded-xl bg-gray-900 px-4 py-2.5 active:opacity-90"
              >
                <Text className="font-semibold text-white">저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
