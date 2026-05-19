// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Dimensions,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  PanResponder,
  Keyboard,
  Platform,
} from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import {
  fetchFollowingNews,
  fetchHomeCourses,
  fetchPopularCoursesBySaves,
  normalizeCourseList,
  pickCourseSaveCount,
  saveSharedCourse,
} from "../api/courses";
import { useMockData } from "../context/MockDataContext";
import { useAuthStore } from "../store/authStore";
import {
  fetchIntegratedWeather,
  type IntegratedWeatherResponse,
} from "../data/integratedWeatherApi";
import { sharePublicCourse } from "../utils/shareCourse";

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_MARGIN = 16;
const RECENT_CARD_WIDTH = SCREEN_WIDTH * 0.78;
/** 고정 헤더 바 높이(SafeArea top은 SafeAreaView가 처리) */
const HEADER_HEIGHT = 48;

const PAGE_BG = "#F0F5FF";

const CARD_STYLE = {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  borderWidth: 0.5,
  borderColor: "rgba(37,99,235,0.1)",
};

const WEATHER_AUTO_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_FETCH_TIMEOUT_MS = 12_000;
const LOCATION_TIMEOUT_MS = 7000;
const REFRESH_GUARD_TIMEOUT_MS = 15_000;
const REFRESH_INDICATOR_COLOR = "#1d4ed8";
/** 새로고침 중 콘텐츠가 내려가 유지되는 거리 */
const REFRESH_HOLD_OFFSET = 58;
const REFRESH_MIN_HOLD_MS = 420;
const PULL_MAX = 100;
const PULL_TRIGGER_DISTANCE = 50;
const DEFAULT_WEATHER_LOCATION = "서울 강남구";
const WEATHER_ICON_IMAGES = {
  sunny: require("../assets/Weather/Sunny.png"),
  partly_cloudy: require("../assets/Weather/PartlyCloudy.png"),
  cloudy: require("../assets/Weather/PartlyCloudy.png"),
  rainy: require("../assets/Weather/Rainy.png"),
  shower: require("../assets/Weather/RainThunder.png"),
  sleet: require("../assets/Weather/Snowy.png"),
  snowy: require("../assets/Weather/Snowy.png"),
} as const;

function getWeatherIconSource(iconKey?: string) {
  const key = String(iconKey ?? "").toLowerCase() as keyof typeof WEATHER_ICON_IMAGES;
  return WEATHER_ICON_IMAGES[key] ?? WEATHER_ICON_IMAGES.partly_cloudy;
}

function formatFetchedAt(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `조회 ${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function buildWeatherLocationQuery(
  addr?: Location.LocationGeocodedAddress | null,
): string {
  if (!addr) return DEFAULT_WEATHER_LOCATION;
  const parts = [
    addr.region,
    addr.city,
    addr.district,
    addr.subregion,
    addr.name,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      ordered.push(p);
    }
  }
  const joined = ordered.join(" ").replace(/\s+/g, " ").trim();
  return joined || DEFAULT_WEATHER_LOCATION;
}

function getWeatherMoodMessage(weather?: IntegratedWeatherResponse["current"]): string {
  if (!weather) return "오늘 코스를 천천히 고르기 좋은 날씨네요!";
  const temp = Number.isFinite(weather.temperature) ? weather.temperature : 18;
  const rain = Number.isFinite(weather.precipitation1h) ? weather.precipitation1h : 0;
  const desc = String(weather.weatherDesc ?? "").toLowerCase();

  if (rain >= 1 || desc.includes("비")) {
    return "오늘은 실내 코스로 여유롭게 즐기기 좋은 날씨네요!";
  }
  if (temp >= 28) {
    return "오늘은 그늘 많은 짧은 산책 코스가 딱 좋은 날씨네요!";
  }
  if (temp <= 5) {
    return "오늘은 따뜻하게 입고 가까운 코스를 즐기기 좋은 날씨네요!";
  }
  if (desc.includes("맑") || desc.includes("sun")) {
    return "오늘은 야외 산책 코스를 즐기기 좋은 날씨네요!";
  }
  return "오늘은 가볍게 이동하며 코스를 둘러보기 좋은 날씨네요!";
}

function SectionHeader({
  title,
  actionLabel,
  onPressAction,
}: {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#1A1A2E" }}>{title}</Text>
      {actionLabel ? (
        <Pressable hitSlop={12} onPress={onPressAction}>
          <View className="flex-row items-center">
            <Text style={{ fontSize: 13, fontWeight: "400", color: "#6B7280" }}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#2563eb" />
          </View>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

function getTagStyle(tag: string) {
  if (tag === "카페") return { bg: "#FEF3C7", color: "#92400E" };
  if (tag === "골목") return { bg: "#EDE9FE", color: "#4338CA" };
  if (tag === "산책") return { bg: "#D1FAE5", color: "#065F46" };
  if (tag === "맛집") return { bg: "#FEE2E2", color: "#991B1B" };
  return { bg: "#DBEAFE", color: "#1D4ED8" };
}

function getCategoryTint(category: string) {
  return "#DBEAFE";
}

export default function HomeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();
  const authUser = useAuthStore((s: any) => s.user);
  const { savedCourseIds, togglePopularFavorite } = useMockData();
  const [homeCourses, setHomeCourses] = useState<any[]>([]);
  const [popularCourses, setPopularCourses] = useState<any[]>([]);
  const [followingNewsApi, setFollowingNewsApi] = useState<any[]>([]);

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedWeatherResponse | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [heroLocationLabel, setHeroLocationLabel] = useState("위치 확인 중...");
  const weatherLocationRef = useRef("");
  const pullOffset = useRef(new Animated.Value(0)).current;
  const pullDistanceRef = useRef(0);
  const scrollAtTopRef = useRef(true);
  const refreshingRef = useRef(false);
  const pullSettlingRef = useRef(false);
  const scrollRef = useRef(null);
  /** 당김 1회당 임계 도달 햅틱 1번만 */
  const pullThresholdHapticFiredRef = useRef(false);

  const fetchHomeFeedData = useCallback(async () => {
    const [recent, popular, news] = await Promise.all([
      fetchHomeCourses(6).catch(() => [] as Awaited<ReturnType<typeof fetchHomeCourses>>),
      fetchPopularCoursesBySaves(6).catch(
        () => [] as Awaited<ReturnType<typeof fetchPopularCoursesBySaves>>,
      ),
      fetchFollowingNews(3).catch(() => [] as Awaited<ReturnType<typeof fetchFollowingNews>>),
    ]);
    const recentNorm = normalizeCourseList(recent);
    const popularNorm = normalizeCourseList(popular);
    return {
      recent: recentNorm,
      popular: popularNorm.length > 0 ? popularNorm : recentNorm,
      news: Array.isArray(news) ? news : [],
    };
  }, []);

  const applyHomeFeed = useCallback(
    (payload: Awaited<ReturnType<typeof fetchHomeFeedData>>) => {
      setHomeCourses(payload.recent);
      setPopularCourses(payload.popular);
      setFollowingNewsApi(payload.news);
    },
    [],
  );

  const loadHomeFeed = useCallback(async () => {
    const payload = await fetchHomeFeedData();
    applyHomeFeed(payload);
  }, [applyHomeFeed, fetchHomeFeedData]);

  useEffect(() => {
    let mounted = true;
    fetchHomeFeedData()
      .then((payload) => {
        if (mounted) applyHomeFeed(payload);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [applyHomeFeed, fetchHomeFeedData]);

  const weatherSubtitle = useMemo(
    () => formatFetchedAt(integrated?.fetchedAt),
    [integrated?.fetchedAt],
  );
  const weatherMoodMessage = useMemo(
    () => getWeatherMoodMessage(integrated?.current),
    [integrated?.current],
  );
  const weatherHighlights = useMemo(() => {
    const c = integrated?.current;
    if (!c) return ["체감 --°", "습도 --%", "미세 --"];
    return [
      `체감 ${Math.round(c.feelsLike)}°`,
      `습도 ${Math.round(c.humidity)}%`,
      `미세 ${integrated?.air?.pm10Grade ?? "--"}`,
    ];
  }, [integrated?.air?.pm10Grade, integrated?.current]);
  const recentCourses = useMemo(
    () =>
      homeCourses.slice(0, 3).map((course, idx) => {
        const steps = Array.isArray(course.routeSteps) ? course.routeSteps : [];
        return {
        id: `recent-${course.id}`,
        courseId: String(course.id),
        title: course.title,
        waypoints: steps.slice(0, 3).map((step) => step?.name ?? ""),
        pinCount: steps.length,
        distanceKm: Number((course.overallDurationMinutes / 55).toFixed(1)),
        tags: idx % 2 === 0 ? ["카페", "골목"] : ["맛집", "산책"],
      };
      }),
    [homeCourses],
  );
  const trendingCourses = useMemo(
    () =>
      popularCourses.slice(0, 3).map((course, idx) => {
        const steps = Array.isArray(course.routeSteps) ? course.routeSteps : [];
        const saveCount = pickCourseSaveCount(course);
        return {
        id: `trend-${course.id}`,
        courseId: course.id,
        title: course.title,
        author: course.authorUserId
          ? `@${course.authorUserId}`
          : `${course.region ?? "지역"} 코스`,
        saveCount,
        pinCount: steps.length,
        distanceKm: Number((course.overallDurationMinutes / 55).toFixed(1)),
        category: course.category ?? "기타",
      };
      }),
    [popularCourses],
  );
  const followingNews = Array.isArray(followingNewsApi) ? followingNewsApi : [];

  const precipHumidityChip = useMemo(() => {
    const c = integrated?.current;
    if (!c) return "강수 · 습도";
    const p = Number.isFinite(c.precipitation1h)
      ? `${c.precipitation1h}mm`
      : "--";
    const h = Number.isFinite(c.humidity) ? `${Math.round(c.humidity)}%` : "--";
    return `1시간 강수 ${p} · 습도 ${h}`;
  }, [integrated?.current]);

  const fetchWeather = useCallback(
    async (
      cancelledRef?: { value: boolean },
      locationOverride?: string,
      options?: { silent?: boolean },
    ) => {
      const raw = (locationOverride ?? weatherLocationRef.current).trim();
      const target = raw || DEFAULT_WEATHER_LOCATION;
      weatherLocationRef.current = target;

      try {
        if (!options?.silent) setWeatherLoading(true);
        setWeatherError(null);

        const controller = new AbortController();
        const timerId = setTimeout(
          () => controller.abort(),
          WEATHER_FETCH_TIMEOUT_MS,
        );
        let data: IntegratedWeatherResponse;
        try {
          data = await fetchIntegratedWeather(target, controller.signal);
        } finally {
          clearTimeout(timerId);
        }

        if (cancelledRef?.value) return;
        setIntegrated(data);
        setHeroLocationLabel(data.location);
      } catch (e: any) {
        if (cancelledRef?.value) return;
        const msg =
          e?.name === "AbortError"
            ? "날씨 요청 시간이 초과되었습니다."
            : (e?.message ?? "날씨 정보를 불러오지 못했습니다.");
        setWeatherError(msg);
      } finally {
        if (!cancelledRef?.value && !options?.silent) setWeatherLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (!weatherLocationRef.current.trim()) return;
      fetchWeather(undefined, undefined, { silent: true });
    }, WEATHER_AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchWeather]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && weatherLocationRef.current.trim()) {
        fetchWeather(undefined, undefined, { silent: true });
      }
    });
    return () => sub.remove();
  }, [fetchWeather]);

  const resolveCurrentLocation = useCallback(
    async (cancelledRef?: { value: boolean }) => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          if (!cancelledRef?.value) {
            setHeroLocationLabel("위치 권한 미허용");
            await fetchWeather(cancelledRef, DEFAULT_WEATHER_LOCATION);
          }
          return;
        }

        const pos = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("위치 시간 초과")),
              LOCATION_TIMEOUT_MS,
            ),
          ),
        ]);

        if (cancelledRef?.value) return;

        const addr = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });

        if (cancelledRef?.value) return;

        const q = buildWeatherLocationQuery(addr?.[0]);
        await fetchWeather(cancelledRef, q);
      } catch {
        if (!cancelledRef?.value) {
          setHeroLocationLabel("위치 확인 실패");
          await fetchWeather(cancelledRef, DEFAULT_WEATHER_LOCATION);
        }
      }
    },
    [fetchWeather],
  );

  useEffect(() => {
    const cancelledRef = { value: false };
    resolveCurrentLocation(cancelledRef);
    return () => {
      cancelledRef.value = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
        setSearchExpanded(false);
      };
    }, []),
  );

  const resetPullGesture = useCallback(() => {
    pullDistanceRef.current = 0;
    pullThresholdHapticFiredRef.current = false;
  }, []);

  const applyPullDistance = useCallback(
    (distance: number) => {
      const d = Math.max(0, Math.min(PULL_MAX, distance));
      pullDistanceRef.current = d;
      pullOffset.setValue(d);
      if (refreshingRef.current) return;
      if (
        d >= PULL_TRIGGER_DISTANCE &&
        !pullThresholdHapticFiredRef.current
      ) {
        pullThresholdHapticFiredRef.current = true;
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
    },
    [pullOffset],
  );

  const scrollPullToTop = useCallback(() => {
    try {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch {}
  }, []);

  const animatePullTo = useCallback(
    (to: number, opts?: { onDone?: () => void; collapse?: boolean }) => {
      pullOffset.stopAnimation();
      if (opts?.collapse) {
        pullSettlingRef.current = true;
        scrollPullToTop();
      }
      Animated.timing(pullOffset, {
        toValue: to,
        duration: opts?.collapse ? 280 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (opts?.collapse) {
          pullDistanceRef.current = 0;
          pullSettlingRef.current = false;
        }
        if (finished && opts?.onDone) opts.onDone();
      });
    },
    [pullOffset, scrollPullToTop],
  );

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    scrollPullToTop();
    animatePullTo(REFRESH_HOLD_OFFSET);
    const refreshStartedAt = Date.now();
    try {
      await Promise.race([
        (async () => {
          await resolveCurrentLocation();
          await Promise.all([
            fetchWeather(undefined, undefined, { silent: true }),
            loadHomeFeed(),
          ]);
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("새로고침 시간 초과")), REFRESH_GUARD_TIMEOUT_MS),
        ),
      ]);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    } finally {
      const remain = Math.max(0, REFRESH_MIN_HOLD_MS - (Date.now() - refreshStartedAt));
      setTimeout(() => {
        animatePullTo(0, {
          collapse: true,
          onDone: () => {
            refreshingRef.current = false;
            setRefreshing(false);
            pullOffset.setValue(0);
          },
        });
      }, remain);
    }
  }, [animatePullTo, fetchWeather, loadHomeFeed, resolveCurrentLocation]);

  const displayLocation =
    integrated?.location?.trim() || heroLocationLabel || "위치 확인 중...";
  const contentTopPadding = 0;
  const contentBottomPadding = insets.bottom + 120;

  /** 슬롯 높이와 함께 휠도 나타나고 사라짐 (접힐 때 UI와 동시에 fade out) */
  const slotIndicatorOpacity = pullOffset.interpolate({
    inputRange: [0, 10, REFRESH_HOLD_OFFSET],
    outputRange: [0, 0.55, 1],
    extrapolate: "clamp",
  });
  const indicatorRotate = pullOffset.interpolate({
    inputRange: [0, PULL_MAX],
    outputRange: ["0deg", "240deg"],
  });

  const onPullScroll = useCallback(
    (e) => {
      if (refreshingRef.current || pullSettlingRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      scrollAtTopRef.current = y <= 6;
      if (y < 0) {
        applyPullDistance(Math.min(-y, PULL_MAX));
      }
    },
    [applyPullDistance],
  );

  const onPullScrollEndDrag = useCallback(
    (e) => {
      if (refreshingRef.current || pullSettlingRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      if (y >= 0) return;
      const pull = Math.min(-y, PULL_MAX);
      const shouldRefresh = pull >= PULL_TRIGGER_DISTANCE;
      resetPullGesture();
      scrollPullToTop();
      if (shouldRefresh) {
        void runRefresh();
      } else {
        animatePullTo(0, { collapse: true });
      }
    },
    [animatePullTo, resetPullGesture, runRefresh, scrollPullToTop],
  );

  const onPullMomentumScrollEnd = useCallback(
    (e) => {
      if (refreshingRef.current || pullSettlingRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      if (y < 0) scrollPullToTop();
    },
    [scrollPullToTop],
  );
  const openRouteCreate = useCallback(() => {
    (navigation.getParent() as any)?.navigate("RouteCreate");
  }, [navigation]);
  const moveTab = useCallback(
    (tab: keyof RootTabParamList) => {
      navigation.navigate(tab);
    },
    [navigation],
  );

  const handlePopularBookmark = useCallback(
    (courseId: string) => {
      const wasSaved = savedCourseIds.includes(courseId);
      togglePopularFavorite(courseId);
      if (!wasSaved) void saveSharedCourse(courseId);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    },
    [savedCourseIds, togglePopularFavorite],
  );

  const openSharedCourseDetail = useCallback(
    (courseId: string) => {
      const id = String(courseId ?? "").trim();
      if (!id) return;
      navigation.navigate("SharedRoute", { viewCourseId: id });
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    },
    [navigation],
  );

  const handleShareCourse = useCallback((courseId: string, title: string) => {
    void sharePublicCourse({ courseId, title });
  }, []);
  const executeRouteSearch = useCallback(() => {
    const q = homeSearchQuery.trim();
    navigation.navigate("SharedRoute", q ? { initialQuery: q } : undefined);
    setSearchExpanded(false);
    setHomeSearchQuery("");
  }, [homeSearchQuery, navigation]);

  const HEADER_ICON_BTN = 36;
  const HEADER_ICON_GAP = 8;
  const LOCATION_COLLAPSED_W = 36;
  const reservedRightCollapsed = HEADER_ICON_BTN * 2 + HEADER_ICON_GAP;

  /** 지역 칩이 오른쪽 아이콘을 밀지 않도록 상한(화면의 ~46% 또는 168px) */
  const LOCATION_MAX_W = useMemo(() => {
    const maxStretch =
      SCREEN_WIDTH - HORIZONTAL_MARGIN * 2 - reservedRightCollapsed;
    const preferredCap = Math.min(168, Math.floor(SCREEN_WIDTH * 0.46));
    return Math.max(100, Math.min(preferredCap, maxStretch));
  }, []);

  const locationSlotWidth = useRef(new Animated.Value(LOCATION_MAX_W)).current;

  useEffect(() => {
    locationSlotWidth.setValue(LOCATION_MAX_W);
  }, [LOCATION_MAX_W, locationSlotWidth]);

  useEffect(() => {
    const to = searchExpanded ? LOCATION_COLLAPSED_W : LOCATION_MAX_W;
    Animated.timing(locationSlotWidth, {
      toValue: to,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [searchExpanded, LOCATION_MAX_W, locationSlotWidth]);

  const toggleSearchExpand = useCallback(() => {
    setSearchExpanded((prev) => {
      const next = !prev;
      if (!next) Keyboard.dismiss();
      return next;
    });
    try {
      void Haptics.selectionAsync();
    } catch {}
  }, []);

  const collapseSearchOnly = useCallback(() => {
    Keyboard.dismiss();
    setSearchExpanded(false);
    try {
      void Haptics.selectionAsync();
    } catch {}
  }, []);

  const pullPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !refreshingRef.current &&
          !pullSettlingRef.current &&
          scrollAtTopRef.current &&
          gestureState.dy > 5 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.05,
        onPanResponderMove: (_, gestureState) => {
          if (refreshingRef.current || pullSettlingRef.current) return;
          applyPullDistance(gestureState.dy * 0.72);
        },
        onPanResponderRelease: () => {
          if (refreshingRef.current || pullSettlingRef.current) return;
          const shouldRefresh =
            pullDistanceRef.current >= PULL_TRIGGER_DISTANCE;
          resetPullGesture();
          scrollPullToTop();
          if (shouldRefresh) {
            void runRefresh();
          } else {
            animatePullTo(0, { collapse: true });
          }
        },
        onPanResponderTerminate: () => {
          if (refreshingRef.current || pullSettlingRef.current) return;
          resetPullGesture();
          animatePullTo(0, { collapse: true });
        },
      }),
    [animatePullTo, applyPullDistance, resetPullGesture, runRefresh, scrollPullToTop],
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: PAGE_BG }} edges={["top"]}>
      {/* 상단 바: 스크롤·당김과 분리 — 위치 고정 */}
      <View
        style={{
          height: HEADER_HEIGHT,
          paddingTop: 2,
          paddingBottom: 0,
          paddingHorizontal: HORIZONTAL_MARGIN,
          backgroundColor: PAGE_BG,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "rgba(37,99,235,0.1)",
          zIndex: 100,
          elevation: Platform.OS === "android" ? 4 : 0,
        }}
      >
        <View className="flex-row items-center" style={{ width: "100%" }}>
          <Animated.View style={{ width: locationSlotWidth, overflow: "hidden" }}>
            {!searchExpanded ? (
              <Pressable
                className="flex-row items-center rounded-full px-3 py-2"
                style={{ backgroundColor: "#dbeafe", maxWidth: LOCATION_MAX_W }}
              >
                <Ionicons name="location" size={14} color="#1d4ed8" />
                <Text
                  className="mx-1.5 text-xs font-semibold text-blue-800"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {displayLocation}
                </Text>
                <Ionicons name="chevron-down" size={13} color="#1d4ed8" />
              </Pressable>
            ) : (
              <Pressable
                onPress={collapseSearchOnly}
                hitSlop={10}
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: LOCATION_COLLAPSED_W,
                  height: HEADER_ICON_BTN,
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Ionicons name="location" size={18} color="#2563eb" />
              </Pressable>
            )}
          </Animated.View>

          {!searchExpanded ? (
            <>
              <View style={{ flex: 1 }} />
              <Pressable
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: HEADER_ICON_BTN,
                  height: HEADER_ICON_BTN,
                  marginRight: HEADER_ICON_GAP,
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
                onPress={toggleSearchExpand}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="검색 펼치기"
              >
                <Ionicons name="search-outline" size={20} color="#1a1a2e" />
              </Pressable>
              <Pressable
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: HEADER_ICON_BTN,
                  height: HEADER_ICON_BTN,
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
                onPress={() =>
                  (navigation.getParent() as any)?.navigate("NotificationCenter")
                }
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={20} color="#1a1a2e" />
              </Pressable>
            </>
          ) : (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                marginLeft: HEADER_ICON_GAP,
                minWidth: 0,
              }}
            >
              <View
                className="flex-1 flex-row items-center rounded-2xl bg-white px-3"
                style={{
                  minHeight: 46,
                  paddingVertical: 6,
                  marginRight: HEADER_ICON_GAP,
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.22)",
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Pressable
                  onPress={collapseSearchOnly}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="검색 접기"
                  className="mr-2 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
                >
                  <Ionicons name="chevron-back" size={22} color="#2563EB" />
                </Pressable>
                <TextInput
                  value={homeSearchQuery}
                  onChangeText={setHomeSearchQuery}
                  onSubmitEditing={executeRouteSearch}
                  returnKeyType="search"
                  placeholder="루트 이름·장소 검색"
                  placeholderTextColor="#64748b"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: "#0f172a",
                    fontSize: 15,
                    paddingVertical: Platform.OS === "ios" ? 8 : 4,
                  }}
                  clearButtonMode="while-editing"
                  autoFocus
                />
              </View>
              <Pressable
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: HEADER_ICON_BTN,
                  height: HEADER_ICON_BTN,
                  marginRight: HEADER_ICON_GAP,
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
                onPress={executeRouteSearch}
                hitSlop={8}
              >
                <Ionicons name="arrow-forward" size={20} color="#2563eb" />
              </Pressable>
              <Pressable
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: HEADER_ICON_BTN,
                  height: HEADER_ICON_BTN,
                  shadowColor: "#0f172a",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 2,
                }}
                onPress={() =>
                  (navigation.getParent() as any)?.navigate("NotificationCenter")
                }
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={20} color="#1a1a2e" />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <View className="flex-1" style={{ minHeight: 0 }} {...pullPanResponder.panHandlers}>
        <Animated.ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!refreshing}
          bounces
          overScrollMode="always"
          scrollEventThrottle={16}
          onScroll={onPullScroll}
          onScrollEndDrag={onPullScrollEndDrag}
          onMomentumScrollEnd={onPullMomentumScrollEnd}
          contentContainerStyle={{
            paddingTop: contentTopPadding,
            paddingBottom: contentBottomPadding,
            paddingHorizontal: HORIZONTAL_MARGIN,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              height: pullOffset,
              alignItems: "center",
              justifyContent: "flex-end",
              paddingBottom: 6,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                opacity: slotIndicatorOpacity,
                ...(refreshing
                  ? {}
                  : { transform: [{ rotate: indicatorRotate }] }),
              }}
            >
              {refreshing ? (
                <ActivityIndicator size="large" color={REFRESH_INDICATOR_COLOR} />
              ) : (
                <Ionicons name="refresh" size={26} color={REFRESH_INDICATOR_COLOR} />
              )}
            </Animated.View>
          </Animated.View>
        <LinearGradient
          colors={["#2563EB", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            marginHorizontal: 0,
            minHeight: 168,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <View className="flex-row justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-blue-100">
                {authUser?.nickname ? `${authUser.nickname}님, 반가워요` : "반가워요"}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 22, fontWeight: "600", lineHeight: 30, color: "#fff" }}>
                오늘은 어디를 걸어볼까요?
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "400", color: "#dbeafe" }}>{weatherMoodMessage}</Text>
              <Pressable
                onPress={openRouteCreate}
                className="mt-4 self-start active:opacity-90"
                style={{
                  backgroundColor: "#2563EB",
                  borderRadius: 10,
                  paddingVertical: 9,
                  paddingHorizontal: 18,
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>새 코스 만들기</Text>
              </Pressable>
            </View>
            <View className="items-end justify-end">
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* TODO: 캐릭터 이미지로 교체 예정 */}
                {(() => {
                  const source = require("../assets/ruty.png");
                  if (!source) return null;
                  return (
                    <Image
                      source={source}
                      resizeMode="contain"
                      style={{ width: 56, height: 56 }}
                    />
                  );
                })()}
              </View>
            </View>
          </View>
        </LinearGradient>

        <View className="mt-5 flex-row items-center justify-between px-4 py-3" style={CARD_STYLE}>
          <View className="min-w-0 flex-1 pr-2">
            <View className="flex-row items-center">
              <Image
                source={getWeatherIconSource(integrated?.current?.weatherIcon)}
                style={{ width: 24, height: 24 }}
              />
              <Text style={{ marginLeft: 8, color: "#1A1A2E", fontSize: 22, fontWeight: "600" }}>
                {integrated?.current ? `${Math.round(integrated.current.temperature)}°` : "--°"}
              </Text>
              <Text style={{ marginLeft: 8, color: "#6B7280", fontSize: 13, fontWeight: "400" }}>
                {integrated?.current?.weatherDesc ?? "날씨 확인 중"}
              </Text>
            </View>
            <Text style={{ marginTop: 4, color: "#6B7280", fontSize: 12, fontWeight: "400" }} numberOfLines={1}>
              {weatherHighlights.join(" · ")}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: "#EFF6FF",
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 20,
              maxWidth: 120,
              flexShrink: 0,
            }}
          >
            <Text style={{ color: "#2563EB", fontSize: 12, fontWeight: "500" }} numberOfLines={1}>
              코스 추천일 ☀️
            </Text>
          </View>
        </View>
        {weatherError ? <Text className="mt-1 text-xs text-rose-600">{weatherError}</Text> : null}

        <View style={{ marginTop: 20 }}>
          <View style={{ marginBottom: 12 }}>
            <SectionHeader title="내 최근 코스" actionLabel="전체 보기" onPressAction={() => navigation.navigate("MyRoute")} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={RECENT_CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingTop: 12, paddingRight: 8 }}
          >
            {recentCourses.map((course) => (
              <Pressable
                key={course.id}
                onPress={() => navigation.navigate("MyRoute")}
                className="mr-3 rounded-[16px] p-3 active:opacity-95"
                style={{ width: RECENT_CARD_WIDTH, ...CARD_STYLE }}
              >
                <View
                  style={{
                    height: 86,
                    borderRadius: 12,
                    backgroundColor: "#DBEAFE",
                    borderWidth: 0.5,
                    borderColor: "#c7d2fe",
                    overflow: "hidden",
                  }}
                >
                  <Svg width="100%" height="100%" viewBox="0 0 300 120">
                    <Polyline
                      points="60,88 150,34 240,56"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.35"
                    />
                    <Circle cx="60" cy="88" r="10" fill="#fff" stroke="#2563EB" strokeWidth="5" />
                    <Circle cx="150" cy="34" r="10" fill="#fff" stroke="#2563EB" strokeWidth="5" />
                    <Circle cx="240" cy="56" r="10" fill="#fff" stroke="#2563EB" strokeWidth="5" />
                  </Svg>

                  <View style={{ position: "absolute", left: 10, bottom: 8, flexDirection: "row" }}>
                    {course.tags.slice(0, 2).map((tag) => {
                      const tagStyle = getTagStyle(tag);
                      return (
                        <View
                          key={`${course.id}-${tag}`}
                          style={{
                            marginRight: 6,
                            backgroundColor: tagStyle.bg,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ color: tagStyle.color, fontSize: 11, fontWeight: "500" }}>{tag}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: "#1A1A2E" }} numberOfLines={1}>
                  {course.title}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "400", color: "#6B7280" }} numberOfLines={1}>
                  {course.waypoints.join(" · ")}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>
                  핀 {course.pinCount}개 · {course.distanceKm}km
                </Text>
                <View className="mt-3 flex-row">
                  <Pressable
                    className="mr-2 active:opacity-80"
                    style={{
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 18,
                    }}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      handleShareCourse(course.courseId, course.title);
                    }}
                  >
                    <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "400" }}>공유</Text>
                  </Pressable>
                  <Pressable
                    className="active:opacity-90"
                    style={{
                      backgroundColor: "#2563EB",
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 18,
                    }}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      openSharedCourseDetail(course.courseId);
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>보기</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={openRouteCreate}
              className="items-center justify-center rounded-[18px] p-3"
              style={{
                width: RECENT_CARD_WIDTH * 0.58,
                borderWidth: 1.5,
                borderColor: "#93c5fd",
                borderStyle: "dashed",
                backgroundColor: "#f8fbff",
              }}
            >
              <Ionicons name="add-circle-outline" size={28} color="#2563EB" />
              <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: "#2563EB" }}>새 코스 만들기</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={{ marginTop: 20 }}>
          <View style={{ marginBottom: 12 }}>
            <SectionHeader
              title="지금 인기 코스"
              actionLabel="더 보기"
              onPressAction={() =>
                navigation.navigate("SharedRoute", { openAsPopular: true })
              }
            />
          </View>
          <View className="mt-3">
            {trendingCourses.map((course) => {
              const fid = String(course.courseId);
              const bookmarked = savedCourseIds.includes(fid);
              return (
                <View
                  key={course.id}
                  className="mb-3 flex-row items-center rounded-[16px] p-3"
                  style={CARD_STYLE}
                >
                  <Pressable
                    className="min-w-0 flex-1 flex-row items-center active:opacity-95"
                    onPress={() =>
                      navigation.navigate("SharedRoute", {
                        viewCourseId: fid,
                      })
                    }
                  >
                    <View
                      className="mr-3 h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: getCategoryTint(course.category) }}
                    >
                      <Ionicons name="map-outline" size={22} color="#2563EB" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A1A2E" }} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 13, fontWeight: "400", color: "#6B7280" }}>
                        🙂 {course.author}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>
                        핀 {course.pinCount}개 · {course.distanceKm}km · {course.category}
                      </Text>
                    </View>
                  </Pressable>
                  <View className="items-end pl-1">
                    <Pressable
                      className="rounded-full p-1.5"
                      hitSlop={10}
                      onPress={() => handlePopularBookmark(fid)}
                      accessibilityRole="button"
                      accessibilityLabel={bookmarked ? "즐겨찾기 해제" : "즐겨찾기 · 내 루트에 저장"}
                    >
                      <Ionicons
                        name={bookmarked ? "bookmark" : "bookmark-outline"}
                        size={18}
                        color={bookmarked ? "#2563EB" : "#6B7280"}
                      />
                    </Pressable>
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: "#EFF6FF",
                        borderRadius: 6,
                        paddingVertical: 2,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text style={{ color: "#2563EB", fontSize: 11, fontWeight: "500" }}>인기</Text>
                    </View>
                    <View className="mt-1 flex-row items-center">
                      <Ionicons name="bookmark-outline" size={12} color="#6B7280" />
                      <Text style={{ marginLeft: 3, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>
                        저장 {course.saveCount}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-2">
          <SectionHeader
            title="팔로잉 소식"
            actionLabel="전체"
            onPressAction={() =>
              (navigation.getParent() as any)?.navigate("FollowingNews")
            }
          />
          <View className="mt-3">
            {followingNews.map((news) => (
              <Pressable
                key={news.id}
                onPress={() =>
                  (navigation.getParent() as any)?.navigate("FollowingNews")
                }
                className="mb-2.5 flex-row items-center rounded-[16px] p-3"
                style={CARD_STYLE}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563EB" }}>{news.user.slice(0, 1)}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text style={{ fontSize: 13, fontWeight: "400", color: "#1A1A2E" }} numberOfLines={1}>
                    <Text style={{ fontWeight: "600" }}>{news.user}</Text>이 {news.action}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "400", color: "#6B7280" }} numberOfLines={1}>
                    {news.courseName}
                  </Text>
                </View>
                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>{news.ago}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        </Animated.ScrollView>
      </View>

    </SafeAreaView>
  );
}
