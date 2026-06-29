import React, { useCallback, useState } from 'react';
import {
  Alert,
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
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { Check, ChevronLeft, Lock, Trash2, Unlock, Users, X } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { useAuthStore } from '@/store/authStore';
import { getGroup, updateGroup, deleteGroup } from '@/api/meet/groups';
import { getJoinRequests, processJoinRequest } from '@/api/meet/members';
import type { JoinRequest, GroupType } from '@/api/meet/types';

type ManageRouteProp = RouteProp<RootStackParamList, 'MeetManage'>;

export default function MeetManageScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<ManageRouteProp>();
  const { groupUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken) ?? '';

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('PUBLIC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, reqs] = await Promise.all([
        getGroup(groupUuid),
        getJoinRequests(accessToken, groupUuid).catch(() => [] as JoinRequest[]),
      ]);
      setName(g.name);
      setDescription(g.description);
      setGroupType(g.type);
      setRequiresApproval(g.requiresApproval);
      setJoinRequests(reqs);
    } catch {
      /* ignore */
    }
  }, [accessToken, groupUuid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
              navigation.navigate({ name: 'Tabs', params: { screen: 'Meet' } });
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
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7} style={s.backBtn} onPress={() => safeGoBack(navigation)}>
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>모임 관리</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 가입 신청 목록 */}
        {joinRequests.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>가입 신청</Text>
              <View style={s.sectionBadge}>
                <Text style={s.sectionBadgeText}>{joinRequests.length}</Text>
              </View>
            </View>
            <View style={s.card}>
              {joinRequests.map((req, i) => (
                <View key={req.requestId}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.reqRow}>
                    <View style={s.reqAvatar}>
                      {req.requesterProfileImageUrl ? (
                        <Image
                          source={{ uri: req.requesterProfileImageUrl }}
                          style={{ width: 44, height: 44, borderRadius: 22 }}
                        />
                      ) : (
                        <Users color="#94A3B8" size={20} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reqName}>{req.requesterNickname}</Text>
                      <Text style={s.reqId}>@{req.requesterUserId}</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.7}
                      style={s.approveBtn}
                      onPress={() => handleApprove(req)}
                    >
                      <Check color="#22C55E" size={17} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7}
                      style={s.rejectBtn}
                      onPress={() => handleReject(req)}
                    >
                      <X color="#EF4444" size={17} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 기본 정보 */}
        <Text style={s.sectionLabel}>기본 정보</Text>
        <View style={s.card}>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>모임 이름</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="모임 이름"
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
              placeholder="모임 소개"
              placeholderTextColor="#CBD5E1"
              maxLength={200}
              multiline
              textAlignVertical="top"
              selectionColor="#93C5FD"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>공개 범위</Text>
            <View style={s.typeRow}>
              <TouchableOpacity activeOpacity={0.7}
                style={[s.typeBtn, groupType === 'PUBLIC' && s.typeBtnActive]}
                onPress={() => setGroupType('PUBLIC')}
              >
                <Unlock
                  color={groupType === 'PUBLIC' ? '#3B82F6' : '#94A3B8'}
                  size={15}
                />
                <Text style={[s.typeBtnText, groupType === 'PUBLIC' && s.typeBtnTextActive]}>
                  공개
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}
                style={[s.typeBtn, groupType === 'PRIVATE' && s.typeBtnActive]}
                onPress={() => setGroupType('PRIVATE')}
              >
                <Lock
                  color={groupType === 'PRIVATE' ? '#3B82F6' : '#94A3B8'}
                  size={15}
                />
                <Text
                  style={[s.typeBtnText, groupType === 'PRIVATE' && s.typeBtnTextActive]}
                >
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
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={requiresApproval ? '#3B82F6' : '#fff'}
              />
            </View>
          )}

          <TouchableOpacity activeOpacity={0.7}
            style={[s.saveBtn, { opacity: saving ? 0.65 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>{saving ? '저장 중…' : '저장하기'}</Text>
          </TouchableOpacity>
        </View>

        {/* 위험 구역 */}
        <Text style={[s.sectionLabel, { color: '#EF4444', marginTop: 28 }]}>위험 구역</Text>
        <TouchableOpacity style={s.dangerCard} onPress={handleDeleteGroup} activeOpacity={0.8}>
          <View style={s.dangerIconWrap}>
            <Trash2 color="#EF4444" size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.dangerText}>모임 삭제</Text>
            <Text style={s.dangerHint}>삭제 후 복구가 불가능합니다</Text>
          </View>
          <ChevronLeft
            color="#FCA5A5"
            size={18}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        </TouchableOpacity>
      </ScrollView>
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

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  sectionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFF',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  typeBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  typeBtnTextActive: { color: '#1D4ED8' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  switchHint: { fontSize: 12, color: '#94A3B8' },

  saveBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F1F5F9', marginVertical: 2 },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  reqAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reqName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  reqId: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  approveBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...cardShadow,
  },
  dangerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  dangerHint: { fontSize: 12, color: '#FCA5A5', marginTop: 2 },
});
