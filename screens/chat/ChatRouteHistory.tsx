import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useAuthStore } from "@/store/authStore";
import {
  RouteHistoryItem,
  getRouteHistory,
} from "@/api/chat/chat";
import { RouteHistoryFeed } from "@/components/RouteHistoryFeed";

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

export const ChatRouteHistory = () => {
  const route = useRoute<ChatRouteHistoryRouteProp>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { roomUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    console.log("[ChatRouteHistory] roomUuid:", roomUuid);
  }, [roomUuid]);

  const [routeList, setRouteList] = useState<RouteHistoryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteHistoryItem | null>(null);

  useEffect(() => {
    if (!accessToken || !roomUuid) return;
    console.log("[ChatRouteHistory] 채팅방의 루트 목록 조회 시작:", { roomUuid });
    getRouteHistory(accessToken, roomUuid)
      .then((data) => {
        console.log("[ChatRouteHistory] 루트 목록 조회 완료:", data.length, "개");
        setRouteList(data);
      })
      .catch((err) => {
        console.error("[ChatRouteHistory] 루트 목록 조회 실패:", err);
        setRouteList([]);
      })
      .finally(() => setListLoading(false));
  }, [accessToken, roomUuid]);

  if (selectedRoute) {
    return (
      <RouteHistoryFeed
        courseId={selectedRoute.courseUuid}
        accessToken={accessToken}
        onClose={() => setSelectedRoute(null)}
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
