// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { appAlert } from '../utils/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { deleteMyAccount, getMyProfile } from '../api/users';
import { linkKakao, unlinkKakao, linkGoogle, unlinkGoogle } from '../api/auth';
import { signInWithGoogleNative } from '../utils/googleSignIn';
import OAuthWebViewModal from '../components/OAuthWebViewModal';

import { getKakaoOAuthRestApiKey } from '../constants/kakao';

const KAKAO_REST_KEY = getKakaoOAuthRestApiKey();
const KAKAO_REDIRECT_URI = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI ?? '';
const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_KEY}` +
  `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
  `&response_type=code`;

const SECTION_STYLE = {
  borderWidth: 0.5,
  borderColor: 'rgba(37,99,235,0.12)',
  borderRadius: 16,
  backgroundColor: '#fff',
};

const DANGER_SECTION_STYLE = {
  borderWidth: 1,
  borderColor: '#fecaca',
  borderRadius: 16,
  backgroundColor: '#fff',
};

export default function AccountSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const logout = useAuthStore(s => s.logout);
  const authUser = useAuthStore(s => s.user);
  const [emailInput, setEmailInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [kakaoModalVisible, setKakaoModalVisible] = useState(false);
  const [linkBusy, setLinkBusy] = useState<null | 'kakao' | 'google'>(null);
  const [loginMethods, setLoginMethods] = useState<string[] | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const me = await getMyProfile();
      setLoginMethods(Array.isArray(me.loginMethods) ? me.loginMethods : []);
    } catch {
      // 상태 조회 실패 시 버튼은 표시하지 않음
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const kakaoLinked = loginMethods?.includes('KAKAO') ?? false;
  const googleLinked = loginMethods?.includes('GOOGLE') ?? false;
  const statusReady = loginMethods != null;

  const handleKakaoCode = async (code: string) => {
    setKakaoModalVisible(false);
    setLinkBusy('kakao');
    try {
      await linkKakao({ code, redirectUri: KAKAO_REDIRECT_URI });
      await loadStatus();
      appAlert('연동 완료', '카카오 계정이 연동되었습니다.');
    } catch (e: any) {
      appAlert('연동 실패', e?.response?.data?.message ?? e?.message ?? '카카오 연동에 실패했습니다.');
    } finally {
      setLinkBusy(null);
    }
  };

  const handleUnlinkKakao = () => {
    appAlert('카카오 연동 해제', '카카오 계정 연동을 해제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        style: 'destructive',
        onPress: async () => {
          setLinkBusy('kakao');
          try {
            await unlinkKakao();
            await loadStatus();
            appAlert('해제 완료', '카카오 연동이 해제되었습니다.');
          } catch (e: any) {
            appAlert(
              '해제 실패',
              e?.response?.data?.message ?? e?.message ?? '카카오 연동 해제에 실패했습니다.',
            );
          } finally {
            setLinkBusy(null);
          }
        },
      },
    ]);
  };

  const handleLinkGoogle = async () => {
    if (linkBusy) return;
    setLinkBusy('google');
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (result.reason !== 'cancelled') {
          appAlert('연동 실패', result.message ?? '구글 로그인에 실패했습니다.');
        }
        return;
      }
      await linkGoogle({ idToken: result.idToken });
      await loadStatus();
      appAlert('연동 완료', '구글 계정이 연동되었습니다.');
    } catch (e: any) {
      appAlert('연동 실패', e?.response?.data?.message ?? e?.message ?? '구글 연동에 실패했습니다.');
    } finally {
      setLinkBusy(null);
    }
  };

  const handleUnlinkGoogle = () => {
    appAlert('구글 연동 해제', '구글 계정 연동을 해제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        style: 'destructive',
        onPress: async () => {
          setLinkBusy('google');
          try {
            await unlinkGoogle();
            await loadStatus();
            appAlert('해제 완료', '구글 연동이 해제되었습니다.');
          } catch (e: any) {
            appAlert(
              '해제 실패',
              e?.response?.data?.message ?? e?.message ?? '구글 연동 해제에 실패했습니다.',
            );
          } finally {
            setLinkBusy(null);
          }
        },
      },
    ]);
  };

  const userEmail = authUser?.email ?? '';
  const emailMatches = emailInput.trim() === userEmail;

  const resetToLogin = () => {
    navigation
      .getParent()
      ?.getParent()
      ?.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleLogout = () => {
    appAlert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          resetToLogin();
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (!emailMatches || deleting) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      await logout();
      resetToLogin();
    } catch (e: any) {
      appAlert('오류', e?.response?.data?.message ?? e?.message ?? '회원 탈퇴에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top']}>
      <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#F0F5FF] px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">계정 설정</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 소셜 계정 연동 */}
        <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          소셜 계정 연동
        </Text>
        <View style={SECTION_STYLE} className="px-4 py-1">
          {/* 카카오 */}
          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-3">
              <View
                className="items-center justify-center w-8 h-8 rounded-full"
                style={{ backgroundColor: '#FEE500' }}
              >
                <Ionicons name="chatbubble" size={16} color="#3C1E1E" />
              </View>
              <Text className="text-[15px] font-semibold text-gray-800">카카오</Text>
            </View>
            {!statusReady ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : kakaoLinked ? (
              <Pressable
                onPress={handleUnlinkKakao}
                disabled={linkBusy != null}
                className="items-center justify-center px-3.5 py-2 border border-gray-200 rounded-xl active:opacity-70 disabled:opacity-40"
              >
                {linkBusy === 'kakao' ? (
                  <ActivityIndicator size="small" color="#9ca3af" />
                ) : (
                  <Text className="text-sm font-semibold text-gray-500">해제</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setKakaoModalVisible(true)}
                disabled={linkBusy != null}
                className="items-center justify-center px-3.5 py-2 rounded-xl active:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#2563eb' }}
              >
                {linkBusy === 'kakao' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">연동</Text>
                )}
              </Pressable>
            )}
          </View>

          <View style={{ height: 0.5, backgroundColor: 'rgba(37,99,235,0.1)' }} />

          {/* 구글 */}
          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center w-8 h-8 border border-gray-200 rounded-full bg-white">
                <Ionicons name="logo-google" size={16} color="#EA4335" />
              </View>
              <Text className="text-[15px] font-semibold text-gray-800">구글</Text>
            </View>
            {!statusReady ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : googleLinked ? (
              <Pressable
                onPress={handleUnlinkGoogle}
                disabled={linkBusy != null}
                className="items-center justify-center px-3.5 py-2 border border-gray-200 rounded-xl active:opacity-70 disabled:opacity-40"
              >
                {linkBusy === 'google' ? (
                  <ActivityIndicator size="small" color="#9ca3af" />
                ) : (
                  <Text className="text-sm font-semibold text-gray-500">해제</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleLinkGoogle}
                disabled={linkBusy != null}
                className="items-center justify-center px-3.5 py-2 rounded-xl active:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#2563eb' }}
              >
                {linkBusy === 'google' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">연동</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* 로그아웃 */}
        <Text className="mt-8 mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          계정
        </Text>
        <View style={SECTION_STYLE} className="px-4 py-1">
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center justify-between py-4 active:opacity-70"
          >
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center w-8 h-8 rounded-full bg-red-50">
                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              </View>
              <Text className="text-[15px] font-semibold text-red-500">로그아웃</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </Pressable>
        </View>

        {/* 회원 탈퇴 */}
        <Text className="mt-8 mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          위험 구역
        </Text>
        <View style={DANGER_SECTION_STYLE} className="px-4 py-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="warning-outline" size={20} color="#ef4444" />
            <Text className="text-base font-bold text-gray-900">계정 영구 삭제</Text>
          </View>

          <Text className="mb-1 text-sm leading-5 text-gray-600">
            계정을 삭제하면 모든 데이터가{' '}
            <Text className="font-semibold text-red-500">영구적으로 제거</Text>되며 복구할 수
            없습니다.
          </Text>
          <Text className="mb-5 text-sm leading-5 text-gray-500">
            루트, 친구, 채팅 기록 등 모든 정보가 삭제됩니다.
          </Text>

          <View className="px-3 py-2 mb-2 rounded-xl bg-gray-50">
            <Text className="text-xs font-semibold text-gray-500">
              삭제를 확인하려면 아래에 이메일 주소를 입력하세요
            </Text>
            <Text className="mt-0.5 text-xs font-bold text-gray-800">{userEmail}</Text>
          </View>

          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="이메일 주소 입력"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            className="px-4 py-3 mb-4 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl"
            style={
              emailInput.length > 0 ? { borderColor: emailMatches ? '#86efac' : '#fca5a5' } : {}
            }
          />

          {emailInput.length > 0 && !emailMatches && (
            <Text className="mb-3 text-xs text-red-400">이메일이 일치하지 않습니다.</Text>
          )}

          <Pressable
            onPress={handleDeleteAccount}
            disabled={!emailMatches || deleting}
            className="items-center rounded-xl py-3.5 active:opacity-80"
            style={{ backgroundColor: emailMatches ? '#ef4444' : '#f3f4f6' }}
          >
            <Text
              className="text-[15px] font-semibold"
              style={{ color: emailMatches ? '#fff' : '#9ca3af' }}
            >
              {deleting ? '처리 중...' : '계정 영구 삭제'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {kakaoModalVisible && (
        <OAuthWebViewModal
          visible
          authUrl={KAKAO_AUTH_URL}
          redirectUri={KAKAO_REDIRECT_URI}
          onCode={handleKakaoCode}
          onClose={() => setKakaoModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}
