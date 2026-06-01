import React, { useState } from 'react';
import {
  Alert,
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
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { useAuthStore } from '@/store/authStore';
import { createGroup } from '@/api/meet/groups';
import type { GroupType } from '@/api/meet/types';

export default function MeetCreateScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const accessToken = useAuthStore((s) => s.accessToken) ?? '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('PUBLIC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isPrivate = groupType === 'PRIVATE';

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
      const group = await createGroup(accessToken, {
        name: trimmedName,
        description: description.trim(),
        type: groupType,
        requiresApproval: isPrivate ? false : requiresApproval,
      });
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
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => safeGoBack(navigation)}>
          <ChevronLeft color="#111827" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>모임 만들기</Text>
        <View style={{ width: 40 }} />
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
          {/* 모임 이름 */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>모임 이름 *</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="모임 이름을 입력하세요"
              placeholderTextColor="#C4C9D4"
              maxLength={50}
              selectionColor="#3B82F6"
            />
          </View>

          {/* 소개 */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>소개</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="모임을 소개해주세요."
              placeholderTextColor="#C4C9D4"
              maxLength={200}
              multiline
              textAlignVertical="top"
              selectionColor="#3B82F6"
            />
          </View>

          {/* 공개 / 비공개 */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>공개 범위</Text>
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeBtn, !isPrivate && s.typeBtnActive]}
                onPress={() => setGroupType('PUBLIC')}
              >
                <Text style={[s.typeBtnText, !isPrivate && s.typeBtnTextActive]}>
                  공개
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeBtn, isPrivate && s.typeBtnActive]}
                onPress={() => setGroupType('PRIVATE')}
              >
                <Text style={[s.typeBtnText, isPrivate && s.typeBtnTextActive]}>
                  비공개
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={s.fieldHint}>
              {isPrivate
                ? '초대 링크를 통해서만 가입할 수 있습니다.'
                : '누구나 찾아서 가입할 수 있습니다.'}
            </Text>
          </View>

          {/* 가입 승인 여부 (공개 모임만) */}
          {!isPrivate && (
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>가입 승인 필요</Text>
                <Text style={s.switchHint}>켜면 방장 승인 후 가입됩니다.</Text>
              </View>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={requiresApproval ? '#3B82F6' : '#fff'}
              />
            </View>
          )}

          {/* 생성 버튼 */}
          <TouchableOpacity
            style={[s.submitBtn, { opacity: submitting ? 0.6 : 1 }]}
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

const shadow = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F5FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },

  fieldWrap: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    letterSpacing: 0.3, marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: '#111827',
    borderWidth: 1.5, borderColor: '#E5E7EB', ...shadow,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  fieldHint: { fontSize: 12, color: '#9CA3AF', marginTop: 6, paddingLeft: 4 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', ...shadow,
  },
  typeBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeBtnText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  typeBtnTextActive: { color: '#fff' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 20, ...shadow,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  switchHint: { fontSize: 12, color: '#9CA3AF' },

  submitBtn: {
    backgroundColor: '#3B82F6', borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
