// @ts-nocheck
import React, { useMemo } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import GoogleMapWebView from "./GoogleMapWebView";
import type { MapMarkerPoint, MapPathPoint, MapRouteSegment } from "./mapTypes";

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  zoom?: number;
  fitToRoute?: boolean;
  /** WebView·임베드에서 지도 기본 UI·표기 최소화 */
  chromeless?: boolean;
  /** false면 지도 제스처(드래그/줌/회전) 비활성화 */
  interactive?: boolean;
  allowTap?: boolean;
  avoidLineOverlap?: boolean;
  path?: MapPathPoint[];
  segments?: MapRouteSegment[];
  stops?: MapPathPoint[];
  markers?: MapMarkerPoint[];
  style?: object;
};

const ROUTE_COLOR = "#2563eb";

function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

type Coordinates = { latitude?: number; longitude?: number };
type CameraPosition = { coordinates?: Coordinates; zoom?: number };

function validPoints(path: MapPathPoint[] | undefined): MapPathPoint[] {
  return (path ?? []).filter(
    (p) =>
      p &&
      typeof p.latitude === "number" &&
      typeof p.longitude === "number" &&
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
  fitToRoute: boolean,
  zoomOverride?: number,
): CameraPosition {
  const targetZoom =
    typeof zoomOverride === "number" && Number.isFinite(zoomOverride)
      ? Math.max(8, Math.min(20, zoomOverride))
      : kakaoLevelToZoom(level);

  if (fitToRoute && pts.length >= 2) {
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
      zoom: targetZoom,
    };
  }
  return {
    coordinates: { latitude: fallbackLat, longitude: fallbackLng },
    zoom: targetZoom,
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
  zoom: zoomProp,
  fitToRoute = true,
  chromeless: _chromeless = true,
  interactive = true,
  allowTap = true,
  path,
  segments,
  stops,
  markers,
  style,
}: Props): React.JSX.Element {
  const { GoogleMaps } = require("expo-maps");

  const pts = useMemo(() => validPoints(path), [path]);
  const segs = useMemo(
    () =>
      (segments ?? [])
        .map((s) => ({
          ...s,
          points: validPoints(s.points),
        }))
        .filter((s) => s.points.length >= 2),
    [segments],
  );
  const stopPts = useMemo(() => validPoints(stops), [stops]);
  const markerPts = useMemo(
    () =>
      (markers ?? []).filter(
        (p) =>
          p &&
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude),
      ),
    [markers],
  );
  const cameraPath = useMemo(() => {
    if (segs.length >= 1) return segs.flatMap((s) => s.points);
    if (pts.length >= 1) return pts;
    if (markerPts.length >= 1)
      return markerPts.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
      }));
    return stopPts;
  }, [segs, pts, markerPts, stopPts]);
  const cameraPosition = useMemo(
    () =>
      cameraForPath(
        cameraPath,
        latitude,
        longitude,
        level,
        fitToRoute,
        zoomProp,
      ),
    [cameraPath, latitude, longitude, level, fitToRoute, zoomProp],
  );
  const lineCoords = useMemo(() => toCoordinates(pts), [pts]);

  const nativeMarkers = useMemo(() => {
    if (markerPts.length > 0) {
      return markerPts.map((c, i) => ({
        id: `marker-${i}`,
        coordinates: { latitude: c.latitude, longitude: c.longitude },
        title: c.label ? `${c.label}` : undefined,
        subtitle: c.label ? " " : undefined,
        tintColor: c.color,
        isTappable: allowTap,
      }));
    }
    if (stopPts.length > 0) {
      return stopPts.map((c, i) => ({
        id: `stop-${i}`,
        coordinates: { latitude: c.latitude, longitude: c.longitude },
        title: `${i + 1}`,
        isTappable: allowTap,
      }));
    }
    if (lineCoords.length <= 24) {
      return lineCoords.map((c, i) => ({
        id: `stop-${i}`,
        coordinates: c,
        isTappable: allowTap,
      }));
    }
    if (lineCoords.length >= 2) {
      return [
        { id: "stop-0", coordinates: lineCoords[0], isTappable: allowTap },
        {
          id: "stop-last",
          coordinates: lineCoords[lineCoords.length - 1],
          isTappable: allowTap,
        },
      ];
    }
    return [];
  }, [markerPts, stopPts, lineCoords, allowTap]);

  const polylines = useMemo(() => {
    if (segs.length >= 1) {
      return segs.map((s) => ({
        id: s.id,
        coordinates: toCoordinates(s.points),
        color: s.color || ROUTE_COLOR,
        width: s.width ?? 4,
        geodesic: true,
        lineDashPattern: s.dashed ? [8, 8] : undefined,
      }));
    }
    if (lineCoords.length < 2) return [];
    return [
      {
        id: "route",
        coordinates: lineCoords,
        color: ROUTE_COLOR,
        width: 4,
        geodesic: true,
      },
    ];
  }, [segs, lineCoords]);

  const baseStyle = [{ flex: 1, backgroundColor: "#e5e7eb" }, style];

  return (
    <GoogleMaps.View
        style={baseStyle}
        cameraPosition={cameraPosition}
        markers={nativeMarkers}
        polylines={polylines}
        uiSettings={{
          compassEnabled: false,
          myLocationButtonEnabled: false,
          mapToolbarEnabled: false,
          zoomControlsEnabled: false,
          scaleBarEnabled: false,
          indoorLevelPickerEnabled: false,
          scrollGesturesEnabled: interactive,
          zoomGesturesEnabled: interactive,
          rotationGesturesEnabled: interactive,
          tiltGesturesEnabled: interactive,
        }}
        properties={{ selectionEnabled: false }}
    />
  );
}

export default function AppMapView(props: Props): React.JSX.Element {
  const useNativeGoogle = Platform.OS === "android" && !isExpoGoClient();

  if (useNativeGoogle) {
    return <AppMapViewExpoGoogleMapsImpl {...props} />;
  }

  return <GoogleMapWebView {...props} fitToRoute={props.fitToRoute ?? true} />;
}
