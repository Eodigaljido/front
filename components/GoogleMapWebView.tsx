// @ts-nocheck — WebView/iframe + Google Maps JavaScript API
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, Platform, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { GOOGLE_MAPS_JS_API_KEY } from '../constants/googleMaps';
import type { MapPathPoint } from './mapTypes';

export type { MapPathPoint };

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  path?: MapPathPoint[];
  style?: object;
};

/** 기존 화면에서 쓰던 레벨 값 → Google zoom */
function levelToGoogleZoom(level: number): number {
  const lv = Math.max(1, Math.min(14, Number(level) || 8));
  return Math.max(8, Math.min(18, 20 - lv));
}

function buildGoogleBootstrapHtml(apiKey: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { width:100%; height:100%; margin:0; padding:0; background:#e5e7eb; }
  </style>
  <script>
    var map = null;
    var polyline = null;
    var markers = [];
    function clearOverlays() {
      if (polyline) { polyline.setMap(null); polyline = null; }
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

    function gmInit() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      window.__applyRoute = function (spec) {
        if (!spec || !map) return;
        clearOverlays();
        var pathPts = spec.path || [];
        var linePath = pathPts.map(function (c) {
          return { lat: c.lat, lng: c.lng };
        });
        var defaultCenter = { lat: spec.lat, lng: spec.lng };
        var gZoom = typeof spec.zoom === 'number' ? spec.zoom : 14;
        if (linePath.length >= 2) {
          polyline = new google.maps.Polyline({
            path: linePath,
            geodesic: true,
            strokeColor: '#2563eb',
            strokeOpacity: 0.92,
            strokeWeight: 5,
            map: map,
          });
          linePath.forEach(function (pos) {
            var m = new google.maps.Marker({ position: pos, map: map });
            markers.push(m);
          });
          var bounds = new google.maps.LatLngBounds();
          linePath.forEach(function (p) {
            bounds.extend(p);
          });
          map.fitBounds(bounds, 48);
        } else if (linePath.length === 1) {
          map.setCenter(linePath[0]);
          map.setZoom(gZoom);
          markers.push(new google.maps.Marker({ position: linePath[0], map: map }));
        } else {
          map.setCenter(defaultCenter);
          map.setZoom(gZoom);
          markers.push(new google.maps.Marker({ position: defaultCenter, map: map }));
        }
        relayoutMap();
        setTimeout(relayoutMap, 50);
        setTimeout(relayoutMap, 200);
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

export default function GoogleMapWebView({
  latitude = 37.5665,
  longitude = 126.978,
  level = 8,
  path,
  style,
}: Props) {
  const apiKey = GOOGLE_MAPS_JS_API_KEY;

  const pathJson = useMemo(() => {
    const pts = (path ?? [])
      .filter((p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({ lat: p.latitude, lng: p.longitude }));
    return JSON.stringify(pts);
  }, [path]);

  const bootstrapHtml = useMemo(() => (apiKey ? buildGoogleBootstrapHtml(apiKey) : ''), [apiKey]);

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
    const zoom = levelToGoogleZoom(level);
    const pathArr = JSON.parse(pathJson);
    const payload = `{lat:${lat},lng:${lng},zoom:${zoom},path:${pathJson}}`;
    const code = `(function(){var spec=${payload};if(window.__applyRoute)window.__applyRoute(spec);else window.__pendingSpec=spec;true;})();`;
    if (Platform.OS === 'web') {
      try {
        const w = iframeRef.current?.contentWindow;
        if (!w) return;
        const spec = { lat, lng, zoom, path: pathArr };
        if (typeof w.__applyRoute === 'function') w.__applyRoute(spec);
        else w.__pendingSpec = spec;
      } catch (_) {}
      return;
    }
    webRef.current?.injectJavaScript(code);
  }, [latitude, longitude, level, pathJson]);

  useEffect(() => {
    if (!mapDomReadyRef.current && Platform.OS !== 'web') return;
    if (Platform.OS === 'web' && !webIframeReady) return;
    injectSpecJs();
  }, [injectSpecJs, webIframeReady]);

  const onWebViewLoadEnd = useCallback(() => {
    mapDomReadyRef.current = true;
    injectSpecJs();
  }, [injectSpecJs]);

  const onMapContainerLayout = useCallback((_e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      webRef.current?.injectJavaScript(
        '(function(){try{if(window.__gmRelayout)window.__gmRelayout();}catch(e){}true;})();',
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
          Google Maps API 키가 필요해요
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 20 }}>
          .env에 EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY(또는 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)를 넣고, Cloud Console에서
          Maps JavaScript API를 켜 주세요. Android 네이티브는 EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY가 별도로 필요할 수
          있어요.
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1, backgroundColor: '#e5e7eb' }, style]}>
        <iframe
          ref={iframeRef}
          title="google-map"
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
