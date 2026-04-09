// @ts-nocheck
import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import GoogleMapWebView from './GoogleMapWebView';
import type { MapPathPoint } from './mapTypes';

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  path?: MapPathPoint[];
  stops?: MapPathPoint[];
  style?: object;
};

const ROUTE_COLOR = '#2563eb';

function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

type Coordinates = { latitude?: number; longitude?: number };
type CameraPosition = { coordinates?: Coordinates; zoom?: number };

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

/**
 * Android 개발 빌드: expo-maps GoogleMaps.View
 * iOS · Expo Go · 그 외: Google Maps JavaScript API(WebView) — expo-maps는 Android만 네이티브 Google 지원
 */
function AppMapViewExpoGoogleMapsImpl({
  latitude = 37.5665,
  longitude = 126.978,
  level = 8,
  path,
  stops,
  style,
}: Props): React.JSX.Element {
  const { GoogleMaps } = require('expo-maps');

  const pts = useMemo(() => validPoints(path), [path]);
  const stopPts = useMemo(() => validPoints(stops), [stops]);
  const cameraPath = useMemo(() => {
    if (pts.length >= 1) return pts;
    return stopPts;
  }, [pts, stopPts]);
  const cameraPosition = useMemo(
    () => cameraForPath(cameraPath, latitude, longitude, level),
    [cameraPath, latitude, longitude, level],
  );
  const lineCoords = useMemo(() => toCoordinates(pts), [pts]);

  const markers = useMemo(() => {
    if (stopPts.length > 0) {
      return stopPts.map((c, i) => ({
        id: `stop-${i}`,
        coordinates: { latitude: c.latitude, longitude: c.longitude },
      }));
    }
    if (lineCoords.length <= 24) {
      return lineCoords.map((c, i) => ({
        id: `stop-${i}`,
        coordinates: c,
      }));
    }
    if (lineCoords.length >= 2) {
      return [
        { id: 'stop-0', coordinates: lineCoords[0] },
        { id: 'stop-last', coordinates: lineCoords[lineCoords.length - 1] },
      ];
    }
    return [];
  }, [stopPts, lineCoords]);

  const polylines = useMemo(() => {
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

  return (
    <GoogleMaps.View
      style={baseStyle}
      cameraPosition={cameraPosition}
      markers={markers}
      polylines={polylines}
      uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false }}
    />
  );
}

export default function AppMapView(props: Props): React.JSX.Element {
  const useNativeGoogle =
    Platform.OS === 'android' && !isExpoGoClient();

  if (useNativeGoogle) {
    return <AppMapViewExpoGoogleMapsImpl {...props} />;
  }

  return <GoogleMapWebView {...props} />;
}
