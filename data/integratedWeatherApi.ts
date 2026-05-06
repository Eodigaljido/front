/**
 * 백엔드 통합 날씨 API — Swagger: GET /api/weather?location=
 * 기본 호스트는 개발 서버; `EXPO_PUBLIC_WEATHER_API_BASE_URL`로 덮어쓸 수 있습니다.
 */

const DEFAULT_WEATHER_API_BASE = "http://3.36.85.213:8080";

export type IntegratedWeatherCurrent = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation1h: number;
  precipitationType: string;
  weatherIcon: string;
  weatherDesc: string;
  pop: number;
};

export type IntegratedWeatherAir = {
  pm10: number;
  pm10Grade: string;
  pm25: number;
  pm25Grade: string;
  aqi: number;
  aqiGrade: string;
} | null;

export type IntegratedWeatherWeeklyItem = {
  date: string;
  dayOfWeek: string;
  weatherIcon: string;
  weatherDesc: string;
  tempMax: number | null;
  tempMin: number | null;
  pop: number;
};

export type IntegratedWeatherResponse = {
  location: string;
  fetchedAt: string;
  current: IntegratedWeatherCurrent;
  air: IntegratedWeatherAir;
  weekly: IntegratedWeatherWeeklyItem[];
  stale: boolean | null;
};

export type IntegratedWeatherErrorBody = {
  code?: string;
  message?: string;
};

export function getWeatherApiBaseUrl(): string {
  const raw =
    typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_WEATHER_API_BASE_URL != null
      ? String(process.env.EXPO_PUBLIC_WEATHER_API_BASE_URL).trim()
      : "";
  return raw || DEFAULT_WEATHER_API_BASE;
}

export async function fetchIntegratedWeather(
  location: string,
  signal?: AbortSignal,
): Promise<IntegratedWeatherResponse> {
  const q = location.trim();
  if (!q) {
    throw new Error("지역명이 필요합니다.");
  }
  const base = getWeatherApiBaseUrl().replace(/\/$/, "");
  const url = `${base}/api/weather?location=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      res.ok
        ? "날씨 응답을 해석하지 못했습니다."
        : `날씨 서버 오류 (${res.status})`,
    );
  }
  if (!res.ok) {
    const err = body as IntegratedWeatherErrorBody;
    throw new Error(err?.message ?? `날씨 서버 오류 (${res.status})`);
  }
  return body as IntegratedWeatherResponse;
}
