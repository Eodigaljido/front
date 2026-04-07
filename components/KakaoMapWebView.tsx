// @ts-nocheck
import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_MAP_JS_KEY } from '../constants/kakao';

type Props = {
  latitude?: number;
  longitude?: number;
  level?: number;
  style?: object;
};

export default function KakaoMapWebView({
  latitude = 37.5665,
  longitude = 126.978,
  level = 3,
  style,
}: Props) {
  const appKey = KAKAO_MAP_JS_KEY;

  const html = useMemo(() => {
    if (!appKey) return '';
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html, body, #map { width:100%; height:100%; margin:0; padding:0; }</style>
  <script>
    function initMap() {
      kakao.maps.load(function () {
        var map = new kakao.maps.Map(
          document.getElementById('map'),
          {
            center: new kakao.maps.LatLng(${latitude}, ${longitude}),
            level: ${level}
          }
        );
        var marker = new kakao.maps.Marker({ position: map.getCenter() });
        marker.setMap(map);
      });
    }
  </script>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false" onload="initMap()"></script>
</head>
<body>
  <div id="map"></div>
</body>
</html>`;
  }, [appKey, latitude, longitude, level]);

  if (!appKey) {
    return (
      <View
        style={[
          { flex: 1, backgroundColor: '#f3f4f6', padding: 16, justifyContent: 'center' },
          style,
        ]}
      >
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
      <View style={[{ flex: 1, backgroundColor: '#0f172a' }, style]}>
        <iframe
          title="kakao-map"
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </View>
    );
  }

  return (
    <WebView
      style={[{ flex: 1, backgroundColor: '#0f172a' }, style]}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      setSupportMultipleWindows={false}
    />
  );
}
