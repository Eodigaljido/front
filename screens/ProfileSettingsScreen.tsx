// @ts-nocheck
import React, { useState, useCallback } from 'react';
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

const DEFAULT_AVATAR_URI = 'https://i.pravatar.cc/100?img=5';

export default function ProfileSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();

  const [avatarUri, setAvatarUri] = useState<string>(DEFAULT_AVATAR_URI);
  const [pickingImage, setPickingImage] = useState(false);
  const [nickname, setNickname] = useState('juyung');
  const [email] = useState('btm.email2769@gmail.com');
  const [bio, setBio] = useState('');
  const [publicProfile, setPublicProfile] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

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
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setPickingImage(false);
    }
  }, [pickingImage]);

  const handleSave = () => {
    Alert.alert('저장 완료', '프로필이 저장되었습니다. (로컬만 반영)');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f5f5f9]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#f5f5f9] px-4 py-3">
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
            className="mt-6 items-center rounded-2xl bg-gray-900 py-4 active:opacity-90"
          >
            <Text className="text-base font-semibold text-white">변경 사항 저장</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
