import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  Share2,
  Unlock,
  Users,
} from 'lucide-react-native';

import { RootStackParamList } from '@/App';
import { safeGoBack } from '@/navigation/rootNavigation';
import { useAuthStore } from '@/store/authStore';

import { getGroup, joinGroup } from '@/api/meet/groups';
import { getGroupChatRooms, createGroupChatRoom } from '@/api/meet/chatRooms';
import { getGroupPosts, createGroupPost } from '@/api/meet/posts';
import { getGroupRoutes } from '@/api/meet/routes';
import { leaveGroup } from '@/api/meet/members';
import type { Group, GroupChatRoom, GroupPost, GroupRoute } from '@/api/meet/types';

type DetailRouteProp = RouteProp<RootStackParamList, 'MeetDetail'>;
type Tab = 'chat' | 'feed' | 'info';
type FeedFilter = 'all' | 'post' | 'route';

export default function MeetDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<DetailRouteProp>();
  const { groupUuid, groupName: initialName } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken) ?? '';
  const myUuid = useAuthStore((s) => s.user?.uuid);

  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [group, setGroup] = useState<Group | null>(null);
  const [chatRooms, setChatRooms] = useState<GroupChatRoom[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [routes, setRoutes] = useState<GroupRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [writePostModalVisible, setWritePostModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  const isAdmin = group?.adminUuid === myUuid;
  const isMember = group?.joinedByMe ?? false;

  const loadGroup = useCallback(async () => {
    try {
      const g = await getGroup(groupUuid);
      setGroup(g);
    } catch {
      /* ignore */
    }
  }, [groupUuid]);

  const loadChatRooms = useCallback(async () => {
    if (!accessToken) return;
    try {
      const rooms = await getGroupChatRooms(accessToken, groupUuid);
      setChatRooms(rooms);
    } catch {
      setChatRooms([]);
    }
  }, [accessToken, groupUuid]);

  const loadFeed = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [p, r] = await Promise.all([
        getGroupPosts(accessToken, groupUuid),
        getGroupRoutes(accessToken, groupUuid),
      ]);
      setPosts(p);
      setRoutes(r);
    } catch {
      /* ignore */
    }
  }, [accessToken, groupUuid]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadGroup(), loadChatRooms(), loadFeed()]);
    setLoading(false);
  }, [loadGroup, loadChatRooms, loadFeed]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleJoin = async () => {
    if (!accessToken) return;
    try {
      const res = await joinGroup(accessToken, groupUuid);
      if (res.status === 'JOINED') {
        Alert.alert('완료', '모임에 가입되었습니다.');
      } else {
        Alert.alert('신청 완료', '방장 승인 후 가입됩니다.');
      }
      void loadGroup();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '가입에 실패했습니다.';
      Alert.alert('오류', msg);
    }
  };

  const handleLeave = () => {
    Alert.alert('모임 탈퇴', '모임에서 탈퇴하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(accessToken, groupUuid);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('오류', err?.response?.data?.message ?? '탈퇴에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setCreatingRoom(true);
    try {
      await createGroupChatRoom(accessToken, groupUuid, name);
      setNewRoomName('');
      setCreateRoomModalVisible(false);
      void loadChatRooms();
    } catch {
      Alert.alert('오류', '채팅방 생성에 실패했습니다.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSubmitPost = async () => {
    const content = newPostContent.trim();
    if (!content) return;
    setSubmittingPost(true);
    try {
      await createGroupPost(accessToken, groupUuid, { content });
      setNewPostContent('');
      setWritePostModalVisible(false);
      void loadFeed();
    } catch {
      Alert.alert('오류', '게시물 작성에 실패했습니다.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const feedItems = (() => {
    if (feedFilter === 'post') return posts.map((p) => ({ type: 'post' as const, data: p }));
    if (feedFilter === 'route') return routes.map((r) => ({ type: 'route' as const, data: r }));
    const combined: Array<{ type: 'post'; data: GroupPost } | { type: 'route'; data: GroupRoute }> = [
      ...posts.map((p) => ({ type: 'post' as const, data: p })),
      ...routes.map((r) => ({ type: 'route' as const, data: r })),
    ];
    combined.sort((a, b) => {
      const aDate = a.type === 'post' ? a.data.createdAt : '';
      const bDate = b.type === 'post' ? b.data.createdAt : '';
      return bDate.localeCompare(aDate);
    });
    return combined;
  })();

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => safeGoBack(navigation)}>
          <ChevronLeft color="#111827" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {group?.name ?? initialName}
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() =>
              navigation.navigate('MeetManage', {
                groupUuid,
                groupName: group?.name ?? initialName,
              })
            }
          >
            <Settings color="#3B82F6" size={20} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* 탭 바 */}
      <View style={s.tabBar}>
        {(['chat', 'feed', 'info'] as Tab[]).map((tab) => {
          const labels: Record<Tab, string> = {
            chat: '채팅',
            feed: '게시물 & 루트',
            info: '소개',
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : (
        <>
          {/* 탭 1: 채팅방 목록 */}
          {activeTab === 'chat' && (
            <FlatList
              data={chatRooms}
              keyExtractor={(item) => item.uuid}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              ListHeaderComponent={
                isMember ? (
                  <TouchableOpacity
                    style={s.createRoomBtn}
                    onPress={() => setCreateRoomModalVisible(true)}
                  >
                    <Plus color="#3B82F6" size={16} />
                    <Text style={s.createRoomBtnText}>채팅방 만들기</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>채팅방이 없습니다.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.roomCard}
                  onPress={() =>
                    navigation.navigate('ChatRoomScreen', {
                      roomUuid: item.uuid,
                      roomName: item.name,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <View style={s.roomIconWrap}>
                    <MessageCircle color="#3B82F6" size={22} />
                  </View>
                  <Text style={s.roomName}>{item.name}</Text>
                  <ChevronRight color="#D1D5DB" size={18} />
                </TouchableOpacity>
              )}
            />
          )}

          {/* 탭 2: 게시물 & 루트 */}
          {activeTab === 'feed' && (
            <View style={{ flex: 1 }}>
              <View style={s.filterRow}>
                {(['all', 'post', 'route'] as FeedFilter[]).map((f) => {
                  const labels: Record<FeedFilter, string> = {
                    all: '전체',
                    post: '게시물',
                    route: '루트',
                  };
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[s.filterBtn, feedFilter === f && s.filterBtnActive]}
                      onPress={() => setFeedFilter(f)}
                    >
                      <Text
                        style={[s.filterLabel, feedFilter === f && s.filterLabelActive]}
                      >
                        {labels[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FlatList
                data={feedItems}
                keyExtractor={(item, i) =>
                  item.type === 'post' ? item.data.uuid : `route-${item.data.id}-${i}`
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                ListHeaderComponent={
                  isMember ? (
                    <TouchableOpacity
                      style={s.writePostBtn}
                      onPress={() => setWritePostModalVisible(true)}
                    >
                      <Plus color="#3B82F6" size={16} />
                      <Text style={s.createRoomBtnText}>게시물 작성</Text>
                    </TouchableOpacity>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>게시물이 없습니다.</Text>
                  </View>
                }
                renderItem={({ item }) =>
                  item.type === 'post' ? (
                    <PostCard post={item.data} />
                  ) : (
                    <RouteCard route={item.data} />
                  )
                }
              />
            </View>
          )}

          {/* 탭 3: 소개 */}
          {activeTab === 'info' && group && (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 모임 프로필 카드 */}
              <View style={s.infoCard}>
                <View style={s.infoAvatar}>
                  {group.profileImageUrl ? (
                    <Image
                      source={{ uri: group.profileImageUrl }}
                      style={{ width: 80, height: 80 }}
                    />
                  ) : (
                    <Users color="#9CA3AF" size={36} />
                  )}
                </View>
                <Text style={s.infoName}>{group.name}</Text>
                {group.description ? (
                  <Text style={s.infoDesc}>{group.description}</Text>
                ) : null}
                <View style={s.infoMeta}>
                  <View style={s.infoMetaItem}>
                    <Users color="#6B7280" size={14} />
                    <Text style={s.infoMetaText}>{group.memberCount}명</Text>
                  </View>
                  <View style={s.infoMetaSep} />
                  <View style={s.infoMetaItem}>
                    {group.type === 'PUBLIC' ? (
                      <Unlock color="#6B7280" size={14} />
                    ) : (
                      <Lock color="#6B7280" size={14} />
                    )}
                    <Text style={s.infoMetaText}>
                      {group.type === 'PUBLIC' ? '공개' : '비공개'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 액션 카드 */}
              <View style={s.card}>
                {/* 가입/탈퇴 */}
                {!isMember ? (
                  <TouchableOpacity style={s.actionRow} onPress={handleJoin} activeOpacity={0.7}>
                    <View style={[s.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                      <Users color="#3B82F6" size={18} />
                    </View>
                    <Text style={[s.actionText, { color: '#3B82F6' }]}>
                      {group.type === 'PRIVATE' || group.requiresApproval
                        ? '가입 신청'
                        : '가입하기'}
                    </Text>
                    <ChevronRight color="#D1D5DB" size={18} />
                  </TouchableOpacity>
                ) : !isAdmin ? (
                  <TouchableOpacity style={s.actionRow} onPress={handleLeave} activeOpacity={0.7}>
                    <View style={[s.actionIcon, { backgroundColor: '#FEE2E2' }]}>
                      <ChevronLeft color="#EF4444" size={18} />
                    </View>
                    <Text style={[s.actionText, { color: '#EF4444' }]}>모임 탈퇴</Text>
                    <ChevronRight color="#D1D5DB" size={18} />
                  </TouchableOpacity>
                ) : null}

                {/* 공유 */}
                {isMember && (
                  <>
                    <View style={s.cardDivider} />
                    <TouchableOpacity
                      style={s.actionRow}
                      onPress={() =>
                        Alert.alert('링크 공유', `https://eodigaljido.uk/groups/${groupUuid}`)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[s.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                        <Share2 color="#22C55E" size={18} />
                      </View>
                      <Text style={[s.actionText, { color: '#111827' }]}>모임 링크 공유</Text>
                      <ChevronRight color="#D1D5DB" size={18} />
                    </TouchableOpacity>
                  </>
                )}

                {/* 방장 관리 */}
                {isAdmin && (
                  <>
                    <View style={s.cardDivider} />
                    <TouchableOpacity
                      style={s.actionRow}
                      onPress={() =>
                        navigation.navigate('MeetManage', {
                          groupUuid,
                          groupName: group.name,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[s.actionIcon, { backgroundColor: '#F5F3FF' }]}>
                        <Settings color="#7C3AED" size={18} />
                      </View>
                      <Text style={[s.actionText, { color: '#111827' }]}>모임 관리</Text>
                      <ChevronRight color="#D1D5DB" size={18} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* 채팅방 생성 모달 */}
      <Modal
        visible={createRoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateRoomModalVisible(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setCreateRoomModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>채팅방 만들기</Text>
            <TextInput
              style={s.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="채팅방 이름"
              placeholderTextColor="#C4C9D4"
              autoFocus
              maxLength={50}
              selectionColor="#3B82F6"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setCreateRoomModalVisible(false)}
              >
                <Text style={s.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnConfirm, { opacity: creatingRoom ? 0.6 : 1 }]}
                onPress={handleCreateRoom}
                disabled={creatingRoom}
              >
                <Text style={s.modalBtnConfirmText}>{creatingRoom ? '생성 중…' : '만들기'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 게시물 작성 모달 */}
      <Modal
        visible={writePostModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWritePostModalVisible(false)}
      >
        <View style={s.bottomSheetWrap}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setWritePostModalVisible(false)} />
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>게시물 작성</Text>
            <TextInput
              style={s.postInput}
              value={newPostContent}
              onChangeText={setNewPostContent}
              placeholder="모임 멤버들에게 전할 내용을 작성하세요."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              selectionColor="#3B82F6"
            />
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={[s.submitBtn, { opacity: submittingPost ? 0.6 : 1 }]}
                onPress={handleSubmitPost}
                disabled={submittingPost}
              >
                <Text style={s.submitBtnText}>{submittingPost ? '등록 중…' : '게시물 등록'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PostCard({ post }: { post: GroupPost }) {
  const time = new Date(post.createdAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={s.feedCard}>
      <View style={s.feedCardHeader}>
        <View style={s.feedAvatar}>
          {post.authorProfileImageUrl ? (
            <Image
              source={{ uri: post.authorProfileImageUrl }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <Text style={s.feedAvatarText}>{post.authorNickname[0]}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.feedAuthor}>{post.authorNickname}</Text>
          <Text style={s.feedTime}>{time}</Text>
        </View>
      </View>
      <Text style={s.feedContent}>{post.content}</Text>
      {post.imageUrls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {post.imageUrls.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={{ width: 120, height: 90, borderRadius: 10, marginRight: 8 }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function RouteCard({ route }: { route: GroupRoute }) {
  return (
    <View style={[s.feedCard, { flexDirection: 'row', gap: 12 }]}>
      <View style={s.routeThumb}>
        {route.thumbnail ? (
          <Image source={{ uri: route.thumbnail }} style={{ width: 64, height: 64 }} />
        ) : (
          <MapPin color="#9CA3AF" size={24} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Unlock color="#22C55E" size={12} />
          <Text style={s.routeRegion}>{route.region}</Text>
        </View>
        <Text style={s.routeTitle} numberOfLines={1}>
          {route.title}
        </Text>
        <Text style={s.routeMeta} numberOfLines={1}>
          {route.departure} → {route.arrival}
        </Text>
      </View>
    </View>
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
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#F0F5FF',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...shadow,
  },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700',
    color: '#111827', letterSpacing: -0.3, marginHorizontal: 8,
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    ...shadow,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
    ...shadow,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#3B82F6' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabLabelActive: { color: '#fff' },

  createRoomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 16, marginBottom: 12,
  },
  writePostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 16, marginBottom: 12,
  },
  createRoomBtnText: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },

  roomCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, ...shadow,
  },
  roomIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  roomName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', ...shadow,
  },
  filterBtnActive: { backgroundColor: '#3B82F6' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  filterLabelActive: { color: '#fff' },

  feedCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 10, ...shadow,
  },
  feedCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  feedAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  feedAvatarText: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  feedAuthor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  feedTime: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  feedContent: { fontSize: 14, color: '#374151', lineHeight: 20 },

  routeThumb: {
    width: 64, height: 64, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  routeRegion: { fontSize: 11, color: '#22C55E', fontWeight: '600' },
  routeTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  routeMeta: { fontSize: 12, color: '#9CA3AF' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 14, ...shadow,
  },
  infoAvatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16,
  },
  infoName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  infoDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  infoMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoMetaText: { fontSize: 13, color: '#6B7280' },
  infoMetaSep: { width: 1, height: 14, backgroundColor: '#E5E7EB' },

  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', ...shadow },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginHorizontal: 20 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 16, gap: 14,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: '500' },

  emptyBox: {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 40,
    alignItems: 'center', ...shadow,
  },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    width: 300, backgroundColor: '#fff', borderRadius: 20, padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827',
    marginBottom: 16, backgroundColor: '#FAFAFA',
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnConfirm: { backgroundColor: '#3B82F6' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalBtnConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  bottomSheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginTop: 14, marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: '700', color: '#111827',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  postInput: {
    minHeight: 120, marginHorizontal: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 14, color: '#111827',
    backgroundColor: '#FAFAFA', marginBottom: 16, textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
