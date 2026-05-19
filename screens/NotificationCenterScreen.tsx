import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

type NoticeItem = {
  id: string;
  type: "공지" | "소식" | "이벤트";
  title: string;
  body: string;
  ago: string;
};

const MOCK_NOTICES: NoticeItem[] = [];

function typeTint(type: NoticeItem["type"]) {
  if (type === "공지") return { bg: "#DBEAFE", color: "#1D4ED8" };
  if (type === "이벤트") return { bg: "#FEE2E2", color: "#B91C1C" };
  return { bg: "#DCFCE7", color: "#166534" };
}

export default function NotificationCenterScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} className="mr-2 p-1">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">알림</Text>
      </View>

      <FlatList
        data={MOCK_NOTICES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 px-8">
            <Ionicons name="notifications-off-outline" size={44} color="#9ca3af" />
            <Text className="mt-3 text-center text-sm text-gray-500">
              알림 API 연동 후 목록이 표시됩니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tint = typeTint(item.type);
          return (
            <View
              className="mb-3 rounded-2xl bg-white p-4"
              style={{ borderWidth: 0.5, borderColor: "rgba(37,99,235,0.12)" }}
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
                  <Text style={{ color: tint.color, fontSize: 11, fontWeight: "600" }}>
                    {item.type}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">{item.ago}</Text>
              </View>
              <Text className="text-sm font-semibold text-gray-900">{item.title}</Text>
              <Text className="mt-1 text-xs text-gray-600">{item.body}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
