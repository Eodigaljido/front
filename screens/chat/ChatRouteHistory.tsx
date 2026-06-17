import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { ChevronLeft, MapPin } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { safeGoBack } from "@/navigation/rootNavigation";
import { RootStackParamList } from "@/App";
import { BubbleChat } from "@/stories/chat/BubbleChat";
import { useAuthStore } from "@/store/authStore";
import {
  RouteHistoryItem,
  RouteFeedItem,
  RouteFeedPage,
  getRouteHistory,
  getRouteFeed,
} from "@/api/chat/chat";

type ChatRouteHistoryRouteProp = RouteProp<RootStackParamList, "ChatRouteHistory">;

const ACCENT_COLORS = [
  "#0088FF",
  "#34C759",
  "#FF9500",
  "#5AC8FA",
  "#FF3B30",
  "#AF52DE",
  "#30D158",
];

// ── Feed Detail ────────────────────────────────────────────────────────────────

interface FeedProps {
  selectedRoute: RouteHistoryItem;
  accessToken: string;
  userUuid: string | undefined;
  onBack: () => void;
}

const RouteHistoryFeed = ({
  selectedRoute,
  accessToken,
  userUuid,
  onBack,
}: FeedProps) => {
  const [feedItems, setFeedItems] = useState<RouteFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const canLoadMoreRef = useRef(false);

  useEffect(() => {
    getRouteFeed(accessToken, selectedRoute.courseUuid, 0, 30)
      .then((data: RouteFeedPage) => {
        setFeedItems(data.items);
        setTotalPages(data.pageInfo.totalPages);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
          setTimeout(() => {
            canLoadMoreRef.current = true;
          }, 300);
        }, 100);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken, selectedRoute.courseUuid]);

  const loadMore = useCallback(async () => {
    if (!canLoadMoreRef.current || loadingMore || page + 1 >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await getRouteFeed(accessToken, selectedRoute.courseUuid, next, 30);
      setFeedItems((prev) => [...prev, ...data.items]);
      setPage(next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, selectedRoute.courseUuid, page, totalPages, loadingMore]);

  const handleScroll = ({ nativeEvent }: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    const nearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    if (nearBottom) loadMore();
  };

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <View style={styles.feedHeaderCenter}>
            <Text style={styles.feedHeaderTitle} numberOfLines={1}>
              {selectedRoute.name}
            </Text>
            <Text style={styles.feedHeaderSub}>
              {selectedRoute.participantCount}명 참여
            </Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" />
          </View>
        ) : feedItems.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>기록이 없습니다</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 16 }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {feedItems.map((item) => {
              if (item.type === "CHAT" && item.action === "CHAT") {
                const isMine = item.actorUuid === userUuid;
                return (
                  <BubbleChat
                    key={item.itemId}
                    text={item.content ?? undefined}
                    isMine={isMine}
                    sentAt={new Date(item.createdAt)}
                    userName={item.actorNickname}
                    profileImageUrl={
                      !isMine ? (item.actorProfileImageUrl ?? undefined) : undefined
                    }
                    showSender={!isMine}
                  />
                );
              }
              return (
                <View key={item.itemId} style={feedStyles.eventRow}>
                  <Text style={feedStyles.eventText}>{item.editDescription}</Text>
                  <Text style={feedStyles.eventTime}>
                    {new Date(item.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            })}
            {loadingMore && (
              <ActivityIndicator size="small" style={{ marginVertical: 8 }} />
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────

export const ChatRouteHistory = () => {
  const route = useRoute<ChatRouteHistoryRouteProp>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { roomUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);
  const userUuid = useAuthStore((s) => s.user?.uuid);

  const [routeList, setRouteList] = useState<RouteHistoryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteHistoryItem | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getRouteHistory(accessToken, roomUuid)
      .then(setRouteList)
      .catch(console.error)
      .finally(() => setListLoading(false));
  }, [accessToken, roomUuid]);

  if (selectedRoute) {
    return (
      <RouteHistoryFeed
        selectedRoute={selectedRoute}
        accessToken={accessToken ?? ""}
        userUuid={userUuid}
        onBack={() => setSelectedRoute(null)}
      />
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => safeGoBack(navigation)}
            style={styles.headerBtn}
          >
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>루트 기록</Text>
          <View style={styles.headerBtn} />
        </View>

        {listLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" />
          </View>
        ) : routeList.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>루트 기록이 없습니다</Text>
            <Text style={styles.emptySubText}>
              공동 편집 세션 중 생성된 루트가 여기에 표시됩니다
            </Text>
          </View>
        ) : (
          <FlatList
            data={routeList}
            keyExtractor={(item) => item.courseUuid}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.threadItem}
                onPress={() => setSelectedRoute(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.threadIcon,
                    { backgroundColor: ACCENT_COLORS[index % ACCENT_COLORS.length] },
                  ]}
                >
                  <MapPin size={18} color="#fff" />
                </View>
                <View style={styles.threadContent}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.threadDesc}>{item.participantCount}명 참여</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: 80,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  feedHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  feedHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  feedHeaderSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  threadItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  threadIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  threadContent: {
    flex: 1,
    gap: 4,
  },
  threadName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  threadDesc: {
    fontSize: 13,
    color: "#8E8E93",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginLeft: 80,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  emptySubText: {
    fontSize: 13,
    color: "#AEAEB2",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

const feedStyles = StyleSheet.create({
  eventRow: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 16,
    gap: 2,
  },
  eventText: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "center",
  },
  eventTime: {
    fontSize: 11,
    color: "#AEAEB2",
    textAlign: "center",
  },
});
