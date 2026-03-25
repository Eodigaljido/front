// @ts-nocheck
import React, { useMemo } from 'react';
import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { useMockData } from '../context/MockDataContext';
import { MOCK_COURSES, type CourseItem } from '../data/mockData';

type MyRouteNavProp = BottomTabNavigationProp<RootTabParamList, 'MyRoute'>;

const CARD_STYLE = {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 16,
  marginHorizontal: 16,
  marginBottom: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export default function MyRouteScreen(): React.JSX.Element {
  const navigation = useNavigation<MyRouteNavProp>();
  const { savedCourseIds, removeSavedCourse } = useMockData();

  const savedCourses = useMemo(
    () => MOCK_COURSES.filter(c => savedCourseIds.includes(c.id)),
    [savedCourseIds],
  );

  const handleRemove = (item: CourseItem) => {
    Alert.alert('저장 삭제', `"${item.title}" 코스를 저장 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => removeSavedCourse(item.id) },
    ]);
  };

  if (savedCourses.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="items-center justify-center flex-1 px-8">
          <View className="p-6 bg-gray-100 rounded-full">
            <Ionicons name="bookmark-outline" size={48} color="#9ca3af" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
            저장한 코스가 없습니다
          </Text>
          <Text className="mt-2 text-sm text-center text-gray-500">
            공유 루트에서 마음에 드는 코스를 저장해 보세요.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('SharedRoute')}
            className="px-6 py-3 mt-6 bg-blue-500 rounded-xl"
          >
            <Text className="font-medium text-white">공유 루트 보기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 py-3 border-b border-gray-100">
        <Text className="text-lg font-bold text-gray-900">저장한 코스</Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          {savedCourses.length}개의 코스를 저장했어요
        </Text>
      </View>
      <FlatList<CourseItem>
        data={savedCourses}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={CARD_STYLE}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 min-w-0">
                <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="mt-1 text-xs text-gray-500">{item.meta}</Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View className="rounded bg-green-100 px-2 py-0.5">
                    <Text className="text-xs text-green-700">{item.departure}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color="#9ca3af" />
                  <View className="rounded bg-red-100 px-2 py-0.5">
                    <Text className="text-xs text-red-700">{item.arrival}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => handleRemove(item)}
                className="p-2 ml-2 bg-gray-100 rounded-lg"
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
