// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useMockData } from "../context/MockDataContext";
import {
  convertPersonalCourseToPublic,
  deleteMyCourse,
  fetchMyCourseDetail,
  fetchMyCourses,
  fetchMySharingCourseIds,
  normalizeCourseList,
  setMyCoursePublic,
} from "../api/courses";
import {
  UserSavedRoute,
  userRouteToCourseItem,
  userRouteMapCenter,
  userRouteMapPath,
} from "../data/userSavedRoute";
import AppMapView from "../components/AppMapView";
import FilterBottomSheet from "../components/FilterBottomSheet";
import { fetchMergedDirectionsPolyline } from "../data/googleDirectionsApi";
import { useCourseStepWalkingSegments } from "../hooks/useCourseStepWalkingSegments";

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: "rgba(37,99,235,0.12)",
  borderRadius: 16,
  backgroundColor: "#fff",
};

/** 카드 id(문자열/숫자)와 목록·상세 재조회 id 불일치 방지 */
function sameCourseId(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  return String(a ?? "") === String(b ?? "");
}

function simplifyRoutePath(
  path: { latitude: number; longitude: number }[] | null | undefined,
  maxPoints = 20,
): { latitude: number; longitude: number }[] | undefined {
  if (!path || path.length === 0) return undefined;
  if (path.length <= maxPoints) return path;
  const first = path[0];
  const last = path[path.length - 1];
  const inner = path.slice(1, -1);
  const keepInner = Math.max(0, maxPoints - 2);
  if (keepInner <= 0) return [first, last];
  const step = Math.max(1, Math.ceil(inner.length / keepInner));
  const sampled = inner.filter((_, idx) => idx % step === 0).slice(0, keepInner);
  return [first, ...sampled, last];
}

function CourseCard({
  item,
  onPressCard,
  onRemove,
  onEdit,
  isFavorite,
  isPublic,
  showPublicToggle,
  publishBusy,
  onTogglePublic,
}: {
  item: CourseItem;
  onPressCard: () => void;
  onRemove: () => void;
  onEdit: () => void;
  isFavorite?: boolean;
  isPublic?: boolean;
  showPublicToggle?: boolean;
  publishBusy?: boolean;
  onTogglePublic?: (next: boolean) => void;
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
            <View className="flex-row items-start gap-1">
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
            <Text className="mt-1 text-xs text-gray-500">{item.meta}</Text>
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

      {showPublicToggle ? (
        <View
          className="flex-row items-center justify-between border-t border-gray-100 px-3.5 py-2.5"
          style={{ backgroundColor: isPublic ? "rgba(37,99,235,0.06)" : "#fafafa" }}
        >
          <View className="flex-row items-center gap-2 flex-1 min-w-0 pr-2">
            <Ionicons
              name={isPublic ? "globe" : "lock-closed-outline"}
              size={16}
              color={isPublic ? "#2563eb" : "#64748b"}
            />
            <Text
              className="text-xs font-medium"
              style={{ color: isPublic ? "#2563eb" : "#64748b" }}
              numberOfLines={1}
            >
              {isPublic ? "공개 코스" : "개인 코스"}
            </Text>
          </View>
          <Switch
            disabled={publishBusy}
            value={Boolean(isPublic)}
            onValueChange={(next) => onTogglePublic?.(next)}
            trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
            thumbColor={isPublic ? "#2563eb" : "#f4f4f5"}
          />
        </View>
      ) : null}
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

export default function MyRouteScreen(): React.JSX.Element {
  const stackNav = useNavigation<any>();
  const {
    favoriteCourseIds,
    removeSavedCourse,
    userSavedRoutes,
    deleteUserRoute,
    upsertUserRoute,
  } = useMockData();

  const [searchQuery, setSearchQuery] = useState("");
  const [apiMyCourses, setApiMyCourses] = useState<CourseItem[]>([]);
  /** Swagger GET /api/courses/my/sharing 기준, 공유 활성화된 코스 id */
  const [sharingIdSet, setSharingIdSet] = useState(() => new Set());
  const [shareToggleBusy, setShareToggleBusy] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>("즐겨찾기순");
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  /** 카드에서 연 상세 — 목록 재조회·id 타입 불일치 시에도 동일 코스 표시 */
  const [viewingCourseSnapshot, setViewingCourseSnapshot] =
    useState<CourseItem | null>(null);
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
      const sharingIds = await fetchMySharingCourseIds();
      setSharingIdSet(new Set(sharingIds));
    } catch {
      setApiMyCourses([]);
      setSharingIdSet(new Set());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadMyRoutesAndSharing();
    }, [reloadMyRoutesAndSharing]),
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
    fetchMyCourseDetail(viewingCourseId)
      .then((course) => {
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

  const mergedCourses = useMemo(() => {
    const fromUser = userSavedRoutes.map(userRouteToCourseItem);
    const combined = [...fromUser, ...apiMyCourses];
    const seen = new Set<string>();
    return combined.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
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
  ]);

  const isUserSavedRouteId = (id: string) =>
    userSavedRoutes.some((r) => sameCourseId(r.id, id));

  const isServerBackedMyCourse = (id: string) =>
    apiMyCourses.some((c) => sameCourseId(c.id, id));

  /** 루트 제작 등으로 직접 만든 코스만 공유 토글 허용 (공유 탭에서만 저장한 목록 등 제외) */
  const isUserAuthoredMyRoute = (id: string, courseLike: CourseItem) => {
    if (isUserSavedRouteId(id)) return true;
    const cat = String(courseLike?.category ?? "");
    const meta = String(courseLike?.meta ?? "");
    if (cat === "직접제작" || cat.includes("직접")) return true;
    if (/직접\s*제작|루트\s*제작/.test(meta)) return true;
    return false;
  };

  const canShareMyRouteToPublic = (id: string, courseLike: CourseItem) =>
    isServerBackedMyCourse(id) && isUserAuthoredMyRoute(id, courseLike);

  /** 직접 만든 코스 — 서버 저장·기기 전용 모두 공개 토글 표시 */
  const canShowPublicToggle = (id: string, courseLike: CourseItem) => {
    if (!isUserAuthoredMyRoute(id, courseLike)) return false;
    if (canShareMyRouteToPublic(id, courseLike)) return true;
    return userSavedRoutes.some((r) => sameCourseId(r.id, id));
  };

  const isCoursePublic = useCallback(
    (id: string) => {
      for (const sid of sharingIdSet) {
        if (sameCourseId(sid, id)) return true;
      }
      return false;
    },
    [sharingIdSet],
  );

  const applySharingState = useCallback((courseId: string, isPublic: boolean) => {
    setSharingIdSet((prev) => {
      const n = new Set(prev);
      for (const sid of [...n]) {
        if (sameCourseId(sid, courseId)) n.delete(sid);
      }
      if (isPublic) n.add(String(courseId));
      return n;
    });
  }, []);

  const handleSetCoursePublic = useCallback(
    async (courseId: string, makePublic: boolean) => {
      setShareToggleBusy(true);
      try {
        const ok = await setMyCoursePublic(courseId, makePublic);
        if (!ok) {
          Alert.alert(
            "실패",
            makePublic
              ? "공개 코스로 전환하지 못했습니다. 네트워크 또는 서버 상태를 확인해 주세요."
              : "비공개로 전환하지 못했습니다.",
          );
          return false;
        }
        applySharingState(courseId, makePublic);
        await reloadMyRoutesAndSharing();
        return true;
      } finally {
        setShareToggleBusy(false);
      }
    },
    [applySharingState, reloadMyRoutesAndSharing],
  );

  const handleConvertLocalRouteToPublic = useCallback(
    async (ur: UserSavedRoute) => {
      const start = ur.stops[0];
      const end = ur.stops[ur.stops.length - 1];
      if (start?.lat == null || end?.lat == null) {
        Alert.alert(
          "공개 불가",
          "출발·도착 좌표가 있는 루트만 공개할 수 있어요. 루트 제작에서 장소를 다시 지정한 뒤 저장해 주세요.",
        );
        return;
      }
      setShareToggleBusy(true);
      try {
        const result = await convertPersonalCourseToPublic(ur);
        if (!result.ok) {
          if (result.reason === "UPLOAD_FAILED") {
            Alert.alert(
              "업로드 실패",
              "서버에 코스를 올리지 못했습니다. 네트워크 연결 후 다시 시도해 주세요.",
            );
          } else {
            Alert.alert(
              "공개 실패",
              "코스는 서버에 저장됐지만 공개 설정에 실패했습니다. 잠시 후 상세에서 다시 켜 주세요.",
            );
            if (result.serverId) applySharingState(result.serverId, false);
          }
          return;
        }
        if (result.migratedFromLocalId) {
          deleteUserRoute(result.migratedFromLocalId);
        }
        upsertUserRoute({
          ...ur,
          id: result.serverId,
          updatedAt: new Date().toISOString(),
        });
        applySharingState(result.serverId, true);
        if (sameCourseId(viewingCourseId, ur.id)) {
          setViewingCourseId(result.serverId);
          setViewingCourseSnapshot((prev) =>
            prev && sameCourseId(prev.id, ur.id)
              ? { ...prev, id: result.serverId }
              : prev,
          );
        }
        await reloadMyRoutesAndSharing();
      } finally {
        setShareToggleBusy(false);
      }
    },
    [
      applySharingState,
      deleteUserRoute,
      reloadMyRoutesAndSharing,
      upsertUserRoute,
      viewingCourseId,
    ],
  );

  const handleToggleCoursePublic = useCallback(
    async (
      courseId: string,
      course: CourseItem,
      ur: UserSavedRoute | undefined,
      makePublic: boolean,
    ) => {
      if (makePublic) {
        if (ur && !isServerBackedMyCourse(courseId)) {
          await handleConvertLocalRouteToPublic(ur);
          return;
        }
        await handleSetCoursePublic(courseId, true);
        return;
      }
      if (!isServerBackedMyCourse(courseId)) return;
      await handleSetCoursePublic(courseId, false);
    },
    [
      handleConvertLocalRouteToPublic,
      handleSetCoursePublic,
      isServerBackedMyCourse,
    ],
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
              setViewingCourseId(null);
              setViewingCourseSnapshot(null);
            }
          },
        },
      ],
    );
  };

  const openRouteCreateEdit = (routeId: string, collaborative: boolean) => {
    stackNav.getParent()?.navigate("RouteCreate", {
      editRouteId: routeId,
      collaborative,
    });
  };

  const openRouteCreateFromMockCourse = (mockCourseId: string) => {
    stackNav
      .getParent()
      ?.navigate("RouteCreate", { seedMockCourseId: mockCourseId });
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
              onPress={() => stackNav.getParent()?.navigate("RouteCreate")}
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
            const showToggle = canShowPublicToggle(item.id, item);
            return (
              <CourseCard
                item={item}
                isFavorite={favoriteCourseIds.some((fid) =>
                  sameCourseId(fid, item.id),
                )}
                isPublic={isCoursePublic(item.id)}
                showPublicToggle={showToggle}
                publishBusy={shareToggleBusy}
                onTogglePublic={(next) =>
                  handleToggleCoursePublic(item.id, item, ur, next)
                }
                onPressCard={() => {
                  setViewingCourseSnapshot(item);
                  setViewingCourseId(String(item.id));
                }}
                onRemove={() => handleRemove(item)}
                onEdit={() => {
                  if (isUserSavedRouteId(item.id)) {
                    openRouteCreateEdit(
                      item.id,
                      ur?.collaborative === true,
                    );
                  } else if (isServerBackedMyCourse(item.id)) {
                    openRouteCreateEdit(item.id, false);
                  } else {
                    openRouteCreateFromMockCourse(item.id);
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

      {/* 코스 상세 보기 모달 */}
      <Modal
        visible={!!viewingCourseId}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setViewingCourseId(null);
          setViewingCourseSnapshot(null);
        }}
      >
        <View style={{ flex: 1 }}>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(107,114,128,0.45)" },
            ]}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              setViewingCourseId(null);
              setViewingCourseSnapshot(null);
            }}
          />

          <View
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
            <View
              className="overflow-hidden rounded-t-3xl"
              style={{
                maxHeight: "82%",
                width: "100%",
                backgroundColor: "#F8FBFF",
                zIndex: 2,
                elevation: 12,
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
                          onPress={() => {
                            setViewingCourseId(null);
                            setViewingCourseSnapshot(null);
                          }}
                          className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5"
                        >
                          <Text className="text-sm font-semibold text-white">
                            닫기
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  const hours = (course.overallDurationMinutes / 60).toFixed(1);
                  const routeSteps = Array.isArray(course.routeSteps)
                    ? course.routeSteps
                    : [];
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
                      ? pathPts.map((pt, i) => ({
                          latitude: pt.latitude,
                          longitude: pt.longitude,
                          label: `${i + 1}`,
                          kind:
                            i === 0
                              ? "start"
                              : i === pathPts.length - 1
                                ? "end"
                                : "waypoint",
                          color:
                            i === 0
                              ? "#2563EB"
                              : i === pathPts.length - 1
                                ? "#EF4444"
                                : "#64748B",
                        }))
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
                    <>
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
                            onPress={() => setViewingCourseId(null)}
                            hitSlop={12}
                          >
                            <Ionicons name="close" size={26} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            height: 200,
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
                            style={{ width: "100%", height: 200 }}
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
                            ? "주황색 선: 선택 구간 도보 경로"
                            : pathPts && pathPts.length >= 2
                              ? `선 방향: 1번(${startStepName}) → ${pathPts.length}번(${endStepName})`
                              : "선 방향: 출발 지점 기준"}
                        </Text>
                      </View>

                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        className="bg-white"
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
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => {
                                setViewingCourseId(null);
                                if (ur) {
                                  openRouteCreateEdit(
                                    ur.id,
                                    ur.collaborative === true,
                                  );
                                } else if (isServerBackedMyCourse(course.id)) {
                                  openRouteCreateEdit(course.id, false);
                                } else {
                                  openRouteCreateFromMockCourse(course.id);
                                }
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
                                setViewingCourseId(null);
                                handleRemove(course);
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
                        <Text className="mb-2 text-sm text-gray-500">
                          {course.meta}
                        </Text>

                        <View className="flex-row flex-wrap items-center gap-2 mb-3">
                          <View className="px-3 py-1 bg-gray-100 rounded-full">
                            <Text className="text-xs text-gray-700">
                              {course.category}
                            </Text>
                          </View>
                          <View className="px-3 py-1 bg-gray-100 rounded-full">
                            <Text className="text-xs text-gray-700">
                              {course.region}
                            </Text>
                          </View>
                          <View className="px-3 py-1 rounded-full bg-blue-50">
                            <Text className="text-xs text-blue-700">
                              예상 소요 약 {hours}시간
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

                        {canShowPublicToggle(course.id, course) ? (
                          <View className="mb-6 rounded-xl border border-blue-100 bg-blue-50/90 p-3.5">
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1 pr-3">
                                <Text className="text-sm font-semibold text-gray-900">
                                  공개 코스
                                </Text>
                                <Text className="mt-1 text-[11px] leading-4 text-gray-600">
                                  {isCoursePublic(course.id)
                                    ? "공유 코스 탭에 노출 중이에요."
                                    : ur && !isServerBackedMyCourse(course.id)
                                      ? "켜면 서버에 올린 뒤 공유 코스 탭에 공개돼요."
                                      : "켜면 공유 코스 탭에 노출돼요."}
                                </Text>
                              </View>
                              <Switch
                                disabled={shareToggleBusy}
                                value={isCoursePublic(course.id)}
                                onValueChange={(next) =>
                                  handleToggleCoursePublic(
                                    course.id,
                                    course,
                                    ur,
                                    next,
                                  )
                                }
                                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                                thumbColor={
                                  isCoursePublic(course.id) ? "#2563eb" : "#f4f4f5"
                                }
                              />
                            </View>
                          </View>
                        ) : null}

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
                    </>
                  );
                })()}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
