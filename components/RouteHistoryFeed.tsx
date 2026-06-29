import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Image,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RouteFeedItem } from "@/api/chat/chat";
import { getRouteFeed } from "@/api/chat/chat";

type Props = {
  courseId: string;
  accessToken: string | null;
  onClose?: () => void;
};

export function RouteHistoryFeed({
  courseId,
  accessToken,
  onClose,
}: Props): React.JSX.Element {
  const [items, setItems] = useState<RouteFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadFeed = useCallback(
    async (pageNum: number) => {
      if (!accessToken || !courseId) return;
      setLoading(true);
      try {
        console.log(`[RouteHistoryFeed] 피드 로드 시작: courseId=${courseId}, page=${pageNum}`);
        const result = await getRouteFeed(accessToken, courseId, pageNum, 30);
        console.log(`[RouteHistoryFeed] 피드 로드 완료: ${result.items?.length ?? 0}개 항목`);
        if (pageNum === 0) {
          setItems(result.items ?? []);
        } else {
          setItems((prev) => [...prev, ...(result.items ?? [])]);
        }
        setHasMore(
          (result.pageInfo?.page ?? 0) < ((result.pageInfo?.totalPages ?? 1) - 1)
        );
      } catch (err) {
        console.error("[RouteHistoryFeed] 루트 기록 로드 실패:", err);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, courseId]
  );

  useEffect(() => {
    void loadFeed(0);
    setPage(0);
  }, [courseId, accessToken, loadFeed]);

  const getActionIcon = (action: string): string => {
    switch (action) {
      case "CHAT_SENDED":
        return "chatbubble-outline";
      case "CHAT_EDITED":
        return "pencil-outline";
      case "CHAT_DELETED":
        return "trash-outline";
      case "ROUTE_UPDATED":
        return "map-outline";
      default:
        return "information-circle-outline";
    }
  };

  const getActionColor = (type: string, action: string): string => {
    if (type === "CHAT") {
      if (action === "CHAT_SENDED") return "#2563EB";
      if (action === "CHAT_EDITED") return "#F59E0B";
      if (action === "CHAT_DELETED") return "#EF4444";
    }
    if (type === "COURSE" && action === "ROUTE_UPDATED") return "#10B981";
    return "#6B7280";
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderItem = ({ item }: { item: RouteFeedItem }) => {
    const actionColor = getActionColor(item.type, item.action);
    const icon = getActionIcon(item.action);

    return (
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        {/* 타임라인 도트 */}
        <View
          style={{
            width: 40,
            alignItems: "center",
            paddingTop: 4,
            marginRight: 12,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: actionColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon as any} size={16} color="white" />
          </View>
        </View>

        {/* 메시지 내용 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {item.actorProfileImageUrl ? (
              <Image
                source={{ uri: item.actorProfileImageUrl }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#E5E7EB",
                }}
              />
            ) : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#E5E7EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
                  {item.actorNickname?.[0] ?? "?"}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827" }}>
              {item.editDescription}
            </Text>
          </View>

          {/* 채팅 메시지 내용 */}
          {item.content && (
            <Text
              style={{
                marginTop: 6,
                marginLeft: 32,
                fontSize: 13,
                color: "#6B7280",
                fontStyle: "italic",
              }}
              numberOfLines={2}
            >
              "{item.content}"
            </Text>
          )}

          {/* 시간 */}
          <Text
            style={{
              marginTop: 4,
              marginLeft: 32,
              fontSize: 11,
              color: "#9CA3AF",
            }}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View
      style={{
        paddingVertical: 40,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
      <Text
        style={{
          marginTop: 12,
          fontSize: 14,
          color: "#9CA3AF",
          textAlign: "center",
        }}
      >
        아직 편집 기록이 없습니다
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || items.length === 0) return null;
    return (
      <View style={{ paddingVertical: 16, alignItems: "center" }}>
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
          편집 기록
        </Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </Pressable>
        )}
      </View>

      {/* 피드 리스트 */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.itemId}`}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={() => {
          if (hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            void loadFeed(nextPage);
          }
        }}
        onEndReachedThreshold={0.5}
        scrollEnabled
      />
    </View>
  );
}
