import { useEffect, useRef } from 'react';
import { Modal, View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  oauthRedirectMatches,
  parseOAuthCodeFromUrl,
} from '../utils/oauthRedirect';

interface Props {
  visible: boolean;
  authUrl: string;
  redirectUri: string;
  onCode: (code: string) => void;
  onClose: () => void;
}

export default function OAuthWebViewModal({ visible, authUrl, redirectUri, onCode, onClose }: Props) {
  const handled = useRef(false);

  useEffect(() => {
    if (visible) handled.current = false;
  }, [visible, authUrl, redirectUri]);

  function handleNavigation(navState: WebViewNavigation) {
    const { url } = navState;
    if (!oauthRedirectMatches(url, redirectUri)) return false;

    if (!handled.current) {
      handled.current = true;
      const code = parseOAuthCodeFromUrl(url);
      if (code) {
        onCode(code);
      } else {
        onClose();
      }
    }
    return true;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.close}>✕ 닫기</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: authUrl }}
          onShouldStartLoadWithRequest={navState => {
            if (oauthRedirectMatches(navState.url, redirectUri)) {
              handleNavigation(navState);
              return false;
            }
            return true;
          }}
          onNavigationStateChange={navState => {
            if (oauthRedirectMatches(navState.url, redirectUri)) {
              handleNavigation(navState);
            }
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          )}
          style={styles.webview}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  close: { fontSize: 14, color: '#374151' },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
