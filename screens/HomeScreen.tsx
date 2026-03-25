// @ts-nocheck
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { useMockData } from '../context/MockDataContext';
import { getPopularNearbyCourses, MOCK_CHAT_ROOMS } from '../data/mockData';

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_MARGIN = 16;
const FEATURE_CARD_WIDTH = SCREEN_WIDTH * 0.62;

const CARD_STYLE = {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 6,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.04)',
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: HORIZONTAL_MARGIN }}
      >
        {/* 히어로 배너 */}
        <View className="mt-4 overflow-hidden rounded-3xl">
          <ImageBackground
            source={require('../assets/banner.jpg')}
            resizeMode="cover"
            style={{ width: '100%', minHeight: 132 }}
            imageStyle={{ opacity: 0.95 }}
          >
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.38)',
              }}
            />
            <View className="px-5 pt-5 pb-5" style={{ minHeight: 132 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="items-center justify-center h-9 w-9 rounded-xl bg-white/15">
                    <Ionicons name="navigate" size={18} color="#fff" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-xs text-white/80">현재 위치</Text>
                    <Text className="mt-0.5 text-lg font-extrabold text-white">
                      마포구 홍대입구
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {}}
                  className="px-3 py-2 rounded-full bg-white/15"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Text className="text-xs font-semibold text-white">변경</Text>
                </Pressable>
              </View>

              <Text className="mt-3 text-sm font-semibold text-white/90">
                오늘 주변 인기 코스 {popularCourses.length}개 · 이벤트 5개
              </Text>

              {/* 퀵 액션 */}
              <View className="flex-row gap-10 mt-4">
                <Pressable
                  onPress={() => navigation.navigate('SharedRoute', { openFilter: true })}
                  className="flex-row items-center"
                >
                  <View className="items-center justify-center bg-white h-9 w-9 rounded-xl">
                    <Ionicons name="search" size={18} color="#111827" />
                  </View>
                  <Text className="ml-2 text-sm font-bold text-white">코스 찾기</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('MyRoute')}
                  className="flex-row items-center"
                >
                  <View className="items-center justify-center bg-white h-9 w-9 rounded-xl">
                    <Ionicons name="bookmark" size={18} color="#111827" />
                  </View>
                  <Text className="ml-2 text-sm font-bold text-white">내 저장</Text>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* 요약 카드 2개 */}
        <View className="flex-row gap-3 mt-4">
          <Pressable
            style={[CARD_STYLE, { flex: 1, padding: 14 }]}
            onPress={() => navigation.navigate('MyRoute')}
          >
            <View className="flex-row items-center justify-between">
              <View className="rounded-2xl bg-blue-50 p-2.5">
                <Ionicons name="bookmark" size={20} color="#2563eb" />
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
            <Text className="mt-3 text-xs font-semibold text-gray-500">저장한 코스</Text>
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">
              {savedCourseIds.length}
            </Text>
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
            <Text className="mt-1 text-2xl font-extrabold text-gray-900">
              {publicCourseIds.length}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">전체 보기</Text>
          </Pressable>
        </View>

        {/* 최근 채팅 */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            title="최근 채팅"
            actionLabel="더보기"
            onPressAction={() => navigation.navigate('Chat')}
          />
          {MOCK_CHAT_ROOMS.length === 0 ? (
            <View
              style={[
                SOFT_CARD_STYLE,
                {
                  marginTop: 12,
                  minHeight: 132,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
              <Text className="mt-2 text-sm text-gray-400">최근 채팅이 없습니다</Text>
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 8 }}>
              {MOCK_CHAT_ROOMS.map(room => (
                <Pressable
                  key={room.id}
                  style={[CARD_STYLE, { marginTop: 0, padding: 14 }]}
                  onPress={() => navigation.navigate('Chat')}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="items-center justify-center bg-gray-100 h-9 w-9 rounded-xl">
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#64748b" />
                      </View>
                      <Text className="ml-3 font-semibold text-gray-900">{room.name}</Text>
                    </View>
                    {room.unread > 0 && (
                      <View className="rounded-full bg-blue-500 px-2 py-0.5">
                        <Text className="text-xs font-medium text-white">{room.unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="mt-1 text-sm text-gray-500" numberOfLines={1}>
                    {room.lastMessage}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">{room.time}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 주변 인기 코스 */}
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            title="주변 인기 코스"
            actionLabel="자세히 보기"
            onPressAction={() =>
              navigation.navigate('SharedRoute', { openFilter: true, openAsPopular: true })
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              marginTop: 12,
              paddingRight: HORIZONTAL_MARGIN,
              gap: 12,
            }}
            style={{ marginLeft: -HORIZONTAL_MARGIN, paddingLeft: HORIZONTAL_MARGIN }}
          >
            {popularCourses.map(course => (
              <Pressable
                key={course.id}
                style={{ width: FEATURE_CARD_WIDTH }}
                onPress={() =>
                  navigation.navigate('SharedRoute', {
                    viewCourseId: course.id,
                    openAsPopular: true,
                  })
                }
              >
                <View style={[CARD_STYLE, { padding: 0, overflow: 'hidden' }]}>
                  <View style={{ height: 88, backgroundColor: '#111827' }}>
                    <ImageBackground
                      source={require('../assets/banner.jpg')}
                      resizeMode="cover"
                      style={{ width: '100%', height: '100%' }}
                      imageStyle={{ opacity: 0.85 }}
                    >
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          backgroundColor: 'rgba(0,0,0,0.35)',
                        }}
                      />
                      <View className="justify-end flex-1 px-4 pb-3">
                        <View className="flex-row items-center justify-between">
                          <View className="rounded-full bg-white/15 px-2.5 py-1">
                            <Text className="text-[11px] font-semibold text-white">
                              {course.region} · {course.category}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Ionicons name="eye-outline" size={14} color="#fff" />
                            <Text className="ml-1 text-[11px] font-semibold text-white/90">
                              {course.views}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ImageBackground>
                  </View>
                  <View className="px-4 pt-3 pb-4">
                    <Text className="text-sm font-extrabold text-gray-900" numberOfLines={2}>
                      {course.title}
                    </Text>
                    <View className="flex-row items-center mt-2">
                      <View className="rounded bg-green-100 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-green-700">
                          {course.departure}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color="#9ca3af"
                        style={{ marginHorizontal: 6 }}
                      />
                      <View className="rounded bg-red-100 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-red-700">
                          {course.arrival}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
