// @ts-nocheck - NativeWind(className) 타입이 @types/react-native와 병합되지 않아 일시 비활성화
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { Ionicons } from "@expo/vector-icons";
import {
  COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
  COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM,
  computeMapRouteFit,
  courseRouteStepsToMapPath,
  focusMapOnCourseStep,
  getCourseMapCenterFromSteps,
  type CourseDetailMapFocus,
  type CourseItem,
  type CourseReview,
} from "../data/mockData";
import {
  looksLikeStraightStopConnectorPath,
  resolveCoursePreviewDirectionsMode,
  type DirectionsMode,
} from "../data/googleDirectionsApi";
import { useMockData } from "../context/MockDataContext";
import { useToast } from "../context/ToastContext";
import {
  fetchSharedCourses,
  fetchSharedCourseDetail,
  fetchMyCourses,
  normalizeCourseList,
  pickCourseSaveCount,
  sortCoursesBySaveCount,
  saveSharedCourse,
  unsaveSharedCourse,
  submitSharedCourseReview,
} from "../api/courses";
import { displayCourseRegionChip } from "../utils/inferCourseRegionLabel";
import {
  getCourseAuthorLabel,
  getCourseModifierLabel,
} from "../utils/formatCourseAuthor";
import {
  CourseAuthorCardRow,
  CourseAuthorDetailChip,
} from "../components/CourseAuthorDisplay";
import AppMapView from "../components/AppMapView";
import { buildMapMarkersFromPathPoints } from "../utils/spreadMapMarkers";
import { simplifyRoutePath } from "../utils/simplifyRoutePath";
import { sharePublicCourse } from "../utils/shareCourse";
import { fetchMergedDirectionsPolyline } from "../data/googleDirectionsApi";
import { useCourseStepWalkingSegments } from "../hooks/useCourseStepWalkingSegments";
import FilterBottomSheet, {
  CATEGORIES,
  REGIONS,
  SORT_OPTIONS,
} from "../components/FilterBottomSheet";
import { dedupeCoursesById, sameCourseId } from "../utils/sameCourseId";
import { courseMatchesTagOrCategory } from "../utils/courseTagFilter";
import { mergeLocalThumbnailsIntoCourses } from "../utils/mergeCourseThumbnails";
import { enrichCoursesWithForkOriginAuthors, enrichCourseWithForkOriginAuthor } from "../utils/enrichForkOriginAuthor";
import { mergeCourseAuthorCredits } from "../utils/courseAuthorCredits";
import { rootNavigate } from "../navigation/rootNavigation";
import { useRouteSection } from "../context/RouteScreenContext";

type SharedRouteParams = {
  section?: "shared" | "my";
  openFilter?: boolean;
  openAsPopular?: boolean;
  viewCourseId?: string;
  initialQuery?: string;
};

type TabId = "all" | "popular" | "date" | "friends";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "popular", label: "인기코스" },
  { id: "date", label: "데이트" },
  { id: "friends", label: "친구모임" },
];

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: "rgba(37,99,235,0.12)",
  borderRadius: 16,
  backgroundColor: "#fff",
};

function mergeSharedCourseWithExtraReviews(
  base: CourseItem,
  extras: CourseReview[] | undefined,
): CourseItem {
  const add = extras ?? [];
  const merged = [...(base.reviews ?? []), ...add].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const rating =
    merged.length > 0
      ? merged.reduce((s, r) => s + r.rating, 0) / merged.length
      : base.rating;
  return {
    ...base,
    reviews: merged,
    rating,
    reviewCount: base.reviewCount + add.length,
  };
}

function CourseCard({
  item,
  onPress,
  authorCtx,
}: {
  item: CourseItem;
  onPress: () => void;
  authorCtx: {
    myUuid?: string | null;
    myUserId?: string | null;
    myNickname?: string | null;
  };
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-3 overflow-hidden bg-white rounded-2xl active:opacity-95"
      style={CARD_STYLE}
    >
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
          <Text
            className="text-[15px] font-semibold leading-snug text-gray-900"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <CourseAuthorCardRow course={item} authorCtx={authorCtx} />
          {Array.isArray(item.tags) && item.tags.length > 0 ? (
            <View className="mt-1.5 flex-row flex-wrap gap-1">
              {item.tags.slice(0, 2).map((tag) => (
                <View
                  key={`${item.id}-${tag}`}
                  className="rounded-full bg-indigo-50 px-2 py-0.5"
                >
                  <Text className="text-[11px] font-medium text-indigo-800">{tag}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
              {item.meta}
            </Text>
          )}
        </View>
        <View className="justify-center pl-1">
          <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
        </View>
      </View>

      <View className="flex-row items-center px-3.5 py-2.5">
        <View className="px-2 py-1 bg-blue-600 rounded-md">
          <Text className="text-[11px] font-semibold text-white">출발</Text>
        </View>
        <Text className="ml-2 text-[13px] text-gray-900" numberOfLines={1}>
          {item.departure}
        </Text>
        <View className="w-px h-3 mx-2 bg-gray-300" />
        <View className="px-2 py-1 rounded-md bg-slate-500">
          <Text className="text-[11px] font-semibold text-white">도착</Text>
        </View>
        <Text
          className="ml-2 flex-1 text-[13px] text-gray-900"
          numberOfLines={1}
        >
          {item.arrival}
        </Text>
      </View>
    </Pressable>
  );
}

type SharedRouteScreenProps = {
  embedded?: boolean;
};

export default function SharedRouteScreen({
  embedded = false,
}: SharedRouteScreenProps = {}): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params || {}) as SharedRouteParams;
  const {
    addSavedCourse,
    addSharedCourseReview,
    extraSharedCourseReviews,
    savedCourseIds,
    userSavedRoutes,
  } = useMockData();
  const { showToast } = useToast();
  const routeSection = useRouteSection();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authorCtx = useMemo(
    () => ({
      myUuid: authUser?.uuid,
      myUserId: authUser?.userId,
      myNickname: authUser?.nickname,
    }),
    [authUser?.uuid, authUser?.userId, authUser?.nickname],
  );
  const [apiMyCourses, setApiMyCourses] = useState<CourseItem[]>([]);

  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [coursesData, setCoursesData] = useState<CourseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<CourseDetailMapFocus | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [courseDetailMergedPath, setCourseDetailMergedPath] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);
  const [sharedDetailCourseApi, setSharedDetailCourseApi] =
    useState<CourseItem | null>(null);
  const [courseDetailPathLoading, setCourseDetailPathLoading] = useState(false);

  const detailMapCourse = useMemo(() => {
    if (!viewingCourseId) return null;
    return (
      (sharedDetailCourseApi?.id === viewingCourseId
        ? sharedDetailCourseApi
        : null) ?? coursesData.find((c) => c.id === viewingCourseId) ?? null
    );
  }, [viewingCourseId, sharedDetailCourseApi, coursesData]);
  const detailMapStepPoints = useMemo(() => {
    const detailSteps = Array.isArray(detailMapCourse?.routeSteps)
      ? detailMapCourse.routeSteps
      : [];
    if (!detailMapCourse || detailSteps.length < 2) return null;
    return courseRouteStepsToMapPath(detailMapCourse.id, detailSteps);
  }, [detailMapCourse]);
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

  const [reviewCourseId, setReviewCourseId] = useState<string | null>(null);
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [reviewUserName, setReviewUserName] = useState("나");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [savingMyRoute, setSavingMyRoute] = useState(false);
  const [favoritedCourseIds, setFavoritedCourseIds] = useState<Set<string>>(new Set());
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [detailModalMounted, setDetailModalMounted] = useState(false);
  const detailBackdropOpacity = useRef(new Animated.Value(0)).current;
  const detailSheetTranslateY = useRef(new Animated.Value(500)).current;
  const detailSheetOffY = useMemo(
    () => Math.min(520, Dimensions.get("window").height * 0.6),
    [],
  );
  const viewingCourseIdRef = useRef<string | null>(null);
  viewingCourseIdRef.current = viewingCourseId;

  const reloadSharedCourses = useCallback(async () => {
    try {
      const courses = await fetchSharedCourses();
      const normalized = normalizeCourseList(courses);
      const withThumbs = mergeLocalThumbnailsIntoCourses(
        normalized,
        userSavedRoutes,
      );
      const withAuthors = await enrichCoursesWithForkOriginAuthors(
        withThumbs,
        userSavedRoutes,
      );
      setCoursesData((prev) => mergeCourseAuthorCredits(withAuthors, prev));
    } catch {
      setCoursesData([]);
    }
  }, [userSavedRoutes]);

  const reloadMyCourses = useCallback(async () => {
    try {
      const courses = await fetchMyCourses();
      setApiMyCourses(normalizeCourseList(courses));
    } catch {
      setApiMyCourses([]);
    }
  }, []);

  const isOwnMyRoute = useCallback(
    (course: CourseItem) => {
      const id = String(course?.id ?? "");
      if (!id) return false;
      if (
        authorCtx.myUuid &&
        course.authorUuid &&
        String(course.authorUuid) === String(authorCtx.myUuid)
      ) {
        return true;
      }
      if (userSavedRoutes.some((r) => sameCourseId(r.id, id))) return true;
      if (apiMyCourses.some((c) => sameCourseId(c.id, id))) return true;
      return false;
    },
    [userSavedRoutes, apiMyCourses, authorCtx.myUuid],
  );

  useFocusEffect(
    useCallback(() => {
      reloadSharedCourses();
      reloadMyCourses();
    }, [reloadSharedCourses, reloadMyCourses]),
  );

  useEffect(() => {
    if (viewingCourseId) setDetailModalMounted(true);
  }, [viewingCourseId]);

  useEffect(() => {
    if (!(detailModalMounted && viewingCourseId)) return;
    detailSheetTranslateY.setValue(detailSheetOffY);
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
  }, [viewingCourseId, detailModalMounted, detailSheetOffY]);

  const closeCourseDetail = () => {
    if (!viewingCourseIdRef.current) return;
    setReviewComposerOpen(false);
    Animated.parallel([
      Animated.timing(detailBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(detailSheetTranslateY, {
        toValue: detailSheetOffY,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setViewingCourseId(null);
        setDetailModalMounted(false);
      }
    });
  };

  useEffect(() => {
    if (params?.section === "my") return;
    if (params?.openFilter) setFilterVisible(true);
    if (params?.openAsPopular) setSelectedSort("인기순");
    if (params?.viewCourseId) setViewingCourseId(params.viewCourseId);
    if (typeof params?.initialQuery === "string") setSearchQuery(params.initialQuery);
  }, [
    params?.section,
    params?.openFilter,
    params?.openAsPopular,
    params?.viewCourseId,
    params?.initialQuery,
  ]);

  useEffect(() => {
    if (!viewingCourseId) {
      setMapFocus(null);
      setSelectedStepId(null);
      setReviewComposerOpen(false);
      setReviewCourseId(null);
      return;
    }
    setReviewComposerOpen(false);
    setSelectedStepId(null);
    const course =
      (sharedDetailCourseApi?.id === viewingCourseId
        ? sharedDetailCourseApi
        : null) ?? coursesData.find((c) => c.id === viewingCourseId);
    setMapFocus(
      course
        ? {
            ...getCourseMapCenterFromSteps(course),
            level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
          }
        : null,
    );
  }, [viewingCourseId, coursesData, sharedDetailCourseApi]);

  useEffect(() => {
    if (!viewingCourseId) {
      setCourseDetailMergedPath(null);
      setCourseDetailPathLoading(false);
      setSharedDetailCourseApi(null);
      return;
    }
    let mounted = true;
    fetchSharedCourseDetail(viewingCourseId)
      .then(async (course) => {
        if (!mounted || !course) return;
        const enriched = await enrichCourseWithForkOriginAuthor(
          course,
          userSavedRoutes,
        );
        if (mounted && enriched) setSharedDetailCourseApi(enriched);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [viewingCourseId, userSavedRoutes]);

  useEffect(() => {
    if (!viewingCourseId) {
      setCourseDetailMergedPath(null);
      setCourseDetailPathLoading(false);
      return;
    }
    const course =
      (sharedDetailCourseApi?.id === viewingCourseId
        ? sharedDetailCourseApi
        : null) ?? coursesData.find((c) => c.id === viewingCourseId);
    const routeSteps = Array.isArray(course?.routeSteps) ? course.routeSteps : [];
    if (!course || routeSteps.length < 2) {
      setCourseDetailMergedPath(null);
      setCourseDetailPathLoading(false);
      return;
    }
    const stepPoints = courseRouteStepsToMapPath(course.id, routeSteps);
    const directionsMode = resolveCoursePreviewDirectionsMode(course.routeLegs);
    const ac = new AbortController();
    setCourseDetailPathLoading(true);
    setCourseDetailMergedPath(null);
    const loadMergedPath = (mode: DirectionsMode) =>
      fetchMergedDirectionsPolyline({
        points: stepPoints,
        mode,
        signal: ac.signal,
      });
    loadMergedPath(directionsMode)
      .then(async (path) => {
        if (ac.signal.aborted) return;
        let final = path;
        if (
          looksLikeStraightStopConnectorPath(path, stepPoints.length) &&
          directionsMode === "transit"
        ) {
          final = await loadMergedPath("driving");
        }
        if (!ac.signal.aborted && final.length >= 2)
          setCourseDetailMergedPath(final);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setCourseDetailPathLoading(false);
      });
    return () => ac.abort();
  }, [viewingCourseId, coursesData, sharedDetailCourseApi]);

  const filteredCourses = useMemo(() => {
    let list = [...coursesData];

    if (activeTab === "date")
      list = list.filter((c) => courseMatchesTagOrCategory(c, "데이트"));
    else if (activeTab === "friends")
      list = list.filter((c) => courseMatchesTagOrCategory(c, "친구모임"));
    else if (activeTab === "popular")
      list = sortCoursesBySaveCount(list);

    if (selectedCategory)
      list = list.filter((c) => courseMatchesTagOrCategory(c, selectedCategory));
    if (selectedRegion) {
      const region = selectedRegion.trim();
      list = list.filter((c) => {
        const r = String(c.region ?? "").trim();
        return r === region || r.startsWith(`${region} `) || r.startsWith(region);
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const tagHit = (Array.isArray(c.tags) ? c.tags : []).some((t) =>
          String(t ?? "")
            .toLowerCase()
            .includes(q),
        );
        return (
          tagHit ||
          String(c.title ?? "").toLowerCase().includes(q) ||
          String(c.meta ?? "").toLowerCase().includes(q) ||
          String(c.departure ?? "").toLowerCase().includes(q) ||
          String(c.arrival ?? "").toLowerCase().includes(q)
        );
      });
    }

    if (selectedSort === "인기순" || selectedSort === "저장순")
      list = sortCoursesBySaveCount(list);
    else if (selectedSort === "즐겨찾기순")
      list = sortCoursesBySaveCount(list);
    else if (selectedSort === "최신순")
      list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    else if (selectedSort === "조회순")
      list = [...list].sort((a, b) => b.views - a.views);
    else if (selectedSort === "거리순" || selectedSort === "추천순") {
      list = [...list].sort((a, b) => b.views - a.views);
    }

    return dedupeCoursesById(list);
  }, [activeTab, searchQuery, selectedCategory, selectedRegion, selectedSort, coursesData]);

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };
  const handleRegionToggle = (region: string) => {
    setSelectedRegion((prev) => (prev === region ? null : region));
  };
  const handleSortToggle = (opt: string) => {
    setSelectedSort((prev) => (prev === opt ? null : opt));
  };

  const handleToggleFavorite = useCallback(
    async (courseId: string) => {
      setTogglingFavorite(true);
      try {
        const isFavorited = favoritedCourseIds.has(courseId);
        if (isFavorited) {
          const success = await unsaveSharedCourse(courseId);
          if (success) {
            setFavoritedCourseIds((prev) => {
              const next = new Set(prev);
              next.delete(courseId);
              return next;
            });
            showToast('즐겨찾기를 취소했어요');
          } else {
            showToast('즐겨찾기 취소에 실패했어요');
          }
        } else {
          const result = await saveSharedCourse(courseId);
          if (result.ok) {
            setFavoritedCourseIds((prev) => new Set(prev).add(courseId));
            showToast('즐겨찾기에 추가했어요');
          } else if (result.reason === "NOT_ON_SERVER") {
            showToast('코스를 찾을 수 없어요');
          } else {
            showToast('즐겨찾기 추가에 실패했어요');
          }
        }
      } finally {
        setTogglingFavorite(false);
      }
    },
    [favoritedCourseIds, showToast],
  );

  const ScreenRoot = embedded ? View : SafeAreaView;
  const screenRootProps = embedded
    ? { className: "flex-1 bg-[#F0F5FF]" }
    : { className: "flex-1 bg-[#F0F5FF]", edges: ["top"] as const };

  return (
    <ScreenRoot {...screenRootProps}>
      {/* 검색 + 필터 — 배경과 분리된 카드형 검색바 */}
      <View
        className={`flex-row items-center gap-2.5 px-4 ${embedded ? 'pb-2 pt-1' : 'py-3'}`}
      >
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
            className="items-center justify-center mr-2 h-9 w-9 rounded-xl"
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
        <Pressable
          onPress={() => setFilterVisible(true)}
          className="h-[46px] w-[46px] items-center justify-center rounded-2xl bg-white active:opacity-90"
          style={{
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
          accessibilityLabel="필터"
        >
          <Ionicons name="options-outline" size={23} color="#2563EB" />
        </Pressable>
      </View>

      {/* 탭 - 세로 높이 고정으로 불필요한 빈 공간 제거 */}
      <View className="px-4 pb-1" style={{ height: 44 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingVertical: 6,
            gap: 10,
            alignItems: "center",
          }}
          style={{ flexGrow: 0 }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                borderWidth: 1,
                borderColor: activeTab === tab.id ? "#2563EB" : "#dbeafe",
                backgroundColor: activeTab === tab.id ? "#2563EB" : "#ffffff",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text
                className={`text-xs font-medium ${activeTab === tab.id ? "text-white" : "text-gray-600"}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 코스 리스트 */}
      <FlatList<CourseItem>
        data={filteredCourses ?? []}
        keyExtractor={(item: CourseItem, index) => `shared-${item.id}-${index}`}
        renderItem={({ item }: { item: CourseItem }) => (
          <CourseCard
            item={item}
            authorCtx={authorCtx}
            onPress={() => setViewingCourseId(item.id)}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedSort={selectedSort}
        onCategoryToggle={handleCategoryToggle}
        onRegionToggle={handleRegionToggle}
        onSortToggle={handleSortToggle}
        onReset={() => {
          setSelectedCategory(null);
          setSelectedRegion(null);
          setSelectedSort(null);
        }}
        onApply={() => {
          // 실제 적용 시 필터 상태로 API 호출 등
        }}
      />

      {/* 코스 상세 보기 모달 — 배경은 페이드, 시트만 슬라이드 (Modal slide는 백드롭까지 같이 움직임) */}
      <Modal
        visible={detailModalMounted}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (reviewComposerOpen) {
            setReviewComposerOpen(false);
            return;
          }
          closeCourseDetail();
        }}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: detailBackdropOpacity,
              },
            ]}
          >
            <Pressable
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "rgba(107,114,128,0.45)" },
              ]}
              onPress={() => {
                if (reviewComposerOpen) {
                  setReviewComposerOpen(false);
                  return;
                }
                closeCourseDetail();
              }}
            />
          </Animated.View>

          <View
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                width: "100%",
                maxHeight: "82%",
                transform: [{ translateY: detailSheetTranslateY }],
              }}
            >
              <View
                className="overflow-hidden rounded-t-3xl"
                style={{ maxHeight: "100%", backgroundColor: "#F8FBFF" }}
              >
                {viewingCourseId &&
                  (() => {
                    const courseBase =
                      (sharedDetailCourseApi?.id === viewingCourseId
                        ? sharedDetailCourseApi
                        : null) ??
                      coursesData.find((c) => c.id === viewingCourseId);
                    if (!courseBase) return null;
                    const course = mergeSharedCourseWithExtraReviews(
                      courseBase,
                      extraSharedCourseReviews[courseBase.id],
                    );

                    const hours = (course.overallDurationMinutes / 60).toFixed(
                      1,
                    );
                    const routeSteps = Array.isArray(course.routeSteps)
                      ? course.routeSteps
                      : [];
                    const pathPts =
                      routeSteps.length >= 1
                        ? courseRouteStepsToMapPath(course.id, routeSteps)
                        : undefined;
                    // 실경로만 표시 (실패 시 정류장 직선 연결·부채꼴 방지)
                    const polylinePath = simplifyRoutePath(
                      courseDetailMergedPath && courseDetailMergedPath.length >= 2
                        ? courseDetailMergedPath
                        : undefined,
                    );
                    const stepNamesForRegionChips = routeSteps
                      .map((s) => String(s?.name ?? "").trim())
                      .filter(Boolean);
                    const regionChipLabel = displayCourseRegionChip(
                      course.region,
                      course.departure,
                      course.arrival,
                      stepNamesForRegionChips,
                    );
                    const mapMarkers =
                      pathPts && pathPts.length >= 1
                        ? buildMapMarkersFromPathPoints(pathPts)
                        : undefined;
                    const stepMapFocused = Boolean(selectedStepId);
                    const showWalkOnMap =
                      stepMapFocused &&
                      Boolean(stepWalkSegments && stepWalkSegments.length > 0);
                    const fallbackCenter = getCourseMapCenterFromSteps(course);
                    const fitPathForCamera =
                      showWalkOnMap && stepWalkSegments?.length
                        ? stepWalkSegments.flatMap((s) => s.points)
                        : courseDetailMergedPath &&
                            courseDetailMergedPath.length >= 2
                          ? courseDetailMergedPath
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

                    return (
                      <>
                        {/* 상단: 어두운 영역 + 지도 */}
                        <View
                          style={{
                            backgroundColor: "#EEF5FF",
                            paddingHorizontal: 0,
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
                            <Pressable onPress={closeCourseDetail} hitSlop={12}>
                              <Ionicons
                                name="close"
                                size={26}
                                color="#64748b"
                              />
                            </Pressable>
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
                              key={`${course.id}-${mapZoom ?? "f"}-${polylinePath?.length ?? 0}-${courseDetailMergedPath?.length ?? 0}-${stepMapFocused ? "step" : "route"}-${selectedStepId ?? "all"}`}
                              latitude={mapCenter.lat}
                              longitude={mapCenter.lng}
                              level={8}
                              zoom={mapZoom}
                              fitToRoute={mapFitToRoute}
                              allowTap={false}
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
                            {(courseDetailPathLoading ||
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
                                <ActivityIndicator
                                  size="small"
                                  color="#2563eb"
                                />
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
                          <View className="flex-row items-center justify-between gap-2 mb-4">
                            <Text className="flex-1 text-xl font-bold text-gray-900">
                              코스 상세
                            </Text>
                            <View className="flex-row items-center gap-2">
                            <Pressable
                              disabled={togglingFavorite}
                              onPress={() => void handleToggleFavorite(course.id)}
                              className="flex-row items-center px-3 py-2 bg-white border rounded-lg active:opacity-90"
                              style={{
                                borderColor: favoritedCourseIds.has(course.id)
                                  ? "#ef4444"
                                  : "#d1d5db",
                                opacity: togglingFavorite ? 0.6 : 1,
                              }}
                            >
                              <Ionicons
                                name={
                                  favoritedCourseIds.has(course.id)
                                    ? "heart"
                                    : "heart-outline"
                                }
                                size={18}
                                color={
                                  favoritedCourseIds.has(course.id)
                                    ? "#ef4444"
                                    : "#6b7280"
                                }
                              />
                              <Text
                                className="ml-1 text-xs font-semibold"
                                style={{
                                  color: favoritedCourseIds.has(course.id)
                                    ? "#ef4444"
                                    : "#4b5563",
                                }}
                              >
                                {favoritedCourseIds.has(course.id)
                                  ? "즐겨찾기됨"
                                  : "즐겨찾기"}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                void sharePublicCourse({
                                  courseId: course.id,
                                  title: course.title,
                                  accessToken,
                                  myUuid: authUser?.uuid,
                                })
                              }
                              className="flex-row items-center px-3 py-2 bg-white border border-gray-300 rounded-lg active:opacity-90"
                            >
                              <Ionicons name="share-outline" size={18} color="#2563eb" />
                              <Text className="ml-1 text-xs font-semibold text-blue-600">
                                공유
                              </Text>
                            </Pressable>
                            {isOwnMyRoute(course) ? (
                              <Pressable
                                onPress={() => {
                                  closeCourseDetail();
                                  const courseId = String(course.id);
                                  if (routeSection) {
                                    routeSection.setSection("my");
                                    navigation.setParams({
                                      section: "my",
                                      viewCourseId: courseId,
                                    });
                                  } else {
                                    navigation.navigate("Route", {
                                      section: "my",
                                      viewCourseId: courseId,
                                    });
                                  }
                                }}
                                className="flex-row items-center px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 active:opacity-90"
                              >
                                <Ionicons name="map-outline" size={18} color="#2563eb" />
                                <Text className="ml-1 text-xs font-bold text-blue-700">
                                  내 루트에서 보기
                                </Text>
                              </Pressable>
                            ) : (
                              <Pressable
                                disabled={
                                  savingMyRoute || savedCourseIds.includes(course.id)
                                }
                                onPress={async () => {
                                  if (savedCourseIds.includes(course.id)) {
                                    showToast('이미 저장된 코스예요');
                                    return;
                                  }
                                  setSavingMyRoute(true);
                                  try {
                                    const result = await saveSharedCourse(course.id);
                                    if (result.ok) {
                                      addSavedCourse(course.id);
                                      showToast('저장 완료');
                                    } else if (result.reason === "NOT_ON_SERVER") {
                                      showToast('코스를 찾을 수 없어요');
                                    } else {
                                      showToast('저장하지 못했어요');
                                    }
                                  } finally {
                                    setSavingMyRoute(false);
                                  }
                                }}
                                className="flex-row items-center px-3 py-2 rounded-lg active:opacity-90"
                                style={{
                                  backgroundColor: savedCourseIds.includes(course.id)
                                    ? "#93c5fd"
                                    : "#2563EB",
                                  opacity:
                                    savingMyRoute ||
                                    savedCourseIds.includes(course.id)
                                      ? 0.85
                                      : 1,
                                }}
                              >
                                {savingMyRoute ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={18}
                                    color="#fff"
                                  />
                                )}
                                <Text className="ml-1 text-xs font-bold text-white">
                                  {savedCourseIds.includes(course.id)
                                    ? "내 루트에 있음"
                                    : savingMyRoute
                                      ? "저장 중…"
                                      : "내 루트 추가"}
                                </Text>
                              </Pressable>
                            )}
                            </View>
                          </View>

                          <Text className="mb-1 text-base font-semibold text-gray-900">
                            {course.title}
                          </Text>
                          <CourseAuthorDetailChip
                            course={course}
                            authorCtx={authorCtx}
                            onPressCreator={() => {
                              const authorLabel = getCourseAuthorLabel(
                                course,
                                authorCtx,
                              );
                              const authorUuid = String(
                                course.authorUuid ?? "",
                              ).trim();
                              const authorUserId = String(
                                course.authorUserId ?? "",
                              ).trim();
                              rootNavigate("UserProfile", {
                                userUuid: authorUuid || undefined,
                                userId: authorUserId || undefined,
                                nickname:
                                  authorLabel.startsWith("@") ||
                                  authorLabel === "제작자 미표시"
                                    ? undefined
                                    : authorLabel,
                              });
                            }}
                            onPressModifier={() => {
                              const modLabel = getCourseModifierLabel(
                                course,
                                authorCtx,
                              );
                              const modUuid = String(
                                course.modifierUuid ?? "",
                              ).trim();
                              const modUserId = String(
                                course.modifierUserId ?? "",
                              ).trim();
                              rootNavigate("UserProfile", {
                                userUuid: modUuid || undefined,
                                userId: modUserId || undefined,
                                nickname:
                                  modLabel.startsWith("@") ||
                                  modLabel === "수정자 미표시"
                                    ? undefined
                                    : modLabel,
                              });
                            }}
                          />
                          {Array.isArray(course.tags) && course.tags.length > 0 ? (
                            <View className="flex-row flex-wrap gap-1 mb-2">
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
                            <Text className="mb-2 text-sm text-gray-500">{course.meta}</Text>
                          )}

                          <View className="flex-row flex-wrap items-center gap-2 mb-3">
                            <View className="px-3 py-1 bg-gray-100 rounded-full">
                              <Text className="text-xs text-gray-700">
                                {regionChipLabel}
                              </Text>
                            </View>
                            <View className="px-3 py-1 rounded-full bg-blue-50">
                              <Text className="text-xs text-blue-700">
                                예상 소요 약 {hours}시간
                              </Text>
                            </View>
                            <View className="px-3 py-1 rounded-full bg-yellow-50">
                              <Text className="text-xs text-yellow-700">
                                ★ {course.rating.toFixed(1)} (
                                {course.reviewCount}명)
                              </Text>
                            </View>
                          </View>

                          {/* 출발/도착 요약 */}
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

                          {/* 경로 단계별 체류 시간 */}
                          <Text className="mb-2 text-sm font-semibold text-gray-900">
                            코스 경로
                          </Text>
                          <View className="p-3 mb-6 rounded-xl bg-gray-50">
                            {routeSteps.map((step, index) => (
                              <Pressable
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
                                  setMapFocus(
                                    focusMapOnCourseStep(
                                      step,
                                      course.id,
                                      index,
                                      routeSteps.length,
                                    ),
                                  );
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
                                        backgroundColor:
                                          "rgba(59,130,246,0.08)",
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
                                  <Text className="mt-0.5 text-xs text-gray-500">
                                    평균 머문 시간 약 {step.stayMinutes}분
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                          </View>

                          {/* 이용자 후기 */}
                          <Text className="mb-2 text-sm font-semibold text-gray-900">
                            이용자 후기
                          </Text>
                          {(course.reviews ?? []).length === 0 ? (
                            <View className="p-3 mb-2 rounded-xl bg-gray-50">
                              <Text className="text-xs text-gray-500">
                                아직 등록된 후기가 없습니다. 코스를 다녀온 후 첫
                                후기를 남겨 보세요.
                              </Text>
                            </View>
                          ) : (
                            <View className="p-3 mb-2 rounded-xl bg-gray-50">
                              {(course.reviews ?? []).map((review) => (
                                <View
                                  key={review.id}
                                  className="mb-3 last:mb-0"
                                >
                                  <View className="flex-row items-center justify-between">
                                    <Text className="text-sm font-semibold text-gray-900">
                                      {review.userName}
                                    </Text>
                                    <Text className="text-xs text-yellow-600">
                                      ★ {review.rating.toFixed(1)}
                                    </Text>
                                  </View>
                                  <Text className="mt-1 text-xs text-gray-700">
                                    {review.text}
                                  </Text>
                                  <Text className="mt-0.5 text-[11px] text-gray-400">
                                    {review.date}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <Pressable
                            onPress={() => {
                              setReviewCourseId(course.id);
                              setReviewUserName(
                                String(authUser?.nickname ?? "").trim() || "나",
                              );
                              setReviewAnonymous(false);
                              setReviewRating(5);
                              setReviewBody("");
                              setReviewComposerOpen(true);
                            }}
                            className="mb-2 mt-2 flex-row items-center justify-center rounded-xl bg-amber-500 py-3.5 active:opacity-90"
                          >
                            <Ionicons
                              name="create-outline"
                              size={20}
                              color="#fff"
                            />
                            <Text className="ml-2 text-sm font-bold text-white">
                              리뷰 남기기
                            </Text>
                          </Pressable>

                        </ScrollView>
                      </>
                    );
                  })()}
              </View>
            </Animated.View>
          </View>

          {reviewComposerOpen && reviewCourseId ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                zIndex: 200,
              }}
              pointerEvents="box-none"
            >
              <Pressable
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "rgba(0,0,0,0.55)" },
                ]}
                onPress={() => setReviewComposerOpen(false)}
              />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 24,
                }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, width: "100%" }}
              >
                <View className="w-full max-w-md p-5 bg-white shadow-xl rounded-2xl">
                  <Text className="text-lg font-bold text-gray-900">
                    리뷰 작성
                  </Text>
                  <Text
                    className="mt-1 text-xs text-gray-500"
                    numberOfLines={2}
                  >
                    {coursesData.find((c) => c.id === reviewCourseId)?.title ?? ""}
                  </Text>

                  <Text className="mt-4 text-xs font-semibold text-gray-600">
                    작성자 공개
                  </Text>
                  <View className="flex-row gap-2 mt-2">
                    <Pressable
                      onPress={() => setReviewAnonymous(false)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 ${
                        !reviewAnonymous
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <Text
                        className={`text-center text-sm font-semibold ${
                          !reviewAnonymous ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        닉네임 공개
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setReviewAnonymous(true)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 ${
                        reviewAnonymous
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <Text
                        className={`text-center text-sm font-semibold ${
                          reviewAnonymous ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        익명
                      </Text>
                    </Pressable>
                  </View>

                  <Text className="mt-3 text-xs font-semibold text-gray-600">
                    별점
                  </Text>
                  <View className="flex-row gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setReviewRating(n)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={n <= reviewRating ? "star" : "star-outline"}
                          size={28}
                          color={n <= reviewRating ? "#f59e0b" : "#d1d5db"}
                        />
                      </Pressable>
                    ))}
                  </View>

                  <Text className="mt-4 text-xs font-semibold text-gray-600">
                    후기 작성
                  </Text>
                  <TextInput
                    value={reviewBody}
                    onChangeText={setReviewBody}
                    placeholder="코스 경험을 짧게 남겨 주세요"
                    placeholderTextColor="#9ca3af"
                    multiline
                    className="mt-1 min-h-[100px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900"
                    textAlignVertical="top"
                    maxLength={500}
                  />

                  <View className="flex-row gap-2 mt-5">
                    <Pressable
                      onPress={() => setReviewComposerOpen(false)}
                      className="items-center flex-1 py-3 border border-gray-200 rounded-xl active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-gray-600">
                        취소
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (!reviewCourseId) return;
                        const t = reviewBody.trim();
                        const displayName = reviewAnonymous
                          ? "익명"
                          : String(reviewUserName ?? "").trim() || "나";
                        if (!t) {
                          showToast('후기 내용을 입력해 주세요');
                          return;
                        }
                        const ok = await submitSharedCourseReview(reviewCourseId, {
                          userName: displayName,
                          rating: reviewRating,
                          text: t,
                        });
                        addSharedCourseReview(reviewCourseId, {
                          userName: displayName,
                          rating: reviewRating,
                          text: t,
                        });
                        setReviewComposerOpen(false);
                        showToast(ok ? '후기가 등록됐어요' : '후기를 등록하지 못했어요');
                      }}
                      className="items-center flex-1 py-3 rounded-xl bg-amber-500 active:opacity-90"
                    >
                      <Text className="text-sm font-bold text-white">등록</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : null}
        </View>
      </Modal>
    </ScreenRoot>
  );
}
