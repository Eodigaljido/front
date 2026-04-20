// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ImageBackground,
  StyleSheet,
  TextInput,
  Modal,
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

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_MARGIN = 16;
const FEATURE_CARD_WIDTH = SCREEN_WIDTH * 0.62;

const CARD_STYLE = {
  backgroundColor: "#fff",
  borderRadius: 18,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 6,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.04)",
};

const WEATHER_API_KEY =
  "517f70743c415da1aae1a5681eea2afc6c4e46bcaceb9423269090e7889c3135";
const WEATHER_GRID = { nx: 60, ny: 127 };

type WeatherSnapshot = {
  temperatureC: number | null;
  minTempC: number | null;
  maxTempC: number | null;
  humidity: number | null;
  rainChance: number | null;
  sky: string;
  baseDate: string;
  baseTime: string;
};

function getKstNow() {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 60 * 60000);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function computeBaseDateTime(nowKst: Date): {
  baseDate: string;
  baseTime: string;
} {
  const candidates = [
    "0200",
    "0500",
    "0800",
    "1100",
    "1400",
    "1700",
    "2000",
    "2300",
  ];
  const hhmm = Number(
    `${String(nowKst.getHours()).padStart(2, "0")}${String(nowKst.getMinutes()).padStart(2, "0")}`,
  );
  let picked = candidates[0];
  for (const c of candidates) {
    if (Number(c) <= hhmm) picked = c;
  }
  if (Number(hhmm) < Number(candidates[0])) {
    const prev = new Date(nowKst);
    prev.setDate(prev.getDate() - 1);
    return { baseDate: toYmd(prev), baseTime: "2300" };
  }
  return { baseDate: toYmd(nowKst), baseTime: picked };
}

function parseSkyLabel(sky?: string, pty?: string): string {
  if (pty && pty !== "0") {
    if (pty === "1") return "비";
    if (pty === "2") return "비/눈";
    if (pty === "3") return "눈";
    if (pty === "4") return "소나기";
  }
  if (sky === "1") return "맑음";
  if (sky === "3") return "구름많음";
  if (sky === "4") return "흐림";
  return "정보 없음";
}

function toGrid(lat: number, lng: number): { nx: number; ny: number } {
  // 기상청 DFS 격자 변환
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
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
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherPlaceLabel, setWeatherPlaceLabel] = useState("홍대입구");
  const [weatherGrid, setWeatherGrid] = useState(WEATHER_GRID);
  const [weatherSource, setWeatherSource] = useState<
    "default" | "current" | "custom"
  >("default");
  const [heroLocationLabel, setHeroLocationLabel] = useState("위치 확인 중...");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState("");
  const [resolvingAddress, setResolvingAddress] = useState(false);

  const weatherSubtitle = useMemo(() => {
    if (!weather) return "";
    return `발표 ${weather.baseDate.slice(4, 6)}.${weather.baseDate.slice(6, 8)} ${weather.baseTime.slice(0, 2)}:${weather.baseTime.slice(2, 4)} 기준`;
  }, [weather]);

  const fetchWeather = useCallback(
    async (
      cancelledRef?: { value: boolean },
      grid?: { nx: number; ny: number },
    ) => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        const now = getKstNow();
        const { baseDate, baseTime } = computeBaseDateTime(now);
        const targetGrid = grid ?? weatherGrid;
        const url =
          `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
          `?serviceKey=${encodeURIComponent(WEATHER_API_KEY)}` +
          `&pageNo=1&numOfRows=180&dataType=JSON` +
          `&base_date=${baseDate}&base_time=${baseTime}` +
          `&nx=${targetGrid.nx}&ny=${targetGrid.ny}`;
        const res = await fetch(url);
        const json = await res.json();
        const items = json?.response?.body?.items?.item ?? [];
        if (!Array.isArray(items) || items.length === 0)
          throw new Error("날씨 데이터가 없습니다.");
        const grouped = new Map<
          string,
          {
            TMP?: string;
            SKY?: string;
            PTY?: string;
            REH?: string;
            POP?: string;
            TMN?: string;
            TMX?: string;
          }
        >();
        for (const it of items) {
          const key = `${it.fcstDate}-${it.fcstTime}`;
          const row = grouped.get(key) ?? {};
          if (it.category === "TMP") row.TMP = String(it.fcstValue);
          if (it.category === "SKY") row.SKY = String(it.fcstValue);
          if (it.category === "PTY") row.PTY = String(it.fcstValue);
          if (it.category === "REH") row.REH = String(it.fcstValue);
          if (it.category === "POP") row.POP = String(it.fcstValue);
          if (it.category === "TMN") row.TMN = String(it.fcstValue);
          if (it.category === "TMX") row.TMX = String(it.fcstValue);
          grouped.set(key, row);
        }
        const keys = Array.from(grouped.keys()).sort();
        const pick =
          keys.find((k) => {
            const [d, t] = k.split("-");
            return (
              Number(`${d}${t}`) >=
              Number(
                `${toYmd(now)}${String(now.getHours()).padStart(2, "0")}00`,
              )
            );
          }) ?? keys[0];
        const row = grouped.get(pick) ?? {};
        if (cancelledRef?.value) return;
        let minTemp: number | null = null;
        let maxTemp: number | null = null;
        for (const r of grouped.values()) {
          if (r.TMN != null) minTemp = Number(r.TMN);
          if (r.TMX != null) maxTemp = Number(r.TMX);
        }
        setWeather({
          temperatureC: row.TMP != null ? Number(row.TMP) : null,
          minTempC: minTemp,
          maxTempC: maxTemp,
          humidity: row.REH != null ? Number(row.REH) : null,
          rainChance: row.POP != null ? Number(row.POP) : null,
          sky: parseSkyLabel(row.SKY, row.PTY),
          baseDate,
          baseTime,
        });
      } catch (e: any) {
        if (cancelledRef?.value) return;
        setWeatherError(e?.message ?? "날씨 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelledRef?.value) setWeatherLoading(false);
      }
    },
    [weatherGrid],
  );

  useEffect(() => {
    const cancelledRef = { value: false };
    fetchWeather(cancelledRef);
    return () => {
      cancelledRef.value = true;
    };
  }, [fetchWeather]);

  const resolveCurrentLocation = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setHeroLocationLabel("위치 권한 미허용");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { nx, ny } = toGrid(pos.coords.latitude, pos.coords.longitude);
      setWeatherGrid({ nx, ny });
      setWeatherSource("current");
      setWeatherPlaceLabel("현재 위치");
      await fetchWeather(undefined, { nx, ny });

      const addr = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const a = addr?.[0];
      const label =
        [a?.district, a?.subregion, a?.city]
          .filter(Boolean)
          .slice(0, 2)
          .join(" ") || "현재 위치";
      setHeroLocationLabel(label);
    } catch {
      setHeroLocationLabel("현재 위치");
    }
  }, [fetchWeather]);

  useEffect(() => {
    resolveCurrentLocation();
  }, [resolveCurrentLocation]);

  const useCurrentLocationWeather = useCallback(async () => {
    try {
      setResolvingAddress(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setWeatherError("위치 권한이 필요합니다.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { nx, ny } = toGrid(pos.coords.latitude, pos.coords.longitude);
      setWeatherGrid({ nx, ny });
      setWeatherPlaceLabel("현재 위치");
      setWeatherSource("current");
      setLocationModalOpen(false);
      await fetchWeather(undefined, { nx, ny });
    } catch {
      setWeatherError("현재 위치를 가져오지 못했습니다.");
    } finally {
      setResolvingAddress(false);
    }
  }, [fetchWeather]);

  const useCustomAddressWeather = useCallback(async () => {
    const q = customAddressInput.trim();
    if (!q) {
      setWeatherError("주소를 입력해 주세요.");
      return;
    }
    try {
      setResolvingAddress(true);
      const geo = await Location.geocodeAsync(q);
      if (!geo.length) {
        setWeatherError("입력한 위치를 찾지 못했습니다.");
        return;
      }
      const { latitude, longitude } = geo[0];
      const { nx, ny } = toGrid(latitude, longitude);
      setWeatherGrid({ nx, ny });
      setWeatherPlaceLabel(q);
      setWeatherSource("custom");
      setLocationModalOpen(false);
      await fetchWeather(undefined, { nx, ny });
    } catch {
      setWeatherError("위치 변환 중 오류가 발생했습니다.");
    } finally {
      setResolvingAddress(false);
    }
  }, [customAddressInput, fetchWeather]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingHorizontal: HORIZONTAL_MARGIN,
        }}
      >
        {/* 히어로 배너 */}
        <View className="mt-4 overflow-hidden rounded-3xl">
          <ImageBackground
            source={require("../assets/banner.jpg")}
            resizeMode="cover"
            style={{ width: "100%", minHeight: 132 }}
            imageStyle={{ opacity: 0.95 }}
          >
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(0,0,0,0.38)",
              }}
            />
            <View className="px-5 pt-5 pb-5" style={{ minHeight: 132 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="items-center justify-center h-9 w-9 rounded-xl bg-white/15">
                    <Ionicons name="navigate" size={18} color="#fff" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-xs text-white/80">현재 위치</Text>
                    <Text className="mt-0.5 text-lg font-extrabold text-white">
                      {heroLocationLabel}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={resolveCurrentLocation}
                  className="px-3 py-2 rounded-full bg-white/15"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Text className="text-xs font-semibold text-white">갱신</Text>
                </Pressable>
              </View>

              <Text className="mt-3 text-sm font-semibold text-white/90">
                오늘 주변 인기 코스 {popularCourses.length}개 · 이벤트 5개
              </Text>

              {/* 퀵 액션 */}
              <View className="flex-row gap-10 mt-4">
                <Pressable
                  onPress={() =>
                    navigation.navigate("SharedRoute", { openFilter: true })
                  }
                  className="flex-row items-center"
                >
                  <View className="items-center justify-center bg-white h-9 w-9 rounded-xl">
                    <Ionicons name="search" size={18} color="#111827" />
                  </View>
                  <Text className="ml-2 text-sm font-bold text-white">
                    코스 찾기
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate("MyRoute")}
                  className="flex-row items-center"
                >
                  <View className="items-center justify-center bg-white h-9 w-9 rounded-xl">
                    <Ionicons name="bookmark" size={18} color="#111827" />
                  </View>
                  <Text className="ml-2 text-sm font-bold text-white">
                    내 저장
                  </Text>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* 요약 카드 2개 */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            style={[CARD_STYLE, { flex: 1, padding: 14 }]}
            onPress={() => navigation.navigate("MyRoute")}
          >
            <View className="flex-row items-center justify-between">
              <View className="rounded-2xl bg-blue-50 p-2.5">
                <Ionicons name="bookmark" size={20} color="#2563eb" />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
            <Text className="mt-3 text-xs font-semibold text-gray-500">
              저장한 코스
            </Text>
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">
              {savedCourseIds.length}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">전체 보기</Text>
          </Pressable>

          <Pressable
            style={[CARD_STYLE, { flex: 1, padding: 14 }]}
            onPress={() => navigation.navigate("SharedRoute")}
          >
            <View className="flex-row items-center justify-between">
              <View className="rounded-2xl bg-emerald-50 p-2.5">
                <Ionicons name="paper-plane" size={20} color="#059669" />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
            <Text className="mt-3 text-xs font-semibold text-gray-500">
              공개한 코스
            </Text>
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">
              {publicCourseIds.length}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">전체 보기</Text>
          </Pressable>
        </View>

        {/* 오늘 날씨 */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader title="오늘 날씨" />
          <View style={[CARD_STYLE, { marginTop: 12, padding: 14 }]}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                  <Ionicons
                    name="partly-sunny-outline"
                    size={22}
                    color="#0284c7"
                  />
                </View>
                <View className="ml-3">
                  <Text className="text-sm font-semibold text-gray-900">
                    {weatherPlaceLabel} 예상 날씨
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    {weatherSubtitle}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setLocationModalOpen(true)}
                  className="rounded-lg bg-blue-50 px-2.5 py-1.5"
                >
                  <Text className="text-[11px] font-semibold text-blue-700">
                    위치 선택
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => fetchWeather()}
                  className="rounded-lg bg-gray-100 px-2.5 py-1.5"
                >
                  <Text className="text-[11px] font-semibold text-gray-700">
                    새로고침
                  </Text>
                </Pressable>
              </View>
            </View>
            <View className="mt-3 min-h-[72px]">
              <View className="flex-row items-end">
                <Text className="text-3xl font-extrabold text-gray-900">
                  {weather?.temperatureC != null
                    ? `${Math.round(weather.temperatureC)}°`
                    : "--°"}
                </Text>
                <Text className="mb-1 ml-2 text-sm font-semibold text-sky-700">
                  {weather?.sky ?? "날씨 준비중"}
                </Text>
              </View>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <View className="rounded-full bg-gray-100 px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-gray-700">
                    강수확률{" "}
                    {weather?.rainChance != null
                      ? `${Math.round(weather.rainChance)}%`
                      : "--"}
                  </Text>
                </View>
                <View className="rounded-full bg-gray-100 px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-gray-700">
                    습도{" "}
                    {weather?.humidity != null
                      ? `${Math.round(weather.humidity)}%`
                      : "--"}
                  </Text>
                </View>
                <View className="rounded-full bg-gray-100 px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-gray-700">
                    최저/최고{" "}
                    {weather?.minTempC != null
                      ? Math.round(weather.minTempC)
                      : "--"}
                    ° /{" "}
                    {weather?.maxTempC != null
                      ? Math.round(weather.maxTempC)
                      : "--"}
                    °
                  </Text>
                </View>
                <View className="rounded-full bg-gray-100 px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-gray-700">
                    기준{" "}
                    {weatherSource === "current"
                      ? "현재 위치"
                      : weatherSource === "custom"
                        ? "선택 위치"
                        : "기본 위치"}
                  </Text>
                </View>
              </View>
              {weatherError ? (
                <Text className="mt-2 text-xs text-rose-500">
                  일시적으로 최신 날씨를 불러오지 못했습니다.
                </Text>
              ) : null}
            </View>
          </View>
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
                      <View className="justify-end flex-1 px-4 pb-3">
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
                  <View className="px-4 pt-3 pb-4">
                    <Text
                      className="text-sm font-extrabold text-gray-900"
                      numberOfLines={2}
                    >
                      {course.title}
                    </Text>
                    <View className="flex-row items-center mt-2">
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

      <Modal
        visible={locationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModalOpen(false)}
      >
        <View className="flex-1 justify-center px-6">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            className="bg-black/40"
            onPress={() => setLocationModalOpen(false)}
          />
          <View className="rounded-2xl bg-white p-5" style={{ zIndex: 1 }}>
            <Text className="text-lg font-bold text-gray-900">
              날씨 위치 선택
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              현재 위치 또는 원하는 주소로 날씨를 조회할 수 있어요.
            </Text>

            <Pressable
              onPress={useCurrentLocationWeather}
              className="mt-4 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:opacity-90"
              disabled={resolvingAddress}
            >
              <Ionicons name="locate" size={18} color="#fff" />
              <Text className="ml-2 text-sm font-bold text-white">
                현재 위치 사용
              </Text>
            </Pressable>

            <Text className="mt-4 text-xs font-semibold text-gray-600">
              원하는 위치(주소)
            </Text>
            <TextInput
              value={customAddressInput}
              onChangeText={setCustomAddressInput}
              placeholder="예: 서울 마포구 홍익로"
              placeholderTextColor="#9ca3af"
              className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900"
            />
            <Pressable
              onPress={useCustomAddressWeather}
              className="mt-2 items-center rounded-xl border border-gray-300 py-3 active:opacity-90"
              disabled={resolvingAddress}
            >
              <Text className="text-sm font-semibold text-gray-700">
                이 위치로 조회
              </Text>
            </Pressable>

            {resolvingAddress ? (
              <View className="mt-3 flex-row items-center justify-center">
                <ActivityIndicator size="small" color="#2563eb" />
                <Text className="ml-2 text-xs text-gray-500">
                  위치 확인 중...
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
