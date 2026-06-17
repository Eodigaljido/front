import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
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
import { ChevronLeft, Crown, Users } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { getGroupMembers } from '@/api/meet/members';
import type { GroupMember } from '@/api/meet/types';

type MembersRouteProp = RouteProp<RootStackParamList, 'MeetMembers'>;

const AVATAR_COLORS = [
  '#4F80FF',
  '#7C3AED',
  '#EC4899',
  '#F97316',
  '#16A34A',
  '#0EA5E9',
];
function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

const PAGE_SIZE = 30;

export default function MeetMembersScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<MembersRouteProp>();
  const { groupUuid, groupName } = route.params;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getGroupMembers(groupUuid, 0, PAGE_SIZE);
      setMembers(list);
      setPage(0);
      setReachedEnd(list.length < PAGE_SIZE);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [groupUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd || loading) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const list = await getGroupMembers(groupUuid, next, PAGE_SIZE);
      setMembers((prev) => {
        const seen = new Set(prev.map((m) => m.userUuid));
        return [...prev, ...list.filter((m) => !seen.has(m.userUuid))];
      });
      setPage(next);
      setReachedEnd(list.length < PAGE_SIZE);
    } catch {
      setReachedEnd(true);
    } finally {
      setLoadingMore(false);
    }
  }, [groupUuid, page, loadingMore, reachedEnd, loading]);

  // 방장 먼저, 그 다음 가입 순
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'ADMIN' ? -1 : 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => safeGoBack(navigation)}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            멤버
          </Text>
          {groupName ? (
            <Text style={s.headerSub} numberOfLines={1}>
              {groupName}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.userUuid}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          ListHeaderComponent={
            <View style={s.countRow}>
              <Users color="#3B82F6" size={15} />
              <Text style={s.countText}>멤버 {members.length}명</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <View style={s.emptyIconWrap}>
                <Users color="#CBD5E1" size={26} />
              </View>
              <Text style={s.emptyTitle}>멤버가 없어요</Text>
              <Text style={s.emptyDesc}>아직 가입한 멤버가 없습니다</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color="#3B82F6"
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              onPress={() =>
                navigation.navigate('UserProfile', {
                  userUuid: item.userUuid,
                  userId: item.userId,
                  nickname: item.nickname,
                  profileImageUrl: item.profileImageUrl ?? undefined,
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function MemberRow({
  member,
  onPress,
}: {
  member: GroupMember;
  onPress: () => void;
}) {
  const isAdmin = member.role === 'ADMIN';
  const color = getAvatarColor(member.nickname);
  const joined = new Date(member.joinedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
      <View
        style={[
          s.avatar,
          { backgroundColor: member.profileImageUrl ? '#F1F5F9' : color },
        ]}
      >
        {member.profileImageUrl ? (
          <Image source={{ uri: member.profileImageUrl }} style={s.avatarImg} />
        ) : (
          <Text style={s.avatarText}>
            {member.nickname[0]?.toUpperCase() ?? '?'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.name} numberOfLines={1}>
            {member.nickname}
          </Text>
          {isAdmin && (
            <View style={s.adminBadge}>
              <Crown color="#D97706" size={11} />
              <Text style={s.adminBadgeText}>방장</Text>
            </View>
          )}
        </View>
        <Text style={s.sub} numberOfLines={1}>
          @{member.userId} · {joined} 가입
        </Text>
      </View>
    </TouchableOpacity>
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  countText: { fontSize: 14, fontWeight: '700', color: '#334155' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    paddingRight: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  sub: { fontSize: 12, color: '#94A3B8' },

  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  adminBadgeText: { fontSize: 11, color: '#D97706', fontWeight: '700' },

  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...cardShadow,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569' },
  emptyDesc: { fontSize: 13, color: '#94A3B8' },
});
