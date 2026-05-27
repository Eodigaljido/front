// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
  COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM,
  computeMapRouteFit,
  focusMapOnCourseStep,
  getCourseMapCenter,
  getCourseMapCenterFromSteps,
  getCourseStepMapPoint,
  type CourseDetailMapFocus,
  type CourseItem,
} from "../data/mockData";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useMockData } from "../context/MockDataContext";
import {
  deleteMyCourse,
  fetchMyCourses,
  fetchMyRouteCollaborativeFlag,
  normalizeCourseList,
  resolveCourseDetailForRoute,
} from "../api/courses";
import {
  UserSavedRoute,
  userRouteToCourseItem,
  userRouteMapCenter,
  userRouteMapPath,
} from "../data/userSavedRoute";
import AppMapView from "../components/AppMapView";
import { buildMapMarkersFromPathPoints } from "../utils/spreadMapMarkers";
import { simplifyRoutePath } from "../utils/simplifyRoutePath";
import FilterBottomSheet from "../components/FilterBottomSheet";
import { formatOverallDurationLabel } from "../utils/formatOverallDurationLabel";
import { resolveCourseRegionLabel } from "../utils/inferCourseRegionLabel";
import { shareCollaborativeRoute } from "../utils/shareCollaborativeRoute";
import { sameCourseId } from "../utils/sameCourseId";
import { getCourseAuthorLabel, isOwnServerCourse } from "../utils/formatCourseAuthor";
import { CourseCardAuthorRow } from "../components/CourseCardAuthorRow";
import { useAuthStore } from "../store/authStore";
import { rootNavigate } from "../navigation/rootNavigation";

type RouteKindFilter = "all" | "personal" | "collaborative";
const ROUTE_KIND_CHIPS: { key: RouteKindFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "personal", label: "개인" },
  { key: "collaborative", label: "공동" },
];
import { fetchMergedDirectionsPolyline } from "../data/googleDirectionsApi";
import { useCourseStepWalkingSegments } from "../hooks/useCourseStepWalkingSegments";

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: "rgba(37,99,235,0.12)",
  borderRadius: 16,
  backgroundColor: "#fff",
};

function CourseCard({
  item,
  onPressCard,
  onGuide,
  onRemove,
  onEdit,
  isFavorite,
  isCollaborative,
  authorLabel,
}: {
  item: CourseItem;
  onPressCard: () => void;
  onGuide: () => void;
  onRemove: () => void;
  onEdit: () => void;
  isFavorite?: boolean;
  isCollaborative?: boolean;
  authorLabel: string;
}) {
  return (
    <View
      className="mx-4 mb-3 overflow-hidden bg-white rounded-2xl"
      style={CARD_STYLE}
    >
      <TouchableOpacity
        onPress={onPressCard}
        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
      >
        {/* 상단: 썸네일 + 제목/메타 + 삭제 아이콘 */}
        <View className="flex-row border-b border-gray-100 p-3.5">
          <View className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-blue-50">
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center justify-center w-full h-full bg-blue-50">
                <Ionicons name="image-outline" size={24} color="#60a5fa" />
              </View>
            )}
          </View>
          <View className="justify-center flex-1 min-w-0 ml-3">
            <View className="flex-row items-start gap-1 flex-wrap">
              {isCollaborative ? (
                <View className="rounded-md bg-orange-100 px-1.5 py-0.5 mr-1">
                  <Text className="text-[10px] font-bold text-orange-700">공동</Text>
                </View>
              ) : null}
              {isFavorite ? (
                <Ionicons name="bookmark" size={15} color="#2563EB" style={{ marginTop: 2 }} />
              ) : null}
              <Text
                className="text-[15px] font-semibold leading-snug text-gray-900"
                numberOfLines={2}
                style={{ flex: 1 }}
              >
                {item.title}
              </Text>
            </View>
            <CourseCardAuthorRow label={authorLabel} />
            <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
              {item.meta}
            </Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={onEdit}
              className="justify-center pl-1"
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRemove}
              className="justify-center pl-2"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 경로 안내 */}
        <View className="flex-row items-center px-3.5 py-2.5">
          <View className="px-2 py-1 bg-blue-600 rounded-md">
            <Text className="text-[11px] font-semibold text-white">출발</Text>
          </View>
          <Text className="ml-2 text-[13px] text-gray-900" numberOfLines={1}>
            {item.departure}
          </Text>
          <View className="w-px h-3 mx-2 bg-gray-300" />
          <View className="px-2 py-1 bg-slate-500 rounded-md">
            <Text className="text-[11px] font-semibold text-white">도착</Text>
          </View>
          <Text
            className="ml-2 flex-1 text-[13px] text-gray-900"
            numberOfLines={1}
          >
            {item.arrival}
          </Text>
        </View>
      </TouchableOpacity>

      <View className="border-t border-gray-100 px-3.5 py-2.5">
        <TouchableOpacity
          onPress={onGuide}
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5"
          accessibilityLabel="지도 안내"
        >
          <Ionicons name="map-outline" size={18} color="#2563eb" />
          <Text className="text-sm font-semibold text-blue-600">안내</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getUserRouteStepPoint(
  route: UserSavedRoute,
  stepIndex: number,
): { lat: number; lng: number } {
  const s = route.stops[stepIndex];
  if (s?.lat != null && s?.lng != null) return { lat: s.lat, lng: s.lng };
  return userRouteMapCenter(route);
}

const MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY = "MY_ROUTE_DETAIL_SHEET_MAX_HEIGHT_PX";
const MY_ROUTE_WINDOW_H = Dimensions.get("window").height;
/** 시트를 화면 밖으로 밀어 닫을 때 이동 거리 */
const MY_ROUTE_SHEET_HIDE_Y = Math.ceil(MY_ROUTE_WINDOW_H + 120);

function clampMyRouteDetailSheetHeight(px: number): number {
  const minH = Math.round(MY_ROUTE_WINDOW_H * 0.45);
  const maxH = Math.round(MY_ROUTE_WINDOW_H * 0.94);
  return Math.min(Math.max(Math.round(px), minH), maxH);
}

type MyRouteParams = { viewCourseId?: string };

export default function MyRouteScreen(): React.JSX.Element {
  const route = useRoute();
  const myRouteParams = (route.params || {}) as MyRouteParams;
  const authUser = useAuthStore((s) => s.user);
  const authorCtx = useMemo(
    () => ({
      myUuid: authUser?.uuid,
      myUserId: authUser?.userId,
      myNickname: authUser?.nickname,
    }),
    [authUser?.uuid, authUser?.userId, authUser?.nickname],
  );
  const {
    favoriteCourseIds,
    removeSavedCourse,
    userSavedRoutes,
    deleteUserRoute,
    upsertUserRoute,
  } = useMockData();

  const [searchQuery, setSearchQuery] = useState("");
  const [apiMyCourses, setApiMyCourses] = useState<CourseItem[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>("즐겨찾기순");
  const [selectedRouteKind, setSelectedRouteKind] = useState<RouteKindFilter>("all");
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  /** 카드에서 연 상세 — 목록 재조회·id 타입 불일치 시에도 동일 코스 표시 */
  const [viewingCourseSnapshot, setViewingCourseSnapshot] =
    useState<CourseItem | null>(null);
  const [detailModalMounted, setDetailModalMounted] = useState(false);
  const detailBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [detailSheetMaxHeightPx, setDetailSheetMaxHeightPx] = useState(() =>
    clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.82),
  );
  const sheetHeightRef = useRef(
    clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.82),
  );
  sheetHeightRef.current = detailSheetMaxHeightPx;
  const sheetPanStartHeight = useRef(0);
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 0.55,
      onPanResponderGrant: () => {
        sheetPanStartHeight.current = sheetHeightRef.current;
      },
      onPanResponderMove: (_, g) => {
        setDetailSheetMaxHeightPx(
          clampMyRouteDetailSheetHeight(sheetPanStartHeight.current - g.dy),
        );
      },
      onPanResponderRelease: async (_, g) => {
        const next = clampMyRouteDetailSheetHeight(
          sheetPanStartHeight.current - g.dy,
        );
        setDetailSheetMaxHeightPx(next);
        try {
          await AsyncStorage.setItem(
            MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY,
            String(next),
          );
        } catch {
          /* ignore */
        }
      },
    }),
  ).current;

  const detailSheetTranslateY = useRef(
    new Animated.Value(MY_ROUTE_SHEET_HIDE_Y),
  ).current;
  const viewingCourseIdRef = useRef<string | null>(null);
  viewingCourseIdRef.current = viewingCourseId;
  const [mapFocus, setMapFocus] = useState<CourseDetailMapFocus | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [detailMergedPath, setDetailMergedPath] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);
  const [detailPathLoading, setDetailPathLoading] = useState(false);
  const [myDetailCourseApi, setMyDetailCourseApi] = useState<CourseItem | null>(null);
  const [myCourseDetailLoading, setMyCourseDetailLoading] = useState(false);

  const detailMapCourse = useMemo(() => {
    if (!viewingCourseId) return null;
    const ur = userSavedRoutes.find((r) =>
      sameCourseId(r.id, viewingCourseId),
    );
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    return (
      (myDetailCourseApi &&
      sameCourseId(myDetailCourseApi.id, viewingCourseId)
        ? myDetailCourseApi
        : null) ??
      courseFromApi ??
      (ur ? userRouteToCourseItem(ur) : null) ??
      (viewingCourseSnapshot &&
      sameCourseId(viewingCourseSnapshot.id, viewingCourseId)
        ? viewingCourseSnapshot
        : null)
    );
  }, [
    viewingCourseId,
    userSavedRoutes,
    apiMyCourses,
    myDetailCourseApi,
    viewingCourseSnapshot,
  ]);
  const detailMapStepPoints = useMemo(() => {
    if (!viewingCourseId || !detailMapCourse) return null;
    const ur = userSavedRoutes.find((r) =>
      sameCourseId(r.id, viewingCourseId),
    );
    if (ur && userRouteMapPath(ur).length >= 2) {
      return userRouteMapPath(ur);
    }
    const detailSteps = Array.isArray(detailMapCourse.routeSteps)
      ? detailMapCourse.routeSteps
      : [];
    if (detailSteps.length >= 2) {
      return detailSteps.map((step, i) => {
        if (step.lat != null && step.lng != null) {
          return { latitude: step.lat, longitude: step.lng };
        }
        const p = getCourseStepMapPoint(
          detailMapCourse.id,
          i,
          detailSteps.length,
        );
        return { latitude: p.lat, longitude: p.lng };
      });
    }
    return null;
  }, [viewingCourseId, detailMapCourse, userSavedRoutes]);
  const detailMapStepIds = useMemo(
    () => detailMapCourse?.routeSteps?.map((s) => s.id) ?? [],
    [detailMapCourse],
  );
  const { walkSegments: stepWalkSegments, walkLoading: stepWalkLoading } =
    useCourseStepWalkingSegments(
      detailMapStepPoints,
      selectedStepId,
      detailMapStepIds,
    );

  const reloadMyRoutesAndSharing = useCallback(async () => {
    try {
      const courses = await fetchMyCourses();
      setApiMyCourses(normalizeCourseList(courses));
    } catch {
      /* 네트워크 오류 시 목록을 비우면 서버 연동 판별이 깨짐 → 이전 상태 유지 */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadMyRoutesAndSharing();
    }, [reloadMyRoutesAndSharing]),
  );

  useEffect(() => {
    const vid = String(myRouteParams?.viewCourseId ?? "").trim();
    if (!vid) return;
    const fromUser = userSavedRoutes.find((r) => sameCourseId(r.id, vid));
    const fromApi = apiMyCourses.find((c) => sameCourseId(c.id, vid));
    const snap = fromUser
      ? userRouteToCourseItem(fromUser)
      : fromApi ?? null;
    if (snap) setViewingCourseSnapshot(snap);
    setViewingCourseId(vid);
  }, [myRouteParams?.viewCourseId, userSavedRoutes, apiMyCourses]);

  useEffect(() => {
    if (viewingCourseId) setDetailModalMounted(true);
  }, [viewingCourseId]);

  useEffect(() => {
    if (!(detailModalMounted && viewingCourseId)) return;
    detailSheetTranslateY.setValue(MY_ROUTE_SHEET_HIDE_Y);
    detailBackdropOpacity.setValue(0);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(detailBackdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(detailSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 68,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [viewingCourseId, detailModalMounted]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY);
        if (cancelled || raw == null) return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        setDetailSheetMaxHeightPx(clampMyRouteDetailSheetHeight(n));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissCourseDetailImmediate = useCallback(() => {
    setViewingCourseId(null);
    setViewingCourseSnapshot(null);
    setDetailModalMounted(false);
    detailBackdropOpacity.setValue(0);
    detailSheetTranslateY.setValue(MY_ROUTE_SHEET_HIDE_Y);
  }, [detailBackdropOpacity, detailSheetTranslateY]);

  const closeCourseDetail = useCallback(
    (afterClose?: () => void) => {
      if (!viewingCourseIdRef.current) return;
      Animated.parallel([
        Animated.timing(detailBackdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(detailSheetTranslateY, {
          toValue: MY_ROUTE_SHEET_HIDE_Y,
          duration: 230,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setViewingCourseId(null);
          setViewingCourseSnapshot(null);
          setDetailModalMounted(false);
          afterClose?.();
        }
      });
    },
    [detailBackdropOpacity, detailSheetTranslateY],
  );

  useEffect(() => {
    if (!viewingCourseId) {
      setViewingCourseSnapshot(null);
      setMapFocus(null);
      setSelectedStepId(null);
      return;
    }
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, viewingCourseId));
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const courseForCenter = ur
      ? userRouteToCourseItem(ur)
      : courseFromApi ?? viewingCourseSnapshot;
    setMapFocus(
      courseForCenter
        ? {
            ...getCourseMapCenterFromSteps(courseForCenter),
            level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
          }
        : {
            ...getCourseMapCenter(viewingCourseId),
            level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
          },
    );
    setSelectedStepId(null);
  }, [viewingCourseId, userSavedRoutes, apiMyCourses, viewingCourseSnapshot]);

  useEffect(() => {
    if (!viewingCourseId) {
      setMyDetailCourseApi(null);
      setMyCourseDetailLoading(false);
      return;
    }
    // 로컬에만 있는 직접 제작 루트(UUID)는 서버에 없으므로 GET 하지 않음(404 방지)
    if (userSavedRoutes.some((r) => sameCourseId(r.id, viewingCourseId))) {
      setMyDetailCourseApi(null);
      setMyCourseDetailLoading(false);
      return;
    }
    let mounted = true;
    setMyCourseDetailLoading(true);
    resolveCourseDetailForRoute(viewingCourseId)
      .then(({ course }) => {
        if (!mounted) return;
        setMyDetailCourseApi(course ?? null);
        setMyCourseDetailLoading(false);
      })
      .catch(() => {
        if (mounted) setMyCourseDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [viewingCourseId, userSavedRoutes]);

  useEffect(() => {
    if (!viewingCourseId) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, viewingCourseId));
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const course =
      (myDetailCourseApi && sameCourseId(myDetailCourseApi.id, viewingCourseId)
        ? myDetailCourseApi
        : null) ??
      courseFromApi ??
      (ur ? userRouteToCourseItem(ur) : null) ??
      (viewingCourseSnapshot &&
      sameCourseId(viewingCourseSnapshot.id, viewingCourseId)
        ? viewingCourseSnapshot
        : null);
    if (!course) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    let stepPoints: { latitude: number; longitude: number }[] = [];
    if (ur && userRouteMapPath(ur).length >= 2) {
      stepPoints = userRouteMapPath(ur);
    } else if (Array.isArray(course.routeSteps) && course.routeSteps.length >= 2) {
      stepPoints = course.routeSteps.map((step, i) => {
        if (step.lat != null && step.lng != null) {
          return { latitude: step.lat, longitude: step.lng };
        }
        const p = getCourseStepMapPoint(course.id, i, course.routeSteps.length);
        return { latitude: p.lat, longitude: p.lng };
      });
    } else {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    const ac = new AbortController();
    setDetailPathLoading(true);
    setDetailMergedPath(null);
    fetchMergedDirectionsPolyline({
      points: stepPoints,
      mode: "transit",
      signal: ac.signal,
    })
      .then((path) => {
        if (!ac.signal.aborted && path.length >= 2) setDetailMergedPath(path);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setDetailPathLoading(false);
      });

    return () => ac.abort();
  }, [
    viewingCourseId,
    userSavedRoutes,
    apiMyCourses,
    myDetailCourseApi,
    viewingCourseSnapshot,
  ]);

  const isCollaborativeRouteId = useCallback(
    (id: string) =>
      userSavedRoutes.some(
        (r) => sameCourseId(r.id, id) && r.collaborative === true,
      ),
    [userSavedRoutes],
  );

  const mergedCourses = useMemo(() => {
    const fromUser = userSavedRoutes.map(userRouteToCourseItem);
    const combined = [...fromUser, ...apiMyCourses];
    const seen = new Set<string>();
    return combined.filter((c) => {
      const k = String(c.id ?? "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [userSavedRoutes, apiMyCourses]);

  const filteredCourses = useMemo(() => {
    let list = mergedCourses;

    if (selectedCategory)
      list = list.filter((c) => c.category === selectedCategory);
    if (selectedRegion) list = list.filter((c) => c.region === selectedRegion);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          String(c.title ?? "").toLowerCase().includes(q) ||
          String(c.meta ?? "").toLowerCase().includes(q) ||
          String(c.departure ?? "").toLowerCase().includes(q) ||
          String(c.arrival ?? "").toLowerCase().includes(q),
      );
    }

    if (selectedRouteKind === "personal") {
      list = list.filter((c) => !isCollaborativeRouteId(c.id));
    } else if (selectedRouteKind === "collaborative") {
      list = list.filter((c) => isCollaborativeRouteId(c.id));
    }

    if (selectedSort === "즐겨찾기순" || selectedSort === null) {
      const favRank = new Map(favoriteCourseIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => {
        const ra = favRank.has(a.id) ? favRank.get(a.id) : 10_000;
        const rb = favRank.has(b.id) ? favRank.get(b.id) : 10_000;
        return ra - rb;
      });
    } else if (selectedSort === "인기순" || selectedSort === "조회순") {
      list = [...list].sort((a, b) => b.views - a.views);
    } else if (selectedSort === "최신순") {
      list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }

    return list;
  }, [
    mergedCourses,
    searchQuery,
    selectedCategory,
    selectedRegion,
    selectedSort,
    favoriteCourseIds,
    selectedRouteKind,
    isCollaborativeRouteId,
  ]);

  const isUserSavedRouteId = (id: string) =>
    userSavedRoutes.some((r) => sameCourseId(r.id, id));

  const isServerBackedMyCourse = (id: string) =>
    apiMyCourses.some((c) => sameCourseId(c.id, id));

  const canEditAsOwnMyCourse = useCallback(
    (course: CourseItem) => {
      const fromApi = apiMyCourses.find((c) => sameCourseId(c.id, course.id));
      if (!fromApi) return false;
      return isOwnServerCourse(course, authorCtx);
    },
    [apiMyCourses, authorCtx],
  );

  const handleRemove = (item: CourseItem) => {
    Alert.alert(
      "저장 삭제",
      `"${item.title}" 코스를 저장 목록에서 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            if (isUserSavedRouteId(item.id)) {
              // 기기에만 저장된 루트 — 서버 DELETE 호출 시 404
              deleteUserRoute(item.id);
            } else if (apiMyCourses.some((c) => sameCourseId(c.id, item.id))) {
              await deleteMyCourse(item.id);
              removeSavedCourse(item.id);
            } else {
              removeSavedCourse(item.id);
            }
            if (sameCourseId(viewingCourseId, item.id)) {
              dismissCourseDetailImmediate();
            }
          },
        },
      ],
    );
  };

  const openRouteCreateEdit = (routeId: string, collaborative: boolean) => {
    rootNavigate("RouteCreate", {
      editRouteId: routeId,
      collaborative,
    });
  };

  const openRouteCreateFromSharedCourse = (sharedCourseId: string) => {
    rootNavigate("RouteCreate", { seedSharedCourseId: sharedCourseId });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={["top"]}>
      {/* 헤더 배너 */}
      <View className="px-4 pt-2 pb-2">
        <View className="rounded-2xl px-4 py-4" style={{ backgroundColor: "#2563EB" }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-semibold text-white">내 코스</Text>
              <Text className="mt-1 text-xs text-blue-100">
                저장한 코스와 내가 만든 코스를 관리해요
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => rootNavigate("RouteCreate")}
              className="px-3 py-2 rounded-lg bg-white/20 active:opacity-90"
            >
              <Text className="text-xs font-semibold text-white">루트 제작</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 검색 + 필터 — 배경과 분리된 카드형 검색바 */}
      <View className="flex-row items-center gap-2.5 px-4 py-3">
        <View
          className="flex-1 flex-row items-center rounded-2xl bg-white px-3.5"
          style={{
            minHeight: 46,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View
            className="mr-2 h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
          >
            <Ionicons name="search" size={20} color="#2563EB" />
          </View>
          <TextInput
            placeholder="코스명 · 출발/도착 · 지역 검색"
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-[15px] text-gray-900"
            style={{ paddingVertical: 2 }}
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.85}
          accessibilityLabel="필터"
          className="items-center justify-center rounded-2xl bg-white"
          style={{
            width: 46,
            height: 46,
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Ionicons name="options-outline" size={23} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-2 px-4 pb-1">
        {ROUTE_KIND_CHIPS.map((chip) => {
          const on = selectedRouteKind === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setSelectedRouteKind(chip.key)}
              className={`rounded-full px-3.5 py-1.5 border ${
                on ? "bg-blue-600 border-blue-600" : "bg-white border-blue-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${on ? "text-white" : "text-blue-700"}`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 저장 코스 수 */}
      <View className="px-4 py-1.5">
        <Text className="text-sm text-gray-500">
          {filteredCourses.length}개의 코스를 저장했어요
        </Text>
      </View>

      {/* 코스 리스트 */}
      {filteredCourses.length === 0 ? (
        <View className="items-center justify-center flex-1 px-8">
          <View className="p-6 bg-gray-100 rounded-full">
            <Ionicons name="bookmark-outline" size={48} color="#9ca3af" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
            저장한 코스가 없습니다
          </Text>
          <Text className="mt-2 text-sm text-center text-gray-500">
            루트 제작에서 직접 저장하거나, 공유 루트에서 코스를 저장해 보세요.
          </Text>
        </View>
      ) : (
        <FlatList<CourseItem>
          data={filteredCourses ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const ur = userSavedRoutes.find((r) => sameCourseId(r.id, item.id));
            const authorLabel = getCourseAuthorLabel(item, {
              ...authorCtx,
              isLocalOwnRoute: Boolean(ur),
            });
            return (
              <CourseCard
                item={item}
                authorLabel={authorLabel}
                isFavorite={favoriteCourseIds.some((fid) =>
                  sameCourseId(fid, item.id),
                )}
                isCollaborative={ur?.collaborative === true}
                onPressCard={() => {
                  setViewingCourseSnapshot(item);
                  setViewingCourseId(String(item.id));
                }}
                onGuide={() => {
                  rootNavigate("CourseGuide", {
                    courseId: String(item.id),
                    courseTitle: item.title,
                  });
                }}
                onRemove={() => handleRemove(item)}
                onEdit={() => {
                  if (isUserSavedRouteId(item.id)) {
                    openRouteCreateEdit(
                      item.id,
                      ur?.collaborative === true,
                    );
                  } else if (
                    isServerBackedMyCourse(item.id) &&
                    canEditAsOwnMyCourse(item)
                  ) {
                    void fetchMyRouteCollaborativeFlag(item.id).then((collab) =>
                      openRouteCreateEdit(item.id, collab),
                    );
                  } else {
                    openRouteCreateFromSharedCourse(item.id);
                  }
                }}
              />
            );
          }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedSort={selectedSort}
        onCategoryToggle={(cat) =>
          setSelectedCategory((prev) => (prev === cat ? null : cat))
        }
        onRegionToggle={(region) =>
          setSelectedRegion((prev) => (prev === region ? null : region))
        }
        onSortToggle={(opt) =>
          setSelectedSort((prev) => (prev === opt ? null : opt))
        }
        onReset={() => {
          setSelectedCategory(null);
          setSelectedRegion(null);
          setSelectedSort("즐겨찾기순");
        }}
        onApply={() => {}}
      />

      {/* 코스 상세 보기 모달 — 배경은 페이드, 시트만 슬라이드 (Modal slide는 백드롭까지 같이 움직임) */}
      <Modal
        visible={detailModalMounted}
        transparent
        animationType="none"
        onRequestClose={() => closeCourseDetail()}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: detailBackdropOpacity },
            ]}
          >
            <Pressable
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "rgba(107,114,128,0.45)" },
              ]}
              onPress={() => closeCourseDetail()}
            />
          </Animated.View>

          <View
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                width: "100%",
                height: detailSheetMaxHeightPx,
                maxHeight: clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.94),
                transform: [{ translateY: detailSheetTranslateY }],
              }}
            >
              <View
                className="overflow-hidden rounded-t-3xl flex-1"
                style={{
                  height: "100%",
                  backgroundColor: "#F8FBFF",
                }}
              >
              {viewingCourseId &&
                (() => {
                  const ur = userSavedRoutes.find((r) =>
                    sameCourseId(r.id, viewingCourseId),
                  );
                  const courseFromApi = apiMyCourses.find((c) =>
                    sameCourseId(c.id, viewingCourseId),
                  );
                  const course =
                    (myDetailCourseApi &&
                    sameCourseId(myDetailCourseApi.id, viewingCourseId)
                      ? myDetailCourseApi
                      : null) ??
                    courseFromApi ??
                    (ur ? userRouteToCourseItem(ur) : null) ??
                    (viewingCourseSnapshot &&
                    sameCourseId(viewingCourseSnapshot.id, viewingCourseId)
                      ? viewingCourseSnapshot
                      : null);
                  if (!course) {
                    return (
                      <View
                        style={{
                          paddingVertical: 40,
                          paddingHorizontal: 24,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {myCourseDetailLoading ? (
                          <>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text className="mt-4 text-sm text-gray-600">
                              코스 정보를 불러오는 중…
                            </Text>
                          </>
                        ) : (
                          <Text className="text-sm text-center text-gray-600">
                            코스 정보를 불러올 수 없습니다.
                          </Text>
                        )}
                        <TouchableOpacity
                          onPress={() => closeCourseDetail()}
                          className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5"
                        >
                          <Text className="text-sm font-semibold text-white">
                            닫기
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  const mapBlockHeight = Math.min(
                    240,
                    Math.max(110, Math.floor(detailSheetMaxHeightPx * 0.3)),
                  );
                  const routeSteps = Array.isArray(course.routeSteps)
                    ? course.routeSteps
                    : [];
                  const midStepNames = routeSteps
                    .slice(1, -1)
                    .map((s) => String(s?.name ?? "").trim())
                    .filter(Boolean);
                  const regionChip =
                    resolveCourseRegionLabel(
                      course.region,
                      course.departure,
                      course.arrival,
                      midStepNames,
                    ) || null;
                  let pathPts:
                    | { latitude: number; longitude: number }[]
                    | undefined;
                  if (ur && userRouteMapPath(ur).length >= 1) {
                    pathPts = userRouteMapPath(ur).map((p) => ({
                      latitude: p.latitude,
                      longitude: p.longitude,
                    }));
                  } else if (routeSteps.length >= 1) {
                    pathPts = routeSteps.map((step, i) => {
                      if (step.lat != null && step.lng != null) {
                        return { latitude: step.lat, longitude: step.lng };
                      }
                      const p = getCourseStepMapPoint(
                        course.id,
                        i,
                        routeSteps.length,
                      );
                      return { latitude: p.lat, longitude: p.lng };
                    });
                  } else {
                    pathPts = undefined;
                  }
                  const mapMarkers =
                    pathPts && pathPts.length >= 1
                      ? buildMapMarkersFromPathPoints(pathPts)
                      : undefined;
                  // 실경로가 있으면 단순화해서 사용하고, 없으면 경유지 연결선으로 대체
                  const polylinePath = simplifyRoutePath(
                    detailMergedPath && detailMergedPath.length >= 2
                      ? detailMergedPath
                      : pathPts,
                  );
                  const fallbackCenter = ur
                    ? userRouteMapCenter(ur)
                    : getCourseMapCenter(course.id);
                  const stepMapFocused = Boolean(selectedStepId);
                  const showWalkOnMap =
                    stepMapFocused &&
                    Boolean(stepWalkSegments && stepWalkSegments.length > 0);
                  const fitPathForCamera =
                    showWalkOnMap && stepWalkSegments?.length
                      ? stepWalkSegments.flatMap((s) => s.points)
                      : detailMergedPath && detailMergedPath.length >= 2
                        ? detailMergedPath
                        : pathPts;
                  const mapRouteFit = computeMapRouteFit(
                    fitPathForCamera ?? [],
                    stepMapFocused
                      ? {
                          maxZoom: COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM,
                          paddingZoomOut: 0.5,
                        }
                      : { minZoom: 10, maxZoom: 16, paddingZoomOut: 0.9 },
                  );
                  const mapCenter =
                    stepMapFocused && mapFocus
                      ? mapFocus
                      : mapRouteFit
                        ? { lat: mapRouteFit.lat, lng: mapRouteFit.lng }
                        : mapFocus ?? fallbackCenter;
                  const mapZoom = mapRouteFit?.zoom;
                  const mapFitToRoute = !mapRouteFit;
                  const startStepName =
                    routeSteps[0]?.name ?? course.departure;
                  const endStepName =
                    routeSteps[routeSteps.length - 1]?.name ??
                    course.arrival;

                  return (
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          backgroundColor: "#EEF5FF",
                          paddingTop: 14,
                          paddingBottom: 14,
                          borderTopLeftRadius: 24,
                          borderTopRightRadius: 24,
                          overflow: "hidden",
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: "rgba(37,99,235,0.15)",
                        }}
                      >
                        <View className="flex-row items-center justify-between px-4 mb-2">
                          <Text className="text-sm font-semibold text-[#1A1A2E]">
                            코스 위치
                          </Text>
                          <TouchableOpacity
                            onPress={() => closeCourseDetail()}
                            hitSlop={12}
                          >
                            <Ionicons name="close" size={26} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            height: mapBlockHeight,
                            marginHorizontal: 10,
                            borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: "#dbeafe",
                            borderWidth: 1,
                            borderColor: "#bfdbfe",
                            position: "relative",
                          }}
                        >
                          <AppMapView
                            key={
                              ur
                                ? `ur-${ur.id}-${mapZoom ?? "f"}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}-${stepMapFocused ? "step" : "route"}-${selectedStepId ?? "all"}`
                                : `mc-${course.id}-${mapZoom ?? "f"}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}-${stepMapFocused ? "step" : "route"}-${selectedStepId ?? "all"}`
                            }
                            latitude={mapCenter.lat}
                            longitude={mapCenter.lng}
                            level={8}
                            zoom={mapZoom}
                            fitToRoute={mapFitToRoute}
                            path={
                              !showWalkOnMap &&
                              polylinePath &&
                              polylinePath.length >= 1
                                ? polylinePath
                                : undefined
                            }
                            segments={
                              showWalkOnMap ? stepWalkSegments : undefined
                            }
                            stops={
                              !showWalkOnMap &&
                              polylinePath &&
                              polylinePath.length >= 1
                                ? polylinePath
                                : undefined
                            }
                            markers={mapMarkers}
                            style={{ width: "100%", height: mapBlockHeight }}
                          />
                          {(detailPathLoading ||
                            (stepMapFocused && stepWalkLoading)) ? (
                            <View
                              style={{
                                position: "absolute",
                                right: 10,
                                top: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: "rgba(255,255,255,0.92)",
                              }}
                            >
                              <ActivityIndicator size="small" color="#2563eb" />
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#2563eb",
                                  fontWeight: "600",
                                }}
                              >
                                {stepMapFocused && stepWalkLoading
                                  ? "도보 경로 불러오는 중"
                                  : "경로 반영 중"}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="mt-2 px-4 text-[11px] font-medium text-slate-500">
                          {showWalkOnMap
                            ? "도보 구간: 주황"
                            : pathPts && pathPts.length >= 2
                              ? `1(${startStepName}) → ${pathPts.length}(${endStepName})`
                              : "출발 기준"}
                        </Text>
                      </View>


                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        className="bg-white flex-1"
                        style={{ flexGrow: 1 }}
                        contentContainerStyle={{
                          paddingHorizontal: 20,
                          paddingTop: 16,
                          paddingBottom: 28,
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-4">
                          <Text className="text-xl font-bold text-gray-900">
                            코스 상세
                          </Text>
                          <View className="flex-row items-center gap-2 flex-wrap justify-end">
                            {ur?.collaborative === true ? (
                              <TouchableOpacity
                                onPress={() => {
                                  void shareCollaborativeRoute({
                                    routeId: String(course.id),
                                    title: course.title,
                                  });
                                }}
                                className="flex-row items-center gap-1 rounded-xl bg-orange-50 px-3 py-2"
                              >
                                <Ionicons
                                  name="share-social-outline"
                                  size={16}
                                  color="#ea580c"
                                />
                                <Text className="text-sm font-semibold text-orange-600">
                                  초대
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => {
                                closeCourseDetail(() => {
                                  if (ur) {
                                    openRouteCreateEdit(
                                      ur.id,
                                      ur.collaborative === true,
                                    );
                                  } else if (
                                    isServerBackedMyCourse(course.id) &&
                                    canEditAsOwnMyCourse(course)
                                  ) {
                                    openRouteCreateEdit(course.id, false);
                                  } else {
                                    openRouteCreateFromSharedCourse(course.id);
                                  }
                                });
                              }}
                              className="flex-row items-center gap-1 rounded-xl bg-blue-50 px-3 py-2"
                            >
                              <Ionicons
                                name="create-outline"
                                size={16}
                                color="#2563eb"
                              />
                              <Text className="text-sm font-semibold text-blue-600">
                                수정
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                closeCourseDetail(() => handleRemove(course));
                              }}
                              className="flex-row items-center gap-1 rounded-xl bg-red-50 px-3 py-2"
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#ef4444"
                              />
                              <Text className="text-sm font-semibold text-red-500">
                                저장 삭제
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text className="mb-1 text-base font-semibold text-gray-900">
                          {course.title}
                        </Text>
                        {(() => {
                          const authorLabel = getCourseAuthorLabel(course, {
                            ...authorCtx,
                            isLocalOwnRoute: Boolean(ur),
                          });
                          const authorUuid = String(course.authorUuid ?? '').trim();
                          const authorUserId = String(course.authorUserId ?? '').trim();
                          const isMine = authorLabel.includes('(나)') || authorLabel === '내가 제작';
                          const canOpenProfile = !isMine && Boolean(authorUuid || authorUserId);
                          return (
                            <Pressable
                              disabled={!canOpenProfile}
                              onPress={() => {
                                if (!canOpenProfile) return;
                                rootNavigate('UserProfile', {
                                  userUuid: authorUuid || undefined,
                                  userId: authorUserId || undefined,
                                  nickname:
                                    authorLabel.startsWith('@') || authorLabel === '제작자 미표시'
                                      ? undefined
                                      : authorLabel,
                                });
                              }}
                              className="mb-2 flex-row items-center self-start rounded-full px-3 py-1.5"
                              style={{
                                backgroundColor: canOpenProfile ? '#EFF6FF' : '#F3F4F6',
                              }}
                            >
                              <Ionicons
                                name={canOpenProfile ? 'person-circle-outline' : 'person-outline'}
                                size={14}
                                color={canOpenProfile ? '#2563EB' : '#6B7280'}
                              />
                              <Text
                                className="ml-1 text-xs font-semibold"
                                style={{ color: canOpenProfile ? '#1D4ED8' : '#6B7280' }}
                              >
                                제작자 {authorLabel}
                              </Text>
                            </Pressable>
                          );
                        })()}
                        {Array.isArray(course.tags) && course.tags.length > 0 ? (
                          <View className="mb-2 flex-row flex-wrap gap-1.5">
                            {course.tags.slice(0, 2).map((tag) => (
                              <View
                                key={String(tag)}
                                className="rounded-full bg-indigo-50 px-2.5 py-0.5"
                              >
                                <Text className="text-xs font-medium text-indigo-800">{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text className="mb-2 text-xs text-gray-500">
                            선택된 태그가 없어요
                          </Text>
                        )}

                        <View className="flex-row flex-wrap items-center gap-2 mb-3">
                          {regionChip ? (
                            <View className="px-3 py-1 rounded-full bg-slate-100">
                              <Text className="text-xs font-medium text-slate-700">{regionChip}</Text>
                            </View>
                          ) : null}
                          <View className="px-3 py-1 rounded-full bg-blue-50">
                            <Text className="text-xs text-blue-700">
                              예상 소요{" "}
                              {formatOverallDurationLabel(
                                course.overallDurationMinutes,
                              )}
                            </Text>
                          </View>
                          <View className="px-3 py-1 rounded-full bg-yellow-50">
                            <Text className="text-xs text-yellow-700">
                              ★ {course.rating.toFixed(1)} ({course.reviewCount}
                              명)
                            </Text>
                          </View>
                        </View>

                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          <View className="flex-row items-center">
                            <View className="px-2 py-1 bg-green-100 rounded">
                              <Text className="text-xs font-medium text-green-700">
                                출발
                              </Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.departure}
                            </Text>
                          </View>
                          <View className="flex-row items-center mt-2">
                            <View className="px-2 py-1 bg-red-100 rounded">
                              <Text className="text-xs font-medium text-red-700">
                                도착
                              </Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.arrival}
                            </Text>
                          </View>
                        </View>

                        <Text className="mb-2 text-sm font-semibold text-gray-900">
                          코스 경로
                        </Text>
                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          {routeSteps.map((step, index) => (
                            <TouchableOpacity
                              key={step.id}
                              onPress={() => {
                                if (selectedStepId === step.id) {
                                  setSelectedStepId(null);
                                  setMapFocus({
                                    ...getCourseMapCenterFromSteps(course),
                                    level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
                                  });
                                  return;
                                }
                                if (ur) {
                                  const p = getUserRouteStepPoint(ur, index);
                                  setMapFocus({ lat: p.lat, lng: p.lng });
                                } else {
                                  setMapFocus(
                                    focusMapOnCourseStep(
                                      step,
                                      course.id,
                                      index,
                                      routeSteps.length,
                                    ),
                                  );
                                }
                                setSelectedStepId(step.id);
                              }}
                              className="flex-row items-start py-1.5"
                              style={[
                                index > 0
                                  ? {
                                      borderTopWidth: 1,
                                      borderTopColor: "#e5e7eb",
                                    }
                                  : null,
                                selectedStepId === step.id
                                  ? {
                                      backgroundColor: "rgba(59,130,246,0.08)",
                                      borderRadius: 8,
                                    }
                                  : null,
                              ]}
                            >
                              <Text className="mt-0.5 w-5 text-xs font-semibold text-gray-500">
                                {index + 1}.
                              </Text>
                              <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-900">
                                  {step.name}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  );
                })()}
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
