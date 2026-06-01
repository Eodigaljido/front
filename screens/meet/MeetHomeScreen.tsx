import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Plus, Search, Users } from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { getPublicGroups } from '@/api/meet/groups';
import type { Group } from '@/api/meet/types';

export default function MeetHomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicGroups(0, 50);
      setGroups(res.content ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const myGroups = filtered.filter((g) => g.joinedByMe);
  const exploreGroups = filtered.filter((g) => !g.joinedByMe);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.headerTitle}>모임</Text>
        <TouchableOpacity
          style={s.createBtn}
          onPress={() => navigation.navigate('MeetCreate')}
        >
          <Plus color="#3B82F6" size={20} />
        </TouchableOpacity>
      </View>

      {/* 검색바 */}
      <View style={s.searchWrap}>
        <Search color="#9CA3AF" size={16} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="모임 이름으로 검색"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <>
              {/* 내 모임 */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>내 모임</Text>
                {myGroups.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>가입한 모임이 없습니다.</Text>
                  </View>
                ) : (
                  myGroups.map((group) => (
                    <GroupCard
                      key={group.uuid}
                      group={group}
                      onPress={() =>
                        navigation.navigate('MeetDetail', {
                          groupUuid: group.uuid,
                          groupName: group.name,
                        })
                      }
                    />
                  ))
                )}
              </View>

              {/* 공개 모임 탐색 */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>공개 모임 탐색</Text>
                {exploreGroups.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>검색 결과가 없습니다.</Text>
                  </View>
                ) : (
                  exploreGroups.map((group) => (
                    <GroupCard
                      key={group.uuid}
                      group={group}
                      onPress={() =>
                        navigation.navigate('MeetDetail', {
                          groupUuid: group.uuid,
                          groupName: group.name,
                        })
                      }
                    />
                  ))
                )}
              </View>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

function GroupCard({
  group,
  onPress,
}: {
  group: Group;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardAvatar}>
        {group.profileImageUrl ? (
          <Image source={{ uri: group.profileImageUrl }} style={s.cardImg} />
        ) : (
          <Users color="#9CA3AF" size={28} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.cardName} numberOfLines={1}>
            {group.name}
          </Text>
          {group.type === 'PRIVATE' && (
            <View style={s.privateBadge}>
              <Text style={s.privateBadgeText}>비공개</Text>
            </View>
          )}
        </View>
        {group.description ? (
          <Text style={s.cardDesc} numberOfLines={1}>
            {group.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users color="#9CA3AF" size={12} />
          <Text style={s.cardMeta}>{group.memberCount}명</Text>
        </View>
      </View>
      {group.joinedByMe && (
        <View style={s.joinedBadge}>
          <Text style={s.joinedBadgeText}>참여 중</Text>
        </View>
      )}
    </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    ...shadow,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    ...shadow,
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImg: { width: 56, height: 56 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  cardDesc: { fontSize: 13, color: '#6B7280' },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  privateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  privateBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  joinedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
  },
  joinedBadgeText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
});
