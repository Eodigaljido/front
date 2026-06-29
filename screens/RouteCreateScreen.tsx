// @ts-nocheck
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
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
  ActivityIndicator,
  Image,
  PanResponder,
  Dimensions,
  useWindowDimensions,
  Switch,
  AppState,
} from "react-native";
import { appAlert } from "../utils/appAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AppMapView from "../components/AppMapView";
import type { MapRouteSegment } from "../components/mapTypes";
import { buildMapMarkersFromRouteStops } from "../utils/spreadMapMarkers";
import { formatOverallDurationLabel } from "../utils/formatOverallDurationLabel";
import { useMockData } from "../context/MockDataContext";
import { useToast } from "../context/ToastContext";
import {
  TRANSPORT_LABELS,
  type TransportMode,
  type MockPlace,
  estimateMinutes,
} from "../data/routeCreateMocks";
import {
  hasCollaboratorPeers,
  isEffectivelyCollaborativeRoute,
  type RouteMember,
} from "../data/collaborativeRoute";
import { useCollaborativeRouteMembers } from "../hooks/useCollaborativeRouteMembers";
import { useCollaborativeRoutePresence } from "../hooks/useCollaborativeRoutePresence";
import { useCollaborativeRouteEntry } from "../hooks/useCollaborativeRouteEntry";
import {
  patchMyRouteWithVersion,
  sendCoursePresenceHeartbeat,
  type CollaborativeAccess,
} from "../api/collaborativeCourse";
import type { UpsertMyRoutePayload } from "../api/courses";
import { rootNavigate, safeGoBack } from "../navigation/rootNavigation";
import CollaboratorAvatarStack from "../components/CollaboratorAvatarStack";
import { CollaborativeFriendInviteModal } from "../components/CollaborativeFriendInviteModal";
import { RouteCollaborativeChatSheet } from "../components/RouteCollaborativeChatSheet";
import { presentCollaborativeShareOptions } from "../utils/shareCollaborativeRoute";
import { useAuthStore } from "../store/authStore";
import {
  linkRouteToGroupChat,
  linkCourseChatRoomForShare,
  inviteFriendsToRouteChat,
  buildRouteGroupChatName,
  promptCreateCourseChatRoom,
} from "../data/routeCollaborativeChat";
import {
  searchKakaoPlacesByKeyword,
  KAKAO_KEYWORD_CATEGORY_OPTIONS,
  type KakaoKeywordSort,
} from "../data/kakaoLocalApi";
import {
  fetchGoogleDirectionsLeg,
  fetchBicycleDirectionsLeg,
  fetchWalkingRouteAlternatives,
  fetchTransitRouteAlternatives,
  type DirectionsMode,
  type WalkRouteCandidate,
  type TransitRouteCandidate,
} from "../data/googleDirectionsApi";
import {
  buildStyledMapSegments,
  directionsSegmentsToMapSegments,
  sortMapSegmentsForRender,
} from "../utils/mapRouteSegmentStyle";
import {
  ROUTE_USER_MESSAGES,
  sanitizeRouteDisplayText,
  toUserFacingErrorMessage,
} from "../utils/routeCopy";
import {
  buildUpsertPayloadFromUserRoute,
  createMyRoute,
  fetchMyRouteCollaborativeFlag,
  fetchMySharingCourseIds,
  fetchSharedCourseDetail,
  fetchMyCourseDetail,
  forkSharedCourseToPersonalRoute,
  hasMeaningfulRouteSteps,
  resolveCourseDetailForRoute,
  resolvePersonalRouteIdForForkSave,
  setMyCoursePublic,
  updateMyRoute,
  syncMyCourseThumbnailToServer,
} from "../api/courses";
import {
  isLocalThumbnailUri,
  resolveCourseThumbnailForDisplay,
} from "../utils/courseThumbnailUri";
import type { CourseItem } from "../data/mockData";
import {
  findPersonalRouteIdForForkSource,
  type UserSavedRoute,
} from "../data/userSavedRoute";
import { MAX_ROUTE_TAGS, ROUTE_TAG_PRESETS } from "../data/routeTags";
import { getCourseStepMapPoint } from "../data/mockData";
import { sameCourseId } from "../utils/sameCourseId";
import {
  forkOriginAuthorFromCourse,
  resolveForkOriginForSave,
} from "../utils/enrichForkOriginAuthor";
import { shouldPreferApiRouteOverLocal } from "../utils/routeStopRichness";
import { useCollaborativeRouteSync } from "../hooks/useCollaborativeRouteSync";
import { useRouteEditorAutoSave } from "../hooks/useRouteEditorAutoSave";

const COLLAB_PATCH_MAX_RETRIES = 3;

type EditorAuthorCredits = Pick<
  CourseItem,
  "authorUuid" | "authorUserId" | "modifierUuid" | "modifierUserId"
>;

type RouteStop = {
  id: string;
  kind: "start" | "via" | "end";
  title: string;
  /** 장소 검색·지도에서 받은 원래 이름 */
  originalTitle?: string;
  timeLine: string;
  lat?: number;
  lng?: number;
};

function stopOriginalTitleHint(stop: RouteStop): string | null {
  const orig = String(stop.originalTitle ?? "").trim();
  const title = String(stop.title ?? "").trim();
  if (!orig || orig === title) return null;
  if (stop.lat == null || stop.lng == null) return null;
  return orig;
}

function withPlaceFromSearch(
  stop: RouteStop,
  placeName: string,
  patch: Partial<RouteStop>,
): RouteStop {
  const name = String(placeName).trim();
  return {
    ...stop,
    ...patch,
    title: name,
    originalTitle: name,
  };
}

function routeStopToPersist(s: RouteStop) {
  const orig = String(s.originalTitle ?? "").trim();
  const title = String(s.title ?? "").trim();
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    timeLine: s.timeLine,
    lat: s.lat,
    lng: s.lng,
    ...(orig && orig !== title ? { originalTitle: orig } : {}),
  };
}

type RouteLeg = {
  id: string;
  mode: TransportMode;
  minutes: number;
  transitType?: "bus" | "subway" | "train";
  directionsSummary?: string;
  directionsDetail?: string;
  distanceMeters?: number;
  /** 도보 구간 — 가장 가까운 도보 경로 1개 */
  walkCandidates?: WalkRouteCandidate[];
  selectedWalkCandidateId?: string;
  /** 대중교통 구간 — 노선·출발·도착 시각 후보 */
  transitCandidates?: TransitRouteCandidate[];
  selectedTransitCandidateId?: string;
};

type LegDirectionResult = {
  path: { latitude: number; longitude: number }[];
  segments: MapRouteSegment[];
  durationMinutes: number;
  summary: string;
  detail: string;
  distanceMeters?: number;
  walkCandidates?: WalkRouteCandidate[];
  transitCandidates?: TransitRouteCandidate[];
};

const WALK_SEGMENT_COLOR = "#f59e0b";
const RIDE_SEGMENT_COLOR = "#2563eb";

function mapSegmentsFromDirectionLeg(
  legIndex: number,
  leg: RouteLeg | undefined,
  rawSegs: Array<{
    mode: "walk" | "ride";
    points: { latitude: number; longitude: number }[];
    lineLabel?: string;
    vehicleType?: string;
  }>,
  fallbackPath: { latitude: number; longitude: number }[],
): MapRouteSegment[] {
  const legMode = leg?.mode ?? "walk";
  if (rawSegs.length >= 1) {
    return sortMapSegmentsForRender(
      directionsSegmentsToMapSegments(
        rawSegs,
        legIndex,
        legMode,
        leg?.transitType,
      ),
    );
  }
  if (fallbackPath.length < 2) return [];
  return sortMapSegmentsForRender(
    buildStyledMapSegments({
      idPrefix: `leg-${legIndex}-path`,
      points: fallbackPath,
      legMode,
      transitType: leg?.transitType,
    }),
  );
}

/** 내 루트 수정(editRouteId) 화면에서만 하단 패널 높이 저장 */
const ROUTE_EDIT_SHEET_HEIGHT_STORAGE_KEY = "ROUTE_CREATE_EDIT_SHEET_HEIGHT_PX";

const ROUTE_CREATE_EMPTY_STOPS: RouteStop[] = [
  {
    id: "s0",
    kind: "start",
    title: "출발지를 검색해 추가하세요",
    timeLine: "교통수단 + 장소를 함께 선택",
  },
  {
    id: "s-end",
    kind: "end",
    title: "도착지를 검색해 추가하세요",
    timeLine: "교통수단 + 장소를 함께 선택",
  },
];

function normalizeLegMode(m: string): TransportMode {
  return (
    ["walk", "transit", "car", "bike"].includes(m) ? m : "walk"
  ) as TransportMode;
}

function transportIcon(mode: TransportMode): string {
  const m: Record<TransportMode, string> = {
    walk: "walk",
    transit: "bus",
    car: "car",
    bike: "bicycle",
  };
  return m[mode];
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TRANSIT_TYPE_LABELS = {
  bus: "버스",
  subway: "지하철",
  train: "기차",
} as const;
const DEFAULT_PLACE_SEARCH_QUERY = "맛집";

type TransitType = keyof typeof TRANSIT_TYPE_LABELS;

function legTransportLabel(
  mode: TransportMode,
  transitType?: TransitType,
): string {
  if (mode !== "transit") return TRANSPORT_LABELS[mode];
  return transitType
    ? `대중교통(${TRANSIT_TYPE_LABELS[transitType]})`
    : TRANSPORT_LABELS.transit;
}

/** 새 구간·장소 추가 시 기본 이동수단 — 도보(보도) */
function pickFastestModeByKey(_placeKey: string): TransportMode {
  return "walk";
}

/** 공유 루트 목 코스 → 루트 제작 정류장/구간 (저장 시 새 내 루트로 추가) */
/** API 코스 상세 → 루트 제작 정류장/구간 */
function courseItemToRouteStops(course: CourseItem): {
  stops: RouteStop[];
  legs: RouteLeg[];
} {
  const steps = course.routeSteps;
  if (steps.length === 0) {
    return { stops: ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })), legs: [] };
  }
  if (steps.length === 1) {
    const s = steps[0];
    const { lat, lng } =
      s.lat != null && s.lng != null
        ? { lat: s.lat, lng: s.lng }
        : getCourseStepMapPoint(course.id, 0);
    const placeName = String(s.name).trim();
    const stops: RouteStop[] = [
      {
        id: `seed-${uid()}-s`,
        kind: "start",
        title: placeName,
        originalTitle: placeName,
        timeLine: `목 코스 · 약 ${s.stayMinutes}분`,
        lat,
        lng,
      },
      {
        id: `seed-${uid()}-e`,
        kind: "end",
        title: placeName,
        originalTitle: placeName,
        timeLine: "도착",
        lat,
        lng,
      },
    ];
    return {
      stops,
      legs: [
        {
          id: uid(),
          mode: "walk",
          minutes: Math.max(5, Math.min(40, s.stayMinutes)),
        },
      ],
    };
  }
  const stops: RouteStop[] = steps.map((step, index) => {
    const { lat, lng } =
      step.lat != null && step.lng != null
        ? { lat: step.lat, lng: step.lng }
        : getCourseStepMapPoint(course.id, index, steps.length);
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const kind = isFirst ? "start" : isLast ? "end" : "via";
    const placeName = String(step.name).trim();
    const orig = String(step.originalTitle ?? "").trim() || placeName;
    return {
      id: `seed-${step.id}`,
      kind,
      title: placeName,
      originalTitle: orig,
      timeLine: `목 코스 · 약 ${step.stayMinutes}분`,
      lat,
      lng,
    };
  });
  const legs: RouteLeg[] = [];
  const existingLegs = Array.isArray((course as any).routeLegs)
    ? (course as any).routeLegs
    : [];
  for (let i = 0; i < stops.length - 1; i++) {
    const existing = existingLegs[i];
    const stepKey = `${course.id}-${steps[i]?.id ?? i}-${steps[i + 1]?.id ?? i + 1}`;
    const autoMode = pickFastestModeByKey(stepKey);
    const nextMode: TransportMode =
      existing?.mode === "walk" ||
      existing?.mode === "car" ||
      existing?.mode === "bike" ||
      existing?.mode === "transit"
        ? existing.mode
        : autoMode;
    legs.push({
      id: uid(),
      mode: nextMode,
      minutes: Math.max(
        5,
        Number(
          existing?.minutes ??
            Math.min(
              45,
              Math.max(
                8,
                Math.round(
                  (steps[i].stayMinutes + steps[i + 1].stayMinutes) / 3,
                ),
              ),
            ),
        ),
      ),
      transitType:
        nextMode === "transit"
          ? (existing?.transitType ?? "subway")
          : undefined,
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

function buildWalkPickSegments(
  legIndex: number,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  path: { latitude: number; longitude: number }[],
): MapRouteSegment[] {
  const pts = snapPolylineToEndpoints(path, from, to).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));
  if (pts.length < 2) return [];
  return sortMapSegmentsForRender(
    buildStyledMapSegments({
      idPrefix: `leg-${legIndex}-walk-pick`,
      points: offsetPolylineForLegSeparation(pts, legIndex, 0),
      legMode: "walk",
      isWalkSegment: true,
    }),
  );
}

function buildTransitPickSegments(
  legIndex: number,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  candidate: TransitRouteCandidate,
  transitType?: TransitType,
): MapRouteSegment[] {
  const path = snapPolylineToEndpoints(candidate.path, from, to);
  const rawSegs =
    candidate.segments?.length >= 1
      ? candidate.segments
      : [{ mode: "ride" as const, points: path }];
  const normalized = rawSegs
    .map((seg, segIdx) => {
      const basePts = seg.points?.length >= 2 ? seg.points : path;
      if (!basePts || basePts.length < 2) return null;
      const pts = basePts.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));
      if (segIdx === 0) pts[0] = { latitude: from.lat, longitude: from.lng };
      if (segIdx === rawSegs.length - 1) {
        pts[pts.length - 1] = { latitude: to.lat, longitude: to.lng };
      }
      return {
        mode: seg.mode,
        points: offsetPolylineForLegSeparation(pts, legIndex, segIdx),
        lineLabel: seg.lineLabel,
        vehicleType: seg.vehicleType,
      };
    })
    .filter(Boolean) as Array<{
    mode: "walk" | "ride";
    points: { latitude: number; longitude: number }[];
    lineLabel?: string;
    vehicleType?: string;
  }>;
  return mapSegmentsFromDirectionLeg(
    legIndex,
    { mode: "transit", transitType } as RouteLeg,
    normalized,
    path,
  );
}

function resolveLegDirectionResult(
  legIndex: number,
  leg: RouteLeg | undefined,
  s: RouteStop | undefined,
  e: RouteStop | undefined,
  r: LegDirectionResult | null,
): LegDirectionResult | null {
  if (
    !r ||
    !leg ||
    s?.lat == null ||
    s?.lng == null ||
    e?.lat == null ||
    e?.lng == null
  ) {
    return r;
  }
  const from = { lat: s.lat, lng: s.lng };
  const to = { lat: e.lat, lng: e.lng };

  if (leg.mode === "walk" && r.walkCandidates?.length) {
    const pick =
      r.walkCandidates.find((c) => c.id === leg.selectedWalkCandidateId) ??
      r.walkCandidates[0];
    const path = snapPolylineToEndpoints(pick.path, from, to);
    return {
      ...r,
      path,
      segments: buildWalkPickSegments(legIndex, from, to, path),
      durationMinutes: pick.durationMinutes,
      summary: pick.summary,
      detail: pick.detail,
      distanceMeters: pick.distanceMeters,
      walkCandidates: r.walkCandidates,
    };
  }

  if (leg.mode === "transit" && r.transitCandidates?.length) {
    const pick =
      r.transitCandidates.find(
        (c) => c.id === leg.selectedTransitCandidateId,
      ) ?? r.transitCandidates[0];
    const path = snapPolylineToEndpoints(pick.path, from, to);
    return {
      ...r,
      path,
      segments: buildTransitPickSegments(
        legIndex,
        from,
        to,
        pick,
        leg.transitType,
      ),
      durationMinutes: pick.durationMinutes,
      summary: pick.summary,
      detail: pick.detail,
      distanceMeters: pick.distanceMeters,
      transitCandidates: r.transitCandidates,
    };
  }

  return r;
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
            mode: pickFastestModeByKey(`${a}->${b}`),
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
  const next = seg.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));
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
    if (leg?.mode === "walk") curve = 0.0005;
    if (leg?.mode === "bike") curve = 0.001;
    if (leg?.mode === "car") curve = 0.00035;
    if (leg?.mode === "transit") {
      curve =
        leg.transitType === "bus"
          ? 0.0013
          : leg.transitType === "train"
            ? 0.0006
            : 0.0009;
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
    const samples =
      leg?.mode === "transit" && leg.transitType === "bus" ? 9 : 7;
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
  { meters: 5000, label: "5km" },
  { meters: 10000, label: "10km" },
  { meters: 15000, label: "15km" },
  { meters: 20000, label: "20km" },
  { meters: 30000, label: "30km" },
  { meters: 50000, label: "50km" },
  { meters: null, label: "무제한" },
];

const VIA_LIFT_MS = 420;
const VIA_CANCEL_MOVE_BEFORE_LIFT_PX = 14;
const VIA_DRAG_START_MOVE_PX = 12;
const VIA_DRAG_EDGE_PX = 52;
const VIA_DRAG_SCROLL_STEP = 8;
const VIA_DRAG_SCROLL_INTERVAL_MS = 48;

type StopLayoutRect = { top: number; bottom: number };

/** 출발 → 경유들 → 도착 블록 사이 중점 Y (콘텐츠 좌표). 길이 = 경유 개수 + 1 */
function computeViaGapMids(
  stops: RouteStop[],
  layouts: Record<string, StopLayoutRect>,
): number[] | null {
  const blocks = [
    stops[0],
    ...stops.filter((s) => s.kind === "via"),
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
  const vias = stops.filter((s) => s.kind === "via");
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
  const winW = Dimensions.get("window").width;
  const winH = Dimensions.get("window").height;
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
  const raw = String(distanceLabel ?? "")
    .trim()
    .toLowerCase();
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
  if (raw.includes("km")) return Math.round(n * 1000);
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
  const phaseRef = useRef<"idle" | "lift" | "drag">("idle");
  const grantTRef = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => phaseRef.current === "idle",
        onPanResponderGrant: () => {
          phaseRef.current = "idle";
          grantTRef.current = Date.now();
          if (liftTimerRef.current) clearTimeout(liftTimerRef.current);
          liftTimerRef.current = setTimeout(() => {
            liftTimerRef.current = null;
            phaseRef.current = "lift";
            cbRef.current.onLift();
          }, VIA_LIFT_MS);
        },
        onPanResponderMove: (e, g) => {
          const dist = Math.hypot(g.dx, g.dy);
          const age = Date.now() - grantTRef.current;

          if (phaseRef.current === "drag") {
            const px = e.nativeEvent.pageX;
            const py = e.nativeEvent.pageY;
            cbRef.current.onDragMove(px, py);
            cbRef.current.onEdgeScroll(py);
            return;
          }

          if (phaseRef.current === "idle") {
            if (
              liftTimerRef.current &&
              age < VIA_LIFT_MS &&
              dist > VIA_CANCEL_MOVE_BEFORE_LIFT_PX
            ) {
              clearTimeout(liftTimerRef.current);
              liftTimerRef.current = null;
            }
            return;
          }

          if (phaseRef.current === "lift" && dist > VIA_DRAG_START_MOVE_PX) {
            phaseRef.current = "drag";
            cbRef.current.onDragBegin(e.nativeEvent.pageX, e.nativeEvent.pageY);
          }
        },
        onPanResponderRelease: () => {
          if (liftTimerRef.current) {
            clearTimeout(liftTimerRef.current);
            liftTimerRef.current = null;
          }
          if (phaseRef.current === "drag") cbRef.current.onDragEnd();
          else if (phaseRef.current === "lift") cbRef.current.onLiftCancel();
          phaseRef.current = "idle";
        },
        onPanResponderTerminate: () => {
          if (liftTimerRef.current) {
            clearTimeout(liftTimerRef.current);
            liftTimerRef.current = null;
          }
          if (phaseRef.current === "drag") cbRef.current.onDragEnd();
          else if (phaseRef.current === "lift") cbRef.current.onLiftCancel();
          phaseRef.current = "idle";
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
      <Ionicons
        name="reorder-three"
        size={24}
        color={disabled ? "#e2e8f0" : "#94a3b8"}
      />
    </View>
  );
}

export default function RouteCreateScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const editRouteIdParam = route.params?.editRouteId as string | undefined;
  const isCollaborativeLinkEntry =
    route.params?.collaborative === true && Boolean(editRouteIdParam);
  const isEditingMyRoute = Boolean(editRouteIdParam);
  const clampRouteSheetHeight = useCallback(
    (px: number) => {
      // 최소 높이는 루트 대표이미지/제목 영역이 보이는 수준으로 유지
      const minH = Math.max(120, Math.round(windowH * 0.14));
      const maxH = Math.round(windowH * 0.94);
      return Math.min(Math.max(Math.round(px), minH), maxH);
    },
    [windowH],
  );
  const [routeSheetHeightPx, setRouteSheetHeightPx] = useState(() => {
    const h = Dimensions.get("window").height;
    const minH = Math.max(120, Math.round(h * 0.14));
    const maxH = Math.round(h * 0.94);
    const v = Math.round(h * (isEditingMyRoute ? 0.5 : 0.52));
    return Math.min(Math.max(v, minH), maxH);
  });
  const sheetHeightRef = useRef(routeSheetHeightPx);
  sheetHeightRef.current = routeSheetHeightPx;
  const sheetPanStartRef = useRef(0);
  const routeSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 0.55,
        onPanResponderGrant: () => {
          sheetPanStartRef.current = sheetHeightRef.current;
        },
        onPanResponderMove: (_, g) => {
          setRouteSheetHeightPx(
            clampRouteSheetHeight(sheetPanStartRef.current - g.dy),
          );
        },
        onPanResponderRelease: async (_, g) => {
          const next = clampRouteSheetHeight(sheetPanStartRef.current - g.dy);
          setRouteSheetHeightPx(next);
          if (!isEditingMyRoute) return;
          try {
            await AsyncStorage.setItem(
              ROUTE_EDIT_SHEET_HEIGHT_STORAGE_KEY,
              String(next),
            );
          } catch {
            /* ignore */
          }
        },
      }),
    [clampRouteSheetHeight, isEditingMyRoute],
  );
  useEffect(() => {
    if (!isEditingMyRoute) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(
          ROUTE_EDIT_SHEET_HEIGHT_STORAGE_KEY,
        );
        if (cancelled || raw == null) return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        setRouteSheetHeightPx(clampRouteSheetHeight(n));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditingMyRoute, clampRouteSheetHeight]);
  useEffect(() => {
    setRouteSheetHeightPx((h) => clampRouteSheetHeight(h));
  }, [windowH, clampRouteSheetHeight]);
  const { upsertUserRoute, getUserRoute, deleteUserRoute, userSavedRoutes } =
    useMockData();
  const userSavedRoutesRef = useRef(userSavedRoutes);
  userSavedRoutesRef.current = userSavedRoutes;

  const routeSessionKey = useMemo(() => {
    const editId = String(route.params?.editRouteId ?? "");
    const seedId = String(route.params?.seedSharedCourseId ?? "");
    const collab = route.params?.collaborative === true ? "1" : "0";
    return `${editId}|${seedId}|${collab}`;
  }, [
    route.params?.editRouteId,
    route.params?.seedSharedCourseId,
    route.params?.collaborative,
  ]);
  const routeSessionHydratedRef = useRef<string | null>(null);
  const createRouteInFlightRef = useRef<Promise<string | null> | null>(null);
  const initialDraftPersistTriedRef = useRef(false);

  const [stops, setStops] = useState<RouteStop[]>(() =>
    ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })),
  );

  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [persistedRouteId, setPersistedRouteId] = useState<string | null>(null);
  /** 저장한 타인 공유 코스 id — 첫 저장 시 copy/create로 개인 루트로 전환 */
  const [forkSourceCourseId, setForkSourceCourseId] = useState<string | null>(
    null,
  );
  /** 포크 원본 제작자 — 재공유 목록에 원작자 표시 */
  const forkOriginAuthorRef = useRef<{
    forkId: string;
    authorUuid?: string;
    authorUserId?: string;
    rootCourseId?: string;
  } | null>(null);
  /** state 반영 전에도 동일 코스로 PATCH 하도록 (중복 POST 방지) */
  const persistedRouteIdRef = useRef<string | null>(null);
  const draftLocalRouteIdRef = useRef<string | null>(null);

  useEffect(() => {
    persistedRouteIdRef.current = persistedRouteId;
  }, [persistedRouteId]);

  const pickForkAuthorExtras = useCallback(
    (forkId: string, prev?: UserSavedRoute | null) => {
      const fid = String(forkId ?? "").trim();
      if (!fid) return {};
      const ref = forkOriginAuthorRef.current;
      const fromRef =
        ref && ref.forkId === fid
          ? {
              forkSourceAuthorUuid: ref.authorUuid ?? null,
              forkSourceAuthorUserId: ref.authorUserId ?? null,
            }
          : {};
      const myUuid = String(authUser?.uuid ?? "").trim();
      const myUserId = String(authUser?.userId ?? "").trim();
      const rootCourseId =
        ref?.rootCourseId ?? prev?.rootForkSourceCourseId ?? fid;
      return {
        forkedFromSharedId: fid,
        forkSourceAuthorUuid:
          fromRef.forkSourceAuthorUuid ?? prev?.forkSourceAuthorUuid ?? null,
        forkSourceAuthorUserId:
          fromRef.forkSourceAuthorUserId ??
          prev?.forkSourceAuthorUserId ??
          null,
        rootForkSourceCourseId: rootCourseId,
        forkModifierAuthorUuid: myUuid || prev?.forkModifierAuthorUuid || null,
        forkModifierAuthorUserId:
          myUserId || prev?.forkModifierAuthorUserId || null,
      };
    },
    [authUser?.uuid, authUser?.userId],
  );

  const pickServerBackedRouteId = useCallback((): string | null => {
    const forkFrom = String(forkSourceCourseId ?? "").trim();
    for (const raw of [persistedRouteIdRef.current, persistedRouteId]) {
      const rid = String(raw ?? "").trim();
      if (rid && !rid.startsWith("ur-")) {
        if (forkFrom && sameCourseId(rid, forkFrom)) continue;
        return rid;
      }
    }
    const editId = String(editRouteIdParam ?? "").trim();
    if (editId && !editId.startsWith("ur-")) {
      if (forkFrom && sameCourseId(editId, forkFrom)) return null;
      return editId;
    }
    return null;
  }, [persistedRouteId, editRouteIdParam, forkSourceCourseId]);

  const getServerBackedRouteId = pickServerBackedRouteId;

  const getOrCreateDraftLocalRouteId = useCallback((): string => {
    const serverId = pickServerBackedRouteId();
    if (serverId) return serverId;
    for (const raw of [persistedRouteIdRef.current, persistedRouteId]) {
      const rid = String(raw ?? "").trim();
      if (rid.startsWith("ur-")) return rid;
    }
    if (!draftLocalRouteIdRef.current) {
      draftLocalRouteIdRef.current = `ur-${uid()}`;
    }
    return draftLocalRouteIdRef.current;
  }, [persistedRouteId, pickServerBackedRouteId]);

  const commitPersistedRouteId = useCallback((id: string | null) => {
    const next = String(id ?? "").trim();
    persistedRouteIdRef.current = next || null;
    setPersistedRouteId(next || null);
    if (next && !next.startsWith("ur-")) {
      draftLocalRouteIdRef.current = null;
    }
  }, []);

  const itineraryScrollRef = useRef<ScrollView>(null);
  const itineraryListViewportRef = useRef<View>(null);
  const scrollOffsetYRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const stopLayoutsRef = useRef<Record<string, StopLayoutRect>>({});
  const stopRowRefs = useRef<Record<string, View | null>>({});
  const stopsRef = useRef(stops);
  const legsRef = useRef(legs);
  const legDirectionsResultsRef = useRef<Array<LegDirectionResult | null>>([]);
  stopsRef.current = stops;
  legsRef.current = legs;

  /** 정류장 수(stops.length-1)와 legs 길이가 어긋나면 마지막 구간 이동수단 UI가 사라짐 → 맞춤 */
  useEffect(() => {
    const need = Math.max(0, stops.length - 1);
    if (need === 0) return;
    setLegs((prev) => {
      if (prev.length === need) return prev;
      if (prev.length > need) return prev.slice(0, need);
      const next = [...prev];
      for (let i = next.length; i < need; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        next.push({
          id: uid(),
          mode: "walk",
          minutes: syntheticLegMinutes(from?.id ?? `s${i}`, to?.id ?? `e${i}`),
        });
      }
      return next;
    });
  }, [stops]);

  type ViaDragOverlay = null | {
    phase: "lift" | "drag";
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
  const viaDragPendingRef = useRef<{ pageX: number; pageY: number } | null>(
    null,
  );
  const liftMetaRef = useRef({ viaId: "", from: 0, title: "" });
  const dragMetricsRef = useRef({ grabX: 36, grabY: 32 });
  const viaDragCommitLockRef = useRef(false);
  const viaAutoScrollAtRef = useRef(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MockPlace[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTransitType, setSelectedTransitType] =
    useState<TransitType>("subway");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [searchTargetStopId, setSearchTargetStopId] = useState<string | null>(
    null,
  );
  const [searchSort, setSearchSort] = useState<KakaoKeywordSort>("accuracy");
  const [searchCategoryCode, setSearchCategoryCode] = useState("");
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number | null>(
    15000,
  );
  const [currentSearchCenter, setCurrentSearchCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchCenterSource, setSearchCenterSource] = useState<
    "user" | "route" | null
  >(null);
  const [mapRoutePath, setMapRoutePath] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [mapRouteSegments, setMapRouteSegments] = useState<MapRouteSegment[]>(
    [],
  );
  /** 신규 루트 제작 — 정류장 좌표 없을 때 지도 초기 중심(1회) */
  const [initialMapCenter, setInitialMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const initialMapCenterFetchedRef = useRef(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatRoomMeta, setActiveChatRoomMeta] = useState<{
    name: string;
    memberCount: number;
  } | null>(null);
  const [chatLinking, setChatLinking] = useState(false);
  const [routeChatRoomUuid, setRouteChatRoomUuid] = useState<string | null>(
    null,
  );
  const [friendInviteOpen, setFriendInviteOpen] = useState(false);
  const [friendInviteSubmitting, setFriendInviteSubmitting] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);

  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [routeTitle, setRouteTitle] = useState("새 루트");
  const [routeTitleFieldFocused, setRouteTitleFieldFocused] = useState(false);
  const routeTitleAtFocusRef = useRef(routeTitle);
  const routeTitleLastEditAtRef = useRef(0);
  const [routeCoverImageUri, setRouteCoverImageUri] = useState<string | null>(
    null,
  );
  /** 홈·공유 목록 카드용, 최대 2개 */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingLegId, setEditingLegId] = useState<string | null>(null);
  const [publishToPublic, setPublishToPublic] = useState(false);
  const [wantsCourseChatRoom, setWantsCourseChatRoom] = useState(false);

  const syncPublishToPublicFromRoute = useCallback(
    async (routeId: string, localPublished?: boolean) => {
      if (localPublished === true) {
        setPublishToPublic(true);
        return;
      }
      try {
        const sharingIds = await fetchMySharingCourseIds();
        setPublishToPublic(
          sharingIds.some((sid) => String(sid ?? "") === String(routeId)),
        );
      } catch {
        setPublishToPublic(false);
      }
    },
    [],
  );

  const [collaborativeCommitted, setCollaborativeCommitted] = useState(false);
  const collaborativeCommittedRef = useRef(false);
  collaborativeCommittedRef.current = collaborativeCommitted;
  const collabMembersRef = useRef<RouteMember[]>([]);
  const refreshCollabMembersRef = useRef<(() => void) | null>(null);

  const activeRouteId = String(persistedRouteId ?? editRouteIdParam ?? "new");

  const [editorAuthorCredits, setEditorAuthorCredits] =
    useState<EditorAuthorCredits>({});
  const [collabOwnerNickname, setCollabOwnerNickname] = useState<string | null>(
    null,
  );
  const collabAccessRef = useRef<CollaborativeAccess | null>(null);
  const [collabVersionSeed, setCollabVersionSeed] = useState(0);
  const collabServerVersionRef = useRef(0);
  const [collabCanEdit, setCollabCanEdit] = useState(true);
  const flushCollabRoutePushRef = useRef<() => Promise<void>>(async () => {});
  const flushPersonalRouteAutoSaveRef = useRef<() => Promise<void>>(
    async () => {},
  );
  const [routeEditorFocused, setRouteEditorFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setRouteEditorFocused(true);
      return () => setRouteEditorFocused(false);
    }, []),
  );

  const canTrackRouteMembers =
    Boolean(activeRouteId) &&
    activeRouteId !== "new" &&
    !activeRouteId.startsWith("ur-");

  const { members: collabMembers, refresh: refreshCollabMembers } =
    useCollaborativeRouteMembers({
      routeId: activeRouteId,
      chatRoomUuid: routeChatRoomUuid,
      enabled: canTrackRouteMembers,
      pollMembers: canTrackRouteMembers && routeEditorFocused,
    });
  collabMembersRef.current = collabMembers;
  refreshCollabMembersRef.current = refreshCollabMembers;

  const { status: collabEntryStatus } = useCollaborativeRouteEntry({
    editRouteId: editRouteIdParam,
    collaborative: route.params?.collaborative === true,
    navigation,
    showToast,
    onGranted: (access) => {
      collabAccessRef.current = access;
      setCollaborativeCommitted(true);
      const v = Number(access.version ?? 0);
      setCollabVersionSeed(v);
      collabServerVersionRef.current = v;
      setCollabCanEdit(access.canEdit !== false);
      const ownerNick = String(access.ownerNickname ?? "").trim();
      if (ownerNick) setCollabOwnerNickname(ownerNick);
      const ownerUuid = String(access.ownerUuid ?? "").trim();
      if (ownerUuid) {
        setEditorAuthorCredits((prev) => ({
          ...prev,
          authorUuid: ownerUuid,
        }));
      }
      const room = String(access.chatRoomUuid ?? "").trim();
      if (room) {
        setRouteChatRoomUuid(room);
        setWantsCourseChatRoom(true);
      }
      refreshCollabMembersRef.current?.();
      void sendCoursePresenceHeartbeat(access.courseUuid);
    },
  });

  const isCollaborative = useMemo(
    () =>
      isEffectivelyCollaborativeRoute({
        collaborative: collaborativeCommitted,
        members: collabMembers,
        memberCount: activeChatRoomMeta?.memberCount,
        chatRoomUuid: routeChatRoomUuid,
        forceCollaborative:
          isCollaborativeLinkEntry && collabEntryStatus === "granted",
      }),
    [
      collaborativeCommitted,
      collabMembers,
      activeChatRoomMeta?.memberCount,
      routeChatRoomUuid,
      isCollaborativeLinkEntry,
      collabEntryStatus,
    ],
  );

  const collaborativeModeLocked = isCollaborative;

  const showCollabMemberStack =
    isCollaborative && hasCollaboratorPeers(collabMembers);

  const showHeaderChatBelowShare = useMemo(
    () => isEditingMyRoute && isCollaborative,
    [isEditingMyRoute, isCollaborative],
  );

  const persistCollaborativeLocalFromCourse = useCallback(
    (courseId: string, course: CourseItem, chatRoomUuid?: string | null) => {
      const id = String(courseId ?? "").trim();
      if (!id || id.startsWith("ur-")) return;
      const { stops, legs } = courseItemToRouteStops(course);
      const now = new Date().toISOString();
      const prev = userSavedRoutesRef.current.find((x) =>
        sameCourseId(x.id, id),
      );
      const room =
        String(chatRoomUuid ?? "").trim() ||
        String(prev?.chatRoomUuid ?? "").trim() ||
        undefined;
      upsertUserRoute({
        id,
        title: String(course.title ?? "루트").trim() || "루트",
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        collaborative: isEffectivelyCollaborativeRoute({
          collaborative: true,
          chatRoomUuid: room,
        }),
        chatRoomUuid: room,
        stops: stops.map(routeStopToPersist),
        legs: legs.map((l) => ({
          id: l.id,
          mode: l.mode,
          minutes: l.minutes,
          transitType: l.transitType,
          directionsSummary: l.directionsSummary,
          directionsDetail: l.directionsDetail,
          distanceMeters: l.distanceMeters,
        })),
        tags: Array.isArray(course.tags)
          ? course.tags
              .map((t) => String(t).trim())
              .filter(Boolean)
              .slice(0, 2)
          : prev?.tags,
        coverImageUri: resolveCourseThumbnailForDisplay(
          course.thumbnail,
          prev?.coverImageUri,
        ),
        publishedToPublic: false,
      });
    },
    [upsertUserRoute],
  );

  const getCollabRemoteSkip = useCallback(() => {
    if (routeTitleFieldFocused) {
      return { skipTitle: true as const };
    }
    if (Date.now() - routeTitleLastEditAtRef.current < 2500) {
      return { skipTitle: true as const };
    }
    return {};
  }, [routeTitleFieldFocused]);

  const applyRemoteCourseFromServer = useCallback(
    (course: CourseItem, ctx?: { skipTitle?: boolean }) => {
      const { stops: nextStops, legs: nextLegs } =
        courseItemToRouteStops(course);
      if (!ctx?.skipTitle) {
        setRouteTitle(String(course.title ?? "루트").trim() || "루트");
      }
      setSelectedTags(
        Array.isArray(course.tags)
          ? course.tags
              .map((t) => String(t).trim())
              .filter(Boolean)
              .slice(0, MAX_ROUTE_TAGS)
          : [],
      );
      setStops(nextStops);
      setLegs(
        nextLegs.map((l) => ({
          id: l.id,
          mode: normalizeLegMode(l.mode),
          minutes: l.minutes,
          transitType:
            normalizeLegMode(l.mode) === "transit"
              ? ((l as any).transitType ?? "subway")
              : undefined,
          directionsSummary: l.directionsSummary,
          directionsDetail: l.directionsDetail,
          distanceMeters: l.distanceMeters,
        })),
      );
      setRouteCoverImageUri((prev) =>
        resolveCourseThumbnailForDisplay(course.thumbnail, prev),
      );
      setEditorAuthorCredits({
        authorUuid: course.authorUuid,
        authorUserId: course.authorUserId,
        modifierUuid: course.modifierUuid,
        modifierUserId: course.modifierUserId,
      });
      const rid = pickServerBackedRouteId();
      if (rid) {
        persistCollaborativeLocalFromCourse(rid, course, routeChatRoomUuid);
      }
    },
    [
      pickServerBackedRouteId,
      persistCollaborativeLocalFromCourse,
      routeChatRoomUuid,
    ],
  );

  const collabCourseIdForSync = useMemo(
    () => pickServerBackedRouteId(),
    [
      pickServerBackedRouteId,
      persistedRouteId,
      editRouteIdParam,
      forkSourceCourseId,
    ],
  );

  const collabSyncKey = useMemo(
    () =>
      JSON.stringify({
        tags: selectedTags,
        cover: routeCoverImageUri,
        stops: stops.map((s) => ({
          id: s.id,
          k: s.kind,
          t: s.title,
          lat: s.lat,
          lng: s.lng,
        })),
        legs: legs.map((l) => ({
          id: l.id,
          m: l.mode,
          min: l.minutes,
        })),
      }),
    [selectedTags, routeCoverImageUri, stops, legs],
  );

  const collabTitleSyncKey = useMemo(
    () => (routeTitleFieldFocused ? null : routeTitle.trim()),
    [routeTitle, routeTitleFieldFocused],
  );

  const buildCollabUpsertPayload = useCallback(
    () =>
      buildUpsertPayloadFromUserRoute({
        title: routeTitle.trim() || "루트",
        collaborative: true,
        tags: selectedTags,
        stops: stops.map(routeStopToPersist),
        legs: legs.map((l) => ({
          id: l.id,
          mode: l.mode,
          minutes: l.minutes,
          transitType: l.transitType,
          directionsSummary: l.directionsSummary,
          directionsDetail: l.directionsDetail,
          distanceMeters: l.distanceMeters,
        })),
      }),
    [routeTitle, selectedTags, stops, legs],
  );

  const {
    setServerVersion: setCollabServerVersion,
    serverVersion: collabServerVersion,
    isCourseSocketConnected,
    reloadFromServer: reloadCollabCourseFromServer,
    flushPendingPush: flushCollabRoutePush,
  } = useCollaborativeRouteSync({
    enabled: isCollaborative && Boolean(collabCourseIdForSync),
    canPush: collabCanEdit,
    courseId: collabCourseIdForSync,
    initialVersion: collabVersionSeed,
    myUuid: authUser?.uuid ?? null,
    syncKey: collabSyncKey,
    titleSyncKey: collabTitleSyncKey ?? undefined,
    buildPayload: buildCollabUpsertPayload,
    onApplyRemote: applyRemoteCourseFromServer,
    getRemoteSkip: getCollabRemoteSkip,
    onMembersChange: refreshCollabMembers,
  });

  useEffect(() => {
    collabServerVersionRef.current = collabServerVersion;
  }, [collabServerVersion]);

  useEffect(() => {
    if (Number.isFinite(collabVersionSeed) && collabVersionSeed >= 0) {
      collabServerVersionRef.current = collabVersionSeed;
    }
  }, [collabVersionSeed]);

  const patchCollaborativeRouteOnServer = useCallback(
    async (
      courseId: string,
      payload: UpsertMyRoutePayload,
    ): Promise<boolean> => {
      const id = String(courseId ?? "").trim();
      if (!id || id.startsWith("ur-")) return false;

      let version = collabServerVersionRef.current;
      for (let depth = 0; depth < COLLAB_PATCH_MAX_RETRIES; depth++) {
        const res = await patchMyRouteWithVersion(id, {
          ...payload,
          version,
        });
        if (res.ok) {
          setCollabServerVersion(res.version);
          collabServerVersionRef.current = res.version;
          return true;
        }
        if (!res.conflict) return false;

        setCollabServerVersion(res.currentVersion);
        collabServerVersionRef.current = res.currentVersion;
        if (res.course) {
          applyRemoteCourseFromServer(res.course);
        } else {
          await reloadCollabCourseFromServer({ force: true });
        }
        version = res.currentVersion;
      }
      return false;
    },
    [
      setCollabServerVersion,
      applyRemoteCourseFromServer,
      reloadCollabCourseFromServer,
    ],
  );

  flushCollabRoutePushRef.current = flushCollabRoutePush;

  useCollaborativeRoutePresence({
    courseId: collabCourseIdForSync,
    enabled: isCollaborative && collabCanEdit && Boolean(collabCourseIdForSync),
    isEditorFocused: routeEditorFocused,
    onAfterPing: refreshCollabMembers,
  });

  useEffect(() => {
    if (collabEntryStatus === "granted") {
      routeSessionHydratedRef.current = null;
    }
  }, [collabEntryStatus]);

  useEffect(() => {
    const resetSession = () => {
      routeSessionHydratedRef.current = null;
      initialDraftPersistTriedRef.current = false;
      draftLocalRouteIdRef.current = null;
    };
    const unsubRemove = navigation.addListener("beforeRemove", () => {
      void flushCollabRoutePushRef.current();
      void flushPersonalRouteAutoSaveRef.current();
      resetSession();
    });
    return () => {
      unsubRemove();
    };
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "background" && state !== "inactive") return;
      void flushCollabRoutePushRef.current();
      void flushPersonalRouteAutoSaveRef.current();
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isCollaborativeLinkEntry && collabEntryStatus !== "granted") {
        return undefined;
      }
      if (routeSessionHydratedRef.current === routeSessionKey) {
        return undefined;
      }
      routeSessionHydratedRef.current = routeSessionKey;

      let cancelled = false;
      const savedRoutes = userSavedRoutesRef.current;

      const editId = route.params?.editRouteId as string | undefined;
      const seedId = route.params?.seedSharedCourseId as string | undefined;
      const collab =
        route.params?.collaborative === true ||
        (editId
          ? Boolean(
              savedRoutes.find((x) => String(x.id) === String(editId))
                ?.collaborative,
            )
          : false);

      const applyEmptyRoute = () => {
        draftLocalRouteIdRef.current = null;
        commitPersistedRouteId(null);
        setForkSourceCourseId(null);
        forkOriginAuthorRef.current = null;
        setEditorAuthorCredits({});
        setCollabOwnerNickname(null);
        setRouteTitle("새 루트");
        setSelectedTags([]);
        setPublishToPublic(false);
        setStops(ROUTE_CREATE_EMPTY_STOPS.map((s) => ({ ...s })));
        setLegs([]);
        setRouteChatRoomUuid(null);
        setRouteCoverImageUri(null);
      };

      const applyCourseToEditor = (
        course: CourseItem,
        opts: { persistId: string | null; forkFromId: string | null },
      ) => {
        const { stops: nextStops, legs: nextLegs } =
          courseItemToRouteStops(course);
        commitPersistedRouteId(opts.persistId ?? "");
        setForkSourceCourseId(opts.forkFromId);
        if (opts.forkFromId) {
          const origin = forkOriginAuthorFromCourse(course);
          forkOriginAuthorRef.current = {
            forkId: opts.forkFromId,
            authorUuid: origin.forkSourceAuthorUuid ?? undefined,
            authorUserId: origin.forkSourceAuthorUserId ?? undefined,
            rootCourseId: origin.rootForkSourceCourseId ?? opts.forkFromId,
          };
          void resolveForkOriginForSave(opts.forkFromId, course).then(
            (root) => {
              forkOriginAuthorRef.current = {
                forkId: opts.forkFromId!,
                authorUuid: root.forkSourceAuthorUuid ?? undefined,
                authorUserId: root.forkSourceAuthorUserId ?? undefined,
                rootCourseId: root.rootForkSourceCourseId ?? opts.forkFromId!,
              };
            },
          );
        } else {
          forkOriginAuthorRef.current = null;
        }
        setRouteTitle(course.title);
        setSelectedTags(
          Array.isArray(course.tags)
            ? course.tags
                .map((t) => String(t).trim())
                .filter(Boolean)
                .slice(0, MAX_ROUTE_TAGS)
            : [],
        );
        setStops(nextStops);
        setLegs(nextLegs);
        setRouteCoverImageUri(
          resolveCourseThumbnailForDisplay(course.thumbnail, null),
        );
        setEditorAuthorCredits({
          authorUuid: course.authorUuid,
          authorUserId: course.authorUserId,
          modifierUuid: course.modifierUuid,
          modifierUserId: course.modifierUserId,
        });
      };

      const applyLocalSavedRoute = (r: UserSavedRoute) => {
        const fork = String(r.forkedFromSharedId ?? "").trim();
        setForkSourceCourseId(fork || null);
        if (fork) {
          forkOriginAuthorRef.current = {
            forkId: fork,
            authorUuid:
              String(r.forkSourceAuthorUuid ?? "").trim() || undefined,
            authorUserId:
              String(r.forkSourceAuthorUserId ?? "").trim() || undefined,
            rootCourseId:
              String(r.rootForkSourceCourseId ?? fork).trim() || fork,
          };
        } else {
          forkOriginAuthorRef.current = null;
        }
        commitPersistedRouteId(r.id);
        setRouteTitle(r.title);
        setRouteCoverImageUri(
          resolveCourseThumbnailForDisplay(null, r.coverImageUri),
        );
        setSelectedTags(
          Array.isArray(r.tags)
            ? r.tags
                .map((t) => String(t).trim())
                .filter(Boolean)
                .slice(0, MAX_ROUTE_TAGS)
            : [],
        );
        setStops(r.stops.map((s) => ({ ...s })));
        setLegs(
          r.legs.map((l) => ({
            id: l.id,
            mode: normalizeLegMode(l.mode),
            minutes: l.minutes,
            transitType:
              normalizeLegMode(l.mode) === "transit"
                ? ((l as any).transitType ?? "subway")
                : undefined,
            directionsSummary: l.directionsSummary,
            directionsDetail: l.directionsDetail,
            distanceMeters: l.distanceMeters,
          })),
        );
        setRouteChatRoomUuid(r.chatRoomUuid ?? null);
        setWantsCourseChatRoom(Boolean(String(r.chatRoomUuid ?? "").trim()));
        if (r.collaborative === true) {
          setEditorAuthorCredits({});
        } else {
          setEditorAuthorCredits({
            authorUuid: authUser?.uuid,
            authorUserId: authUser?.userId,
          });
        }
        void syncPublishToPublicFromRoute(r.id, r.publishedToPublic);
      };

      const syncLocalCacheFromCourse = (
        courseId: string,
        course: CourseItem,
        prev?: UserSavedRoute,
      ) => {
        const id = String(courseId ?? "").trim();
        if (!id) return;
        const { stops, legs } = courseItemToRouteStops(course);
        const now = new Date().toISOString();
        upsertUserRoute({
          id,
          title: String(course.title ?? prev?.title ?? "루트").trim() || "루트",
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
          collaborative: prev?.collaborative ?? collab,
          chatRoomUuid:
            prev?.chatRoomUuid ??
            (String(collabAccessRef.current?.chatRoomUuid ?? "").trim() ||
              undefined),
          stops: stops.map(routeStopToPersist),
          legs: legs.map((l) => ({
            id: l.id,
            mode: l.mode,
            minutes: l.minutes,
            transitType: l.transitType,
            directionsSummary: l.directionsSummary,
            directionsDetail: l.directionsDetail,
            distanceMeters: l.distanceMeters,
          })),
          tags: Array.isArray(course.tags)
            ? course.tags
                .map((t) => String(t).trim())
                .filter(Boolean)
                .slice(0, MAX_ROUTE_TAGS)
            : prev?.tags,
          coverImageUri: resolveCourseThumbnailForDisplay(
            course.thumbnail,
            prev?.coverImageUri,
          ),
          publishedToPublic: prev?.publishedToPublic,
          forkedFromSharedId: prev?.forkedFromSharedId,
          forkSourceAuthorUuid: prev?.forkSourceAuthorUuid,
          forkSourceAuthorUserId: prev?.forkSourceAuthorUserId,
          rootForkSourceCourseId: prev?.rootForkSourceCourseId,
          forkModifierAuthorUuid: prev?.forkModifierAuthorUuid,
          forkModifierAuthorUserId: prev?.forkModifierAuthorUserId,
        });
      };

      if (editId) {
        (async () => {
          try {
            const localAtStart = savedRoutes.find((x) =>
              sameCourseId(x.id, editId),
            );
            const { course: detail, source } =
              await resolveCourseDetailForRoute(editId);
            if (cancelled) return;
            const collabFromApi = await fetchMyRouteCollaborativeFlag(editId);
            if (cancelled) return;

            const routesNow = userSavedRoutesRef.current;
            const localR =
              routesNow.find((x) => sameCourseId(x.id, editId)) ?? localAtStart;

            const preferServerOverLocal =
              collabFromApi || localR?.collaborative === true || collab;
            if (
              localR &&
              detail &&
              source !== "shared" &&
              !preferServerOverLocal &&
              !shouldPreferApiRouteOverLocal(localR.stops, detail)
            ) {
              applyLocalSavedRoute(localR);
              return;
            }

            if (detail) {
              const detailTagList = Array.isArray(detail.tags)
                ? detail.tags
                    .map((t) => String(t).trim())
                    .filter(Boolean)
                    .slice(0, MAX_ROUTE_TAGS)
                : [];
              const localTagList = Array.isArray(localR?.tags)
                ? localR!
                    .tags!.map((t) => String(t).trim())
                    .filter(Boolean)
                    .slice(0, MAX_ROUTE_TAGS)
                : [];
              if (source === "shared") {
                const personalId =
                  findPersonalRouteIdForForkSource(editId, routesNow) ||
                  (await resolvePersonalRouteIdForForkSave(
                    editId,
                    routesNow,
                    null,
                  ));
                const localPersonal = personalId
                  ? routesNow.find((x) => sameCourseId(x.id, personalId))
                  : undefined;
                if (localPersonal) {
                  if (
                    detail &&
                    shouldPreferApiRouteOverLocal(localPersonal.stops, detail)
                  ) {
                    applyCourseToEditor(
                      {
                        ...detail,
                        id: personalId!,
                        tags:
                          detailTagList.length > 0
                            ? detailTagList
                            : localTagList,
                      },
                      { persistId: personalId!, forkFromId: null },
                    );
                    syncLocalCacheFromCourse(
                      personalId!,
                      detail,
                      localPersonal,
                    );
                  } else {
                    applyLocalSavedRoute(localPersonal);
                  }
                  return;
                }
                if (personalId && hasMeaningfulRouteSteps(detail)) {
                  applyCourseToEditor(
                    { ...detail, id: personalId },
                    { persistId: personalId, forkFromId: null },
                  );
                  return;
                }
              }
              applyCourseToEditor(
                {
                  ...detail,
                  tags: detailTagList.length > 0 ? detailTagList : localTagList,
                },
                source === "shared"
                  ? { persistId: null, forkFromId: editId }
                  : { persistId: editId, forkFromId: null },
              );
              if (source === "my" && (collab || collabFromApi)) {
                const detailVersion = Number(detail.version ?? NaN);
                if (Number.isFinite(detailVersion) && detailVersion >= 0) {
                  setCollabVersionSeed(detailVersion);
                  setCollabServerVersion(detailVersion);
                }
                const roomFromDetail = String(detail.chatRoomUuid ?? "").trim();
                if (roomFromDetail) {
                  setRouteChatRoomUuid(roomFromDetail);
                  setWantsCourseChatRoom(true);
                }
                persistCollaborativeLocalFromCourse(
                  editId,
                  {
                    ...detail,
                    tags:
                      detailTagList.length > 0 ? detailTagList : localTagList,
                  },
                  collabAccessRef.current?.chatRoomUuid ?? roomFromDetail,
                );
              } else if (localR && source === "my") {
                syncLocalCacheFromCourse(editId, detail, localR);
              }
              if (source === "my") {
                void syncPublishToPublicFromRoute(
                  editId,
                  localR?.publishedToPublic,
                );
              }
              return;
            }

            if (localR) {
              applyLocalSavedRoute(localR);
              return;
            }
            applyEmptyRoute();
          } catch {
            if (!cancelled) {
              const fallback = userSavedRoutesRef.current.find((x) =>
                sameCourseId(x.id, editId),
              );
              if (fallback) applyLocalSavedRoute(fallback);
              else applyEmptyRoute();
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }

      if (seedId) {
        const personalId = findPersonalRouteIdForForkSource(
          seedId,
          savedRoutes,
        );
        const localPersonal = personalId
          ? savedRoutes.find((x) => sameCourseId(x.id, personalId))
          : undefined;
        if (localPersonal) {
          applyLocalSavedRoute(localPersonal);
          return () => {
            cancelled = true;
          };
        }
        (async () => {
          try {
            const myCourse = await fetchMyCourseDetail(seedId);
            if (cancelled) return;
            if (myCourse && hasMeaningfulRouteSteps(myCourse)) {
              applyCourseToEditor(myCourse, {
                persistId: seedId,
                forkFromId: null,
              });
              return;
            }
            const c = await fetchSharedCourseDetail(seedId);
            if (cancelled) return;
            if (!c || !hasMeaningfulRouteSteps(c)) {
              applyEmptyRoute();
              return;
            }
            applyCourseToEditor(c, {
              persistId: null,
              forkFromId: seedId,
            });
          } catch {
            if (!cancelled) {
              applyEmptyRoute();
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }

      applyEmptyRoute();
      return () => {
        cancelled = true;
      };
    }, [
      routeSessionKey,
      isCollaborativeLinkEntry,
      collabEntryStatus,
      route.params?.collaborative,
      route.params?.editRouteId,
      route.params?.seedSharedCourseId,
      syncPublishToPublicFromRoute,
      commitPersistedRouteId,
      persistCollaborativeLocalFromCourse,
    ]),
  );

  /** 신규 루트: 화면 진입 시 1회 현재 위치로 지도 중심 */
  useEffect(() => {
    const editId = route.params?.editRouteId as string | undefined;
    const seedId = route.params?.seedSharedCourseId as string | undefined;
    if (editId || seedId || initialMapCenterFetchedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 120_000,
        });
        if (cancelled) return;
        initialMapCenterFetchedRef.current = true;
        setInitialMapCenter({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch {
        /* 권한·GPS 없으면 MAP_DEFAULT 유지 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.params?.editRouteId, route.params?.seedSharedCourseId]);

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
    ? (searchResults.find((p) => p.id === selectedPlaceId) ?? null)
    : null;

  const mapPath = useMemo(
    () => buildModeAwareMapPath(stops, legs),
    [stops, legs],
  );
  const pathStopsForMap = useMemo(() => buildMapPath(stops), [stops]);
  const mapMarkers = useMemo(
    () => buildMapMarkersFromRouteStops(stops),
    [stops],
  );

  /** 좌표·이동수단이 바뀔 때만 Directions 재호출 (응답으로 갱신되는 minutes/summary는 제외) */
  const directionsRouteKey = useMemo(
    () =>
      `${stops.length}|${stops.map((s) => `${s.lat ?? ""},${s.lng ?? ""}`).join("|")}@@${legs.length}|${legs.map((l) => `${l.mode}:${l.transitType ?? ""}`).join("|")}`,
    [stops, legs],
  );

  const viaStops = useMemo(
    () => stops.filter((s) => s.kind === "via"),
    [stops],
  );
  const totalMinutes = useMemo(
    () => legs.reduce((sum, l) => sum + l.minutes, 0),
    [legs],
  );

  const showAddButton = Boolean(selectedPlace);

  const openSearch = useCallback((targetStopId?: string) => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSelectedPlaceId(null);
    setSelectedTransitType("subway");
    setSearchTargetStopId(
      typeof targetStopId === "string" ? targetStopId : null,
    );
    setSearchSort("accuracy");
    setSearchCategoryCode("");
    setSearchRadiusMeters(15000);
    setCurrentSearchCenter(null);
    setSearchCenterSource(null);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSelectedPlaceId(null);
    setSelectedTransitType("subway");
    setSearchTargetStopId(null);
    setSearchSort("accuracy");
    setSearchCategoryCode("");
    setSearchRadiusMeters(15000);
    setCurrentSearchCenter(null);
    setSearchCenterSource(null);
  }, []);

  const toggleRouteTag = useCallback((tag: string) => {
    const t = String(tag).trim();
    if (!t) return;
    setSelectedTags((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= MAX_ROUTE_TAGS) return prev;
      return [...prev, t];
    });
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    const loadCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== "granted") return;
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
      setSearchCenterSource("user");
      return;
    }
    if (searchMapCenter) {
      setSearchCenterSource("route");
      return;
    }
    setSearchCenterSource(null);
  }, [currentSearchCenter, searchMapCenter]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    const categoryFallbackQuery =
      searchCategoryCode && !q
        ? (KAKAO_KEYWORD_CATEGORY_OPTIONS.find(
            (x) => x.code === searchCategoryCode,
          )?.label ?? "")
        : "";
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
          searchSort === "distance" && !canUseDistanceSort
            ? "accuracy"
            : searchSort;
        const rows = await searchKakaoPlacesByKeyword(effectiveQuery, {
          signal: controller.signal,
          sort: effectiveSort,
          center:
            effectiveSort === "distance"
              ? (effectiveSearchCenter ?? undefined)
              : undefined,
          radiusMeters:
            searchRadiusMeters == null
              ? undefined
              : Math.min(searchRadiusMeters, 20000),
          categoryGroupCode: searchCategoryCode || undefined,
        });
        setSearchResults(rows);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(
          toUserFacingErrorMessage(
            e?.message,
            ROUTE_USER_MESSAGES.placeSearchFailed,
          ),
        );
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

  const applyMapFromDirectionResults = useCallback(
    (
      stopsSnap: RouteStop[],
      legsSnap: RouteLeg[],
      results: Array<LegDirectionResult | null>,
    ) => {
      const fallbackPath = buildModeAwareMapPath(stopsSnap, legsSnap);
      const merged: { latitude: number; longitude: number }[] = [];
      const mergedSegments: MapRouteSegment[] = [];
      for (let i = 0; i < results.length; i++) {
        const s = stopsSnap[i];
        const e = stopsSnap[i + 1];
        const r = resolveLegDirectionResult(i, legsSnap[i], s, e, results[i]);
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
        if (r?.segments && r.segments.length >= 1) {
          mergedSegments.push(...r.segments);
        } else {
          mergedSegments.push(
            ...buildStyledMapSegments({
              idPrefix: `fallback-${i}`,
              points: offsetPolylineForLegSeparation(seg, i, 0),
              legMode: legsSnap[i]?.mode ?? "walk",
              transitType: legsSnap[i]?.transitType,
              isWalkSegment: legsSnap[i]?.mode === "walk",
            }),
          );
        }
      }
      const cleaned = dedupePathPoints(merged);
      setMapRoutePath(cleaned.length > 0 ? cleaned : fallbackPath);
      setMapRouteSegments(sortMapSegmentsForRender(mergedSegments));
    },
    [],
  );

  const selectTransitCandidate = useCallback(
    (legId: string, candidateId: string) => {
      setLegs((prev) => {
        const next = prev.map((l) =>
          l.id === legId
            ? { ...l, selectedTransitCandidateId: candidateId }
            : l,
        );
        legsRef.current = next;
        const pick = next
          .find((l) => l.id === legId)
          ?.transitCandidates?.find((c) => c.id === candidateId);
        const withMeta = pick
          ? next.map((l) =>
              l.id === legId
                ? {
                    ...l,
                    minutes: pick.durationMinutes,
                    directionsSummary: pick.summary,
                    directionsDetail: pick.detail,
                    distanceMeters: pick.distanceMeters,
                  }
                : l,
            )
          : next;
        applyMapFromDirectionResults(
          stopsRef.current,
          withMeta,
          legDirectionsResultsRef.current,
        );
        return withMeta;
      });
    },
    [applyMapFromDirectionResults],
  );

  const selectWalkCandidate = useCallback(
    (legId: string, candidateId: string) => {
      setLegs((prev) => {
        const next = prev.map((l) =>
          l.id === legId ? { ...l, selectedWalkCandidateId: candidateId } : l,
        );
        legsRef.current = next;
        const pick = next
          .find((l) => l.id === legId)
          ?.walkCandidates?.find((c) => c.id === candidateId);
        const withMeta = pick
          ? next.map((l) =>
              l.id === legId
                ? {
                    ...l,
                    minutes: pick.durationMinutes,
                    directionsSummary: pick.summary,
                    directionsDetail: pick.detail,
                    distanceMeters: pick.distanceMeters,
                  }
                : l,
            )
          : next;
        applyMapFromDirectionResults(
          stopsRef.current,
          withMeta,
          legDirectionsResultsRef.current,
        );
        return withMeta;
      });
    },
    [applyMapFromDirectionResults],
  );

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
              ? [
                  {
                    id: "fallback-all",
                    points: fallbackPath,
                    color: RIDE_SEGMENT_COLOR,
                    width: 5,
                  },
                ]
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
            if (
              !s ||
              !e ||
              !leg ||
              s.lat == null ||
              s.lng == null ||
              e.lat == null ||
              e.lng == null
            ) {
              return null;
            }
            const modeMap: Record<TransportMode, DirectionsMode> = {
              walk: "walking",
              bike: "bicycling",
              car: "driving",
              transit: "transit",
            };
            try {
              const fromPt = { latitude: s.lat, longitude: s.lng };
              const toPt = { latitude: e.lat, longitude: e.lng };

              if (leg.mode === "walk") {
                const walkCandidates = await fetchWalkingRouteAlternatives({
                  from: fromPt,
                  to: toPt,
                  signal: controller.signal,
                });
                const pick =
                  walkCandidates.find(
                    (c) => c.id === leg.selectedWalkCandidateId,
                  ) ?? walkCandidates[0];
                const path = snapPolylineToEndpoints(
                  pick.path,
                  { lat: s.lat, lng: s.lng },
                  { lat: e.lat, lng: e.lng },
                );
                const segs = buildWalkPickSegments(
                  i,
                  { lat: s.lat, lng: s.lng },
                  { lat: e.lat, lng: e.lng },
                  path,
                );
                return {
                  path,
                  segments: segs,
                  durationMinutes: pick.durationMinutes,
                  summary: pick.summary,
                  detail: pick.detail,
                  distanceMeters: pick.distanceMeters,
                  walkCandidates,
                } satisfies LegDirectionResult;
              }

              if (leg.mode === "transit") {
                const transitCandidates = await fetchTransitRouteAlternatives({
                  from: fromPt,
                  to: toPt,
                  transitType: leg.transitType,
                  signal: controller.signal,
                });
                const pick =
                  transitCandidates.find(
                    (c) => c.id === leg.selectedTransitCandidateId,
                  ) ?? transitCandidates[0];
                const path = snapPolylineToEndpoints(
                  pick.path,
                  { lat: s.lat, lng: s.lng },
                  { lat: e.lat, lng: e.lng },
                );
                const segs = buildTransitPickSegments(
                  i,
                  { lat: s.lat, lng: s.lng },
                  { lat: e.lat, lng: e.lng },
                  pick,
                  leg.transitType,
                );
                return {
                  path,
                  segments: segs,
                  durationMinutes: pick.durationMinutes,
                  summary: pick.summary,
                  detail: pick.detail,
                  distanceMeters: pick.distanceMeters,
                  transitCandidates,
                } satisfies LegDirectionResult;
              }

              const r =
                leg.mode === "bike"
                  ? await fetchBicycleDirectionsLeg({
                      from: fromPt,
                      to: toPt,
                      signal: controller.signal,
                    })
                  : await fetchGoogleDirectionsLeg({
                      from: fromPt,
                      to: toPt,
                      mode: modeMap[leg.mode],
                      transitType:
                        leg.mode === "transit" ? leg.transitType : undefined,
                      signal: controller.signal,
                    });
              const path = snapPolylineToEndpoints(
                r.path,
                { lat: s.lat, lng: s.lng },
                { lat: e.lat, lng: e.lng },
              );
              const sourceSegs =
                Array.isArray(r.segments) && r.segments.length >= 1
                  ? r.segments
                  : [
                      {
                        mode:
                          leg.mode === "walk"
                            ? ("walk" as const)
                            : ("ride" as const),
                        points: path,
                      },
                    ];
              const rawSegs = sourceSegs
                .map((seg, segIdx) => {
                  const basePts = seg.points?.length >= 2 ? seg.points : path;
                  if (!basePts || basePts.length < 2) return null;
                  const pts = basePts.map((p) => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                  }));
                  if (segIdx === 0)
                    pts[0] = {
                      latitude: s.lat as number,
                      longitude: s.lng as number,
                    };
                  if (segIdx === sourceSegs.length - 1)
                    pts[pts.length - 1] = {
                      latitude: e.lat as number,
                      longitude: e.lng as number,
                    };
                  return {
                    mode: seg.mode,
                    points: offsetPolylineForLegSeparation(pts, i, segIdx),
                    lineLabel: seg.lineLabel,
                    vehicleType: seg.vehicleType,
                  };
                })
                .filter(Boolean);
              const segs = mapSegmentsFromDirectionLeg(i, leg, rawSegs, path);
              const transitChain = rawSegs
                .filter(
                  (x) =>
                    x.mode === "ride" &&
                    typeof x.lineLabel === "string" &&
                    x.lineLabel.trim() !== "",
                )
                .map((x) => String(x.lineLabel).trim());
              const summaryCore =
                transitChain.length > 0 ? transitChain.join(" => ") : r.summary;
              const summary = summaryCore;
              if (__DEV__) {
                console.log(
                  `[Directions] leg ${i} OK mode=${leg.mode} provider=${r.source ?? "google"} pathPoints=${path.length} mapSegs=${segs.length}`,
                );
              }
              return {
                path,
                segments: segs,
                durationMinutes: r.durationMinutes,
                summary,
                detail: r.detail,
                distanceMeters: r.distanceMeters,
              } satisfies LegDirectionResult;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              const aborted =
                (e instanceof Error && e.name === "AbortError") ||
                msg === "Aborted" ||
                /abort/i.test(msg);
              if (!aborted) {
                console.warn(`[Directions] leg ${i} (${leg.mode}) 실패:`, msg);
              }
              return null;
            }
          }),
        );

        legDirectionsResultsRef.current = results;

        if (cancelled) return;
        applyMapFromDirectionResults(stopsSnap, legsSnap, results);
        setLegs((prev) => {
          if (prev.length !== results.length) return prev;
          return prev.map((leg, i) => {
            const r = results[i];
            if (!r) return leg;
            const next: RouteLeg = {
              ...leg,
              minutes: r.durationMinutes,
              directionsSummary: r.summary,
              directionsDetail: r.detail,
              distanceMeters: r.distanceMeters,
            };
            if (r.walkCandidates?.length) {
              next.walkCandidates = r.walkCandidates;
              const keep =
                leg.selectedWalkCandidateId &&
                r.walkCandidates.some(
                  (c) => c.id === leg.selectedWalkCandidateId,
                );
              next.selectedWalkCandidateId = keep
                ? leg.selectedWalkCandidateId
                : r.walkCandidates[0].id;
            } else {
              delete next.walkCandidates;
              delete next.selectedWalkCandidateId;
            }
            if (r.transitCandidates?.length) {
              next.transitCandidates = r.transitCandidates;
              const keepT =
                leg.selectedTransitCandidateId &&
                r.transitCandidates.some(
                  (c) => c.id === leg.selectedTransitCandidateId,
                );
              next.selectedTransitCandidateId = keepT
                ? leg.selectedTransitCandidateId
                : r.transitCandidates[0].id;
            } else {
              delete next.transitCandidates;
              delete next.selectedTransitCandidateId;
            }
            return next;
          });
        });
      } catch {
        if (!cancelled) {
          const fb = buildModeAwareMapPath(stopsRef.current, legsRef.current);
          setMapRoutePath(fb);
          setMapRouteSegments(
            fb.length >= 2
              ? [
                  {
                    id: "fallback-catch",
                    points: fb,
                    color: RIDE_SEGMENT_COLOR,
                    width: 5,
                  },
                ]
              : [],
          );
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [directionsRouteKey, applyMapFromDirectionResults]);

  const handleViaLift = useCallback(
    (viaId: string, fromViaIndex: number, previewTitle: string) => {
      viaDragCommitLockRef.current = false;
      liftMetaRef.current = { viaId, from: fromViaIndex, title: previewTitle };
      const mids = computeViaGapMids(stopsRef.current, stopLayoutsRef.current);
      const lineY = mids ? mids[Math.min(fromViaIndex, mids.length - 1)] : 0;
      setViaDrag({
        phase: "lift",
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
    },
    [],
  );

  const handleViaLiftCancel = useCallback(() => {
    viaDragCommitLockRef.current = false;
    setViaDrag(null);
  }, []);

  const handleViaDragBegin = useCallback((pageX: number, pageY: number) => {
    viaDragCommitLockRef.current = false;
    viaAutoScrollAtRef.current = 0;
    const { viaId } = liftMetaRef.current;
    const row = stopRowRefs.current[viaId];
    const winW = Dimensions.get("window").width;
    const apply = (x: number, y: number, w: number, h: number) => {
      const gx = Math.max(0, Math.min(w, pageX - x));
      const gy = Math.max(0, Math.min(h, pageY - y));
      dragMetricsRef.current = { grabX: gx, grabY: gy };
      setViaDrag((prev) =>
        prev && prev.viaId === viaId
          ? {
              ...prev,
              phase: "drag",
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
    if (row && typeof row.measureInWindow === "function") {
      row.measureInWindow((x, y, w, h) => {
        if (w < 8 || h < 8)
          apply(pageX - 140, pageY - 40, Math.min(320, winW - 40), 78);
        else apply(x, y, w, h);
      });
    } else {
      apply(pageX - 140, pageY - 40, Math.min(320, winW - 40), 78);
    }
  }, []);

  const flushViaDragMove = useCallback((pageX: number, pageY: number) => {
    if (viaDragRef.current?.phase !== "drag") return;
    const mids = computeViaGapMids(stopsRef.current, stopLayoutsRef.current);
    if (!mids) return;
    itineraryListViewportRef.current?.measureInWindow((_vx, vy) => {
      const contentY = scrollOffsetYRef.current + (pageY - vy);
      const slot = fingerContentYToViaSlot(contentY, mids);
      const lineY = mids[Math.min(slot, mids.length - 1)];
      const { grabX, grabY } = dragMetricsRef.current;
      setViaDrag((p) =>
        p && p.phase === "drag"
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
    if (viaDragRef.current?.phase !== "drag") return;
    const now = Date.now();
    if (now - viaAutoScrollAtRef.current < VIA_DRAG_SCROLL_INTERVAL_MS) return;
    viaAutoScrollAtRef.current = now;
    const scrollRef = itineraryScrollRef.current;
    if (!scrollRef) return;
    itineraryListViewportRef.current?.measureInWindow((_x, winY, _w, winH) => {
      const maxY = Math.max(
        0,
        scrollContentHeightRef.current - scrollViewHeightRef.current,
      );
      if (pageY < winY + VIA_DRAG_EDGE_PX) {
        const next = Math.max(
          0,
          scrollOffsetYRef.current - VIA_DRAG_SCROLL_STEP,
        );
        scrollRef.scrollTo({ y: next, animated: false });
        scrollOffsetYRef.current = next;
      } else if (pageY > winY + winH - VIA_DRAG_EDGE_PX) {
        const next = Math.min(
          maxY,
          scrollOffsetYRef.current + VIA_DRAG_SCROLL_STEP,
        );
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
    if (snap?.phase !== "drag") {
      viaDragCommitLockRef.current = false;
      return;
    }
    const oldStops = stopsRef.current;
    const newStops = reorderStopsByViaSlot(
      oldStops,
      snap.fromViaIndex,
      snap.insertSlot,
    );
    const changed = newStops.some((s, i) => s.id !== oldStops[i]?.id);
    if (changed) {
      setStops(newStops);
      setLegs(rebuildLegsForStops(newStops, oldStops, legsRef.current));
    }
    requestAnimationFrame(() => {
      viaDragCommitLockRef.current = false;
      viaAutoScrollAtRef.current = 0;
    });
  }, []);

  const addStopToRoute = useCallback(() => {
    if (!selectedPlace) return;
    const selectedMode: TransportMode = pickFastestModeByKey(selectedPlace.id);
    const m = estimateMinutes(selectedMode, selectedPlace.id);

    if (searchTargetStopId) {
      const target = stops.find((s) => s.id === searchTargetStopId);
      if (!target) {
        closeSearch();
        return;
      }
      const targetTitle =
        target.kind === "start"
          ? "출발지"
          : target.kind === "end"
            ? "도착지"
            : "경유지";
      const timeLine = target.kind === "via" ? "경유지" : "";

      setStops((prev) =>
        prev.map((s) =>
          s.id === searchTargetStopId
            ? withPlaceFromSearch(s, selectedPlace.name, {
                timeLine,
                lat: selectedPlace.latitude,
                lng: selectedPlace.longitude,
              })
            : s,
        ),
      );
      if (target.kind === "start") {
        setLegs((prev) =>
          prev.length > 0
            ? [
                {
                  ...prev[0],
                  mode: selectedMode,
                  minutes: m,
                  transitType:
                    selectedMode === "transit"
                      ? selectedTransitType
                      : undefined,
                },
                ...prev.slice(1),
              ]
            : prev,
        );
      } else if (target.kind === "end") {
        setLegs((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: uid(),
                mode: selectedMode,
                minutes: m,
                transitType:
                  selectedMode === "transit" ? selectedTransitType : undefined,
              },
            ];
          }
          return [
            ...prev.slice(0, -1),
            {
              ...prev[prev.length - 1],
              mode: selectedMode,
              minutes: m,
              transitType:
                selectedMode === "transit" ? selectedTransitType : undefined,
            },
          ];
        });
      }
      closeSearch();
      return;
    }

    const startFilled = stops[0]?.lat != null && stops[0]?.lng != null;
    const endFilled =
      stops[stops.length - 1]?.lat != null &&
      stops[stops.length - 1]?.lng != null;

    if (!startFilled) {
      setStops((prev) => {
        if (prev.length < 2) return prev;
        const [, ...rest] = prev;
        const newStart = withPlaceFromSearch(prev[0], selectedPlace.name, {
          timeLine: "",
          lat: selectedPlace.latitude,
          lng: selectedPlace.longitude,
        });
        return [newStart, ...rest];
      });
      setLegs([]);
      closeSearch();
      return;
    }

    if (!endFilled) {
      setStops((prev) => {
        if (prev.length < 2) return prev;
        const end = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          withPlaceFromSearch(end, selectedPlace.name, {
            timeLine: "",
            lat: selectedPlace.latitude,
            lng: selectedPlace.longitude,
          }),
        ];
      });
      setLegs([
        {
          id: uid(),
          mode: selectedMode,
          minutes: m,
          transitType:
            selectedMode === "transit" ? selectedTransitType : undefined,
        },
      ]);
      closeSearch();
      return;
    }

    setStops((prev) => {
      if (prev.length < 2) return prev;
      const end = prev[prev.length - 1];
      const middle = prev.slice(0, -1);
      const newVia: RouteStop = withPlaceFromSearch(
        {
          id: uid(),
          kind: "via",
          title: selectedPlace.name,
          timeLine: "경유지",
        },
        selectedPlace.name,
        {
          lat: selectedPlace.latitude,
          lng: selectedPlace.longitude,
        },
      );
      return [...middle, newVia, end];
    });

    setLegs((prev) => {
      const mm = estimateMinutes(selectedMode, selectedPlace.id);
      if (prev.length === 0) {
        const firstHalf = Math.max(5, Math.round(mm * 0.45));
        const secondHalf = Math.max(5, mm - firstHalf);
        return [
          {
            id: uid(),
            mode: selectedMode,
            minutes: firstHalf,
            transitType:
              selectedMode === "transit" ? selectedTransitType : undefined,
          },
          {
            id: uid(),
            mode: selectedMode,
            minutes: secondHalf,
            transitType:
              selectedMode === "transit" ? selectedTransitType : undefined,
          },
        ];
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
          transitType:
            selectedMode === "transit" ? selectedTransitType : undefined,
        },
        {
          id: uid(),
          mode: selectedMode,
          minutes: secondHalf,
          transitType:
            selectedMode === "transit" ? selectedTransitType : undefined,
        },
      ];
    });

    closeSearch();
  }, [
    selectedPlace,
    searchTargetStopId,
    selectedTransitType,
    closeSearch,
    stops,
    isCollaborative,
  ]);

  const removeStop = (id: string) => {
    const idx = stops.findIndex((s) => s.id === id);
    if (idx <= 0 || idx >= stops.length - 1) {
      appAlert("", "출발·도착은 삭제할 수 없습니다.");
      return;
    }
    const target = stops[idx];
    const label = target.title || "이 경유지";
    appAlert("경유지 삭제", `"${label}"을(를) 목록에서 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
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
              transitType: a.mode === "transit" ? a.transitType : undefined,
            };
            return [...prev.slice(0, i), merged, ...prev.slice(i + 2)];
          });
        },
      },
    ]);
  };

  /** 표시 이름 변경 (연필) */
  const editStopName = (stop: RouteStop) => {
    if (stop.lat == null || stop.lng == null) {
      openSearch(stop.id);
      return;
    }
    setEditTitle(stop.title);
    setEditingStop(stop);
  };

  /** 장소·좌표 변경 (위치 아이콘) */
  const changeStopPlace = (stop: RouteStop) => {
    openSearch(stop.id);
  };

  const applyEditTitle = () => {
    if (!editingStop) return;
    const t = editTitle.trim();
    if (!t) {
      setEditingStop(null);
      return;
    }
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== editingStop.id) return s;
        const originalTitle =
          String(s.originalTitle ?? editingStop.title).trim() ||
          editingStop.title;
        return { ...s, title: t, originalTitle };
      }),
    );
    setEditingStop(null);
  };

  const pickRouteCoverImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appAlert("", "사진 접근 권한이 필요해요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const localUri = asset.uri;
      setRouteCoverImageUri(localUri);
      const serverId = pickServerBackedRouteId();
      if (serverId) {
        const uploaded = await syncMyCourseThumbnailToServer(
          serverId,
          localUri,
        );
        if (uploaded) {
          setRouteCoverImageUri(uploaded);
          const saved = getUserRoute(serverId);
          if (saved) {
            upsertUserRoute({ ...saved, coverImageUri: uploaded });
          }
          if (isCollaborative) {
            void reloadCollabCourseFromServer();
          }
        }
      }
    }
  }, [
    pickServerBackedRouteId,
    getUserRoute,
    upsertUserRoute,
    isCollaborative,
    reloadCollabCourseFromServer,
  ]);

  const patchRouteChatRoom = useCallback(
    (
      routeId: string,
      chatRoomUuid: string | null,
      base?: ReturnType<typeof getUserRoute>,
    ) => {
      const prev =
        base ??
        getUserRoute(routeId) ??
        userSavedRoutes.find((x) => String(x.id) === String(routeId));
      if (!prev) return;
      upsertUserRoute({
        ...prev,
        chatRoomUuid: chatRoomUuid ?? undefined,
        coverImageUri: routeCoverImageUri ?? prev.coverImageUri,
      });
      setRouteChatRoomUuid(chatRoomUuid);
    },
    [getUserRoute, userSavedRoutes, upsertUserRoute, routeCoverImageUri],
  );

  const persistPromiseRef = useRef<Promise<{
    ok: boolean;
    routeId: string | null;
  }> | null>(null);

  /** 서버 저장 — 공동 루트는 좌표 없어도 초안 저장 가능(공유·초대용) */
  const persistRouteToServer = useCallback(
    async (opts?: {
      navigateBack?: boolean;
      silent?: boolean;
      requireCoords?: boolean;
      collaborativeOverride?: boolean;
    }): Promise<{ ok: boolean; routeId: string | null }> => {
      if (persistPromiseRef.current) return persistPromiseRef.current;

      const requireCoords = opts?.requireCoords !== false;
      const isCollab =
        opts?.collaborativeOverride ??
        (collaborativeCommittedRef.current ||
          hasCollaboratorPeers(collabMembersRef.current));

      if (requireCoords) {
        const missingCoords = stops.some((s) => s.lat == null || s.lng == null);
        if (missingCoords) {
          if (!opts?.silent) showToast("모든 정류장에 위치를 설정해 주세요");
          return { ok: false, routeId: null };
        }
      }

      const task = (async (): Promise<{
        ok: boolean;
        routeId: string | null;
      }> => {
        try {
          const title = routeTitle.trim() || "새 루트";
          const now = new Date().toISOString();
          const serverId = pickServerBackedRouteId();
          const localId = getOrCreateDraftLocalRouteId();
          const prev =
            getUserRoute(localId) ??
            getUserRoute(persistedRouteIdRef.current ?? "") ??
            getUserRoute(persistedRouteId ?? "");
          const wantPublic = publishToPublic && !isCollab;
          const tagsForSave = selectedTags
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, MAX_ROUTE_TAGS);
          const routePayload = buildUpsertPayloadFromUserRoute({
            title,
            collaborative: isCollab,
            tags: tagsForSave,
            stops: stops.map(routeStopToPersist),
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

          upsertUserRoute({
            id: localId,
            title,
            createdAt: prev?.createdAt ?? now,
            updatedAt: now,
            collaborative: isCollab,
            tags: tagsForSave,
            stops: routePayload.stops,
            legs: routePayload.legs,
            publishedToPublic: wantPublic,
            coverImageUri: routeCoverImageUri,
            chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
          });

          let apiSaved = false;
          let effectiveId = localId;
          let savedAsPersonalFork = false;
          const forkId = String(forkSourceCourseId ?? "").trim();
          const forkMeta =
            forkId ||
            (prev?.forkedFromSharedId
              ? String(prev.forkedFromSharedId).trim()
              : "");
          if (forkId) {
            const personalId = await resolvePersonalRouteIdForForkSave(
              forkId,
              userSavedRoutes,
              serverId,
            );
            const isOwnCourseUpdate =
              Boolean(personalId) && sameCourseId(personalId, forkId);
            if (personalId) {
              apiSaved = isCollab
                ? await patchCollaborativeRouteOnServer(
                    personalId,
                    routePayload,
                  )
                : await updateMyRoute(personalId, routePayload);
              if (apiSaved) {
                effectiveId = personalId;
                if (personalId !== localId) deleteUserRoute(localId);
                upsertUserRoute({
                  id: personalId,
                  title,
                  createdAt: prev?.createdAt ?? now,
                  updatedAt: now,
                  collaborative: isCollab,
                  tags: tagsForSave,
                  stops: routePayload.stops,
                  legs: routePayload.legs,
                  publishedToPublic: wantPublic,
                  coverImageUri: routeCoverImageUri,
                  chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
                  ...(isOwnCourseUpdate
                    ? {}
                    : pickForkAuthorExtras(forkId, prev)),
                });
                setForkSourceCourseId(null);
                forkOriginAuthorRef.current = null;
              }
            } else {
              const newPersonalId = await forkSharedCourseToPersonalRoute(
                forkId,
                routePayload,
              );
              apiSaved = Boolean(newPersonalId);
              if (newPersonalId) {
                savedAsPersonalFork = true;
                effectiveId = newPersonalId;
                if (newPersonalId !== localId) deleteUserRoute(localId);
                upsertUserRoute({
                  id: newPersonalId,
                  title,
                  createdAt: prev?.createdAt ?? now,
                  updatedAt: now,
                  collaborative: isCollab,
                  tags: tagsForSave,
                  stops: routePayload.stops,
                  legs: routePayload.legs,
                  publishedToPublic: wantPublic,
                  coverImageUri: routeCoverImageUri,
                  chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
                  ...pickForkAuthorExtras(forkId, prev),
                });
                setForkSourceCourseId(null);
                forkOriginAuthorRef.current = null;
              }
            }
          } else if (serverId) {
            apiSaved = isCollab
              ? await patchCollaborativeRouteOnServer(serverId, routePayload)
              : await updateMyRoute(serverId, routePayload);
            effectiveId = serverId;
            if (apiSaved) {
              upsertUserRoute({
                id: serverId,
                title,
                createdAt: prev?.createdAt ?? now,
                updatedAt: now,
                collaborative: isCollab,
                tags: tagsForSave,
                stops: routePayload.stops,
                legs: routePayload.legs,
                publishedToPublic: wantPublic,
                coverImageUri: routeCoverImageUri,
                chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
                ...(forkMeta ? pickForkAuthorExtras(forkMeta, prev) : {}),
              });
            }
          } else {
            const racedServerId = pickServerBackedRouteId();
            if (racedServerId) {
              apiSaved = isCollab
                ? await patchCollaborativeRouteOnServer(
                    racedServerId,
                    routePayload,
                  )
                : await updateMyRoute(racedServerId, routePayload);
              effectiveId = racedServerId;
              if (apiSaved) {
                upsertUserRoute({
                  id: racedServerId,
                  title,
                  createdAt: prev?.createdAt ?? now,
                  updatedAt: now,
                  collaborative: isCollab,
                  tags: tagsForSave,
                  stops: routePayload.stops,
                  legs: routePayload.legs,
                  publishedToPublic: wantPublic,
                  coverImageUri: routeCoverImageUri,
                  chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
                  ...(forkMeta ? pickForkAuthorExtras(forkMeta, prev) : {}),
                });
              }
            } else {
              let createdId: string | null = null;
              if (createRouteInFlightRef.current) {
                createdId = await createRouteInFlightRef.current;
              } else {
                const createTask = createMyRoute(routePayload);
                createRouteInFlightRef.current = createTask;
                try {
                  createdId = await createTask;
                } finally {
                  createRouteInFlightRef.current = null;
                }
              }
              apiSaved = Boolean(createdId);
              if (createdId) {
                effectiveId = createdId;
                if (createdId !== localId) deleteUserRoute(localId);
                upsertUserRoute({
                  id: createdId,
                  title,
                  createdAt: prev?.createdAt ?? now,
                  updatedAt: now,
                  collaborative: isCollab,
                  tags: tagsForSave,
                  stops: routePayload.stops,
                  legs: routePayload.legs,
                  publishedToPublic: wantPublic,
                  coverImageUri: routeCoverImageUri,
                  chatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid,
                  ...(forkMeta ? pickForkAuthorExtras(forkMeta, prev) : {}),
                });
              }
            }
          }

          if (
            apiSaved &&
            effectiveId &&
            !String(effectiveId).startsWith("ur-") &&
            !isCollab
          ) {
            await setMyCoursePublic(String(effectiveId), wantPublic);
          }

          let thumbnailSynced = true;
          if (
            apiSaved &&
            effectiveId &&
            !String(effectiveId).startsWith("ur-") &&
            routeCoverImageUri
          ) {
            const uploaded = await syncMyCourseThumbnailToServer(
              String(effectiveId),
              routeCoverImageUri,
            );
            if (uploaded) {
              const saved = getUserRoute(effectiveId);
              if (saved) {
                upsertUserRoute({ ...saved, coverImageUri: uploaded });
              }
              setRouteCoverImageUri(uploaded);
            } else if (isLocalThumbnailUri(routeCoverImageUri)) {
              thumbnailSynced = false;
            }
          }

          if (!opts?.silent && apiSaved && !thumbnailSynced) {
            showToast("코스는 저장됐지만 대표 이미지 업로드에 실패했어요");
          }

          commitPersistedRouteId(effectiveId);

          if (isCollab && accessToken && authUser?.uuid && apiSaved) {
            const ensured = await linkRouteToGroupChat({
              accessToken,
              myUuid: authUser.uuid,
              routeId: effectiveId,
              routeTitle: title,
              existingChatRoomUuid:
                routeChatRoomUuid ?? prev?.chatRoomUuid ?? null,
            });
            if (ensured) {
              patchRouteChatRoom(effectiveId, ensured, {
                ...(getUserRoute(effectiveId) ?? {
                  id: effectiveId,
                  title,
                  createdAt: prev?.createdAt ?? now,
                  updatedAt: now,
                  collaborative: true,
                  tags: tagsForSave,
                  stops: routePayload.stops,
                  legs: routePayload.legs,
                  publishedToPublic: wantPublic,
                }),
                chatRoomUuid: ensured,
              });
            }
          }

          if (!opts?.silent) {
            showToast(
              apiSaved
                ? savedAsPersonalFork
                  ? "개인 루트로 저장했어요"
                  : isCollab
                    ? "저장 완료 · 채팅 탭에 연동됐어요"
                    : "저장 완료"
                : "저장하지 못했어요",
            );
          }

          if (opts?.navigateBack && apiSaved) safeGoBack(navigation);

          const savedRouteId =
            apiSaved && effectiveId && !String(effectiveId).startsWith("ur-")
              ? String(effectiveId)
              : null;
          return { ok: apiSaved, routeId: savedRouteId };
        } catch {
          return { ok: false, routeId: null };
        }
      })();

      persistPromiseRef.current = task;
      try {
        return await task;
      } finally {
        persistPromiseRef.current = null;
      }
    },
    [
      stops,
      legs,
      routeTitle,
      pickServerBackedRouteId,
      getOrCreateDraftLocalRouteId,
      commitPersistedRouteId,
      buildUpsertPayloadFromUserRoute,
      forkSourceCourseId,
      collaborativeCommitted,
      publishToPublic,
      wantsCourseChatRoom,
      selectedTags,
      routeCoverImageUri,
      routeChatRoomUuid,
      getUserRoute,
      upsertUserRoute,
      deleteUserRoute,
      accessToken,
      authUser?.uuid,
      patchRouteChatRoom,
      showToast,
      navigation,
      patchCollaborativeRouteOnServer,
    ],
  );

  const personalAutoSaveKey = useMemo(
    () => `${collabSyncKey}\n${collabTitleSyncKey ?? routeTitle.trim()}`,
    [collabSyncKey, collabTitleSyncKey, routeTitle],
  );

  const { flush: flushPersonalRouteAutoSave } = useRouteEditorAutoSave({
    enabled:
      !isCollaborative &&
      Boolean(pickServerBackedRouteId()) &&
      collabCanEdit !== false,
    syncKey: personalAutoSaveKey,
    onSave: () =>
      persistRouteToServer({
        silent: true,
        requireCoords: false,
        navigateBack: false,
      }),
  });

  flushPersonalRouteAutoSaveRef.current = flushPersonalRouteAutoSave;

  const openRouteChat = useCallback(async () => {
    if (!isCollaborative) return;
    if (!accessToken || !authUser?.uuid) {
      showToast("로그인 후 채팅을 사용할 수 있어요");
      return;
    }
    setChatLinking(true);
    try {
      let routeId = pickServerBackedRouteId();
      if (!routeId) {
        const res = await persistRouteToServer({
          silent: true,
          requireCoords: false,
          navigateBack: false,
        });
        routeId = res.routeId;
      }
      if (!routeId) {
        showToast("루트를 먼저 저장한 뒤 채팅을 열 수 있어요");
        return;
      }
      const prev = getUserRoute(routeId);
      const ensured = await linkRouteToGroupChat({
        accessToken,
        myUuid: authUser.uuid,
        routeId,
        routeTitle: routeTitle.trim() || "루트",
        existingChatRoomUuid: routeChatRoomUuid ?? prev?.chatRoomUuid ?? null,
      });
      if (ensured) {
        patchRouteChatRoom(routeId, ensured, prev ?? undefined);
        setActiveChatRoomMeta({
          name: buildRouteGroupChatName(routeTitle.trim() || "루트"),
          memberCount: Math.max(2, collabMembers.length),
        });
      }
      if (!ensured && !routeChatRoomUuid) {
        showToast("채팅방 연결에 실패했어요. 잠시 후 다시 시도해 주세요");
        return;
      }
      setChatOpen(true);
    } finally {
      setChatLinking(false);
    }
  }, [
    accessToken,
    authUser?.uuid,
    pickServerBackedRouteId,
    persistRouteToServer,
    routeTitle,
    routeChatRoomUuid,
    getUserRoute,
    patchRouteChatRoom,
    showToast,
    collabMembers.length,
    isCollaborative,
  ]);

  const handleSelectRouteChatRoom = useCallback(
    (room: { uuid: string; name: string; memberCount: number }) => {
      setRouteChatRoomUuid(room.uuid);
      setActiveChatRoomMeta({
        name: room.name,
        memberCount: room.memberCount,
      });
      const rid = pickServerBackedRouteId();
      if (rid) {
        patchRouteChatRoom(rid, room.uuid);
      }
      setChatOpen(true);
    },
    [pickServerBackedRouteId, patchRouteChatRoom],
  );

  const linkedRouteChatRoom = useMemo(() => {
    const id = String(routeChatRoomUuid ?? "").trim();
    if (!id) return null;
    return {
      uuid: id,
      name:
        String(activeChatRoomMeta?.name ?? "").trim() ||
        buildRouteGroupChatName(routeTitle.trim() || "루트"),
      memberCount: Math.max(
        2,
        activeChatRoomMeta?.memberCount ?? collabMembers.length,
      ),
    };
  }, [
    routeChatRoomUuid,
    activeChatRoomMeta?.name,
    activeChatRoomMeta?.memberCount,
    routeTitle,
    collabMembers.length,
  ]);

  const ensureCollaborativeRoutePersisted = useCallback(async (): Promise<
    string | null
  > => {
    const existing = pickServerBackedRouteId();
    if (existing) return existing;
    const res = await persistRouteToServer({
      silent: true,
      requireCoords: false,
      navigateBack: false,
      collaborativeOverride: false,
    });
    if (res.routeId) return res.routeId;

    // 백엔드가 좌표 없는 초안을 거부할 때 대비: 시작/도착에 임시 중심 좌표를 채워 1회 재시도
    const fallbackLat =
      currentSearchCenter?.latitude ??
      initialMapCenter?.latitude ??
      MAP_DEFAULT_LAT;
    const fallbackLng =
      currentSearchCenter?.longitude ??
      initialMapCenter?.longitude ??
      MAP_DEFAULT_LNG;
    const patchedStops = stops.map((s) =>
      s.kind === "start" || s.kind === "end"
        ? {
            ...s,
            lat: s.lat ?? fallbackLat,
            lng: s.lng ?? fallbackLng,
          }
        : s,
    );
    const patchedPayload = buildUpsertPayloadFromUserRoute({
      title: routeTitle.trim() || "새 루트",
      collaborative: false,
      tags: selectedTags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, MAX_ROUTE_TAGS),
      stops: patchedStops.map(routeStopToPersist),
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
    const created = await createMyRoute(patchedPayload);
    if (!created) return null;

    const now = new Date().toISOString();
    upsertUserRoute({
      id: created,
      title: routeTitle.trim() || "새 루트",
      createdAt: now,
      updatedAt: now,
      collaborative: false,
      tags: selectedTags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, MAX_ROUTE_TAGS),
      stops: patchedPayload.stops,
      legs: patchedPayload.legs,
      publishedToPublic: false,
      coverImageUri: routeCoverImageUri,
      chatRoomUuid: routeChatRoomUuid ?? undefined,
    });
    commitPersistedRouteId(created);
    return created;
  }, [
    pickServerBackedRouteId,
    persistRouteToServer,
    currentSearchCenter?.latitude,
    currentSearchCenter?.longitude,
    initialMapCenter?.latitude,
    initialMapCenter?.longitude,
    stops,
    legs,
    routeTitle,
    selectedTags,
    routeCoverImageUri,
    routeChatRoomUuid,
    upsertUserRoute,
    commitPersistedRouteId,
  ]);

  useEffect(() => {
    const editId = route.params?.editRouteId as string | undefined;
    const seedId = route.params?.seedSharedCourseId as string | undefined;
    if (route.params?.collaborative !== true) return;
    if (editId || seedId) return;
    if (initialDraftPersistTriedRef.current) return;
    if (pickServerBackedRouteId()) return;
    initialDraftPersistTriedRef.current = true;

    // 초대 링크 진입 등 — routeId만 확보(개인 루트로 저장)
    void persistRouteToServer({
      silent: true,
      requireCoords: false,
      navigateBack: false,
      collaborativeOverride: false,
    });
  }, [
    route.params?.editRouteId,
    route.params?.seedSharedCourseId,
    route.params?.collaborative,
    pickServerBackedRouteId,
    persistRouteToServer,
  ]);

  const commitCollaborativeMode = useCallback(() => {
    setCollaborativeCommitted(true);
    void persistRouteToServer({
      silent: true,
      requireCoords: false,
      navigateBack: false,
      collaborativeOverride: true,
    });
  }, [persistRouteToServer]);

  useEffect(() => {
    if (!canTrackRouteMembers) return;
    if (isCollaborativeLinkEntry && collabEntryStatus === "granted") return;

    if (hasCollaboratorPeers(collabMembers)) {
      if (!collaborativeCommittedRef.current) {
        commitCollaborativeMode();
      }
      return;
    }

    if (!collaborativeCommittedRef.current) return;
    setCollaborativeCommitted(false);
    void persistRouteToServer({
      silent: true,
      requireCoords: false,
      navigateBack: false,
      collaborativeOverride: false,
    });
  }, [
    canTrackRouteMembers,
    collabMembers,
    isCollaborativeLinkEntry,
    collabEntryStatus,
    commitCollaborativeMode,
    persistRouteToServer,
  ]);

  const handlePublishToPublicChange = useCallback((next: boolean) => {
    setPublishToPublic(next);
    if (!next) setWantsCourseChatRoom(false);
  }, []);

  /** 상단 공유 — 미저장이면 개인 루트로 저장 후 공유 시트 */
  const handleTopSharePress = useCallback(async () => {
    const rid = await ensureCollaborativeRoutePersisted();
    if (!rid) {
      showToast("공동 루트 저장에 실패했어요. 잠시 후 다시 시도해 주세요");
      return;
    }
    if (!routeChatRoomUuid && accessToken && authUser?.uuid) {
      const wantsChat = await promptCreateCourseChatRoom();
      if (wantsChat) {
        const ensured = await linkCourseChatRoomForShare({
          accessToken,
          myUuid: authUser.uuid,
          routeId: rid,
          routeTitle: routeTitle.trim() || "루트",
          existingChatRoomUuid: routeChatRoomUuid,
        });
        if (ensured) patchRouteChatRoom(rid, ensured);
      }
    }
    presentCollaborativeShareOptions({
      routeId: rid,
      title: routeTitle.trim() || "루트",
      onInviteFriends: () => setFriendInviteOpen(true),
    });
  }, [
    routeTitle,
    showToast,
    ensureCollaborativeRoutePersisted,
    accessToken,
    authUser?.uuid,
    routeChatRoomUuid,
    patchRouteChatRoom,
  ]);

  const handleInviteFriendsToRoute = async (friendUuids: string[]) => {
    const rid =
      (await ensureCollaborativeRoutePersisted()) ?? getServerBackedRouteId();
    if (!rid) {
      appAlert("", "공동 루트를 저장한 뒤 친구에게 공유할 수 있어요.");
      return;
    }
    if (!accessToken || !authUser?.uuid) {
      appAlert("", "로그인 후 친구에게 공유할 수 있어요.");
      return;
    }
    setFriendInviteSubmitting(true);
    try {
      // 먼저 루트를 collaborativeMode로 전환 (멤버 추가 가능하게)
      await commitCollaborativeMode();

      const title = routeTitle.trim() || "루트";
      const { chatRoomUuid, sent } = await inviteFriendsToRouteChat({
        accessToken,
        myUuid: authUser.uuid,
        routeId: rid,
        routeTitle: title,
        friendUuids,
        // 1명 초대: 기존 1대1 채팅방 재사용, existingChatRoomUuid 무시
        // 여러 명 초대: 새 그룹 채팅방 생성
        existingChatRoomUuid: friendUuids.length > 1 ? routeChatRoomUuid : null,
      });
      if (chatRoomUuid) patchRouteChatRoom(rid, chatRoomUuid);
      refreshCollabMembers();
      setFriendInviteOpen(false);
      if (sent) {
        showToast(`${friendUuids.length}명에게 초대했어요 · 채팅 탭에서 확인`);
      } else {
        Alert.alert(
          "초대 실패",
          "친구 초대에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
    } catch (err) {
      console.error('[handleInviteFriendsToRoute]', err);
      Alert.alert(
        "오류",
        "친구 초대 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setFriendInviteSubmitting(false);
    }
  };

  const saveRoute = async () => {
    if (routeSaving) return;
    setRouteSaving(true);
    try {
      await flushCollabRoutePush();
      await flushPersonalRouteAutoSave();
      await persistRouteToServer({ navigateBack: true, requireCoords: true });
    } finally {
      setRouteSaving(false);
    }
  };

  const updateLegMode = useCallback((legId: string, mode: TransportMode) => {
    setLegs((prev) =>
      prev.map((l) =>
        l.id === legId
          ? {
              ...l,
              mode,
              transitType:
                mode === "transit" ? (l.transitType ?? "subway") : undefined,
              directionsSummary: undefined,
              directionsDetail: undefined,
              distanceMeters: undefined,
              walkCandidates: undefined,
              selectedWalkCandidateId: undefined,
              transitCandidates: undefined,
              selectedTransitCandidateId: undefined,
            }
          : l,
      ),
    );
    if (mode !== "transit" && mode !== "walk") {
      setEditingLegId(null);
    }
  }, []);

  const updateLegTransitType = useCallback(
    (legId: string, transitType: TransitType) => {
      setLegs((prev) =>
        prev.map((l) =>
          l.id === legId && l.mode === "transit"
            ? {
                ...l,
                transitType,
                directionsSummary: undefined,
                directionsDetail: undefined,
                distanceMeters: undefined,
                transitCandidates: undefined,
                selectedTransitCandidateId: undefined,
              }
            : l,
        ),
      );
    },
    [],
  );

  const renderStopBadge = (kind: RouteStop["kind"]) => {
    if (kind === "start")
      return (
        <View className="rounded-md bg-blue-600 px-2 py-0.5">
          <Text className="text-[11px] font-bold text-white">출발</Text>
        </View>
      );
    if (kind === "end")
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
    if (stop.kind === "start")
      return (
        <View className="items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
          <Text className="text-xs font-bold text-white">P</Text>
        </View>
      );
    if (stop.kind === "end")
      return (
        <View className="items-center justify-center w-8 h-8 bg-red-500 rounded-full">
          <Text className="text-[10px] font-bold text-white">P</Text>
        </View>
      );
    const vn = viaStops.findIndex((v) => v.id === stop.id) + 1;
    return (
      <View className="items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
        <Text className="text-xs font-semibold text-blue-800">{vn}</Text>
      </View>
    );
  };

  /** 1개: 마커만, 2개 이상: 선 + 마커 (웹: 카카오 JS / 네이티브: expo-maps) */
  const mapPathProp = mapRoutePath.length >= 1 ? mapRoutePath : undefined;

  const mapViewLat =
    mapRoutePath[0]?.latitude ??
    mapPath[0]?.latitude ??
    initialMapCenter?.latitude ??
    MAP_DEFAULT_LAT;
  const mapViewLng =
    mapRoutePath[0]?.longitude ??
    mapPath[0]?.longitude ??
    initialMapCenter?.longitude ??
    MAP_DEFAULT_LNG;

  /** 하단 시트 둥근 모서리 뒤로 지도가 비치도록 살짝 겹침 (rounded-t-3xl ≈ 24px) */
  const ROUTE_SHEET_TOP_OVERLAP = 24;
  const bottomSheetPanelHeightPx = routeSheetHeightPx;

  return (
    <View className="flex-1" style={{ backgroundColor: "#4b5563" }}>
      <View
        style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
        pointerEvents="auto"
      >
        <AppMapView
          style={{ flex: 1 }}
          latitude={mapViewLat}
          longitude={mapViewLng}
          level={mapRoutePath.length >= 2 ? 6 : 8}
          fitToRoute={mapRoutePath.length >= 2 || pathStopsForMap.length >= 2}
          path={mapPathProp}
          segments={mapRouteSegments}
          stops={pathStopsForMap.length >= 1 ? pathStopsForMap : undefined}
          markers={mapMarkers}
        />
      </View>

      <View
        style={{
          flex: 1,
          zIndex: 1,
          pointerEvents: "box-none",
          paddingTop: insets.top + 8,
        }}
      >
        <View
          className="flex-row gap-2 px-3"
          style={{
            alignItems: showHeaderChatBelowShare ? "flex-start" : "center",
          }}
          pointerEvents="box-none"
        >
          <View className="items-center shrink-0" pointerEvents="box-none">
            <Pressable
              onPress={() => safeGoBack(navigation)}
              className="z-10 items-center justify-center w-12 h-12 bg-white rounded-full shadow-md active:opacity-90"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Ionicons name="chevron-back" size={24} color="#2563eb" />
            </Pressable>
            {showCollabMemberStack ? (
              <View className="items-center mt-2">
                <CollaboratorAvatarStack
                  members={collabMembers}
                  size={34}
                  onPress={() =>
                    rootNavigate("RouteCollaborators", {
                      routeId: activeRouteId,
                      routeTitle: routeTitle.trim() || "루트",
                      chatRoomUuid: routeChatRoomUuid,
                    })
                  }
                />
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => openSearch()}
            className="flex-row items-center flex-1 px-4 py-0 bg-white shadow-md rounded-2xl active:opacity-95"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              height: 48,
            }}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
          >
            <Text className="flex-1 text-[15px] text-gray-400">
              주소나 카테고리를 검색해보세요!
            </Text>
            <Ionicons name="search-outline" size={22} color="#6b7280" />
          </Pressable>

          <View className="items-center shrink-0" pointerEvents="box-none">
            <Pressable
              onPress={handleTopSharePress}
              className="items-center justify-center w-12 h-12 bg-white rounded-full shadow-md active:opacity-90"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
              accessibilityLabel="공유 루트로 전환 및 공유"
            >
              <Ionicons name="share-social-outline" size={22} color="#2563eb" />
            </Pressable>
            {showHeaderChatBelowShare ? (
              <Pressable
                onPress={() => void openRouteChat()}
                disabled={chatLinking}
                className="mt-1.5 h-10 w-11 items-center justify-center rounded-full bg-blue-600 shadow-md active:opacity-90"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  elevation: 4,
                }}
                accessibilityLabel="루트 채팅"
              >
                <Ionicons name="chatbubble-outline" size={20} color="#ffffff" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {showCollabMemberStack ? (
          <View className="px-3 mt-2" pointerEvents="box-none">
            <CollaboratorAvatarStack
              members={collabMembers}
              onPress={() =>
                rootNavigate("RouteCollaborators", {
                  routeId: activeRouteId,
                  routeTitle: routeTitle.trim() || "루트",
                })
              }
            />
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 0 }} pointerEvents="none" />

        <View
          className="bg-white border-t border-gray-200 rounded-t-3xl"
          style={{
            height: bottomSheetPanelHeightPx,
            flexShrink: 0,
            marginTop: -ROUTE_SHEET_TOP_OVERLAP,
            paddingBottom: Math.max(insets.bottom, 12),
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 20,
          }}
        >
          <View
            {...routeSheetPanResponder.panHandlers}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              backgroundColor: "#f1f5f9",
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: "#e2e8f0",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 5,
                borderRadius: 3,
                backgroundColor: "#94a3b8",
                marginBottom: 6,
              }}
            />
          </View>
          <View className="px-4 pt-3 pb-2 border-b border-gray-50">
            <View className="flex-row items-center">
              <Pressable
                onPress={() => void pickRouteCoverImage()}
                className="mr-3 overflow-hidden h-14 w-14 rounded-xl bg-slate-100 active:opacity-90"
                accessibilityLabel="루트 대표 이미지 설정"
              >
                {routeCoverImageUri ? (
                  <Image
                    source={{ uri: routeCoverImageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="items-center justify-center w-full h-full">
                    <Ionicons name="camera-outline" size={22} color="#94a3b8" />
                  </View>
                )}
              </Pressable>
              <View className="flex-row items-center flex-1 min-w-0">
                <TextInput
                  value={routeTitle}
                  onChangeText={(text) => {
                    routeTitleLastEditAtRef.current = Date.now();
                    setRouteTitle(text);
                  }}
                  onFocus={() => {
                    routeTitleAtFocusRef.current = routeTitle;
                    setRouteTitleFieldFocused(true);
                  }}
                  onBlur={() => {
                    setRouteTitleFieldFocused(false);
                    routeTitleLastEditAtRef.current = Date.now();
                  }}
                  placeholder="루트 이름 입력"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 text-[17px] font-bold text-gray-900"
                  maxLength={30}
                />
                <Text className="ml-2 text-xs font-medium text-gray-400">
                  {formatOverallDurationLabel(totalMinutes)}
                </Text>
              </View>
            </View>
            <Text className="mt-1.5 text-[10px] text-gray-400">
              대표 이미지 · 내 루트·공유 목록 카드에 표시돼요
            </Text>
          </View>

          <View className="px-4 pb-3 border-b border-gray-100">
            <Text className="mb-1.5 text-[11px] font-semibold text-gray-700">
              태그 (최대 {MAX_ROUTE_TAGS}개)
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {ROUTE_TAG_PRESETS.map((tag) => {
                const on = selectedTags.includes(tag);
                const disabled = !on && selectedTags.length >= MAX_ROUTE_TAGS;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleRouteTag(tag)}
                    disabled={disabled}
                    className={`rounded-full border px-2.5 py-1 ${
                      on
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white"
                    } ${disabled ? "opacity-40" : ""}`}
                  >
                    <Text
                      className={`text-[11px] font-medium ${on ? "text-blue-800" : "text-gray-700"}`}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isCollaborative &&
          collabCourseIdForSync &&
          (!collabCanEdit || isCourseSocketConnected) ? (
            <View className="px-4 pb-2 border-b border-blue-50">
              <Text
                className={`text-[10px] font-medium ${
                  !collabCanEdit ? "text-slate-500" : "text-blue-600"
                }`}
              >
                {!collabCanEdit
                  ? "읽기 전용 · 멤버 수정은 실시간으로 반영돼요"
                  : "멤버 수정이 실시간으로 반영돼요"}
              </Text>
            </View>
          ) : null}

          <View className="border-b border-gray-100 px-3 py-2.5">
            <View className="flex-row items-center gap-2">
              <View className="flex-1 min-w-0" />
              <View className="flex-row items-center gap-2 shrink-0">
                {isCollaborative ? (
                  <Pressable
                    onPress={() => void openRouteChat()}
                    disabled={chatLinking}
                    className="h-9 shrink-0 flex-row items-center justify-center rounded-xl bg-blue-600 px-3.5 active:opacity-90"
                  >
                    <Text className="text-sm font-bold text-white">
                      {chatLinking ? "연결…" : "채팅"}
                    </Text>
                  </Pressable>
                ) : null}
                {!isCollaborative ? (
                  <View className="h-9 flex-row items-center gap-1.5 rounded-xl bg-slate-100 px-2.5">
                    <Ionicons
                      name={publishToPublic ? "globe" : "lock-closed-outline"}
                      size={15}
                      color={publishToPublic ? "#2563eb" : "#64748b"}
                    />
                    <Text className="text-[11px] font-semibold text-gray-600">
                      공개
                    </Text>
                    <Switch
                      value={publishToPublic}
                      onValueChange={(v) => void handlePublishToPublicChange(v)}
                      trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                      thumbColor={publishToPublic ? "#2563eb" : "#f4f4f5"}
                      accessibilityLabel="공개 코스"
                      style={{
                        transform: [{ scaleX: 0.88 }, { scaleY: 0.88 }],
                      }}
                    />
                  </View>
                ) : null}
                <Pressable
                  onPress={() => void saveRoute()}
                  disabled={routeSaving}
                  className="h-9 shrink-0 flex-row items-center justify-center rounded-xl bg-blue-600 px-3.5 active:opacity-90"
                  style={{ opacity: routeSaving ? 0.85 : 1 }}
                >
                  {routeSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-bold text-white">저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          <View
            ref={itineraryListViewportRef}
            className="flex-1"
            collapsable={false}
          >
            <ScrollView
              ref={itineraryScrollRef}
              className="flex-1 px-3"
              scrollEnabled={
                viaDrag?.phase !== "lift" && viaDrag?.phase !== "drag"
              }
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
              contentContainerStyle={{
                paddingBottom: 16,
                position: "relative",
              }}
            >
              {stops.map((stop, index) => {
                const isDragRow = viaDrag != null && viaDrag.viaId === stop.id;
                const cardOpacity = isDragRow
                  ? viaDrag.phase === "lift"
                    ? 0.4
                    : 0.18
                  : 1;
                const viaIdx = viaStops.findIndex((v) => v.id === stop.id);
                const originalHint = stopOriginalTitleHint(stop);
                return (
                  <View
                    key={stop.id}
                    ref={(r) => {
                      stopRowRefs.current[stop.id] = r;
                    }}
                    collapsable={false}
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      stopLayoutsRef.current[stop.id] = {
                        top: y,
                        bottom: y + height,
                      };
                    }}
                  >
                    <View className="flex-row">
                      <View className="items-center w-10">
                        {index > 0 ? (
                          <View
                            style={{
                              width: 3,
                              height: 8,
                              backgroundColor: "#2563eb",
                              opacity: 0.75,
                            }}
                          />
                        ) : null}
                        {renderTimelineDot(stop)}
                        {index < stops.length - 1 ? (
                          <View
                            style={{
                              width: 3,
                              flex: 1,
                              minHeight: 20,
                              backgroundColor: "#2563eb",
                              opacity: 0.75,
                            }}
                          />
                        ) : null}
                      </View>

                      <View
                        className="flex-1 p-3 mb-2 ml-2 rounded-xl bg-gray-50/80"
                        style={{
                          opacity: cardOpacity,
                          ...(isDragRow
                            ? {
                                borderWidth: 2,
                                borderStyle: "dashed" as const,
                                borderColor: "#93c5fd",
                              }
                            : {}),
                        }}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 min-w-0">
                            <View className="flex-row flex-wrap items-center gap-2">
                              {renderStopBadge(stop.kind)}
                              <Text
                                className="text-base font-bold text-gray-900"
                                numberOfLines={2}
                              >
                                {stop.title}
                              </Text>
                            </View>
                            {originalHint ? (
                              <Text
                                className="mt-0.5 text-xs text-gray-400"
                                numberOfLines={1}
                              >
                                {originalHint}
                              </Text>
                            ) : null}
                          </View>
                          <View className="flex-row items-center gap-0.5">
                            {stop.lat != null && stop.lng != null ? (
                              <Pressable
                                onPress={() => changeStopPlace(stop)}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel="장소 변경"
                              >
                                <Ionicons
                                  name="location-outline"
                                  size={18}
                                  color="#6b7280"
                                />
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={() => editStopName(stop)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={
                                stop.lat != null && stop.lng != null
                                  ? "이름 변경"
                                  : "장소 검색"
                              }
                            >
                              <Ionicons
                                name="pencil-outline"
                                size={18}
                                color="#6b7280"
                              />
                            </Pressable>
                            {stop.kind === "via" ? (
                              <Pressable
                                onPress={() => removeStop(stop.id)}
                                hitSlop={6}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={18}
                                  color="#ef4444"
                                />
                              </Pressable>
                            ) : null}
                            {stop.kind === "via" ? (
                              <ViaDragHandle
                                disabled={viaStops.length < 1}
                                onLift={() =>
                                  handleViaLift(stop.id, viaIdx, stop.title)
                                }
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
                        {stop.kind === "end" ? (
                          <Text className="mt-1 text-xs font-semibold text-blue-800">
                            총 예상 소요{" "}
                            {formatOverallDurationLabel(totalMinutes)}
                          </Text>
                        ) : stop.kind === "via" ? (
                          <Text className="mt-1 text-xs text-gray-500">
                            {stop.timeLine}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {index < stops.length - 1 && legs[index] && (
                      <Pressable
                        onPress={() => setEditingLegId(legs[index].id)}
                        className="py-1 pl-2 mb-2 ml-12 active:opacity-70"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: "rgba(37, 99, 235, 0.35)",
                        }}
                      >
                        <View className="flex-row items-center">
                          <MaterialCommunityIcons
                            name={transportIcon(legs[index].mode) as any}
                            size={18}
                            color="#2563eb"
                          />
                          <Text className="flex-1 ml-2 text-xs font-medium text-blue-900/80">
                            {legTransportLabel(
                              legs[index].mode,
                              legs[index].transitType,
                            )}{" "}
                            수정
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color="#94a3b8"
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                        {(() => {
                          const legSummary = sanitizeRouteDisplayText(
                            legs[index].directionsSummary,
                          );
                          if (!legSummary) return null;
                          return (
                            <Text
                              className="mt-0.5 pl-7 text-[11px] leading-4 text-slate-600"
                              numberOfLines={2}
                            >
                              {legSummary}
                            </Text>
                          );
                        })()}
                      </Pressable>
                    )}
                    {index < stops.length - 1 &&
                    legs[index]?.mode === "walk" &&
                    legs[index].walkCandidates &&
                    legs[index].walkCandidates!.length > 1 ? (
                      <View className="mb-2 ml-12 pl-2 flex-row flex-wrap gap-1.5">
                        <Text className="mb-0.5 w-full text-[10px] font-semibold text-blue-800">
                          보도 선택
                        </Text>
                        {legs[index].walkCandidates!.map((c) => {
                          const selectedId =
                            legs[index].selectedWalkCandidateId ??
                            legs[index].walkCandidates![0].id;
                          const on = selectedId === c.id;
                          return (
                            <Pressable
                              key={c.id}
                              onPress={() =>
                                selectWalkCandidate(legs[index].id, c.id)
                              }
                              className={`rounded-lg border px-2.5 py-1.5 ${
                                on
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 bg-white"
                              }`}
                            >
                              <Text
                                className={`text-[11px] font-bold ${
                                  on ? "text-blue-900" : "text-gray-700"
                                }`}
                              >
                                {c.label}
                              </Text>
                              <Text className="text-[10px] text-gray-500">
                                약 {c.durationMinutes}분
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    {index < stops.length - 1 &&
                    legs[index]?.mode === "transit" &&
                    legs[index].transitCandidates &&
                    legs[index].transitCandidates!.length > 0 ? (
                      <View className="pl-2 mb-2 ml-12">
                        <Text className="mb-1.5 text-[10px] font-semibold text-sky-800">
                          대중교통 경로 ({legs[index].transitCandidates!.length}
                          개)
                        </Text>
                        {legs[index].transitCandidates!.map((c) => {
                          const selectedId =
                            legs[index].selectedTransitCandidateId ??
                            legs[index].transitCandidates![0].id;
                          const on = selectedId === c.id;
                          return (
                            <Pressable
                              key={c.id}
                              onPress={() =>
                                selectTransitCandidate(legs[index].id, c.id)
                              }
                              className={`mb-1.5 rounded-xl border px-3 py-2.5 ${
                                on
                                  ? "border-sky-500 bg-sky-50"
                                  : "border-gray-200 bg-white"
                              }`}
                            >
                              <Text
                                className={`text-[12px] font-bold ${
                                  on ? "text-sky-900" : "text-gray-800"
                                }`}
                                numberOfLines={2}
                              >
                                {c.summary}
                              </Text>
                              <View className="flex-row flex-wrap gap-2 mt-1">
                                {c.departureLabel ? (
                                  <Text className="text-[11px] font-semibold text-emerald-700">
                                    {c.departureLabel}
                                  </Text>
                                ) : null}
                                {c.arrivalLabel ? (
                                  <Text className="text-[11px] font-semibold text-blue-700">
                                    {c.arrivalLabel}
                                  </Text>
                                ) : null}
                                <Text className="text-[11px] text-gray-600">
                                  약 {c.durationMinutes}분
                                  {c.transfers > 0
                                    ? ` · 환승 ${c.transfers}회`
                                    : ""}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {viaDrag &&
              (viaDrag.phase === "lift" || viaDrag.phase === "drag") ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 44,
                    right: 12,
                    top: Math.max(0, viaDrag.insertLineY - 2),
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#2563eb",
                    zIndex: 20,
                    shadowColor: "#2563eb",
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
      </View>

      <Modal
        visible={viaDrag?.phase === "drag"}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {viaDrag?.phase === "drag" ? (
            <View
              style={{
                position: "absolute",
                ...clampViaGhostLayout(viaDrag),
                opacity: 0.94,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                borderWidth: 2,
                borderColor: "#2563eb",
                paddingHorizontal: 12,
                paddingVertical: 10,
                shadowColor: "#000",
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
                <Text
                  className="flex-1 text-sm font-bold text-gray-900"
                  numberOfLines={2}
                >
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

      <Modal
        visible={searchOpen}
        animationType="slide"
        onRequestClose={closeSearch}
        statusBarTranslucent={false}
      >
        <View
          className="flex-1 bg-[#f5f5f9]"
          style={{ paddingTop: insets.top + 8 }}
        >
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-row items-center gap-2 border-b border-gray-200 px-3 py-2.5">
              <Pressable
                onPress={closeSearch}
                className="items-center justify-center w-10 h-10 bg-white rounded-full active:opacity-80"
              >
                <Ionicons name="chevron-back" size={22} color="#2563eb" />
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
              <Text className="mb-1 text-[11px] font-bold text-gray-800">
                검색 옵션
              </Text>
              <Text className="mb-1 text-[10px] font-semibold text-gray-600">
                정렬
              </Text>
              <View className="flex-row gap-2 mb-2">
                <Pressable
                  onPress={() => setSearchSort("accuracy")}
                  className={`rounded-lg border px-3 py-1.5 ${
                    searchSort === "accuracy"
                      ? "border-sky-500 bg-sky-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${searchSort === "accuracy" ? "text-sky-800" : "text-gray-700"}`}
                  >
                    정확도순
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!canUseDistanceSort}
                  onPress={() => setSearchSort("distance")}
                  className={`rounded-lg border px-3 py-1.5 ${
                    searchSort === "distance"
                      ? "border-sky-500 bg-sky-50"
                      : "border-gray-200 bg-gray-50"
                  } ${!canUseDistanceSort ? "opacity-40" : ""}`}
                >
                  <Text
                    className={`text-[11px] font-bold ${searchSort === "distance" ? "text-sky-800" : "text-gray-700"}`}
                  >
                    거리순
                  </Text>
                </Pressable>
              </View>
              {searchSort === "distance" && canUseDistanceSort ? (
                <View className="mb-2">
                  <Text className="mb-1 text-[10px] font-semibold text-gray-600">
                    기준점 주변 반경
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {SEARCH_RADIUS_OPTIONS.map(({ meters, label }) => (
                      <Pressable
                        key={label}
                        onPress={() => setSearchRadiusMeters(meters)}
                        className={`rounded-lg border px-2.5 py-1 ${
                          searchRadiusMeters === meters
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            searchRadiusMeters === meters
                              ? "text-blue-900"
                              : "text-gray-700"
                          }`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text className="mt-1 text-[10px] text-gray-500">
                    30km 이상·무제한 검색은 넓은 범위 기준으로 결과가 달라질 수
                    있어요.
                  </Text>
                </View>
              ) : null}
              <Text className="mb-1 text-[10px] font-semibold text-gray-600">
                업종 필터
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {KAKAO_KEYWORD_CATEGORY_OPTIONS.map((opt) => {
                  const on = searchCategoryCode === opt.code;
                  return (
                    <Pressable
                      key={opt.code || "all"}
                      onPress={() => setSearchCategoryCode(opt.code)}
                      className={`rounded-full border px-3 py-1.5 ${
                        on
                          ? "border-sky-500 bg-sky-50"
                          : "border-gray-200 bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${on ? "text-sky-800" : "text-gray-700"}`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {!canUseDistanceSort ? (
                <Text className="mt-2 text-[10px] leading-4 text-blue-800">
                  거리순은 현재 위치 권한 허용 또는 루트 좌표(출발/도착) 설정 후
                  사용할 수 있습니다.
                </Text>
              ) : null}
              {canUseDistanceSort ? (
                <Text className="mt-2 text-[10px] leading-4 text-slate-600">
                  기준점:{" "}
                  {searchCenterSource === "user"
                    ? "현재 사용자 위치"
                    : "루트 정류장 중심점"}
                </Text>
              ) : null}
            </View>

            <ScrollView
              className="flex-1 px-3"
              keyboardShouldPersistTaps="handled"
            >
              <>
                <Text className="px-1 mb-2 text-sm font-bold text-gray-800">
                  검색결과
                </Text>
                {searchLoading ? (
                  <Text className="py-8 text-sm text-center text-gray-500">
                    검색 중...
                  </Text>
                ) : searchError ? (
                  <Text className="py-8 text-sm text-center text-rose-500">
                    {searchError}
                  </Text>
                ) : searchResults.length === 0 ? (
                  <Text className="py-8 text-sm text-center text-gray-500">
                    {searchQuery.trim() === ""
                      ? "필터나 검색을 통해 찾아보세요!"
                      : "검색 결과가 없습니다. 필터나 다른 키워드로 찾아보세요!"}
                  </Text>
                ) : (
                  searchResults.map((p) => {
                    const expanded = selectedPlaceId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setSelectedPlaceId(p.id)}
                        className={`mb-2 overflow-hidden rounded-xl border bg-white active:opacity-95 ${
                          expanded ? "border-sky-500" : "border-gray-200"
                        }`}
                      >
                        <View className="flex-row items-center p-3">
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-gray-900">
                              {p.name}
                            </Text>
                            {p.category ? (
                              <Text
                                className="text-[10px] font-medium text-sky-700"
                                numberOfLines={1}
                              >
                                {p.category}
                              </Text>
                            ) : null}
                            <Text className="text-xs text-gray-500">
                              {p.distance}
                            </Text>
                            <Text
                              className="text-xs text-gray-400"
                              numberOfLines={2}
                            >
                              {p.address}
                            </Text>
                          </View>
                          <Ionicons
                            name="add-circle-outline"
                            size={26}
                            color="#3b82f6"
                          />
                        </View>
                        {expanded && (
                          <View className="px-3 py-3 border-t border-gray-100 bg-gray-50">
                            <Text className="text-sm text-center text-gray-700">
                              선택하신 {TRANSPORT_LABELS.transit}(으)로 이동 시
                              약 {estimateMinutes("transit", p.id)}분
                            </Text>
                          </View>
                        )}
                        {expanded &&
                          showAddButton &&
                          selectedPlaceId === p.id && (
                            <Pressable
                              onPress={addStopToRoute}
                              className="items-center border-t border-gray-200 bg-white py-3.5 active:bg-gray-50"
                            >
                              <Text className="text-base font-bold text-gray-900">
                                {searchTargetStopId
                                  ? "이 위치로 변경"
                                  : "경로에 추가"}
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
        </View>
      </Modal>

      <RouteCollaborativeChatSheet
        visible={isCollaborative && chatOpen}
        onClose={() => setChatOpen(false)}
        accessToken={accessToken}
        myUuid={authUser?.uuid}
        chatRoomUuid={routeChatRoomUuid}
        routeId={persistedRouteId ?? undefined}
        routeTitle={routeTitle.trim() || "루트"}
        roomName={
          activeChatRoomMeta?.name ??
          buildRouteGroupChatName(routeTitle.trim() || "루트")
        }
        memberCount={
          activeChatRoomMeta?.memberCount ?? Math.max(2, collabMembers.length)
        }
        linkedChatRoom={linkedRouteChatRoom}
        onSelectChatRoom={
          accessToken
            ? (room) => {
                handleSelectRouteChatRoom(room);
              }
            : undefined
        }
      />

      <CollaborativeFriendInviteModal
        visible={friendInviteOpen}
        onClose={() => setFriendInviteOpen(false)}
        accessToken={accessToken}
        onConfirm={handleInviteFriendsToRoute}
        submitting={friendInviteSubmitting}
      />

      <Modal visible={!!editingLegId} transparent animationType="fade">
        <View className="justify-center flex-1 px-6">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            className="bg-black/40"
            onPress={() => setEditingLegId(null)}
          />
          <View
            className="max-h-[85%] rounded-2xl bg-white p-5"
            style={{ zIndex: 1 }}
          >
            <Text className="mb-3 text-lg font-bold text-gray-900">
              이동 수단 변경
            </Text>
            {(() => {
              const leg = legs.find((l) => l.id === editingLegId);
              const legDetail = sanitizeRouteDisplayText(leg?.directionsDetail);
              if (!legDetail) return null;
              return (
                <ScrollView
                  className="px-3 py-2 mb-3 border max-h-40 rounded-xl border-slate-100 bg-slate-50"
                  nestedScrollEnabled
                >
                  <Text className="text-xs leading-5 text-slate-700">
                    {legDetail}
                  </Text>
                </ScrollView>
              );
            })()}
            {(Object.keys(TRANSPORT_LABELS) as TransportMode[]).map((mode) => {
              const leg = legs.find((l) => l.id === editingLegId);
              const isSelected = leg?.mode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() =>
                    editingLegId && updateLegMode(editingLegId, mode)
                  }
                  className={`mb-2 flex-row items-center rounded-xl border-2 px-4 py-3 active:opacity-90 ${
                    isSelected
                      ? "border-sky-500 bg-sky-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <MaterialCommunityIcons
                    name={transportIcon(mode) as any}
                    size={22}
                    color={isSelected ? "#0284c7" : "#6b7280"}
                  />
                  <Text
                    className={`ml-3 text-base font-semibold ${
                      isSelected ? "text-sky-700" : "text-gray-700"
                    }`}
                  >
                    {TRANSPORT_LABELS[mode]}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#0284c7"
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </Pressable>
              );
            })}
            {(() => {
              const leg = legs.find((l) => l.id === editingLegId);
              if (
                !leg ||
                leg.mode !== "walk" ||
                !leg.walkCandidates ||
                leg.walkCandidates.length < 2
              ) {
                return null;
              }
              return (
                <View className="mt-2">
                  <Text className="mb-2 text-sm font-semibold text-gray-800">
                    보도 경로 선택
                  </Text>
                  {leg.walkCandidates.map((c) => {
                    const selectedId =
                      leg.selectedWalkCandidateId ?? leg.walkCandidates![0].id;
                    const on = selectedId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() =>
                          editingLegId &&
                          selectWalkCandidate(editingLegId, c.id)
                        }
                        className={`mb-2 rounded-xl border-2 px-3 py-2.5 ${
                          on
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${on ? "text-blue-900" : "text-gray-800"}`}
                        >
                          {c.label}
                        </Text>
                        <Text className="mt-0.5 text-xs text-gray-600">
                          {c.summary}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()}
            {(() => {
              const leg = legs.find((l) => l.id === editingLegId);
              if (!leg || leg.mode !== "transit") return null;
              return (
                <View className="mt-2">
                  <Text className="mb-2 text-sm font-semibold text-gray-800">
                    대중교통 종류 (필터)
                  </Text>
                  <View className="flex-row gap-2 mb-3">
                    {(Object.keys(TRANSIT_TYPE_LABELS) as TransitType[]).map(
                      (tt) => {
                        const on = (leg.transitType ?? "subway") === tt;
                        return (
                          <Pressable
                            key={tt}
                            onPress={() =>
                              editingLegId &&
                              updateLegTransitType(editingLegId, tt)
                            }
                            className={`flex-1 items-center rounded-xl border px-3 py-2.5 ${
                              on
                                ? "border-sky-500 bg-sky-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <Text
                              className={`text-sm font-semibold ${on ? "text-sky-700" : "text-gray-700"}`}
                            >
                              {TRANSIT_TYPE_LABELS[tt]}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                  <Text className="mb-2 text-sm font-semibold text-gray-800">
                    이용 가능한 경로
                  </Text>
                  <ScrollView className="max-h-56" nestedScrollEnabled>
                    {leg.transitCandidates &&
                    leg.transitCandidates.length > 0 ? (
                      leg.transitCandidates.map((c) => {
                        const selectedId =
                          leg.selectedTransitCandidateId ??
                          leg.transitCandidates![0].id;
                        const on = selectedId === c.id;
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() =>
                              editingLegId &&
                              selectTransitCandidate(editingLegId, c.id)
                            }
                            className={`mb-2 rounded-xl border-2 px-3 py-3 ${
                              on
                                ? "border-sky-500 bg-sky-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <Text
                              className={`text-sm font-bold ${on ? "text-sky-900" : "text-gray-900"}`}
                            >
                              {c.summary}
                            </Text>
                            <View className="mt-1.5 flex-row flex-wrap gap-x-3 gap-y-1">
                              {c.departureLabel ? (
                                <Text className="text-xs font-semibold text-emerald-700">
                                  {c.departureLabel}
                                </Text>
                              ) : null}
                              {c.arrivalLabel ? (
                                <Text className="text-xs font-semibold text-blue-700">
                                  {c.arrivalLabel}
                                </Text>
                              ) : null}
                            </View>
                            <Text className="mt-1 text-xs text-gray-600">
                              약 {c.durationMinutes}분
                              {c.transfers > 0
                                ? ` · 환승 ${c.transfers}회`
                                : ""}
                              {c.distanceMeters > 0
                                ? ` · ${c.distanceMeters < 1000 ? `${c.distanceMeters}m` : `${(c.distanceMeters / 1000).toFixed(1)}km`}`
                                : ""}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text className="py-4 text-xs text-center text-gray-500">
                        대중교통 경로를 조회하는 중이거나, 이 구간에 승차 정보가
                        없습니다.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {routeSaving ? (
        <View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 200, elevation: 200 },
          ]}
          className="items-center justify-center bg-black/35"
        >
          <View
            className="items-center px-8 py-6 bg-white rounded-2xl"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <ActivityIndicator size="large" color="#16a34a" />
            <Text className="mt-3 text-base font-semibold text-gray-900">
              저장하는 중…
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              잠시만 기다려 주세요
            </Text>
          </View>
        </View>
      ) : null}

      <Modal visible={!!editingStop} transparent animationType="fade">
        <View className="justify-center flex-1 px-6">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            className="bg-black/40"
            onPress={() => setEditingStop(null)}
          />
          <View className="p-5 bg-white rounded-2xl" style={{ zIndex: 1 }}>
            <Text className="text-lg font-bold text-gray-900">표시 이름</Text>
            <Text className="mt-1 text-xs text-gray-500">
              지도·검색에 쓰인 원래 이름은 아래에 그대로 남아요.
            </Text>
            {editingStop &&
            editingStop.lat != null &&
            String(editingStop.originalTitle ?? editingStop.title).trim() ? (
              <Text className="mt-1 text-xs text-gray-400" numberOfLines={2}>
                원래 이름:{" "}
                {String(editingStop.originalTitle ?? editingStop.title).trim()}
              </Text>
            ) : null}
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              className="px-3 py-3 mt-3 text-base text-gray-900 border border-gray-200 rounded-xl"
              placeholder="표시할 이름"
              autoFocus
            />
            <View className="flex-row justify-end gap-2 mt-4">
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
      {isCollaborativeLinkEntry && collabEntryStatus === "checking" ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            zIndex: 100,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.92)",
          }}
        >
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
            공동 루트 확인 중…
          </Text>
        </View>
      ) : null}
    </View>
  );
}
