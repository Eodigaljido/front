// @ts-nocheck — WebView/iframe window 확장 필드
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, Platform, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_MAP_JS_KEY } from '../constants/kakao';
import type { MapPathPoint } from './mapTypes';

export type { MapPathPoint };

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  /** 2개 이상이면 파란 루트 선(폴리라인) + 각 정점 마커 */
  path?: MapPathPoint[];
  style?: object;
};

/** SDK는 한 번만 로드 — 이후 경로/중심은 injectJavaScript로만 갱신 (전체 리로드 방지) */
function buildStaticBootstrapHtml(appKey: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false"></script>
  <style>
    html, body, #map { width:100%; height:100%; margin:0; padding:0; background:#dbe4ec; }
    #map a[href*="map.kakao.com"],
    #map a[href*="kakao.com"],
    #map a[href*="daum.net"] { display:none !important; visibility:hidden !important; width:0 !important; height:0 !important; overflow:hidden !important; pointer-events:none !important; }
    #map img[src*="logo"],
    #map img[src*="bi_"],
    #map img[alt*="kakao"],
    #map img[alt*="Kakao"] { display:none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function hideKakaoChrome() {
      var root = document.getElementById('map');
      if (!root) return;
      var as = root.querySelectorAll('a');
      for (var i = 0; i < as.length; i++) {
        var h = (as[i].getAttribute('href') || '');
        if (h.indexOf('kakao') !== -1 || h.indexOf('daum') !== -1) {
          as[i].style.cssText = 'display:none!important;visibility:hidden!important;width:0!important;height:0!important;';
        }
      }
      var imgs = root.querySelectorAll('img');
      for (var j = 0; j < imgs.length; j++) {
        var s = (imgs[j].getAttribute('src') || '') + (imgs[j].getAttribute('alt') || '');
        if (/logo|kakao|daum|bi_/i.test(s)) imgs[j].style.display = 'none';
      }
    }
    window.__pendingSpec = null;
    kakao.maps.load(function () {
      var map = new kakao.maps.Map(
        document.getElementById('map'),
        { center: new kakao.maps.LatLng(35.1796, 129.0756), level: 8 }
      );
      var poly = null;
      var markers = [];
      function clearOverlays() {
        if (poly) { poly.setMap(null); poly = null; }
        for (var i = 0; i < markers.length; i++) markers[i].setMap(null);
        markers = [];
      }
      try {
        if (typeof map.setCopyrightPosition === 'function' && kakao.maps.CopyrightPosition) {
          var CP = kakao.maps.CopyrightPosition;
          if (CP.HIDDEN !== undefined) map.setCopyrightPosition(CP.HIDDEN);
        }
      } catch (e) {}
      kakao.maps.event.addListener(map, 'tilesloaded', hideKakaoChrome);
      setTimeout(hideKakaoChrome, 300);
      setTimeout(hideKakaoChrome, 1200);

      function relayoutMap() {
        try {
          if (map && typeof map.relayout === 'function') map.relayout();
        } catch (e) {}
      }
      window.__kakaoRelayout = relayoutMap;
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

      window.__applyRoute = function (spec) {
        if (!spec) return;
        clearOverlays();
        var pathPts = spec.path || [];
        var defaultCenter = new kakao.maps.LatLng(spec.lat, spec.lng);
        var linePath = pathPts.map(function (c) {
          return new kakao.maps.LatLng(c.lat, c.lng);
        });
        if (linePath.length >= 2) {
          poly = new kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 5,
            strokeColor: '#2563eb',
            strokeOpacity: 0.92,
            strokeStyle: 'solid',
          });
          poly.setMap(map);
          linePath.forEach(function (pos) {
            var m = new kakao.maps.Marker({ position: pos });
            m.setMap(map);
            markers.push(m);
          });
          var bounds = new kakao.maps.LatLngBounds();
          linePath.forEach(function (p) { bounds.extend(p); });
          map.setBounds(bounds);
        } else if (linePath.length === 1) {
          map.setCenter(linePath[0]);
          map.setLevel(spec.level);
          var mk = new kakao.maps.Marker({ position: linePath[0] });
          mk.setMap(map);
          markers.push(mk);
        } else {
          map.setCenter(defaultCenter);
          map.setLevel(spec.level);
          var mk2 = new kakao.maps.Marker({ position: defaultCenter });
          mk2.setMap(map);
          markers.push(mk2);
        }
        hideKakaoChrome();
        relayoutMap();
        setTimeout(relayoutMap, 50);
        setTimeout(relayoutMap, 200);
      };

      if (window.__pendingSpec) {
        window.__applyRoute(window.__pendingSpec);
        window.__pendingSpec = null;
      }
    });
  </script>
</body>
</html>`;
}

export default function KakaoMapWebView({
  latitude = 37.5665,
  longitude = 126.978,
  level = 3,
  path,
  style,
}: Props) {
  const appKey = KAKAO_MAP_JS_KEY;

  const pathJson = useMemo(() => {
    const pts = (path ?? [])
      .filter((p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({ lat: p.latitude, lng: p.longitude }));
    return JSON.stringify(pts);
  }, [path]);

  const bootstrapHtml = useMemo(() => (appKey ? buildStaticBootstrapHtml(appKey) : ''), [appKey]);

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
    const lv = Number(level);
    const pathArr = JSON.parse(pathJson);
    const payload = `{lat:${lat},lng:${lng},level:${lv},path:${pathJson}}`;
    const code = `(function(){var spec=${payload};if(window.__applyRoute)window.__applyRoute(spec);else window.__pendingSpec=spec;true;})();`;
    if (Platform.OS === 'web') {
      try {
        const w = iframeRef.current?.contentWindow;
        if (!w) return;
        const spec = { lat, lng, level: lv, path: pathArr };
        if (typeof w.__applyRoute === 'function') w.__applyRoute(spec);
        else w.__pendingSpec = spec;
      } catch (_) {
        /* iframe 미준비 */
      }
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

  /** RN 레이아웃(특히 flex·absolute) 확정 후 WebView 내부 지도 크기 재계산 — 미호출 시 줌할 때만 타일이 잠깐 보이는 현상이 납니다. */
  const onMapContainerLayout = useCallback((_e: LayoutChangeEvent) => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      webRef.current?.injectJavaScript(
        '(function(){try{if(window.__kakaoRelayout)window.__kakaoRelayout();}catch(e){}true;})();',
      );
    });
  }, []);

  if (!appKey) {
    return (
      <View style={[{ flex: 1, backgroundColor: '#f3f4f6', padding: 16, justifyContent: 'center' }, style]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
          카카오 지도 키가 필요해요
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', lineHeight: 20 }}>
          .env에 EXPO_PUBLIC_KAKAO_MAP_JS_KEY 값을 넣고 서버를 다시 실행하세요.
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1, backgroundColor: '#dbe4ec' }, style]}>
        <iframe
          ref={iframeRef}
          title="kakao-map"
          srcDoc={bootstrapHtml}
          onLoad={() => setWebIframeReady(true)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </View>
    );
  }

  return (
    <View
      style={[{ flex: 1, backgroundColor: '#dbe4ec' }, style]}
      collapsable={false}
      onLayout={onMapContainerLayout}
    >
      <WebView
        ref={webRef}
        style={{ flex: 1, backgroundColor: '#dbe4ec' }}
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
