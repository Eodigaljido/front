import React, { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { fetchNotifications, type AppNotification } from "../api/notifications";
import { safeGoBack } from "../navigation/rootNavigation";

function formatAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function typeLabel(type: string): string {
  if (type.includes("CHAT")) return "채팅";
  if (type.includes("ROUTE")) return "루트";
  return "알림";
}

function typeTint(type: string) {
  if (type.includes("CHAT")) return { bg: "#DBEAFE", color: "#1D4ED8" };
  if (type.includes("ROUTE")) return { bg: "#DCFCE7", color: "#166534" };
  return { bg: "#F3F4F6", color: "#374151" };
}

export default function NotificationCenterScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchNotifications(accessToken);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center">
        <Pressable onPress={() => safeGoBack(navigation)} className="mr-2 p-1">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">알림</Text>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-8" color="#2563eb" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-8">
              <Ionicons name="notifications-off-outline" size={44} color="#9ca3af" />
              <Text className="mt-3 text-center text-sm text-gray-500">
                알림이 없어요
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const tint = typeTint(item.type);
            return (
              <View
                className="mb-3 rounded-2xl bg-white p-4"
                style={{
                  borderWidth: 0.5,
                  borderColor: item.isRead
                    ? "rgba(37,99,235,0.12)"
                    : "rgba(37,99,235,0.35)",
                  opacity: item.isRead ? 0.85 : 1,
                }}
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <View
                    style={{
                      backgroundColor: tint.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{ color: tint.color, fontSize: 11, fontWeight: "600" }}
                    >
                      {typeLabel(item.type)}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-500">
                    {formatAgo(item.createdAt)}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-gray-900">{item.title}</Text>
                <Text className="mt-1 text-xs text-gray-600">{item.body}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
