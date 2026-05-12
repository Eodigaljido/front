// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { fetchFollowingNews, fetchHomeCourses } from "../api/courses";
import { useAuthStore } from "../store/authStore";
import {
  fetchIntegratedWeather,
  type IntegratedWeatherResponse,
} from "../data/integratedWeatherApi";

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_MARGIN = 16;
const RECENT_CARD_WIDTH = SCREEN_WIDTH * 0.78;
const HEADER_HEIGHT = 50;

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
const REFRESH_SPINNER_MAX_MS = 3_000;
const PULL_INDICATOR_HIDDEN_Y = -84;
const PULL_INDICATOR_MAX_DRAG = 76;
const PULL_TRIGGER_DISTANCE = 44;
// 새로고침 제스처는 날씨 파트(상단 영역)에서 시작한 경우에만 허용
const PULL_CAPTURE_TOP_LIMIT = 260;
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
  const [popularCourses, setPopularCourses] = useState<any[]>([]);
  const [followingNewsApi, setFollowingNewsApi] = useState<any[]>([]);

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedWeatherResponse | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [showPullIndicator, setShowPullIndicator] = useState(false);
  const [heroLocationLabel, setHeroLocationLabel] = useState("위치 확인 중...");
  const weatherLocationRef = useRef("");
  const pullDownY = useRef(new Animated.Value(PULL_INDICATOR_HIDDEN_Y)).current;
  const pullProgress = useRef(new Animated.Value(0)).current;
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    fetchHomeCourses(6)
      .then((courses) => {
        if (mounted) setPopularCourses(courses);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchFollowingNews(3)
      .then((items) => {
        if (mounted && items.length > 0) setFollowingNewsApi(items);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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
      popularCourses.slice(0, 3).map((course, idx) => ({
        id: `recent-${course.id}`,
        title: course.title,
        waypoints: course.routeSteps.slice(0, 3).map((step) => step.name),
        pinCount: course.routeSteps.length,
        distanceKm: Number((course.overallDurationMinutes / 55).toFixed(1)),
        tags: idx % 2 === 0 ? ["카페", "골목"] : ["맛집", "산책"],
      })),
    [popularCourses],
  );
  const trendingCourses = useMemo(
    () =>
      popularCourses.slice(0, 3).map((course, idx) => ({
        id: `trend-${course.id}`,
        title: course.title,
        author: `${course.region}러 ${idx + 1}`,
        likes: Math.max(12, Math.round(course.views / 8)),
        pinCount: course.routeSteps.length,
        distanceKm: Number((course.overallDurationMinutes / 55).toFixed(1)),
        category: course.category,
      })),
    [popularCourses],
  );
  const followingNewsFallback = useMemo(
    () =>
      trendingCourses.slice(0, 3).map((item, idx) => ({
        id: `feed-${item.id}`,
        user: item.author,
        action: idx % 2 === 0 ? "새 코스를 공개했어요" : "코스를 완주했어요",
        courseName: item.title,
        ago: idx === 0 ? "9분 전" : idx === 1 ? "1시간 전" : "3시간 전",
      })),
    [trendingCourses],
  );
  const followingNews = followingNewsApi.length > 0 ? followingNewsApi : followingNewsFallback;

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

  const handlePullToRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const spinnerTimer = setTimeout(() => {
      // 3초 이상 걸리면 로딩 UI는 숨김(작업은 계속 진행)
      setRefreshing(false);
    }, REFRESH_SPINNER_MAX_MS);
    try {
      await Promise.race([
        (async () => {
          await resolveCurrentLocation();
          await fetchWeather(undefined, undefined, { silent: true });
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("새로고침 시간 초과")), REFRESH_GUARD_TIMEOUT_MS),
        ),
      ]);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch {
      // 시간 초과 또는 위치/네트워크 지연 시에도 로더가 고정되지 않도록 무조건 종료한다.
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    } finally {
      clearTimeout(spinnerTimer);
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [resolveCurrentLocation, fetchWeather]);

  const displayLocation =
    integrated?.location?.trim() || heroLocationLabel || "위치 확인 중...";
  const contentTopPadding = insets.top + HEADER_HEIGHT;
  const contentBottomPadding = insets.bottom + 120;
  const openRouteCreate = useCallback(() => {
    (navigation.getParent() as any)?.navigate("RouteCreate");
  }, [navigation]);
  const moveTab = useCallback(
    (tab: keyof RootTabParamList) => {
      navigation.navigate(tab);
    },
    [navigation],
  );

  const pullPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !refreshing &&
          gestureState.y0 <= insets.top + PULL_CAPTURE_TOP_LIMIT &&
          gestureState.dy > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1,
        onPanResponderMove: (_, gestureState) => {
          const d = Math.max(0, Math.min(PULL_INDICATOR_MAX_DRAG, gestureState.dy * 0.55));
          pullDistanceRef.current = d;
          setShowPullIndicator(d > 0);
          pullDownY.setValue(PULL_INDICATOR_HIDDEN_Y + d);
          pullProgress.setValue(d / PULL_INDICATOR_MAX_DRAG);
        },
        onPanResponderRelease: () => {
          const shouldRefresh = pullDistanceRef.current >= PULL_TRIGGER_DISTANCE;
          pullDistanceRef.current = 0;
          Animated.spring(pullDownY, {
            toValue: PULL_INDICATOR_HIDDEN_Y,
            useNativeDriver: true,
            tension: 70,
            friction: 9,
          }).start();
          Animated.timing(pullProgress, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
          if (!shouldRefresh) setShowPullIndicator(false);
          if (shouldRefresh) handlePullToRefresh();
        },
        onPanResponderTerminate: () => {
          pullDistanceRef.current = 0;
          Animated.spring(pullDownY, {
            toValue: PULL_INDICATOR_HIDDEN_Y,
            useNativeDriver: true,
            tension: 70,
            friction: 9,
          }).start();
          Animated.timing(pullProgress, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
          setShowPullIndicator(false);
        },
      }),
    [handlePullToRefresh, insets.top, pullDownY, pullProgress, refreshing],
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: PAGE_BG }} edges={["top"]}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          height: insets.top + HEADER_HEIGHT,
          paddingTop: insets.top + 2,
          paddingHorizontal: HORIZONTAL_MARGIN,
          backgroundColor: "rgba(240,245,255,0.96)",
          borderBottomWidth: 0.5,
          borderBottomColor: "rgba(37,99,235,0.08)",
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            className="flex-row items-center rounded-full px-3 py-2"
            style={{ backgroundColor: "#dbeafe" }}
          >
            <Ionicons name="location" size={14} color="#1d4ed8" />
            <Text className="mx-1.5 text-xs font-semibold text-blue-800">{displayLocation}</Text>
            <Ionicons name="chevron-down" size={13} color="#1d4ed8" />
          </Pressable>
          <View className="flex-row items-center">
            <Pressable
              className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-white"
              onPress={() => navigation.navigate("SharedRoute", { openFilter: true })}
            >
              <Ionicons name="search-outline" size={20} color="#1a1a2e" />
            </Pressable>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-white"
              onPress={() => navigation.navigate("Chat")}
            >
              <Ionicons name="notifications-outline" size={20} color="#1a1a2e" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
            size="large"
            progressBackgroundColor="#ffffff"
            progressViewOffset={insets.top + HEADER_HEIGHT + 22}
            title="새로고침 중..."
            titleColor="#2563EB"
          />
        }
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: contentBottomPadding,
          paddingHorizontal: HORIZONTAL_MARGIN,
        }}
      >
        <LinearGradient
          colors={["#2563EB", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className=""
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
                    className="mr-2"
                    style={{
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 18,
                    }}
                  >
                    <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "400" }}>공유</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      backgroundColor: "#2563EB",
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 18,
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
            <SectionHeader title="지금 인기 코스" actionLabel="더 보기" onPressAction={() => navigation.navigate("SharedRoute")} />
          </View>
          <View className="mt-3">
            {trendingCourses.map((course) => (
              <Pressable
                key={course.id}
                onPress={() => navigation.navigate("SharedRoute")}
                className="mb-3 flex-row items-center rounded-[16px] p-3 active:opacity-95"
                style={CARD_STYLE}
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
                  <Text style={{ marginTop: 2, fontSize: 13, fontWeight: "400", color: "#6B7280" }}>🙂 {course.author}</Text>
                  <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>
                    핀 {course.pinCount}개 · {course.distanceKm}km · {course.category}
                  </Text>
                </View>
                <View className="items-end">
                  <Pressable className="rounded-full p-1.5">
                    <Ionicons name="bookmark-outline" size={18} color="#6B7280" />
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
                  <Text style={{ marginTop: 4, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>❤ {course.likes}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-2">
          <SectionHeader title="팔로잉 소식" actionLabel="전체" onPressAction={() => moveTab("Chat")} />
          <View className="mt-3">
            {followingNews.map((news) => (
              <Pressable
                key={news.id}
                onPress={() => moveTab("Chat")}
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
      </ScrollView>

    </SafeAreaView>
  );
}
