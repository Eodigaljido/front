// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import {
  deleteMyAccount,
  deleteMyProfileImage,
  getMyProfile,
  patchMyPhone,
  patchMyProfile,
  patchMyProfileImage,
} from '../api/users';

const DEFAULT_AVATAR_URI = 'https://i.pravatar.cc/100?img=5';

export default function ProfileSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const setUser = useAuthStore(s => s.setUser);
  const logout = useAuthStore(s => s.logout);

  const [avatarUri, setAvatarUri] = useState<string>(DEFAULT_AVATAR_URI);
  const [pickingImage, setPickingImage] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

  const syncAuthUser = useCallback(
    (profile: any) => {
      setUser({
        id: profile.id ?? 0,
        uuid: profile.uuid,
        userId: profile.userId ?? '',
        email: profile.email ?? '',
        nickname: profile.nickname ?? '',
        role: profile.role ?? 'USER',
      });
    },
    [setUser],
  );

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const me = await getMyProfile();
      setNickname(me.nickname ?? '');
      setEmail(me.email ?? '');
      setBio((me.bio ?? me.introduction ?? '').trim());
      setPhone(me.phone ?? '');
      setAvatarUri(me.profileImageUrl || DEFAULT_AVATAR_URI);
      syncAuthUser(me);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '프로필을 불러오지 못했습니다.');
    } finally {
      setLoadingProfile(false);
    }
  }, [syncAuthUser]);

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
        setAvatarUri(updated.profileImageUrl || DEFAULT_AVATAR_URI);
        syncAuthUser(updated);
      }
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '이미지를 변경하지 못했습니다.');
    } finally {
      setPickingImage(false);
    }
  }, [pickingImage, syncAuthUser]);

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
      if (phone.trim()) {
        await patchMyPhone(phone.trim());
      }
      syncAuthUser(updated);
      Alert.alert('저장 완료', '프로필이 서버에 저장되었습니다.');
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [saving, nickname, bio, phone, syncAuthUser]);

  const handleDeleteProfileImage = useCallback(async () => {
    try {
      const updated = await deleteMyProfileImage();
      setAvatarUri(updated.profileImageUrl || DEFAULT_AVATAR_URI);
      syncAuthUser(updated);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '프로필 이미지를 삭제하지 못했습니다.');
    }
  }, [syncAuthUser]);

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
              Alert.alert('오류', e?.message ?? '회원 탈퇴에 실패했습니다.');
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
            onPress={() => navigation.goBack()}
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
          {loadingProfile ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#111827" />
              <Text className="mt-3 text-sm text-gray-500">프로필 불러오는 중...</Text>
            </View>
          ) : null}

          <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-6">
            <View className="relative">
              <Image
                source={{ uri: avatarUri }}
                className="h-24 w-24 rounded-full bg-gray-100"
              />
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
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="010-0000-0000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                className="text-base font-semibold text-gray-900"
              />
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
