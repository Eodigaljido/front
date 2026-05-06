// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Animated,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useMockData } from "../context/MockDataContext";
import { getPopularNearbyCourses } from "../data/mockData";
import {
  fetchIntegratedWeather,
  type IntegratedWeatherResponse,
} from "../data/integratedWeatherApi";
import AppMapView from "../components/AppMapView";

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_MARGIN = 16;
const FEATURE_CARD_WIDTH = SCREEN_WIDTH * 0.62;

const PAGE_BG = "#EAF3FF";

const CARD_STYLE = {
  backgroundColor: "#fff",
  borderRadius: 22,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.05)",
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
      <Text className="text-lg font-extrabold text-gray-900">{title}</Text>
      {actionLabel ? (
        <Pressable hitSlop={12} onPress={onPressAction}>
          <View className="flex-row items-center">
            <Text className="text-sm font-semibold text-blue-600">
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

export default function HomeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();
  const { savedCourseIds, publicCourseIds } = useMockData();
  const popularCourses = getPopularNearbyCourses(3);

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedWeatherResponse | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [showPullIndicator, setShowPullIndicator] = useState(false);
  const [heroLocationLabel, setHeroLocationLabel] = useState("위치 확인 중...");
  /** 지도 중심·마커 (GPS 또는 주소 지오코딩) */
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);

  const weatherLocationRef = useRef("");
  const pullDownY = useRef(new Animated.Value(PULL_INDICATOR_HIDDEN_Y)).current;
  const pullProgress = useRef(new Animated.Value(0)).current;
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  const applyGeocodedMapFallback = useCallback(async () => {
    try {
      const geo = await Location.geocodeAsync(DEFAULT_WEATHER_LOCATION);
      const g = geo?.[0];
      if (
        g &&
        typeof g.latitude === "number" &&
        typeof g.longitude === "number"
      ) {
        const next = { latitude: g.latitude, longitude: g.longitude };
        setMapCoords(next);
        setMapCenter(next);
      }
    } catch {
      const next = { latitude: 37.4979, longitude: 127.0276 };
      setMapCoords(next);
      setMapCenter(next);
    }
  }, []);

  const weatherSubtitle = useMemo(
    () => formatFetchedAt(integrated?.fetchedAt),
    [integrated?.fetchedAt],
  );

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
            await applyGeocodedMapFallback();
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

        setMapCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setMapCenter({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });

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
          await applyGeocodedMapFallback();
        }
      }
    },
    [applyGeocodedMapFallback, fetchWeather],
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
    refreshingRef.current = true;
    setRefreshing(true);
    setShowPullIndicator(true);
    const spinnerTimer = setTimeout(() => {
      // 3초 이상 걸리면 로딩 UI는 숨김(작업은 계속 진행)
      setRefreshing(false);
      setShowPullIndicator(false);
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
    } catch {
      // 시간 초과 또는 위치/네트워크 지연 시에도 로더가 고정되지 않도록 무조건 종료한다.
    } finally {
      clearTimeout(spinnerTimer);
      refreshingRef.current = false;
      setRefreshing(false);
      setShowPullIndicator(false);
    }
  }, [resolveCurrentLocation, fetchWeather]);

  const displayLocation =
    integrated?.location?.trim() || heroLocationLabel || "위치 확인 중...";

  const handleMoveToMyLocation = useCallback(async () => {
    try {
      setLocatingMe(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
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
      const next = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setMapCoords(next);
      setMapCenter(next);
    } finally {
      setLocatingMe(false);
    }
  }, []);

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
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: PAGE_BG }}
      edges={["top"]}
    >
      <LinearGradient
        colors={["#CFE9FF", "#DFF2FF", "#EAF3FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ flex: 1 }}>
        {showPullIndicator ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: insets.top + 6,
              left: 0,
              right: 0,
              zIndex: 30,
              alignItems: "center",
              opacity: refreshing
                ? 1
                : pullProgress.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0.15, 0.45, 1],
                    extrapolate: "clamp",
                  }),
              transform: [{ translateY: refreshing ? 0 : pullDownY }],
            }}
          >
            <View
              className="rounded-full px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
            >
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          </Animated.View>
        ) : null}

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={{
            paddingBottom: 24,
            paddingHorizontal: HORIZONTAL_MARGIN,
            flexGrow: 1,
          }}
        >
        {/* 상단 날씨: 테두리 없이 그라데이션 배경 위에 배치 */}
        <View className="pt-4" {...pullPanResponder.panHandlers}>
          <View className="flex-row items-start justify-between">
            <Text
              className="flex-1 pr-3 text-sm font-medium leading-5 text-gray-800"
              numberOfLines={2}
            >
              {displayLocation}
            </Text>
            <Pressable hitSlop={14} accessibilityLabel="알림">
              <Ionicons name="notifications-outline" size={24} color="#111827" />
            </Pressable>
          </View>

          <View className="mt-3 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-3">
              {weatherLoading && !integrated ? (
                <View className="mt-2 flex-row items-center">
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text className="ml-2 text-sm text-gray-500">불러오는 중…</Text>
                </View>
              ) : (
                <Text className="text-[60px] font-extrabold leading-[64px] text-gray-900">
                  {integrated?.current != null
                    ? `${Math.round(integrated.current.temperature)}°`
                    : "--°"}
                </Text>
              )}
              <View
                className="mt-4 self-start rounded-full px-4 py-2.5"
                style={{ backgroundColor: "rgba(37, 99, 235, 0.14)" }}
              >
                <Text className="text-sm font-semibold text-gray-700">
                  {precipHumidityChip}
                </Text>
              </View>
              {integrated?.current?.weatherDesc ? (
                <Text className="mt-2 text-sm font-semibold text-sky-800">
                  {integrated.current.weatherDesc}
                </Text>
              ) : null}
              {integrated?.air ? (
                <Text className="mt-1.5 text-xs text-gray-500">
                  대기{" "}
                  <Text className="font-semibold text-gray-700">
                    미세 {integrated.air.pm10Grade}
                  </Text>
                  {" · "}
                  <Text className="font-semibold text-gray-700">
                    초미세 {integrated.air.pm25Grade}
                  </Text>
                  {" · "}
                  <Text className="font-semibold text-gray-700">
                    통합 {integrated.air.aqiGrade}
                  </Text>
                </Text>
              ) : null}
              {weatherSubtitle ? (
                <Text className="mt-1 text-[11px] text-gray-400">
                  {weatherSubtitle}
                  {integrated?.stale ? " · 이전 데이터" : ""}
                </Text>
              ) : integrated?.stale ? (
                <Text className="mt-1 text-[11px] text-amber-600">
                  이전 데이터 표시 중
                </Text>
              ) : null}
            </View>

            <View className="items-end" style={{ width: 124 }}>
              <View
                className="items-center justify-center"
                style={{
                  width: 120,
                  height: 120,
                }}
              >
                <Image
                  source={getWeatherIconSource(integrated?.current?.weatherIcon)}
                  style={{ width: 112, height: 112 }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          {weatherError ? (
            <Text className="mt-2 text-xs text-rose-600">{weatherError}</Text>
          ) : null}
        </View>

        {/* 지도 (세로 길이 확장) */}
        <View
          className="mt-5 overflow-hidden rounded-3xl"
          style={{
            height: 258,
            minHeight: 258,
            maxHeight: 258,
            backgroundColor: "rgba(147, 197, 253, 0.28)",
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          {mapCoords ? (
            <AppMapView
              chromeless
              interactive
              latitude={(mapCenter?.latitude ?? mapCoords.latitude) + 0.0012}
              longitude={mapCenter?.longitude ?? mapCoords.longitude}
              level={4}
              markers={[
                {
                  latitude: mapCoords.latitude,
                  longitude: mapCoords.longitude,
                  label: "현재",
                },
              ]}
              allowTap
              style={StyleSheet.absoluteFillObject}
            />
            
          ) : (
            <View className="flex-1 items-center justify-center px-4" style={{ minHeight: 258 }}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text className="mt-2 text-center text-xs text-gray-500">
                위치를 불러오면 지도가 표시됩니다.
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleMoveToMyLocation}
            disabled={locatingMe}
            className="absolute bottom-3 right-3 flex-row items-center rounded-full px-3 py-2.5 active:opacity-90"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderWidth: 1,
              borderColor: "rgba(148,163,184,0.35)",
            }}
          >
            {locatingMe ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="locate" size={16} color="#2563eb" />
            )}
            <Text className="ml-1.5 text-xs font-semibold text-blue-700">
              내 위치
            </Text>
          </Pressable>
        </View>

        {/* 저장 / 공개 코스 */}
        <View className="mt-5 gap-3">
          <Pressable
            onPress={() => navigation.navigate("MyRoute")}
            className="active:opacity-95"
            style={{
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.95)",
              borderWidth: 1,
              borderColor: "rgba(37, 99, 235, 0.26)",
              paddingVertical: 16,
              paddingHorizontal: 16,
              shadowColor: "#1e3a8a",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.07,
              shadowRadius: 14,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "#dbeafe" }}
              >
                <Ionicons name="bookmark" size={22} color="#2563eb" />
              </View>
              <View className="ml-3 flex-1 min-w-0">
                <Text className="text-base font-extrabold text-gray-900">
                  저장한 코스
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  내가 담아 둔 루트를 모아 볼 수 있어요
                </Text>
              </View>
              <View className="items-end mr-1">
                <Text className="text-2xl font-extrabold tabular-nums" style={{ color: "#1e40af" }}>
                  {savedCourseIds.length}
                </Text>
                <Text className="text-[10px] font-semibold text-gray-400">개</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("SharedRoute")}
            className="active:opacity-95"
            style={{
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.95)",
              borderWidth: 1,
              borderColor: "rgba(5, 150, 105, 0.26)",
              paddingVertical: 16,
              paddingHorizontal: 16,
              shadowColor: "#14532d",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.07,
              shadowRadius: 14,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "#d1fae5" }}
              >
                <Ionicons name="paper-plane" size={20} color="#059669" />
              </View>
              <View className="ml-3 flex-1 min-w-0">
                <Text className="text-base font-extrabold text-gray-900">
                  공개한 코스
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  다른 사람에게 보여 주는 루트예요
                </Text>
              </View>
              <View className="items-end mr-1">
                <Text className="text-2xl font-extrabold tabular-nums" style={{ color: "#047857" }}>
                  {publicCourseIds.length}
                </Text>
                <Text className="text-[10px] font-semibold text-gray-400">개</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </Pressable>
        </View>


        <View style={{ height: 10 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
