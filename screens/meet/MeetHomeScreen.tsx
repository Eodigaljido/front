import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { ChevronRight, Lock, Plus, Search, Users } from "lucide-react-native";

import { RootStackParamList } from "@/App";
import { getPublicGroups, getMyGroups } from "@/api/meet/groups";
import { useAuthStore } from "@/store/authStore";
import { useTabStore } from "@/store/tabStore";
import type { Group } from "@/api/meet/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MY_CARD_GAP = 12;
// 한 화면에 2개 + 다음 카드 살짝 보이도록(peek)
const MY_CARD_WIDTH = (SCREEN_WIDTH - 56) / 2;
const MY_PREVIEW_LIMIT = 5;
const PUBLIC_PAGE_SIZE = 5;

const AVATAR_COLORS = [
  "#4F80FF",
  "#7C3AED",
  "#EC4899",
  "#F97316",
  "#16A34A",
  "#0EA5E9",
];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function MeetHomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const setSwipeLocked = useTabStore((s) => s.setSwipeLocked);

  // 가로 스크롤 잠금: 손을 떼도 모멘텀·빠른 재스와이프 사이 빈틈에
  // 탭 이동이 새지 않도록 unlock 을 약간 지연시킨다.
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockSwipe = useCallback(() => {
    if (unlockTimer.current) {
      clearTimeout(unlockTimer.current);
      unlockTimer.current = null;
    }
    setSwipeLocked(true);
  }, [setSwipeLocked]);
  const unlockSwipeSoon = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => setSwipeLocked(false), 280);
  }, [setSwipeLocked]);
  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      setSwipeLocked(false);
    },
    [setSwipeLocked],
  );

  const [myGroupsRaw, setMyGroupsRaw] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [publicPage, setPublicPage] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [publicRes, myRes] = await Promise.allSettled([
        getPublicGroups(0, PUBLIC_PAGE_SIZE),
        accessToken ? getMyGroups(accessToken) : Promise.resolve([]),
      ]);
      const page =
        publicRes.status === "fulfilled" ? publicRes.value : null;
      const publicList: Group[] = page?.content ?? [];
      setPublicGroups(publicList);
      setPublicPage(0);
      setReachedEnd(
        page ? (page.last ?? publicList.length < PUBLIC_PAGE_SIZE) : true,
      );
      setMyGroupsRaw(myRes.status === "fulfilled" ? myRes.value : []);
    } catch {
      setPublicGroups([]);
      setMyGroupsRaw([]);
      setReachedEnd(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadMorePublic = useCallback(async () => {
    if (loadingMore || reachedEnd || loading) return;
    setLoadingMore(true);
    try {
      const next = publicPage + 1;
      const page = await getPublicGroups(next, PUBLIC_PAGE_SIZE);
      const list = page.content ?? [];
      setPublicGroups((prev) => {
        const seen = new Set(prev.map((g) => g.uuid));
        return [...prev, ...list.filter((g) => !seen.has(g.uuid))];
      });
      setPublicPage(next);
      setReachedEnd(page.last ?? list.length < PUBLIC_PAGE_SIZE);
    } catch {
      setReachedEnd(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, reachedEnd, loading, publicPage]);

  const q = searchQuery.toLowerCase();
  const myUuidSet = useMemo(
    () => new Set(myGroupsRaw.map((g) => g.uuid)),
    [myGroupsRaw],
  );
  const myGroups = useMemo(
    () => myGroupsRaw.filter((g) => g.name.toLowerCase().includes(q)),
    [myGroupsRaw, q],
  );
  const exploreGroups = useMemo(
    () =>
      publicGroups
        .filter((g) => !g.joinedByMe && !myUuidSet.has(g.uuid))
        .filter((g) => g.name.toLowerCase().includes(q)),
    [publicGroups, myUuidSet, q],
  );

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>모임</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7}
          style={s.createBtn}
          onPress={() => navigation.navigate("MeetCreate")}
        >
          <Plus color="#000" size={20} />
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <Search color="#94A3B8" size={16} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="모임 이름으로 검색"
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={exploreGroups}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <GroupCard
                group={item}
                onPress={() =>
                  navigation.navigate("MeetDetail", {
                    groupUuid: item.uuid,
                    groupName: item.name,
                  })
                }
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMorePublic()}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              <EmptyState
                icon={<Search color="#CBD5E1" size={26} />}
                title="검색 결과가 없어요"
                desc="다른 키워드로 검색하거나 더 불러와 보세요"
              />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color="#3B82F6"
                style={{ marginVertical: 16 }}
              />
            ) : !reachedEnd ? (
              <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
                <TouchableOpacity
                  style={s.loadMoreBtn}
                  onPress={() => void loadMorePublic()}
                  activeOpacity={0.8}
                >
                  <Text style={s.loadMoreText}>공개 모임 더보기</Text>
                  <ChevronRight color="#3B82F6" size={16} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <>
              <View style={{ marginTop: 18 }}>
                <View style={[s.sectionHeader, { paddingHorizontal: 16 }]}>
                  <Text style={[s.sectionTitle, { flex: 0 }]}>내 모임</Text>
                  {myGroups.length > 0 && (
                    <View style={[s.countBadge, { marginLeft: 8 }]}>
                      <Text style={s.countBadgeText}>{myGroups.length}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  {myGroups.length > 0 && (
                    <TouchableOpacity activeOpacity={0.7}
                      style={s.seeAllBtn}
                      onPress={() => navigation.navigate("MeetMyGroups")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.seeAllText}>전체 보기</Text>
                      <ChevronRight color="#3B82F6" size={14} />
                    </TouchableOpacity>
                  )}
                </View>
                {myGroups.length === 0 ? (
                  <View style={{ paddingHorizontal: 16 }}>
                    <EmptyState
                      icon={<Users color="#CBD5E1" size={26} />}
                      title="가입한 모임이 없어요"
                      desc="새 모임을 만들거나 탐색해보세요"
                    />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={MY_CARD_WIDTH + MY_CARD_GAP}
                    snapToAlignment="start"
                    contentContainerStyle={{
                      paddingLeft: 16,
                      paddingRight: 16,
                      gap: MY_CARD_GAP,
                      paddingBottom: 4,
                    }}
                    // 가로 스크롤 중에는 스와이프 탭 이동 잠금
                    onTouchStart={lockSwipe}
                    onScrollBeginDrag={lockSwipe}
                    onScrollEndDrag={unlockSwipeSoon}
                    onMomentumScrollEnd={unlockSwipeSoon}
                    onTouchEnd={unlockSwipeSoon}
                    onTouchCancel={unlockSwipeSoon}
                  >
                    {myGroups.slice(0, MY_PREVIEW_LIMIT).map((group) => (
                      <MyGroupCard
                        key={group.uuid}
                        group={group}
                        onPress={() =>
                          navigation.navigate("MeetDetail", {
                            groupUuid: group.uuid,
                            groupName: group.name,
                          })
                        }
                      />
                    ))}
                    {myGroups.length > MY_PREVIEW_LIMIT && (
                      <MoreCard
                        count={myGroups.length}
                        onPress={() => navigation.navigate("MeetMyGroups")}
                      />
                    )}
                  </ScrollView>
                )}
              </View>

              <View style={[s.section, { marginBottom: 4 }]}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>공개 모임 탐색</Text>
                </View>
              </View>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <View style={s.emptyBox}>
      <View style={s.emptyIconWrap}>{icon}</View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyDesc}>{desc}</Text>
    </View>
  );
}

function MyGroupCard({
  group,
  onPress,
}: {
  group: Group;
  onPress: () => void;
}) {
  const color = getAvatarColor(group.name);
  return (
    <TouchableOpacity
      style={[s.myCard, { width: MY_CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[s.myCardBanner, { backgroundColor: color }]}>
        {group.profileImageUrl ? (
          <Image
            source={{ uri: group.profileImageUrl }}
            style={s.myCardBannerImg}
          />
        ) : (
          <Text style={s.myCardInitial}>
            {group.name[0]?.toUpperCase() ?? "?"}
          </Text>
        )}
        {group.type === "PRIVATE" && (
          <View style={s.myCardLockBadge}>
            <Lock color="#fff" size={11} />
          </View>
        )}
        <View style={s.myCardMemberBadge}>
          <Users color="#fff" size={11} />
          <Text style={s.myCardMemberText}>{group.memberCount}명</Text>
        </View>
      </View>
      <View style={s.myCardInfo}>
        <Text style={s.myCardName} numberOfLines={1}>
          {group.name}
        </Text>
        {group.description ? (
          <Text style={s.myCardDesc} numberOfLines={2}>
            {group.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function MoreCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.moreCard, { width: MY_CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.moreIconWrap}>
        <ChevronRight color="#3B82F6" size={24} />
      </View>
      <Text style={s.moreTitle} numberOfLines={1}>
        전체 보기
      </Text>
      <Text style={s.moreDesc} numberOfLines={1}>
        {count}개 모두
      </Text>
    </TouchableOpacity>
  );
}

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const color = getAvatarColor(group.name);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {group.joinedByMe && (
        <View style={[s.cardAccent, { backgroundColor: color }]} />
      )}
      <View
        style={[
          s.cardAvatar,
          { backgroundColor: group.profileImageUrl ? "#F1F5F9" : color },
        ]}
      >
        {group.profileImageUrl ? (
          <Image source={{ uri: group.profileImageUrl }} style={s.cardImg} />
        ) : (
          <Text style={s.cardAvatarText}>
            {group.name[0]?.toUpperCase() ?? "?"}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.cardName} numberOfLines={1}>
            {group.name}
          </Text>
          {group.type === "PRIVATE" && (
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            marginTop: 2,
          }}
        >
          <Users color="#94A3B8" size={11} />
          <Text style={s.cardMeta}>{group.memberCount}명</Text>
        </View>
      </View>
      {group.joinedByMe && (
        <View style={s.joinedBadge}>
          <Text style={s.joinedBadgeText}>참여중</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7FF" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 13, color: "#94A3B8", marginTop: 2 },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    // Android elevation은 탭 페이저 진입 초기 프레임에 검은 테두리 깜빡임을
    // 유발한다. elevation 대신 boxShadow로 같은 그림자를 그린다(RN 0.81+).
    ...Platform.select({
      ios: { ...cardShadow, shadowOffset: { width: 0, height: 0 } },
      android: { boxShadow: "0px 0px 10px rgba(30,58,138,0.12)" },
    }),
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },

  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#334155", flex: 1 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
  },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 1 },
  seeAllText: { fontSize: 13, fontWeight: "600", color: "#3B82F6" },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  loadMoreText: { fontSize: 14, fontWeight: "700", color: "#3B82F6" },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 36,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F8FAFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptyDesc: { fontSize: 13, color: "#94A3B8" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    paddingLeft: 18,
    marginBottom: 10,
    gap: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  cardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardAvatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  cardImg: { width: 52, height: 52 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F172A", flex: 1 },
  cardDesc: { fontSize: 13, color: "#64748B" },
  cardMeta: { fontSize: 12, color: "#94A3B8" },
  privateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  privateBadgeText: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  joinedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
  },
  joinedBadgeText: { fontSize: 12, fontWeight: "700", color: "#3B82F6" },

  myCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  myCardBanner: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  myCardBannerImg: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  myCardInitial: {
    fontSize: 44,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
  },
  myCardLockBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  myCardMemberBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  myCardMemberText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  myCardInfo: {
    padding: 12,
    gap: 4,
  },
  myCardName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  myCardDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },

  moreCard: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  moreIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  moreTitle: { fontSize: 13, fontWeight: "800", color: "#1D4ED8" },
  moreDesc: { fontSize: 11, color: "#94A3B8" },
  myCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  myCardMetaText: { fontSize: 11, color: "#94A3B8" },
});
