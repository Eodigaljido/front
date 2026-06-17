// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { safeGoBack } from "../navigation/rootNavigation";
import { getUserProfileByUuid, type UserProfile } from "../api/users";
import { fetchMySharedCourses } from "../api/courses";
import { instance } from "../api/axios";
import type { CourseItem } from "../data/mockData";
import ProfileAvatar from "../components/ProfileAvatar";

const ACCENT = "#F87171";
const PAGE_SIZE = 10;

type RouteParams = {
  uuid: string;
  email?: string;
};

function extractEmailPrefix(email?: string | null): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function CourseCard({ item }: { item: CourseItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardThumbnail}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="map-outline" size={26} color="#94a3b8" />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.meta}
        </Text>
        <View style={styles.cardRoute}>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>출발</Text>
          </View>
          <Text style={styles.cardRouteText} numberOfLines={1}>
            {item.departure}
          </Text>
          <View style={styles.cardSeparator} />
          <View style={[styles.cardBadge, { backgroundColor: "#475569" }]}>
            <Text style={styles.cardBadgeText}>도착</Text>
          </View>
          <Text style={[styles.cardRouteText, { flex: 1 }]} numberOfLines={1}>
            {item.arrival}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function UserProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { uuid, email: paramEmail } = (route.params ?? {}) as RouteParams;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"routes" | "favorites">("routes");
  const [menuVisible, setMenuVisible] = useState(false);

  const [routes, setRoutes] = useState<CourseItem[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesPage, setRoutesPage] = useState(0);
  const [routesHasMore, setRoutesHasMore] = useState(true);
  const routesBusyRef = useRef(false);

  const [favorites, setFavorites] = useState<CourseItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesPage, setFavoritesPage] = useState(0);
  const [favoritesHasMore, setFavoritesHasMore] = useState(true);
  const favoritesBusyRef = useRef(false);
  const favoritesInitialized = useRef(false);

  useEffect(() => {
    if (!uuid) return;
    getUserProfileByUuid(uuid)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [uuid]);

  const loadRoutes = useCallback(
    async (page: number, reset = false) => {
      if (routesBusyRef.current || !uuid) return;
      routesBusyRef.current = true;
      setRoutesLoading(true);
      try {
        const data = await fetchMySharedCourses();

        setRoutes((prev) => (reset ? data : [...prev, ...data]));
        setRoutesHasMore(data.length >= PAGE_SIZE);
        setRoutesPage(page);
      } catch {
        setRoutesHasMore(false);
      } finally {
        routesBusyRef.current = false;
        setRoutesLoading(false);
      }
    },
    [uuid],
  );

  const loadFavorites = useCallback(
    async (page: number, reset = false) => {
      if (favoritesBusyRef.current || !uuid) return;
      favoritesBusyRef.current = true;
      setFavoritesLoading(true);
      try {
        const res = await instance.get("/api/courses/saved", {
          params: { userUuid: uuid, sort: "latest", page, size: PAGE_SIZE },
        });
        const arr: any[] = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
            ? res.data
            : [];
        const items: CourseItem[] = arr.map((c, i) => ({
          id: String(c.id ?? c.uuid ?? `fav-${page}-${i}`),
          title: c.title ?? "코스",
          meta: c.meta ?? c.description ?? "",
          departure: c.departure ?? "출발지",
          arrival: c.arrival ?? "도착지",
          thumbnail: c.thumbnail ?? c.imageUrl ?? null,
          category: c.category ?? "기타",
          region: c.region ?? "",
          createdAt: c.createdAt ?? "",
          views: Number(c.views ?? 0),
          saveCount: Number(c.saveCount ?? 0),
          overallDurationMinutes: Number(c.overallDurationMinutes ?? 120),
          rating: Number(c.rating ?? 4.5),
          reviewCount: Number(c.reviewCount ?? 0),
          routeSteps: c.routeSteps ?? [
            { id: "fb", name: "경유지", stayMinutes: 30 },
          ],
          routeLegs: c.routeLegs ?? [],
          reviews: c.reviews ?? [],
        }));
        setFavorites((prev) => (reset ? items : [...prev, ...items]));
        setFavoritesHasMore(items.length >= PAGE_SIZE);
        setFavoritesPage(page);
      } catch {
        setFavoritesHasMore(false);
      } finally {
        favoritesBusyRef.current = false;
        setFavoritesLoading(false);
      }
    },
    [uuid],
  );

  useEffect(() => {
    if (uuid) loadRoutes(0, true);
  }, [uuid, loadRoutes]);

  const handleTabChange = useCallback(
    (tab: "routes" | "favorites") => {
      setActiveTab(tab);
      if (tab === "favorites" && !favoritesInitialized.current) {
        favoritesInitialized.current = true;
        loadFavorites(0, true);
      }
    },
    [loadFavorites],
  );

  const handleRoutesEndReached = useCallback(() => {
    if (routesHasMore && !routesBusyRef.current) loadRoutes(routesPage + 1);
  }, [routesHasMore, routesPage, loadRoutes]);

  const handleFavoritesEndReached = useCallback(() => {
    if (favoritesHasMore && !favoritesBusyRef.current)
      loadFavorites(favoritesPage + 1);
  }, [favoritesHasMore, favoritesPage, loadFavorites]);

  const handleAddFriend = useCallback(async () => {
    setMenuVisible(false);
    try {
      await instance.post("/api/friends/request", { targetUuid: uuid });
      Alert.alert("친구 추가", "친구 요청을 보냈습니다.");
    } catch {
      Alert.alert("오류", "친구 추가에 실패했습니다.");
    }
  }, [uuid]);

  const handleBlock = useCallback(() => {
    setMenuVisible(false);
    Alert.alert("차단", "이 사용자를 차단하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "차단",
        style: "destructive",
        onPress: async () => {
          try {
            await instance.post(`/api/users/${uuid}/block`);
            Alert.alert("완료", "사용자를 차단했습니다.");
            safeGoBack(navigation);
          } catch {
            Alert.alert("오류", "차단에 실패했습니다.");
          }
        },
      },
    ]);
  }, [uuid, navigation]);

  const handleReport = useCallback(() => {
    setMenuVisible(false);
    Alert.alert("신고", "이 사용자를 신고하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "신고",
        style: "destructive",
        onPress: async () => {
          try {
            await instance.post(`/api/users/${uuid}/report`);
            Alert.alert("완료", "신고가 접수되었습니다.");
          } catch {
            Alert.alert("오류", "신고에 실패했습니다.");
          }
        },
      },
    ]);
  }, [uuid]);

  const handleCopyUrl = useCallback(async () => {
    setMenuVisible(false);
    const url = `eodigaljido://profile/${uuid}`;
    try {
      await Share.share({ message: url, url });
    } catch {}
  }, [uuid]);

  const emailPrefix = extractEmailPrefix(profile?.email ?? paramEmail);

  const avgRating =
    routes.length > 0
      ? (routes.reduce((s, c) => s + c.rating, 0) / routes.length).toFixed(1)
      : "—";

  const listData = activeTab === "routes" ? routes : favorites;
  const listLoading = activeTab === "routes" ? routesLoading : favoritesLoading;
  const handleEndReached =
    activeTab === "routes" ? handleRoutesEndReached : handleFavoritesEndReached;

  const ListHeader = (
    <>
      {/* Profile section */}
      <View style={styles.profileSection}>
        {profileLoading ? (
          <ActivityIndicator
            size="small"
            color={ACCENT}
            style={{ margin: 24 }}
          />
        ) : (
          <View style={styles.profileRow}>
            <ProfileAvatar uri={profile?.profileImageUrl} size={72} style={styles.avatar} />
            <View style={styles.profileInfo}>
              <Text style={styles.nickname}>
                {profile?.nickname ?? "사용자"}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{routes.length}</Text>
                  <Text style={styles.statLabel}>공유한 코스</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{avgRating}</Text>
                  <Text style={styles.statLabel}>코스 평점</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{favorites.length}</Text>
                  <Text style={styles.statLabel}>즐겨찾기한 코스</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === "routes" && styles.tabBtnActive]}
          onPress={() => handleTabChange("routes")}
        >
          <Ionicons
            name="map"
            size={24}
            color={activeTab === "routes" ? "#fff" : "#374151"}
          />
        </Pressable>
        <Pressable
          style={[
            styles.tabBtn,
            activeTab === "favorites" && styles.tabBtnActive,
          ]}
          onPress={() => handleTabChange("favorites")}
        >
          <Ionicons
            name="heart"
            size={24}
            color={activeTab === "favorites" ? "#fff" : "#374151"}
          />
          {activeTab === "favorites" && <View style={styles.tabIndicator} />}
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => safeGoBack(navigation)}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {emailPrefix || "프로필"}
        </Text>
        <Pressable
          onPress={() => setMenuVisible(true)}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
        </Pressable>
      </View>

      {/* Content FlatList (key resets scroll on tab change) */}
      <FlatList
        key={activeTab}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CourseCard item={item} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !listLoading ? (
            <View style={styles.emptyView}>
              <Ionicons
                name={activeTab === "routes" ? "map-outline" : "heart-outline"}
                size={48}
                color="#D1D5DB"
              />
              <Text style={styles.emptyText}>
                {activeTab === "routes"
                  ? "아직 만든 루트가 없습니다."
                  : "즐겨찾기한 루트가 없습니다."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          listLoading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Three-dot action modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={handleAddFriend}>
              <Ionicons name="person-add-outline" size={20} color="#111827" />
              <Text style={styles.menuItemText}>친구 추가</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
              <Ionicons name="ban-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
                차단
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Ionicons name="flag-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: "#EF4444" }]}>
                신고
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleCopyUrl}>
              <Ionicons name="link-outline" size={20} color="#111827" />
              <Text style={styles.menuItemText}>프로필 URL 복사</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F5FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F0F5FF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  profileSection: {
    backgroundColor: "#F0F5FF",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#D1D5DB",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 28,
  },
  nickname: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -16,
    paddingTop: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#D1D5DB",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F0F5FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    position: "relative",
  },
  tabBtnActive: {
    backgroundColor: ACCENT,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(37,99,235,0.12)",
  },
  cardThumbnail: {
    width: 90,
    height: 90,
    backgroundColor: "#E5E7EB",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 3,
  },
  cardRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  cardBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  cardRouteText: {
    fontSize: 12,
    color: "#374151",
    marginLeft: 4,
    marginRight: 4,
  },
  cardSeparator: {
    width: 1,
    height: 10,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 2,
  },
  emptyView: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  menuSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "88%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
  },
});
