// @ts-nocheck
/**
 * 코스 「안내」 — 지도 중심, 턴바이턴·음성 없음.
 * 코스 입구 안내: 내 위치 ↔ 코스 출발점 도보 경로 + 사용자 방향 기준 지도 회전.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import type { RootStackParamList } from "../App";
import AppMapView from "../components/AppMapView";
import type { MapMarkerPoint, MapRouteSegment } from "../components/mapTypes";
import {
  buildMapMarkersFromPathPoints,
  spreadOverlappingMapMarkers,
} from "../utils/spreadMapMarkers";
import { simplifyRoutePath } from "../utils/simplifyRoutePath";
import {
  guideMapHeadingFromDevice,
  normalizeDeviceHeading,
} from "../utils/mapBearing";
import { resolveCourseDetailForRoute } from "../api/courses";
import { safeGoBack } from "../navigation/rootNavigation";
import { useMockData } from "../context/MockDataContext";
import {
  fetchGoogleDirectionsLeg,
  fetchMergedDirectionsPolyline,
} from "../data/googleDirectionsApi";
import {
  computeMapRouteFit,
  getCourseMapCenter,
  getCourseStepMapPoint,
  type CourseItem,
} from "../data/mockData";
import {
  userRouteMapPath,
  userRouteToCourseItem,
  userRouteMapCenter,
} from "../data/userSavedRoute";

const APPROACH_LINE_COLOR = "#22c55e";
const COURSE_LINE_COLOR = "#2563eb";
const GUIDE_FOLLOW_ZOOM = 17;

type GuideNav = NativeStackNavigationProp<RootStackParamList, "CourseGuide">;
type GuideRoute = RouteProp<RootStackParamList, "CourseGuide">;
type LatLng = { latitude: number; longitude: number };

function sameCourseId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  return String(a ?? "") === String(b ?? "");
}

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function CourseGuideScreen(): React.JSX.Element {
  const navigation = useNavigation<GuideNav>();
  const route = useRoute<GuideRoute>();
  const insets = useSafeAreaInsets();
  const { courseId, courseTitle: paramTitle } = route.params;
  const { userSavedRoutes } = useMockData();

  const [course, setCourse] = useState<CourseItem | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [approachPath, setApproachPath] = useState<LatLng[] | null>(null);
  const [approachMeta, setApproachMeta] = useState<{
    minutes: number;
    distanceM: number;
    summary: string;
  } | null>(null);
  const [approachLoading, setApproachLoading] = useState(false);
  const [entranceNavActive, setEntranceNavActive] = useState(false);
  const [camera, setCamera] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    fitToRoute: boolean;
  } | null>(null);

  const lastApproachFetchRef = useRef<string>("");
  const lastGpsLogAtRef = useRef(0);

  const ur = useMemo(
    () => userSavedRoutes.find((r) => sameCourseId(r.id, courseId)),
    [userSavedRoutes, courseId],
  );

  useEffect(() => {
    let mounted = true;
    setLoadingCourse(true);
    const local = ur ? userRouteToCourseItem(ur) : null;
    if (local) {
      setCourse(local);
      setLoadingCourse(false);
    }
    resolveCourseDetailForRoute(courseId)
      .then(({ course: apiCourse }) => {
        if (!mounted) return;
        if (apiCourse) setCourse(apiCourse);
        else if (!local) setCourse(null);
      })
      .catch(() => {
        if (mounted && !local) setCourse(null);
      })
      .finally(() => {
        if (mounted) setLoadingCourse(false);
      });
    return () => {
      mounted = false;
    };
  }, [courseId, ur]);

  const stopPoints = useMemo((): LatLng[] => {
    if (!course) return [];
    if (ur && userRouteMapPath(ur).length >= 1) return userRouteMapPath(ur);
    const steps = course.routeSteps ?? [];
    if (steps.length < 1) return [];
    return steps.map((step, i) => {
      if (step.lat != null && step.lng != null) {
        return { latitude: step.lat, longitude: step.lng };
      }
      const p = getCourseStepMapPoint(course.id, i, steps.length);
      return { latitude: p.lat, longitude: p.lng };
    });
  }, [course, ur]);

  const courseStart = useMemo(
    () => (stopPoints.length >= 1 ? stopPoints[0] : null),
    [stopPoints],
  );

  useEffect(() => {
    if (stopPoints.length < 2) {
      setRoutePath(null);
      setPathLoading(false);
      return;
    }
    const ac = new AbortController();
    setPathLoading(true);
    setRoutePath(null);
    fetchMergedDirectionsPolyline({
      points: stopPoints,
      mode: "transit",
      signal: ac.signal,
    })
      .then((path) => {
        if (!ac.signal.aborted && path.length >= 2) setRoutePath(path);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setPathLoading(false);
      });
    return () => ac.abort();
  }, [stopPoints]);

  const polylinePath = useMemo(
    () =>
      simplifyRoutePath(
        routePath && routePath.length >= 2 ? routePath : stopPoints,
      ),
    [routePath, stopPoints],
  );

  useEffect(() => {
    if (!userLocation || !courseStart) {
      setApproachPath(null);
      setApproachMeta(null);
      setApproachLoading(false);
      return;
    }
    const dist = metersBetween(userLocation, courseStart);
    if (dist < 12) {
      setApproachPath([userLocation, courseStart]);
      setApproachMeta({ minutes: 1, distanceM: Math.round(dist), summary: "도착" });
      setApproachLoading(false);
      return;
    }

    const key = `${userLocation.latitude.toFixed(4)},${userLocation.longitude.toFixed(4)}`;
    if (lastApproachFetchRef.current === key) return;

    const ac = new AbortController();
    setApproachLoading(true);
    fetchGoogleDirectionsLeg({
      from: userLocation,
      to: courseStart,
      mode: "walking",
      signal: ac.signal,
    })
      .then((leg) => {
        if (ac.signal.aborted) return;
        const pts =
          leg.path && leg.path.length >= 2
            ? leg.path
            : [userLocation, courseStart];
        setApproachPath(pts);
        setApproachMeta({
          minutes: leg.durationMinutes ?? 1,
          distanceM: leg.distanceMeters ?? Math.round(dist),
          summary: leg.summary ?? "",
        });
        lastApproachFetchRef.current = key;
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setApproachPath([userLocation, courseStart]);
          setApproachMeta({
            minutes: Math.max(1, Math.round(dist / 80)),
            distanceM: Math.round(dist),
            summary: "",
          });
          lastApproachFetchRef.current = key;
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setApproachLoading(false);
      });
    return () => ac.abort();
  }, [userLocation, courseStart]);

  const mapSegments = useMemo((): MapRouteSegment[] => {
    const segs: MapRouteSegment[] = [];
    if (entranceNavActive) {
      const approach = simplifyRoutePath(approachPath);
      if (approach && approach.length >= 2) {
        segs.push({
          id: "approach",
          points: approach,
          color: APPROACH_LINE_COLOR,
          width: 5,
        });
      }
    }
    if (polylinePath && polylinePath.length >= 2) {
      segs.push({
        id: "course",
        points: polylinePath,
        color: COURSE_LINE_COLOR,
        width: 4,
        dashed: entranceNavActive,
      });
    }
    return segs;
  }, [approachPath, polylinePath, entranceNavActive]);

  const mapMarkers = useMemo((): MapMarkerPoint[] | undefined => {
    const stops: MapMarkerPoint[] =
      stopPoints.length >= 1
        ? buildMapMarkersFromPathPoints(stopPoints).map((m, i) =>
            i === 0
              ? { ...m, label: "출발", kind: "start" as const, color: "#2563eb" }
              : m,
          )
        : [];
    if (userLocation) {
      stops.push({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        label: "나",
        color: "#22c55e",
      });
    }
    return stops.length > 0 ? spreadOverlappingMapMarkers(stops) : undefined;
  }, [stopPoints, userLocation]);

  const mapHeading = useMemo(() => {
    if (!entranceNavActive || !userLocation) return undefined;
    const target = courseStart ?? userLocation;
    return guideMapHeadingFromDevice(deviceHeading, userLocation, target);
  }, [entranceNavActive, userLocation, courseStart, deviceHeading]);

  const fitCameraToRoute = useCallback(() => {
    const fitPoints: LatLng[] = [];
    if (approachPath && approachPath.length >= 2) fitPoints.push(...approachPath);
    if (polylinePath && polylinePath.length >= 2) fitPoints.push(...polylinePath);
    else if (stopPoints.length >= 1) fitPoints.push(...stopPoints);
    if (userLocation) fitPoints.push(userLocation);

    const fit = computeMapRouteFit(fitPoints, {
      minZoom: 10,
      maxZoom: 16,
      paddingZoomOut: 0.85,
    });
    if (fit) {
      setCamera({
        lat: fit.lat,
        lng: fit.lng,
        zoom: fit.zoom,
        fitToRoute: false,
      });
      return;
    }
    const center = ur
      ? userRouteMapCenter(ur)
      : getCourseMapCenter(courseId);
    setCamera({ lat: center.lat, lng: center.lng, fitToRoute: true });
  }, [approachPath, polylinePath, stopPoints, userLocation, ur, courseId]);

  /** 자동 카메라 맞춤: 코스 경로 중심(내 위치 변화로 재실행되지 않음) */
  const fitCameraToCourse = useCallback(() => {
    const fitPoints: LatLng[] = [];
    if (polylinePath && polylinePath.length >= 2) fitPoints.push(...polylinePath);
    else if (stopPoints.length >= 1) fitPoints.push(...stopPoints);

    const fit = computeMapRouteFit(fitPoints, {
      minZoom: 10,
      maxZoom: 16,
      paddingZoomOut: 0.85,
    });
    if (fit) {
      setCamera({
        lat: fit.lat,
        lng: fit.lng,
        zoom: fit.zoom,
        fitToRoute: false,
      });
      return;
    }
    const center = ur
      ? userRouteMapCenter(ur)
      : getCourseMapCenter(courseId);
    setCamera({ lat: center.lat, lng: center.lng, fitToRoute: true });
  }, [polylinePath, stopPoints, ur, courseId]);

  useEffect(() => {
    if (!course && loadingCourse) return;
    if (!entranceNavActive) fitCameraToCourse();
  }, [course, loadingCourse, fitCameraToCourse, entranceNavActive]);

  useEffect(() => {
    let posSub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (__DEV__) {
        console.log("[GPS] foreground permission status =", status);
      }
      if (status !== "granted") {
        setLocationDenied(true);
        if (__DEV__) {
          console.log("[GPS] permission denied - tracking unavailable");
        }
        return;
      }
      setLocationDenied(false);

      try {
        headSub = await Location.watchHeadingAsync((h) => {
          const deg = normalizeDeviceHeading(
            h.trueHeading >= 0 ? h.trueHeading : h.magHeading,
          );
          if (deg != null) setDeviceHeading(deg);
        });
      } catch {
        /* 나침반 미지원 기기 */
        if (__DEV__) {
          console.log("[GPS] heading watch unavailable on this device");
        }
      }

      posSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
          timeInterval: 1500,
        },
        (loc) => {
          const now = Date.now();
          if (__DEV__ && now - lastGpsLogAtRef.current > 5000) {
            lastGpsLogAtRef.current = now;
            console.log("[GPS] tracking OK", {
              lat: Number(loc.coords.latitude.toFixed(6)),
              lng: Number(loc.coords.longitude.toFixed(6)),
              accuracyM: loc.coords.accuracy,
              heading: loc.coords.heading,
              speed: loc.coords.speed,
              timestamp: loc.timestamp,
            });
          }
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const moveHeading = normalizeDeviceHeading(loc.coords.heading);
          if (moveHeading != null) {
            setDeviceHeading(moveHeading);
          }
        },
      );
      if (__DEV__) {
        console.log("[GPS] watchPosition subscribed");
      }
    })();

    return () => {
      cancelled = true;
      posSub?.remove();
      headSub?.remove();
      if (__DEV__) {
        console.log("[GPS] tracking unsubscribed");
      }
    };
  }, []);

  const focusMyLocation = useCallback(() => {
    if (!userLocation) return;
    setCamera({
      lat: userLocation.latitude,
      lng: userLocation.longitude,
      zoom: GUIDE_FOLLOW_ZOOM,
      fitToRoute: false,
    });
  }, [userLocation]);

  const onEntranceNavToggle = useCallback(
    (next: boolean) => {
      setEntranceNavActive(next);
      if (!next) {
        requestAnimationFrame(() => fitCameraToRoute());
      }
    },
    [fitCameraToRoute],
  );

  const title = course?.title ?? paramTitle ?? "코스 안내";
  const departure = course?.departure ?? "—";
  const arrival = course?.arrival ?? "—";

  const mapLat = camera?.lat ?? 37.5665;
  const mapLng = camera?.lng ?? 126.978;
  const mapZoom = camera?.zoom;
  const mapFitToRoute =
    !entranceNavActive && (camera?.fitToRoute ?? true);

  const approachLabel = useMemo(() => {
    if (!approachMeta) return null;
    const d =
      approachMeta.distanceM >= 1000
        ? `${(approachMeta.distanceM / 1000).toFixed(1)}km`
        : `${approachMeta.distanceM}m`;
    return `입구까지 도보 약 ${approachMeta.minutes}분 · ${d}`;
  }, [approachMeta]);

  return (
    <View style={styles.root}>
      <AppMapView
        latitude={mapLat}
        longitude={mapLng}
        level={8}
        zoom={mapZoom}
        fitToRoute={mapFitToRoute}
        followUser={false}
        followZoom={GUIDE_FOLLOW_ZOOM}
        mapHeading={mapHeading}
        chromeless
        interactive
        segments={mapSegments.length >= 1 ? mapSegments : undefined}
        path={
          mapSegments.length === 0 && polylinePath?.length >= 2
            ? polylinePath
            : undefined
        }
        stops={stopPoints.length >= 1 ? stopPoints : polylinePath}
        markers={mapMarkers}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top > 0 ? insets.top + 4 : 8 },
          ]}
        >
          <Pressable
            onPress={() => safeGoBack(navigation)}
            style={styles.iconBtn}
            accessibilityLabel="닫기"
          >
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.topSubtitle}>
              {entranceNavActive ? "입구 안내 · 방향 추적" : "지도 안내"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.fabColumn,
            { top: insets.top + 4 + 54 + 20 },
          ]}
        >
          <Pressable
            onPress={fitCameraToRoute}
            style={styles.fab}
            accessibilityLabel="경로 전체 보기"
          >
            <Ionicons name="git-network-outline" size={22} color="#2563eb" />
          </Pressable>
          <Pressable
            onPress={focusMyLocation}
            style={[styles.fab, !userLocation && styles.fabDisabled]}
            accessibilityLabel="내 위치"
          >
            <Ionicons
              name="locate"
              size={22}
              color={userLocation ? "#2563eb" : "#94a3b8"}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.bottomCard,
            { paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
        >
          {loadingCourse ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.loadingText}>코스 불러오는 중…</Text>
            </View>
          ) : !course ? (
            <Text style={styles.hintText}>코스 정보를 불러올 수 없습니다.</Text>
          ) : (
            <>
              <Text style={styles.routeLine} numberOfLines={1}>
                {departure} → {arrival}
              </Text>

              {entranceNavActive && userLocation && courseStart ? (
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: APPROACH_LINE_COLOR }]} />
                  <Text style={styles.legendText}>내 위치 → 코스 출발</Text>
                  <View style={[styles.legendDot, { backgroundColor: COURSE_LINE_COLOR, marginLeft: 12 }]} />
                  <Text style={styles.legendText}>코스 경로</Text>
                </View>
              ) : null}

              {entranceNavActive && approachLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#22c55e" />
                  <Text style={styles.pathLoadingText}>입구 경로 계산 중…</Text>
                </View>
              ) : entranceNavActive && approachLabel ? (
                <Text style={styles.approachMeta}>{approachLabel}</Text>
              ) : null}

              {pathLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#64748b" />
                  <Text style={styles.pathLoadingText}>코스 경로 표시 중…</Text>
                </View>
              ) : null}

              {locationDenied ? (
                <Text style={styles.locationNote}>
                  위치 권한이 없어 입구 안내를 사용할 수 없습니다.
                </Text>
              ) : (
                <View
                  style={[
                    styles.toggleRow,
                    (!userLocation || !courseStart) && styles.toggleRowDisabled,
                  ]}
                >
                  <View style={styles.toggleLabelWrap}>
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color={entranceNavActive ? "#0f766e" : "#64748b"}
                    />
                    <View style={styles.toggleTextCol}>
                      <Text style={styles.toggleTitle}>입구 안내</Text>
                      <Text style={styles.toggleHint}>
                        {entranceNavActive
                          ? "폰 방향에 맞춰 지도 회전 · 출발까지 경로"
                          : "켜면 내 위치에서 코스 출발까지 안내"}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={entranceNavActive}
                    onValueChange={onEntranceNavToggle}
                    disabled={!userLocation || !courseStart}
                    trackColor={{ false: "#d1d5db", true: "#6ee7b7" }}
                    thumbColor={entranceNavActive ? "#0f766e" : "#f4f4f5"}
                    accessibilityLabel="입구 안내"
                  />
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e2e8f0" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  topTitleWrap: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  topTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  topSubtitle: { fontSize: 11, fontWeight: "600", color: "#64748b", marginTop: 2 },
  fabColumn: {
    position: "absolute",
    right: 14,
    gap: 10,
    zIndex: 9,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  fabDisabled: { opacity: 0.65 },
  bottomCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  routeLine: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  approachMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 10,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b",
    fontWeight: "500",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  loadingText: { fontSize: 13, color: "#64748b" },
  pathLoadingText: { fontSize: 12, color: "#94a3b8" },
  locationNote: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    gap: 12,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  toggleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  toggleHint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 16,
  },
});
