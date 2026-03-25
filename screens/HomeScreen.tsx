// @ts-nocheck
import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../App";
import { Ionicons } from "@expo/vector-icons";
import { useMockData } from "../context/MockDataContext";
import { getPopularNearbyCourses, MOCK_CHAT_ROOMS } from "../data/mockData";

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_MARGIN = 16;
const PLACEHOLDER_CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_MARGIN * 2 - 12 * 2) / 3;

const CARD_STYLE = {
  backgroundColor: "#f3f4f6",
  borderRadius: 16,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export default function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<HomeNavProp>();
  const { savedCourseIds, publicCourseIds } = useMockData();
  const popularCourses = getPopularNearbyCourses(3);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingHorizontal: HORIZONTAL_MARGIN,
        }}
      >
        {/* 현재 위치 카드 */}
        <Pressable style={[CARD_STYLE, { marginTop: 16 }]}>
          <View className="flex-row items-center">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#e5e7eb",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="location" size={22} color="#ef4444" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs text-gray-500">현재 위치</Text>
              <Text className="mt-0.5 text-base font-bold text-gray-900">
                마포구 홍대입구
              </Text>
              <Text className="mt-1 text-xs text-gray-500">
                오늘 주변 인기 코스 3개 · 이벤트 5개
              </Text>
            </View>
            <Pressable hitSlop={12}>
              <Text className="text-sm font-medium text-blue-500">변경</Text>
            </Pressable>
          </View>
        </Pressable>

        {/* 저장한 코스 카드 */}
        <Pressable
          style={[CARD_STYLE, { marginTop: 12 }]}
          onPress={() => navigation.navigate("MyRoute")}
        >
          <View className="flex-row items-center">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="layers-outline" size={22} color="#2563eb" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm text-gray-600">저장한 코스</Text>
              <Text className="text-lg font-bold text-blue-600">
                {savedCourseIds.length}개
              </Text>
            </View>
            <Text className="text-sm font-medium text-gray-900">전체 보기</Text>
          </View>
        </Pressable>

        {/* 공개한 코스 카드 */}
        <Pressable
          style={[CARD_STYLE, { marginTop: 12 }]}
          onPress={() => navigation.navigate("SharedRoute")}
        >
          <View className="flex-row items-center">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="layers-outline" size={22} color="#2563eb" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm text-gray-600">공개한 코스</Text>
              <Text className="text-lg font-bold text-blue-600">
                {publicCourseIds.length}개
              </Text>
            </View>
            <Text className="text-sm font-medium text-gray-900">전체 보기</Text>
          </View>
        </Pressable>

        {/* 최근 채팅 */}
        <View style={{ marginTop: 28 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">최근 채팅</Text>
            <Pressable hitSlop={12} onPress={() => navigation.navigate("Chat")}>
              <Text className="text-sm font-medium text-blue-500">더보기</Text>
            </Pressable>
          </View>
          {MOCK_CHAT_ROOMS.length === 0 ? (
            <View
              style={[
                CARD_STYLE,
                {
                  marginTop: 12,
                  minHeight: 160,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
              <Text className="mt-2 text-sm text-gray-400">
                최근 채팅이 없습니다
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 8 }}>
              {MOCK_CHAT_ROOMS.map((room) => (
                <Pressable
                  key={room.id}
                  style={[CARD_STYLE, { marginTop: 0 }]}
                  onPress={() => navigation.navigate("Chat")}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold text-gray-900">
                      {room.name}
                    </Text>
                    {room.unread > 0 && (
                      <View className="rounded-full bg-blue-500 px-2 py-0.5">
                        <Text className="text-xs font-medium text-white">
                          {room.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className="mt-1 text-sm text-gray-500"
                    numberOfLines={1}
                  >
                    {room.lastMessage}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {room.time}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 주변 인기 코스 */}
        <View style={{ marginTop: 28 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">
              주변 인기 코스
            </Text>
            <Pressable
              hitSlop={12}
              onPress={() =>
                navigation.navigate("SharedRoute", {
                  openFilter: true,
                  openAsPopular: true,
                })
              }
            >
              <Text className="text-sm font-medium text-blue-500">
                자세히 보기
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              marginTop: 12,
              paddingRight: HORIZONTAL_MARGIN,
              gap: 12,
            }}
            style={{
              marginLeft: -HORIZONTAL_MARGIN,
              paddingLeft: HORIZONTAL_MARGIN,
            }}
          >
            {popularCourses.map((course) => (
              <Pressable
                key={course.id}
                style={[
                  CARD_STYLE,
                  {
                    width: PLACEHOLDER_CARD_WIDTH,
                    minHeight: 100,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
                onPress={() =>
                  navigation.navigate("SharedRoute", {
                    viewCourseId: course.id,
                    openAsPopular: true,
                  })
                }
              >
                <Ionicons name="map-outline" size={28} color="#9ca3af" />
                <Text
                  className="mt-2 text-xs text-gray-600 text-center"
                  numberOfLines={2}
                >
                  {course.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
