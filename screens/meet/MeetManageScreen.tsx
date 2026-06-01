import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { Check, ChevronLeft, Trash2, Users, X } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { useAuthStore } from '@/store/authStore';
import { getGroup, updateGroup, deleteGroup } from '@/api/meet/groups';
import { getJoinRequests, processJoinRequest } from '@/api/meet/members';
import type { Group, JoinRequest, GroupType } from '@/api/meet/types';

type ManageRouteProp = RouteProp<RootStackParamList, 'MeetManage'>;

export default function MeetManageScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<ManageRouteProp>();
  const { groupUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken) ?? '';

  const [group, setGroup] = useState<Group | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('PUBLIC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, reqs] = await Promise.all([
        getGroup(groupUuid),
        getJoinRequests(accessToken, groupUuid).catch(() => [] as JoinRequest[]),
      ]);
      setGroup(g);
      setName(g.name);
      setDescription(g.description);
      setGroupType(g.type);
      setRequiresApproval(g.requiresApproval);
      setJoinRequests(reqs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [accessToken, groupUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('입력 오류', '모임 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await updateGroup(accessToken, groupUuid, {
        name: trimmedName,
        description: description.trim(),
        type: groupType,
        requiresApproval: groupType === 'PRIVATE' ? false : requiresApproval,
      });
      Alert.alert('완료', '모임 정보가 저장되었습니다.');
      void load();
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (req: JoinRequest) => {
    try {
      await processJoinRequest(accessToken, req.requestId, 'APPROVE');
      setJoinRequests((prev) => prev.filter((r) => r.requestId !== req.requestId));
    } catch {
      Alert.alert('오류', '승인에 실패했습니다.');
    }
  };

  const handleReject = async (req: JoinRequest) => {
    try {
      await processJoinRequest(accessToken, req.requestId, 'REJECT');
      setJoinRequests((prev) => prev.filter((r) => r.requestId !== req.requestId));
    } catch {
      Alert.alert('오류', '거절에 실패했습니다.');
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      '모임 삭제',
      '모임을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup(accessToken, groupUuid);
              navigation.navigate('Tabs');
            } catch {
              Alert.alert('오류', '모임 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => safeGoBack(navigation)}>
          <ChevronLeft color="#111827" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>모임 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 기본 정보 카드 */}
        <Text style={s.sectionLabel}>기본 정보</Text>
        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>모임 이름</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="모임 이름"
              placeholderTextColor="#C4C9D4"
              maxLength={50}
              selectionColor="#3B82F6"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>소개</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="모임 소개"
              placeholderTextColor="#C4C9D4"
              maxLength={200}
              multiline
              textAlignVertical="top"
              selectionColor="#3B82F6"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>공개 범위</Text>
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeBtn, groupType === 'PUBLIC' && s.typeBtnActive]}
                onPress={() => setGroupType('PUBLIC')}
              >
                <Text style={[s.typeBtnText, groupType === 'PUBLIC' && s.typeBtnTextActive]}>
                  공개
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeBtn, groupType === 'PRIVATE' && s.typeBtnActive]}
                onPress={() => setGroupType('PRIVATE')}
              >
                <Text style={[s.typeBtnText, groupType === 'PRIVATE' && s.typeBtnTextActive]}>
                  비공개
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {groupType === 'PUBLIC' && (
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

          <TouchableOpacity
            style={[s.saveBtn, { opacity: saving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>{saving ? '저장 중…' : '저장'}</Text>
          </TouchableOpacity>
        </View>

        {/* 가입 신청 목록 */}
        {joinRequests.length > 0 && (
          <>
            <Text style={s.sectionLabel}>가입 신청 ({joinRequests.length})</Text>
            <View style={s.card}>
              {joinRequests.map((req, i) => (
                <View key={req.requestId}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.reqRow}>
                    <View style={s.reqAvatar}>
                      {req.requesterProfileImageUrl ? (
                        <Image
                          source={{ uri: req.requesterProfileImageUrl }}
                          style={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <Users color="#9CA3AF" size={20} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reqName}>{req.requesterNickname}</Text>
                      <Text style={s.reqId}>@{req.requesterUserId}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.approveBtn}
                      onPress={() => handleApprove(req)}
                    >
                      <Check color="#22C55E" size={18} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => handleReject(req)}
                    >
                      <X color="#EF4444" size={18} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 위험 구역 */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>위험 구역</Text>
        <TouchableOpacity style={s.dangerCard} onPress={handleDeleteGroup} activeOpacity={0.8}>
          <View style={s.dangerIconWrap}>
            <Trash2 color="#EF4444" size={18} />
          </View>
          <Text style={s.dangerText}>모임 삭제</Text>
          <ChevronLeft
            color="#D1D5DB"
            size={18}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        </TouchableOpacity>
      </ScrollView>
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

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    gap: 4, ...shadow,
  },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#111827', backgroundColor: '#FAFAFA',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  typeBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  typeBtnTextActive: { color: '#fff' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 4, paddingBottom: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  switchHint: { fontSize: 12, color: '#9CA3AF' },

  saveBtn: {
    backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginVertical: 2 },
  reqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
  },
  reqAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  reqName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reqId: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  approveBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },

  dangerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, gap: 14, ...shadow,
  },
  dangerIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#EF4444' },
});
