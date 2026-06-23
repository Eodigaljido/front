import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, ChevronLeft, Lock, Unlock, X } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { useAuthStore } from '@/store/authStore';
import { createGroup } from '@/api/meet/groups';
import type { GroupType } from '@/api/meet/types';

export default function MeetCreateScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const accessToken = useAuthStore((s) => s.accessToken) ?? '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('PUBLIC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [image, setImage] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isPrivate = groupType === 'PRIVATE';

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('', '사진 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) {
      // 413(Request Entity Too Large) 방지: 업로드 전 리사이즈·압축
      const needResize = (asset.width ?? 0) > 1280;
      const m = await ImageManipulator.manipulateAsync(
        asset.uri,
        needResize ? [{ resize: { width: 1280 } }] : [],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImage({ uri: m.uri, name: 'group.jpg', type: 'image/jpeg' });
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('입력 오류', '모임 이름을 입력해주세요.');
      return;
    }
    if (!accessToken) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const group = await createGroup(
        accessToken,
        {
          name: trimmedName,
          description: description.trim(),
          type: groupType,
          requiresApproval: isPrivate ? true : requiresApproval,
        },
        image,
      );
      navigation.replace('MeetDetail', {
        groupUuid: group.uuid,
        groupName: group.name,
      });
    } catch (err: any) {
      Alert.alert('오류', err?.response?.data?.message ?? '모임 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7} style={s.backBtn} onPress={() => safeGoBack(navigation)}>
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>모임 만들기</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 프로필 이미지 */}
          <View style={s.imageSection}>
            <TouchableOpacity
              style={s.imagePicker}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {image ? (
                <>
                  <Image source={{ uri: image.uri }} style={s.imagePreview} />
                  <TouchableOpacity activeOpacity={0.7}
                    style={s.imageRemove}
                    onPress={() => setImage(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X color="#fff" size={14} strokeWidth={2.5} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.imagePlaceholder}>
                  <Camera color="#94A3B8" size={26} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={s.imageHint}>
              {image ? '눌러서 변경' : '모임 대표 이미지 (선택)'}
            </Text>
          </View>

          {/* 기본 정보 */}
          <Text style={s.sectionLabel}>기본 정보</Text>
          <View style={s.card}>
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>모임 이름 *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="모임 이름을 입력하세요"
                placeholderTextColor="#CBD5E1"
                maxLength={50}
                selectionColor="#93C5FD"
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>모임 소개</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="모임을 소개해주세요."
                placeholderTextColor="#CBD5E1"
                maxLength={200}
                multiline
                textAlignVertical="top"
                selectionColor="#93C5FD"
              />
              <Text style={s.charCount}>{description.length}/200</Text>
            </View>
          </View>

          {/* 공개 설정 */}
          <Text style={s.sectionLabel}>공개 설정</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>공개 범위</Text>
            <View style={s.typeRow}>
              <TouchableOpacity activeOpacity={0.7}
                style={[s.typeBtn, !isPrivate && s.typeBtnActive]}
                onPress={() => setGroupType('PUBLIC')}
              >
                <View style={[s.typeIconWrap, !isPrivate && s.typeIconWrapActive]}>
                  <Unlock color={!isPrivate ? '#3B82F6' : '#94A3B8'} size={16} />
                </View>
                <Text style={[s.typeBtnText, !isPrivate && s.typeBtnTextActive]}>공개</Text>
                <Text style={[s.typeBtnSub, !isPrivate && s.typeBtnSubActive]}>
                  누구나 가입
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}
                style={[s.typeBtn, isPrivate && s.typeBtnActive]}
                onPress={() => setGroupType('PRIVATE')}
              >
                <View style={[s.typeIconWrap, isPrivate && s.typeIconWrapActive]}>
                  <Lock color={isPrivate ? '#3B82F6' : '#94A3B8'} size={16} />
                </View>
                <Text style={[s.typeBtnText, isPrivate && s.typeBtnTextActive]}>비공개</Text>
                <Text style={[s.typeBtnSub, isPrivate && s.typeBtnSubActive]}>
                  초대로만 가입
                </Text>
              </TouchableOpacity>
            </View>

            {!isPrivate && (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>가입 승인 필요</Text>
                  <Text style={s.switchHint}>켜면 방장 승인 후 가입됩니다.</Text>
                </View>
                <Switch
                  value={requiresApproval}
                  onValueChange={setRequiresApproval}
                  trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                  thumbColor={requiresApproval ? '#3B82F6' : '#fff'}
                />
              </View>
            )}
          </View>

          <TouchableOpacity activeOpacity={0.7}
            style={[s.submitBtn, { opacity: submitting ? 0.65 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? '생성 중…' : '모임 만들기'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
    paddingHorizontal: 4,
  },

  imageSection: { alignItems: 'center', marginTop: 12, gap: 8 },
  imagePicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },
  imagePlaceholder: {
    flex: 1,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFF',
  },
  imagePreview: { width: 100, height: 100, borderRadius: 50 },
  imageRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imageHint: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  typeBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  typeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconWrapActive: { backgroundColor: '#DBEAFE' },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  typeBtnTextActive: { color: '#1D4ED8' },
  typeBtnSub: { fontSize: 11, color: '#CBD5E1', fontWeight: '500' },
  typeBtnSubActive: { color: '#93C5FD' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  switchHint: { fontSize: 12, color: '#94A3B8' },

  submitBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
});
