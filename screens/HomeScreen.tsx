// @ts-nocheck
import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ImageBackground,
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

const SOFT_CARD_STYLE = {
  backgroundColor: '#f3f4f6',
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.04)',
};

function SectionHeader({
  title,
  actionLabel,
  onPressAction,
}: {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-extrabold text-gray-900">{title}</Text>
      {actionLabel ? (
        <Pressable hitSlop={12} onPress={onPressAction}>
          <View className="flex-row items-center">
            <Text className="text-sm font-semibold text-blue-600">{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="#2563eb" />
          </View>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

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
        {/* 히어로 배너 */}
        <View className="mt-4 overflow-hidden rounded-3xl">
          <ImageBackground
            source={require('../assets/banner.jpg')}
            resizeMode="cover"
            style={{ width: '100%', minHeight: 132 }}
            imageStyle={{ opacity: 0.95 }}
          >
            <View className="px-5 pb-5 pt-5" style={{ minHeight: 132 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <Ionicons name="navigate" size={18} color="#fff" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-xs text-white/80">현재 위치</Text>
                    <Text className="mt-0.5 text-lg font-extrabold text-white">마포구 홍대입구</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {}}
                  className="rounded-full bg-white/15 px-3 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Text className="text-xs font-semibold text-white">변경</Text>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* 코스 통계 카드 */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Pressable
            style={[CARD_STYLE, { flex: 1, padding: 14 }]}
            onPress={() => navigation.navigate("MyRoute")}
          >
            <View className="flex-row items-center justify-between">
              <View className="rounded-2xl bg-blue-50 p-2.5">
                <Ionicons name="layers-outline" size={20} color="#2563eb" />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
            <Text className="mt-3 text-xs font-semibold text-gray-500">저장한 코스</Text>
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">{savedCourseIds.length}</Text>
            <Text className="mt-0.5 text-xs text-gray-500">전체 보기</Text>
          </Pressable>

          <Pressable
            style={[CARD_STYLE, { flex: 1, padding: 14 }]}
            onPress={() => navigation.navigate('SharedRoute')}
          >
            <View className="flex-row items-center justify-between">
              <View className="rounded-2xl bg-emerald-50 p-2.5">
                <Ionicons name="paper-plane" size={20} color="#059669" />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
            <Text className="mt-3 text-xs font-semibold text-gray-500">공개한 코스</Text>
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">{publicCourseIds.length}</Text>
            <Text className="mt-0.5 text-xs text-gray-500">전체 보기</Text>
          </Pressable>
        </View>

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
                SOFT_CARD_STYLE,
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

        <View style={{ height: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
