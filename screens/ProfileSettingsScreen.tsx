// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { safeGoBack } from '../navigation/rootNavigation';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import {
  deleteMyAccount,
  deleteMyProfileImage,
  getMyProfile,
  patchMyPhone,
  patchMyProfile,
  patchMyProfileImage,
} from '../api/users';
import { sendPhoneCode, verifyPhoneCode } from '../api/auth/phone';
import { bustProfileImageUri } from '../utils/profileImageUri';
import ProfileAvatar from '../components/ProfileAvatar';

const DEFAULT_AVATAR_URI = '';

export default function ProfileSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const bumpProfileImageCache = useAuthStore(s => s.bumpProfileImageCache);
  const profileImageCacheBust = useAuthStore(s => s.profileImageCacheBust);
  const logout = useAuthStore(s => s.logout);

  const [avatarUri, setAvatarUri] = useState<string>(DEFAULT_AVATAR_URI);
  const [pickingImage, setPickingImage] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

  // 전화번호 인증 상태
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyProfileToForm = useCallback(
    (me: Awaited<ReturnType<typeof getMyProfile>>, cacheKey?: number) => {
      setNickname(me.nickname ?? '');
      setEmail(me.email ?? '');
      setBio((me.bio ?? me.introduction ?? '').trim());
      setPhone(me.phone ?? '');
      setOriginalPhone(me.phone ?? '');
      const bust = cacheKey ?? profileImageCacheBust;
      setAvatarUri(
        me.profileImageUrl
          ? bustProfileImageUri(me.profileImageUrl, bust)
          : DEFAULT_AVATAR_URI,
      );
    },
    [profileImageCacheBust],
  );

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const me = await getMyProfile();
      applyProfileToForm(me);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '프로필을 불러오지 못했습니다.');
    } finally {
      setLoadingProfile(false);
    }
  }, [applyProfileToForm, refreshProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickFromGallery = useCallback(async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '권한 필요',
          '갤러리에서 사진을 선택하려면 사진 라이브러리 접근을 허용해 주세요.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        const updated = await patchMyProfileImage({
          uri: asset.uri,
          name: asset.fileName ?? 'profile.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        });
        const cacheKey = Date.now();
        bumpProfileImageCache();
        const remote = updated.profileImageUrl
          ? bustProfileImageUri(updated.profileImageUrl, cacheKey)
          : '';
        setAvatarUri(remote || asset.uri);
        await refreshProfile();
        showToast('프로필 사진을 변경했어요');
      }
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '이미지를 변경하지 못했습니다.');
    } finally {
      setPickingImage(false);
    }
  }, [pickingImage, bumpProfileImageCache, refreshProfile, showToast]);

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCodeTimer(seconds);
    timerRef.current = setInterval(() => {
      setCodeTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleSendPhoneCode = useCallback(async () => {
    if (phoneSending) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert('입력 확인', '전화번호를 입력해 주세요.');
      return;
    }
    setPhoneSending(true);
    try {
      const res = await sendPhoneCode({ phone: trimmed, purpose: 'CHANGE_PHONE' });
      setPhoneCodeSent(true);
      setPhoneVerified(false);
      setPhoneCode('');
      startTimer(res.expiresInSeconds ?? 180);
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '인증번호 발송에 실패했습니다.');
    } finally {
      setPhoneSending(false);
    }
  }, [phoneSending, phone, startTimer]);

  const handleVerifyPhoneCode = useCallback(async () => {
    if (phoneVerifying) return;
    if (!phoneCode.trim()) {
      Alert.alert('입력 확인', '인증번호를 입력해 주세요.');
      return;
    }
    setPhoneVerifying(true);
    try {
      await verifyPhoneCode({ phone: phone.trim(), code: phoneCode.trim(), purpose: 'CHANGE_PHONE' });
      setPhoneVerified(true);
      setPhoneCodeSent(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setCodeTimer(0);
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '인증번호 확인에 실패했습니다.');
    } finally {
      setPhoneVerifying(false);
    }
  }, [phoneVerifying, phone, phoneCode]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!nickname.trim()) {
      Alert.alert('입력 확인', '닉네임을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchMyProfile({
        nickname: nickname.trim(),
        bio: bio.trim(),
      });
      const phoneTrimmed = phone.trim();
      if (phoneTrimmed && phoneTrimmed !== originalPhone) {
        if (!phoneVerified) {
          Alert.alert('인증 필요', '변경된 전화번호는 인증 후 저장할 수 있습니다.');
          setSaving(false);
          return;
        }
        await patchMyPhone(phoneTrimmed);
        setOriginalPhone(phoneTrimmed);
        setPhoneVerified(false);
      } else if (phoneTrimmed && phoneTrimmed === originalPhone) {
        // 번호 변경 없음 — 그대로 유지
      }
      await refreshProfile();
      showToast('저장 완료');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '저장하지 못했어요';
      showToast(msg);
    } finally {
      setSaving(false);
    }
  }, [saving, nickname, bio, phone, originalPhone, phoneVerified, refreshProfile, showToast]);

  const handleDeleteProfileImage = useCallback(async () => {
    try {
      const updated = await deleteMyProfileImage();
      bumpProfileImageCache();
      setAvatarUri(
        updated.profileImageUrl
          ? bustProfileImageUri(updated.profileImageUrl, Date.now())
          : DEFAULT_AVATAR_URI,
      );
      await refreshProfile();
      showToast('기본 프로필 이미지로 변경했어요');
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '프로필 이미지를 삭제하지 못했습니다.');
    }
  }, [bumpProfileImageCache, refreshProfile, showToast]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      '회원 탈퇴',
      '정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (e: any) {
              Alert.alert('오류', e?.response?.data?.message ?? e?.message ?? '회원 탈퇴에 실패했습니다.');
            }
          },
        },
      ],
    );
  }, [logout, navigation]);

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#F0F5FF] px-4 py-3">
          <Pressable
            onPress={() => safeGoBack(navigation)}
            className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white active:opacity-80"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color="#f97316" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-gray-900">프로필 설정</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-6">
            <View className="relative" style={{ width: 96, height: 96 }}>
              <ProfileAvatar uri={avatarUri} size={96} />
              {loadingProfile ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.65)',
                  }}
                >
                  <ActivityIndicator size="small" color="#111827" />
                </View>
              ) : null}
              <Pressable
                onPress={pickFromGallery}
                disabled={pickingImage}
                className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-800 active:opacity-90 disabled:opacity-50"
              >
                {pickingImage ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="images-outline" size={16} color="#fff" />
                )}
              </Pressable>
            </View>
            <Pressable
              onPress={pickFromGallery}
              disabled={pickingImage}
              className="mt-3 active:opacity-70 disabled:opacity-50"
            >
              <Text className="text-sm font-semibold text-blue-600">갤러리에서 사진 선택</Text>
            </Pressable>
            <Pressable onPress={handleDeleteProfileImage} className="mt-2 active:opacity-70">
              <Text className="text-xs font-semibold text-gray-500">기본 이미지로 변경</Text>
            </Pressable>
            <Text className="mt-2 text-center text-xs text-gray-500">
              사진은 다른 유저에게 프로필에 표시됩니다.
            </Text>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-2">
            <Text className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              기본 정보
            </Text>

            <View className="border-b border-gray-100 py-3">
              <Text className="mb-1.5 text-xs text-gray-500">닉네임</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor="#9ca3af"
                className="text-base font-semibold text-gray-900"
              />
            </View>

            <View className="border-b border-gray-100 py-3">
              <Text className="mb-1.5 text-xs text-gray-500">이메일</Text>
              <Text className="text-base text-gray-600">{email}</Text>
              <Text className="mt-1 text-[11px] text-gray-400">로그인 계정 이메일은 변경할 수 없습니다.</Text>
            </View>

            <View className="py-3">
              <Text className="mb-1.5 text-xs text-gray-500">한 줄 소개</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="다른 사람에게 보여줄 짧은 소개를 입력해 보세요."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                className="min-h-[72px] text-base text-gray-900"
                textAlignVertical="top"
              />
            </View>

            <View className="border-t border-gray-100 py-3">
              <Text className="mb-1.5 text-xs text-gray-500">전화번호</Text>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={phone}
                  onChangeText={v => {
                    setPhone(v);
                    setPhoneVerified(false);
                    setPhoneCodeSent(false);
                    setPhoneCode('');
                    if (timerRef.current) clearInterval(timerRef.current);
                    setCodeTimer(0);
                  }}
                  placeholder="010-0000-0000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  className="flex-1 text-base font-semibold text-gray-900"
                />
                {phoneVerified || (!!originalPhone && phone.trim() === originalPhone) ? (
                  <View className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#dcfce7' }}>
                    <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    <Text className="text-xs font-semibold text-green-700">인증완료</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleSendPhoneCode}
                    disabled={phoneSending || !phone.trim()}
                    className="px-3 py-1.5 rounded-lg active:opacity-80 disabled:opacity-40"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {phoneSending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-xs font-semibold text-white">
                        {phoneCodeSent ? '재발송' : '인증'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>

              {phoneCodeSent && !phoneVerified && (
                <View className="mt-2 flex-row items-center gap-2">
                  <TextInput
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                    placeholder="인증번호 6자리"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="flex-1 text-base text-gray-900 border-b border-gray-200 py-1"
                  />
                  {codeTimer > 0 && (
                    <Text className="text-xs text-gray-400 min-w-[36px] text-right">
                      {Math.floor(codeTimer / 60)}:{String(codeTimer % 60).padStart(2, '0')}
                    </Text>
                  )}
                  <Pressable
                    onPress={handleVerifyPhoneCode}
                    disabled={phoneVerifying || !phoneCode.trim()}
                    className="px-3 py-1.5 rounded-lg active:opacity-80 disabled:opacity-40"
                    style={{ backgroundColor: '#374151' }}
                  >
                    {phoneVerifying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-xs font-semibold text-white">확인</Text>
                    )}
                  </Pressable>
                </View>
              )}
              {phone.trim() && phone.trim() !== originalPhone && !phoneVerified && !phoneCodeSent && (
                <Text className="mt-1 text-[11px] text-orange-500">전화번호를 변경하려면 인증이 필요합니다.</Text>
              )}
            </View>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-2">
            <Text className="py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              공개 · 알림
            </Text>

            <View className="flex-row items-center justify-between border-b border-gray-100 py-3.5">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-gray-900">공개 프로필</Text>
                <Text className="mt-0.5 text-xs text-gray-500">꺼두면 다른 유저에게 프로필이 노출되지 않습니다.</Text>
              </View>
              <Switch
                value={publicProfile}
                onValueChange={setPublicProfile}
                trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                thumbColor={publicProfile ? '#16a34a' : '#f3f4f6'}
              />
            </View>

            <View className="flex-row items-center justify-between py-3.5">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-gray-900">이메일 알림</Text>
                <Text className="mt-0.5 text-xs text-gray-500">이벤트·공지 등 메일로 받기</Text>
              </View>
              <Switch
                value={emailNotif}
                onValueChange={setEmailNotif}
                trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
                thumbColor={emailNotif ? '#2563eb' : '#f3f4f6'}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving || loadingProfile}
            className="mt-6 items-center rounded-2xl bg-gray-900 py-4 active:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">변경 사항 저장</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            className="mt-3 items-center rounded-2xl border border-rose-200 bg-white py-4 active:opacity-90"
          >
            <Text className="text-base font-semibold text-rose-600">회원 탈퇴</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
