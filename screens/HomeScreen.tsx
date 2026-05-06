// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

const PAGE_BG = "#F2F2F2";

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
const DEFAULT_WEATHER_LOCATION = "서울 강남구";

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
  const navigation = useNavigation<HomeNavProp>();
  const { savedCourseIds, publicCourseIds } = useMockData();
  const popularCourses = getPopularNearbyCourses(3);

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedWeatherResponse | null>(
    null,
  );
  const [heroLocationLabel, setHeroLocationLabel] = useState("위치 확인 중...");
  /** 지도 중심·마커 (GPS 또는 주소 지오코딩) */
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const weatherLocationRef = useRef("");

  const applyGeocodedMapFallback = useCallback(async () => {
    try {
      const geo = await Location.geocodeAsync(DEFAULT_WEATHER_LOCATION);
      const g = geo?.[0];
      if (
        g &&
        typeof g.latitude === "number" &&
        typeof g.longitude === "number"
      ) {
        setMapCoords({ latitude: g.latitude, longitude: g.longitude });
      }
    } catch {
      setMapCoords({ latitude: 37.4979, longitude: 127.0276 });
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

  const displayLocation =
    integrated?.location?.trim() || heroLocationLabel || "위치 확인 중...";

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: PAGE_BG }}
      edges={["top"]}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{
          paddingBottom: 120,
          paddingHorizontal: HORIZONTAL_MARGIN,
        }}
      >
        {/* 상단 날씨: 카드 없이 페이지 배경에 직접 */}
        <View className="pt-1">
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

          <View className="mt-2 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-3">
              {weatherLoading && !integrated ? (
                <View className="mt-2 flex-row items-center">
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text className="ml-2 text-sm text-gray-500">불러오는 중…</Text>
                </View>
              ) : (
                <Text className="text-[52px] font-extrabold leading-[56px] text-gray-900">
                  {integrated?.current != null
                    ? `${Math.round(integrated.current.temperature)}°`
                    : "--°"}
                </Text>
              )}
              <View
                className="mt-3 self-start rounded-full px-3 py-2"
                style={{ backgroundColor: "#E8E8ED" }}
              >
                <Text className="text-xs font-semibold text-gray-700">
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

            <View className="items-end" style={{ width: 92 }}>
              <View
                className="items-center justify-center overflow-hidden rounded-2xl"
                style={{
                  width: 88,
                  height: 88,
                  backgroundColor: "#D9D9D9",
                }}
              >
                <Text
                  className="px-2 text-center text-[11px] font-bold text-gray-600"
                  numberOfLines={4}
                >
                  {integrated?.current?.weatherDesc
                    ? `3D 아이콘\n(${integrated.current.weatherDesc})`
                    : "3D 아이콘\n(추가 예정)"}
                </Text>
              </View>
            </View>
          </View>

          {weatherError ? (
            <Text className="mt-2 text-xs text-rose-600">{weatherError}</Text>
          ) : null}
        </View>

        {/* 지도 (상단 라벨 없음, 임베드용 최소 UI) */}
        <View
          className="mt-5 overflow-hidden rounded-3xl"
          style={{ height: 200, backgroundColor: "#e8eaed" }}
        >
          {mapCoords ? (
            <AppMapView
              chromeless
              latitude={mapCoords.latitude}
              longitude={mapCoords.longitude}
              level={4}
              markers={[
                {
                  latitude: mapCoords.latitude,
                  longitude: mapCoords.longitude,
                  label: "현재",
                },
              ]}
              allowTap
              style={{ width: "100%", height: 200 }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-4" style={{ minHeight: 200 }}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text className="mt-2 text-center text-xs text-gray-500">
                위치를 불러오면 지도가 표시됩니다.
              </Text>
            </View>
          )}
        </View>

        {/* 저장 / 공개 코스 */}
        <View className="mt-5 gap-3">
          <Pressable
            onPress={() => navigation.navigate("MyRoute")}
            className="active:opacity-95"
            style={{
              borderRadius: 20,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "rgba(37, 99, 235, 0.14)",
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
                style={{ backgroundColor: "#eff6ff" }}
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
                <Text className="text-2xl font-extrabold tabular-nums" style={{ color: "#1d4ed8" }}>
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
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "rgba(22, 163, 74, 0.16)",
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
                style={{ backgroundColor: "#ecfdf5" }}
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

        {/* 주변 인기 코스 */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            title="주변 인기 코스"
            actionLabel="자세히 보기"
            onPressAction={() =>
              navigation.navigate("SharedRoute", {
                openFilter: true,
                openAsPopular: true,
              })
            }
          />
          <Text className="mt-1 text-xs text-gray-500">
            현재 지역을 기반으로 추천하는 코스예요!
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              marginTop: 12,
              paddingRight: HORIZONTAL_MARGIN,
              gap: 12,
            }}
            style={{
              marginLeft: -HORIZONTAL_MARGIN,
              paddingLeft: HORIZONTAL_MARGIN,
            }}
          >
            {popularCourses.map((course) => (
              <Pressable
                key={course.id}
                style={{ width: FEATURE_CARD_WIDTH }}
                onPress={() =>
                  navigation.navigate("SharedRoute", {
                    viewCourseId: course.id,
                    openAsPopular: true,
                  })
                }
              >
                <View style={[CARD_STYLE, { padding: 0, overflow: "hidden" }]}>
                  <View style={{ height: 88, backgroundColor: "#111827" }}>
                    <ImageBackground
                      source={require("../assets/banner.jpg")}
                      resizeMode="cover"
                      style={{ width: "100%", height: "100%" }}
                      imageStyle={{ opacity: 0.85 }}
                    >
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          backgroundColor: "rgba(0,0,0,0.35)",
                        }}
                      />
                      <View className="flex-1 justify-end px-4 pb-3">
                        <View className="flex-row items-center justify-between">
                          <View className="rounded-full bg-white/15 px-2.5 py-1">
                            <Text className="text-[11px] font-semibold text-white">
                              {course.region} · {course.category}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Ionicons
                              name="eye-outline"
                              size={14}
                              color="#fff"
                            />
                            <Text className="ml-1 text-[11px] font-semibold text-white/90">
                              {course.views}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ImageBackground>
                  </View>
                  <View className="px-4 pb-4 pt-3">
                    <Text
                      className="text-sm font-extrabold text-gray-900"
                      numberOfLines={2}
                    >
                      {course.title}
                    </Text>
                    <View className="mt-2 flex-row items-center">
                      <View className="rounded bg-green-100 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-green-700">
                          {course.departure}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="#9ca3af"
                        style={{ marginHorizontal: 6 }}
                      />
                      <View className="rounded bg-red-100 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-red-700">
                          {course.arrival}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
