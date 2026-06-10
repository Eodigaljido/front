import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { fetchFollowingNews, type FollowingNewsItem } from "../api/courses";
import { safeGoBack } from "../navigation/rootNavigation";
import FollowingNewsAvatar from "../components/FollowingNewsAvatar";

export default function FollowingNewsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<FollowingNewsItem[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchFollowingNews(30)
      .then((res) => {
        if (mounted) setItems(res);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => safeGoBack(navigation)} className="p-1 mr-2">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">친구 소식</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View
            className="mb-2.5 flex-row items-center gap-3 rounded-[16px] p-3 bg-white"
            style={{
              borderWidth: 0.5,
              borderColor: "rgba(37,99,235,0.12)",
            }}
          >
            <FollowingNewsAvatar
              displayName={item.user}
              profileImageUrl={item.profileImageUrl}
              size={40}
            />
            <View className="flex-1 min-w-0">
              <Text style={{ fontSize: 13, fontWeight: "400", color: "#1A1A2E" }} numberOfLines={1}>
                <Text style={{ fontWeight: "600" }}>{item.user}</Text>님이 {item.action}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "400", color: "#6B7280" }} numberOfLines={1}>
                {item.courseName}
              </Text>
            </View>
            <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "400", color: "#6B7280" }}>
              {item.ago}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center px-4 mt-12">
            <Text className="text-sm leading-5 text-center text-gray-600">
              친구가 없어 표시할 소식이 없어요. 채팅 탭의 친구 목록에서 맺을 수 있어요.
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Tabs", { screen: "Chat" })}
              className="mt-4 active:opacity-80"
              accessibilityRole="link"
              accessibilityLabel="친구 추가하기, 채팅 탭으로 이동"
            >
              <Text className="text-sm font-semibold text-blue-600 underline">친구 추가하기</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}
