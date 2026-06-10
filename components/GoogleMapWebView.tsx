// @ts-nocheck — WebView/iframe + Google Maps JavaScript API
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, Platform, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { GOOGLE_MAPS_JS_API_KEY } from '../constants/googleMaps';
import type { MapMarkerPoint, MapPathPoint, MapRouteSegment } from './mapTypes';

export type { MapPathPoint };

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  /** Google Maps zoom (8–20). 있으면 level보다 우선 */
  zoom?: number;
  /** false면 경로 전체 fitBounds 대신 lat/lng·zoom으로 카메라 고정 */
  fitToRoute?: boolean;
  /** 0–360: 지도 회전(북=0). 안내 모드에서 사용자 방향에 맞춤 */
  mapHeading?: number;
  /** true면 lat/lng·zoom으로 사용자 위치 추적( fitBounds 생략 ) */
  followUser?: boolean;
  followZoom?: number;
  /** true면 기본 UI·출처 컨트롤 등을 최대한 숨김(임베드용) */
  chromeless?: boolean;
  /** false면 지도 제스처(드래그/줌/회전) 비활성화 */
  interactive?: boolean;
  /** false면 탭 클릭(POI/마커 선택 등)만 막고, 드래그/줌은 유지 */
  allowTap?: boolean;
  /** true면 겹치는 구간을 미세 오프셋해 선이 덜 겹치게 표시 */
  avoidLineOverlap?: boolean;
  /** 상세 경로(폴리라인). 마커는 기본적으로 찍지 않음 — stops가 없을 때만 제한적으로 표시 */
  path?: MapPathPoint[];
  segments?: MapRouteSegment[];
  /** 정류장·출발/도착 등 마커만 찍을 좌표 (polyline과 분리) */
  stops?: MapPathPoint[];
  markers?: MapMarkerPoint[];
  style?: object;
};

/** 기존 화면에서 쓰던 레벨 값 → Google zoom */
function levelToGoogleZoom(level: number): number {
  const lv = Math.max(1, Math.min(14, Number(level) || 8));
  return Math.max(8, Math.min(18, 20 - lv));
}

/** 지도 타일은 유지하고, 출처·로고 링크 영역만 숨김 (.gmnoprint 전체 숨기면 타일까지 사라짐) */
const MAP_ATTRIBUTION_HIDE_CSS = `
    .gm-style-cc,
    .gm-style-moc,
    .gm-style-pbc,
    .gm-style a[href^="https://maps.google.com/maps"],
    .gm-style a[href^="http://maps.google.com/maps"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
`;

function buildGoogleBootstrapHtml(
  apiKey: string,
  chromeless: boolean,
  interactive: boolean,
): string {
  const chromelessOpts = `
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false,
        keyboardShortcuts: false,
        attributionControl: false,
        rotateControl: false,
`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { width:100%; height:100%; margin:0; padding:0; background:#e5e7eb; }
    ${MAP_ATTRIBUTION_HIDE_CSS}
  </style>
  <script>
    var map = null;
    var polylines = [];
    var markers = [];
    function clearOverlays() {
      for (var p = 0; p < polylines.length; p++) {
        if (polylines[p]) polylines[p].setMap(null);
      }
      polylines = [];
      for (var i = 0; i < markers.length; i++) markers[i].setMap(null);
      markers = [];
    }
    function relayoutMap() {
      try {
        if (map && google && google.maps) google.maps.event.trigger(map, 'resize');
      } catch (e) {}
    }
    window.__gmRelayout = relayoutMap;
    window.__pendingSpec = null;

    function hideMapAttributionLayers() {
      try {
        var root = document.getElementById('map');
        if (!root) return;
        root.querySelectorAll('.gm-style-cc, .gm-style-moc, .gm-style-pbc').forEach(function (el) {
          el.style.display = 'none';
        });
        root.querySelectorAll('a[href*="maps.google.com"]').forEach(function (el) {
          el.style.display = 'none';
        });
        root.querySelectorAll('a, span, div').forEach(function (el) {
          if (el.children && el.children.length > 0) return;
          var t = String(el.textContent || '').trim();
          if (!t || t.length > 64) return;
          if (/^(©|지도\\s*데이터|map data|google|tmap|모빌리티)/i.test(t)) {
            el.style.display = 'none';
          }
        });
      } catch (e) {}
    }
    window.__hideMapAttribution = hideMapAttributionLayers;

    function gmInit() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ${chromelessOpts}
      });
      window.__gmMap = map;
      window.__setGuideCamera = function (cam) {
        if (!window.__gmMap || !cam) return;
        var m = window.__gmMap;
        if (typeof cam.lat === 'number' && typeof cam.lng === 'number') {
          m.setCenter({ lat: Number(cam.lat), lng: Number(cam.lng) });
          if (typeof cam.zoom === 'number' && isFinite(cam.zoom)) m.setZoom(cam.zoom);
        }
        if (typeof cam.heading === 'number' && isFinite(cam.heading)) {
          m.setHeading(cam.heading);
        } else if (cam.resetHeading === true) {
          m.setHeading(0);
        }
      };
      if (google && google.maps && google.maps.event && map) {
        google.maps.event.addListener(map, 'tilesloaded', hideMapAttributionLayers);
      }
      hideMapAttributionLayers();
      map.setOptions({
        draggable: ${interactive ? "true" : "false"},
        scrollwheel: ${interactive ? "true" : "false"},
        disableDoubleClickZoom: ${interactive ? "false" : "true"},
        gestureHandling: ${interactive ? "'auto'" : "'none'"},
      });

      window.__applyRoute = function (spec) {
        if (!spec || !map) return;
        clearOverlays();
        var allowTap = spec.allowTap !== false;
        var avoidLineOverlap = spec.avoidLineOverlap === true;
        map.setOptions({ clickableIcons: allowTap });
        function separateOverlap(path) {
          if (!path || path.length < 3) return path || [];
          var seen = {};
          var out = path.map(function (p) {
            return { lat: Number(p.lat), lng: Number(p.lng) };
          });
          for (var i = 0; i < out.length; i++) {
            var p = out[i];
            var key = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
            var c = seen[key] || 0;
            seen[key] = c + 1;
            if (c === 0 || i === 0 || i === out.length - 1) continue;
            var prev = out[i - 1];
            var next = out[i + 1];
            if (!prev || !next) continue;
            var dx = next.lng - prev.lng;
            var dy = next.lat - prev.lat;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (!len || !isFinite(len)) continue;
            var nx = -dy / len;
            var ny = dx / len;
            var amp = Math.min(0.00018, 0.000055 * (c + 1));
            var sign = c % 2 === 0 ? 1 : -1;
            p.lat = p.lat + ny * amp * sign;
            p.lng = p.lng + nx * amp * sign;
          }
          return out;
        }
        var pathPts = Array.isArray(spec.path) ? spec.path : [];
        var segments = Array.isArray(spec.segments) ? spec.segments : [];
        var stopPts = Array.isArray(spec.stops) && spec.stops.length ? spec.stops : [];
        var markPts = Array.isArray(spec.markers) && spec.markers.length ? spec.markers : [];
        var linePath = pathPts.map(function (c) {
          return { lat: Number(c.lat), lng: Number(c.lng) };
        });
        if (avoidLineOverlap && linePath.length >= 24) {
          linePath = separateOverlap(linePath);
        }
        var markerPath = stopPts.length
          ? stopPts.map(function (c) {
              return { lat: Number(c.lat), lng: Number(c.lng) };
            })
          : linePath.length <= 24
            ? linePath
            : linePath.length >= 2
              ? [linePath[0], linePath[linePath.length - 1]]
              : linePath;
        var defaultCenter = { lat: spec.lat, lng: spec.lng };
        var gZoom = typeof spec.zoom === 'number' ? spec.zoom : 14;
        var anyLine = false;
        function addRoutePolyline(segPath, color, weight, dashed) {
          var poly = new google.maps.Polyline({
            path: segPath,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: dashed ? 0.88 : 0.96,
            strokeWeight: weight,
            icons: dashed
              ? [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      scale: 4,
                      strokeColor: color,
                    },
                    offset: '0',
                    repeat: '18px',
                  },
                ]
              : [],
            map: map,
          });
          polylines.push(poly);
        }
        if (segments.length >= 1) {
          var sortedSegs = segments.slice().sort(function (a, b) {
            return (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0);
          });
          for (var i = 0; i < sortedSegs.length; i++) {
            var seg = sortedSegs[i];
            var segPath = (seg.points || []).map(function (c) {
              return { lat: Number(c.lat), lng: Number(c.lng) };
            });
            if (avoidLineOverlap && segPath.length >= 24) {
              segPath = separateOverlap(segPath);
            }
            if (segPath.length < 2) continue;
            anyLine = true;
            addRoutePolyline(
              segPath,
              seg.color || '#2563eb',
              Number(seg.width) || 4,
              Boolean(seg.dashed),
            );
          }
        } else if (linePath.length >= 2) {
          anyLine = true;
          addRoutePolyline(linePath, '#ffffff', 6, false);
          addRoutePolyline(linePath, '#2563eb', 4, false);
        }
        if (anyLine) {
          var markerSource = markPts.length
            ? markPts
            : (markerPath || []).map(function (p) {
                return { lat: p.lat, lng: p.lng };
              });
          if (!Array.isArray(markerSource)) markerSource = [];
          markerSource.forEach(function (pos, idx) {
            var markerColor =
              pos.color ||
              (pos.kind === 'start'
                ? '#2563eb'
                : pos.kind === 'end'
                  ? '#ef4444'
                  : '#64748b');
            var markerScale = pos.kind === 'start' || pos.kind === 'end' ? 8.5 : 7.2;
            var m = new google.maps.Marker({
              position: { lat: Number(pos.lat), lng: Number(pos.lng) },
              map: map,
              clickable: allowTap,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: markerColor,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: markerScale,
              },
              label: pos.label
                ? {
                    text: String(pos.label),
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                  }
                : undefined,
              zIndex: 20 + idx,
            });
            markers.push(m);
          });
          var bounds = new google.maps.LatLngBounds();
          if (segments.length >= 1) {
            for (var j = 0; j < segments.length; j++) {
              var seg2 = segments[j];
              (seg2.points || []).forEach(function (p) {
                bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) });
              });
            }
          } else {
            linePath.forEach(function (p) {
              bounds.extend(p);
            });
          }
          markerSource.forEach(function (p) {
            bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) });
          });
          if (spec.followUser === true && typeof spec.lat === 'number' && typeof spec.lng === 'number') {
            map.setCenter({ lat: Number(spec.lat), lng: Number(spec.lng) });
            map.setZoom(typeof spec.followZoom === 'number' ? spec.followZoom : 17);
          } else if (spec.fitToRoute === false) {
            map.setCenter(defaultCenter);
            map.setZoom(gZoom);
          } else {
            map.fitBounds(bounds, 48);
          }
          if (typeof spec.mapHeading === 'number' && isFinite(spec.mapHeading)) {
            map.setHeading(spec.mapHeading);
          } else {
            map.setHeading(0);
          }
        } else if (linePath.length === 1) {
          map.setCenter(linePath[0]);
          map.setZoom(gZoom);
          markers.push(new google.maps.Marker({ position: linePath[0], map: map, clickable: allowTap }));
          if (typeof spec.mapHeading === 'number' && isFinite(spec.mapHeading)) {
            map.setHeading(spec.mapHeading);
          } else {
            map.setHeading(0);
          }
        } else {
          map.setCenter(defaultCenter);
          map.setZoom(gZoom);
          markers.push(new google.maps.Marker({ position: defaultCenter, map: map, clickable: allowTap }));
          if (typeof spec.mapHeading === 'number' && isFinite(spec.mapHeading)) {
            map.setHeading(spec.mapHeading);
          } else {
            map.setHeading(0);
          }
        }
        relayoutMap();
        hideMapAttributionLayers();
        setTimeout(relayoutMap, 50);
        setTimeout(relayoutMap, 200);
        setTimeout(hideMapAttributionLayers, 50);
        setTimeout(hideMapAttributionLayers, 250);
      };

      [0, 80, 250, 600].forEach(function (ms) {
        setTimeout(relayoutMap, ms);
      });
      window.addEventListener('resize', relayoutMap);
      if (typeof ResizeObserver !== 'undefined') {
        var el = document.getElementById('map');
        if (el) {
          var ro = new ResizeObserver(function () {
            relayoutMap();
          });
          ro.observe(el);
        }
      }

      if (window.__pendingSpec) {
        window.__applyRoute(window.__pendingSpec);
        window.__pendingSpec = null;
      }
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=gmInit"></script>
</head>
<body>
  <div id="map"></div>
</body>
</html>`;
}

function toLatLngJson(points: MapPathPoint[] | undefined): { lat: number; lng: number }[] {
  return (points ?? [])
    .filter((p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
    .map((p) => ({ lat: p.latitude, lng: p.longitude }));
}

function toMarkerJson(
  points: MapMarkerPoint[] | undefined,
): {
  lat: number;
  lng: number;
  label?: string;
  kind?: "start" | "waypoint" | "end";
  color?: string;
}[] {
  return (points ?? [])
    .filter((p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
    .map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      label: p.label,
      kind: p.kind,
      color: p.color,
    }));
}

function toSegmentsJson(segments: MapRouteSegment[] | undefined) {
  return (segments ?? [])
    .map((s) => ({
      id: s.id,
      color: s.color,
      width: s.width,
      dashed: Boolean(s.dashed),
      points: toLatLngJson(s.points),
    }))
    .filter((s) => s.points.length >= 2);
}

export default function GoogleMapWebView({
  latitude = 37.5665,
  longitude = 126.978,
  level = 8,
  zoom: zoomProp,
  fitToRoute = true,
  mapHeading,
  followUser = false,
  followZoom = 17,
  chromeless = true,
  interactive = true,
  allowTap = true,
  avoidLineOverlap = false,
  path,
  segments,
  stops,
  markers,
  style,
}: Props) {
  const apiKey = GOOGLE_MAPS_JS_API_KEY;

  const pathJson = useMemo(() => JSON.stringify(toLatLngJson(path)), [path]);
  const segmentsJson = useMemo(() => JSON.stringify(toSegmentsJson(segments)), [segments]);
  const stopsJson = useMemo(() => JSON.stringify(toLatLngJson(stops)), [stops]);
  const markersJson = useMemo(() => JSON.stringify(toMarkerJson(markers)), [markers]);

  const bootstrapHtml = useMemo(
    () =>
      apiKey ? buildGoogleBootstrapHtml(apiKey, chromeless, interactive) : '',
    [apiKey, chromeless, interactive],
  );

  const webRef = useRef(null);
  const mapDomReadyRef = useRef(false);
  const iframeRef = useRef(null);
  const [webIframeReady, setWebIframeReady] = useState(false);

  useEffect(() => {
    setWebIframeReady(false);
  }, [bootstrapHtml]);

  const injectSpecJs = useCallback(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const zoom =
      typeof zoomProp === "number" && Number.isFinite(zoomProp)
        ? Math.max(8, Math.min(20, zoomProp))
        : levelToGoogleZoom(level);
    const pathParsed = JSON.parse(pathJson);
    const segmentsParsed = JSON.parse(segmentsJson);
    const stopsParsed = JSON.parse(stopsJson);
    const markersParsed = JSON.parse(markersJson);
    const pathArr = Array.isArray(pathParsed) ? pathParsed : [];
    const segmentsArr = Array.isArray(segmentsParsed) ? segmentsParsed : [];
    const stopsArr = Array.isArray(stopsParsed) ? stopsParsed : [];
    const markersArr = Array.isArray(markersParsed) ? markersParsed : [];
    const spec = {
      lat,
      lng,
      zoom,
      fitToRoute,
      followUser,
      followZoom,
      // heading은 별도 가이드 카메라 주입에서만 처리 (재중심화 루프 방지)
      mapHeading: undefined,
      allowTap,
      avoidLineOverlap,
      path: pathArr,
      segments: segmentsArr,
      stops: stopsArr,
      markers: markersArr,
    };
    const embedded = JSON.stringify(JSON.stringify(spec));
    const code = `(function(){try{var spec=JSON.parse(${embedded});if(window.__applyRoute)window.__applyRoute(spec);else window.__pendingSpec=spec;if(window.__hideMapAttribution)window.__hideMapAttribution();}catch(e){}true;})();`;
    if (Platform.OS === 'web') {
      try {
        const w = iframeRef.current?.contentWindow;
        if (!w) return;
        if (typeof w.__applyRoute === 'function') w.__applyRoute(spec);
        else w.__pendingSpec = spec;
      } catch (_) {}
      return;
    }
    webRef.current?.injectJavaScript(code);
  }, [
    latitude,
    longitude,
    level,
    zoomProp,
    fitToRoute,
    followUser,
    followZoom,
    allowTap,
    avoidLineOverlap,
    pathJson,
    segmentsJson,
    stopsJson,
    markersJson,
  ]);

  useEffect(() => {
    if (!mapDomReadyRef.current && Platform.OS !== 'web') return;
    if (Platform.OS === 'web' && !webIframeReady) return;
    injectSpecJs();
  }, [injectSpecJs, webIframeReady]);

  const injectGuideCameraJs = useCallback(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const zoom =
      typeof zoomProp === 'number' && Number.isFinite(zoomProp)
        ? Math.max(8, Math.min(20, zoomProp))
        : levelToGoogleZoom(level);
    const cam = {
      lat,
      lng,
      zoom: followUser ? (followZoom ?? zoom) : zoom,
      heading:
        typeof mapHeading === 'number' && Number.isFinite(mapHeading)
          ? mapHeading
          : null,
      resetHeading: !(typeof mapHeading === 'number' && Number.isFinite(mapHeading)),
    };
    const embedded = JSON.stringify(JSON.stringify(cam));
    const code = `(function(){try{var cam=JSON.parse(${embedded});if(window.__setGuideCamera)window.__setGuideCamera(cam);}catch(e){}true;})();`;
    if (Platform.OS === 'web') {
      try {
        const w = iframeRef.current?.contentWindow;
        if (w?.__setGuideCamera) w.__setGuideCamera(cam);
      } catch (_) {}
      return;
    }
    webRef.current?.injectJavaScript(code);
  }, [latitude, longitude, level, zoomProp, followUser, followZoom, mapHeading]);

  useEffect(() => {
    if (!mapDomReadyRef.current && Platform.OS !== 'web') return;
    if (Platform.OS === 'web' && !webIframeReady) return;
    if (!followUser) return;
    injectGuideCameraJs();
  }, [injectGuideCameraJs, webIframeReady, followUser]);

  const onWebViewLoadEnd = useCallback(() => {
    mapDomReadyRef.current = true;
    injectSpecJs();
  }, [injectSpecJs]);

  const onMapContainerLayout = useCallback((_e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      webRef.current?.injectJavaScript(
        '(function(){try{if(window.__gmRelayout)window.__gmRelayout();if(window.__hideMapAttribution)window.__hideMapAttribution();}catch(e){}true;})();',
      );
    });
  }, []);

  if (!apiKey) {
    return (
      <View
        style={[
          { flex: 1, backgroundColor: '#f3f4f6', padding: 16, justifyContent: 'center' },
          style,
        ]}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
          지도를 불러오려면 API 키가 필요해요
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 20 }}>
          .env에 EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY를 설정하고, 콘솔에서
          Maps JavaScript API를 활성화해 주세요.
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1, backgroundColor: '#e5e7eb' }, style]}>
        <iframe
          ref={iframeRef}
          title="map"
          srcDoc={bootstrapHtml}
          onLoad={() => setWebIframeReady(true)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </View>
    );
  }

  return (
    <View
      style={[{ flex: 1, backgroundColor: '#e5e7eb' }, style]}
      collapsable={false}
      onLayout={onMapContainerLayout}
    >
      <WebView
        ref={webRef}
        style={{ flex: 1, backgroundColor: '#e5e7eb' }}
        source={{ html: bootstrapHtml }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        cacheEnabled
        androidLayerType="software"
        onLoadEnd={onWebViewLoadEnd}
      />
    </View>
  );
}
