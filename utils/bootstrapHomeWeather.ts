import * as Location from "expo-location";
import {
  fetchIntegratedWeather,
  type IntegratedWeatherResponse,
} from "../data/integratedWeatherApi";

export const DEFAULT_WEATHER_LOCATION = "서울 강남구";
const LOCATION_TIMEOUT_MS = 7000;
const WEATHER_FETCH_TIMEOUT_MS = 12_000;

export type HomeWeatherBootstrap = {
  integrated: IntegratedWeatherResponse | null;
  heroLocationLabel: string;
  weatherLocation: string;
  weatherError: string | null;
};

export function buildWeatherLocationQuery(
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

async function fetchWeatherForLocation(
  location: string,
): Promise<{ integrated: IntegratedWeatherResponse | null; error: string | null }> {
  const target = location.trim() || DEFAULT_WEATHER_LOCATION;
  const controller = new AbortController();
  const timerId = setTimeout(
    () => controller.abort(),
    WEATHER_FETCH_TIMEOUT_MS,
  );
  try {
    const integrated = await fetchIntegratedWeather(target, controller.signal);
    return { integrated, error: null };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    const msg =
      err?.name === "AbortError"
        ? "날씨 요청 시간이 초과되었습니다."
        : (err?.message ?? "날씨 정보를 불러오지 못했습니다.");
    return { integrated: null, error: msg };
  } finally {
    clearTimeout(timerId);
  }
}

/** 앱 진입·로그인 직후 홈 표시 전 GPS·날씨를 한 번에 준비 */
export async function bootstrapHomeWeather(): Promise<HomeWeatherBootstrap> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      const { integrated, error } = await fetchWeatherForLocation(
        DEFAULT_WEATHER_LOCATION,
      );
      return {
        integrated,
        heroLocationLabel: "위치 권한 미허용",
        weatherLocation: DEFAULT_WEATHER_LOCATION,
        weatherError: error,
      };
    }

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("위치 시간 초과")), LOCATION_TIMEOUT_MS),
      ),
    ]);

    const addr = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });

    const weatherLocation = buildWeatherLocationQuery(addr?.[0]);
    const { integrated, error } = await fetchWeatherForLocation(weatherLocation);
    const formatted = addr?.[0]?.formattedAddress
      ?.replace(/^대한민국\s*/, "")
      .trim();

    return {
      integrated,
      heroLocationLabel:
        formatted || integrated?.location || weatherLocation,
      weatherLocation: integrated?.location || weatherLocation,
      weatherError: error,
    };
  } catch {
    const { integrated, error } = await fetchWeatherForLocation(
      DEFAULT_WEATHER_LOCATION,
    );
    return {
      integrated,
      heroLocationLabel: "위치 확인 실패",
      weatherLocation: integrated?.location || DEFAULT_WEATHER_LOCATION,
      weatherError: error,
    };
  }
}
