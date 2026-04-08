// @ts-nocheck — Expo Go는 expo-maps 네이티브 없음 → WebView 폴백
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import KakaoMapWebView from './KakaoMapWebView';
import type { MapPathPoint } from './mapTypes';

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  path?: MapPathPoint[];
  style?: object;
};

/** expo-maps와 동일 형태 — Expo Go 경로에서 expo-maps 패키지를 로드하지 않기 위해 로컬 정의 */
type Coordinates = { latitude?: number; longitude?: number };
type CameraPosition = { coordinates?: Coordinates; zoom?: number };

const ROUTE_COLOR = '#2563eb';

/** Expo Go(storeClient)에는 ExpoMaps 네이티브 모듈이 없음 — 개발 빌드에서만 Apple/Google Maps 사용 */
function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function validPoints(path: MapPathPoint[] | undefined): MapPathPoint[] {
  return (path ?? []).filter(
    (p) =>
      p &&
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude),
  );
}

function toCoordinates(pts: MapPathPoint[]): Coordinates[] {
  return pts.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
}

function kakaoLevelToZoom(level: number): number {
  const lv = Math.max(1, Math.min(14, level));
  return Math.max(8, Math.min(18, 20 - lv));
}

function cameraForPath(
  pts: MapPathPoint[],
  fallbackLat: number,
  fallbackLng: number,
  level: number,
): CameraPosition {
  if (pts.length >= 2) {
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    const latSpan = Math.max(0.002, maxLat - minLat);
    const lngSpan = Math.max(0.002, maxLng - minLng);
    const span = Math.max(latSpan, lngSpan * 0.85);
    let zoom = 14;
    if (span > 0.35) zoom = 9;
    else if (span > 0.15) zoom = 10;
    else if (span > 0.07) zoom = 11;
    else if (span > 0.035) zoom = 12;
    else if (span > 0.018) zoom = 13;
    else if (span > 0.009) zoom = 14;
    else zoom = 15;
    return { coordinates: { latitude: cLat, longitude: cLng }, zoom };
  }
  if (pts.length === 1) {
    return {
      coordinates: { latitude: pts[0].latitude, longitude: pts[0].longitude },
      zoom: kakaoLevelToZoom(level),
    };
  }
  return {
    coordinates: { latitude: fallbackLat, longitude: fallbackLng },
    zoom: kakaoLevelToZoom(level),
  };
}

function AppMapViewExpoMapsImpl({
  latitude = 37.5665,
  longitude = 126.978,
  level = 8,
  path,
  style,
}: Props): React.JSX.Element {
  const { AppleMaps, GoogleMaps } = require('expo-maps');

  const pts = useMemo(() => validPoints(path), [path]);
  const cameraPosition = useMemo(
    () => cameraForPath(pts, latitude, longitude, level),
    [pts, latitude, longitude, level],
  );
  const lineCoords = useMemo(() => toCoordinates(pts), [pts]);

  const markers = useMemo(
    () =>
      lineCoords.map((c, i) => ({
        id: `stop-${i}`,
        coordinates: c,
      })),
    [lineCoords],
  );

  const polylinesApple = useMemo(() => {
    if (lineCoords.length < 2) return [];
    return [
      {
        id: 'route',
        coordinates: lineCoords,
        color: ROUTE_COLOR,
        width: 5,
        contourStyle: 'GEODESIC' as const,
      },
    ];
  }, [lineCoords]);

  const polylinesGoogle = useMemo(() => {
    if (lineCoords.length < 2) return [];
    return [
      {
        id: 'route',
        coordinates: lineCoords,
        color: ROUTE_COLOR,
        width: 5,
        geodesic: true,
      },
    ];
  }, [lineCoords]);

  const baseStyle = [{ flex: 1, backgroundColor: '#e5e7eb' }, style];

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={baseStyle}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylinesApple}
        uiSettings={{ compassEnabled: true, scaleBarEnabled: true, myLocationButtonEnabled: false }}
      />
    );
  }

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        style={baseStyle}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylinesGoogle}
        uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false }}
      />
    );
  }

  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackText}>지도는 iOS·Android 앱에서 표시됩니다.</Text>
    </View>
  );
}

/**
 * 개발 빌드: expo-maps(Apple / Google). Expo Go: 카카오 WebView.
 */
export default function AppMapView(props: Props): React.JSX.Element {
  if (isExpoGoClient()) {
    return <KakaoMapWebView {...props} />;
  }
  return <AppMapViewExpoMapsImpl {...props} />;
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: { fontSize: 14, color: '#4b5563', textAlign: 'center' },
});
