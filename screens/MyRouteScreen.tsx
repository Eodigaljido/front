// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  MOCK_COURSES,
  getCourseMapCenter,
  getCourseStepMapPoint,
  type CourseItem,
} from '../data/mockData';
import { useNavigation } from '@react-navigation/native';
import { useMockData } from '../context/MockDataContext';
import {
  UserSavedRoute,
  userRouteToCourseItem,
  userRouteMapCenter,
  userRouteMapPath,
} from '../data/userSavedRoute';
import AppMapView from '../components/AppMapView';
import FilterBottomSheet from '../components/FilterBottomSheet';
import { fetchMergedDirectionsPolyline } from '../data/googleDirectionsApi';

const CARD_STYLE = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

function CourseCard({
  item,
  onPressCard,
  onRemove,
  onEdit,
}: {
  item: CourseItem;
  onPressCard: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <View className="mx-4 mb-3 overflow-hidden bg-white rounded-2xl" style={CARD_STYLE}>
      <TouchableOpacity
        onPress={onPressCard}
        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
      >
        {/* 상단: 썸네일 + 제목/메타 + 삭제 아이콘 */}
        <View className="flex-row border-b border-gray-100 p-3.5">
          <View className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center justify-center w-full h-full bg-gray-100">
                <Ionicons name="image-outline" size={28} color="#d1d5db" />
              </View>
            )}
          </View>
          <View className="justify-center flex-1 min-w-0 ml-3">
            <Text
              className="text-[15px] font-semibold leading-snug text-gray-900"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text className="mt-1 text-xs text-gray-500">{item.meta}</Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity onPress={onEdit} className="justify-center pl-1" hitSlop={8}>
              <Ionicons name="create-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRemove} className="justify-center pl-2" hitSlop={8}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 경로 안내 */}
        <View className="flex-row items-center px-3.5 py-2.5">
          <View className="px-2 py-1 bg-green-500 rounded-md">
            <Text className="text-[11px] font-semibold text-white">출발</Text>
          </View>
          <Text className="ml-2 text-[13px] text-gray-900" numberOfLines={1}>
            {item.departure}
          </Text>
          <View className="w-px h-3 mx-2 bg-gray-300" />
          <View className="px-2 py-1 bg-red-500 rounded-md">
            <Text className="text-[11px] font-semibold text-white">도착</Text>
          </View>
          <Text className="ml-2 flex-1 text-[13px] text-gray-900" numberOfLines={1}>
            {item.arrival}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function getUserRouteStepPoint(
  route: UserSavedRoute,
  stepIndex: number,
): { lat: number; lng: number } {
  const s = route.stops[stepIndex];
  if (s?.lat != null && s?.lng != null) return { lat: s.lat, lng: s.lng };
  return userRouteMapCenter(route);
}

export default function MyRouteScreen(): React.JSX.Element {
  const stackNav = useNavigation<any>();
  const { savedCourseIds, removeSavedCourse, userSavedRoutes, deleteUserRoute } = useMockData();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [detailMergedPath, setDetailMergedPath] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);
  const [detailPathLoading, setDetailPathLoading] = useState(false);

  useEffect(() => {
    if (!viewingCourseId) {
      setMapFocus(null);
      setSelectedStepId(null);
      return;
    }
    const ur = userSavedRoutes.find(r => r.id === viewingCourseId);
    setMapFocus(ur ? userRouteMapCenter(ur) : getCourseMapCenter(viewingCourseId));
    setSelectedStepId(null);
  }, [viewingCourseId, userSavedRoutes]);

  useEffect(() => {
    if (!viewingCourseId) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }
    const ur = userSavedRoutes.find(r => r.id === viewingCourseId);
    const courseFromMock = MOCK_COURSES.find(c => c.id === viewingCourseId);
    const course = courseFromMock ?? (ur ? userRouteToCourseItem(ur) : null);
    if (!course) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    let stepPoints: { latitude: number; longitude: number }[] = [];
    if (ur && userRouteMapPath(ur).length >= 2) {
      stepPoints = userRouteMapPath(ur);
    } else if (course.routeSteps.length >= 2) {
      stepPoints = course.routeSteps.map((_, i) => {
        const p = getCourseStepMapPoint(course.id, i);
        return { latitude: p.lat, longitude: p.lng };
      });
    } else {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    const ac = new AbortController();
    setDetailPathLoading(true);
    setDetailMergedPath(null);
    fetchMergedDirectionsPolyline({
      points: stepPoints,
      mode: 'transit',
      transitType: 'subway',
      signal: ac.signal,
    })
      .then(path => {
        if (!ac.signal.aborted && path.length >= 2) setDetailMergedPath(path);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setDetailPathLoading(false);
      });

    return () => ac.abort();
  }, [viewingCourseId, userSavedRoutes]);

  const mergedCourses = useMemo(() => {
    const fromUser = userSavedRoutes.map(userRouteToCourseItem);
    const fromMock = MOCK_COURSES.filter(c => savedCourseIds.includes(c.id));
    return [...fromUser, ...fromMock];
  }, [userSavedRoutes, savedCourseIds]);

  const filteredCourses = useMemo(() => {
    let list = mergedCourses;

    if (selectedCategory) list = list.filter(c => c.category === selectedCategory);
    if (selectedRegion) list = list.filter(c => c.region === selectedRegion);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          c.meta.toLowerCase().includes(q) ||
          c.departure.toLowerCase().includes(q) ||
          c.arrival.toLowerCase().includes(q),
      );
    }

    if (selectedSort === '인기순' || selectedSort === '조회순') {
      list = [...list].sort((a, b) => b.views - a.views);
    } else if (selectedSort === '최신순') {
      list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }

    return list;
  }, [mergedCourses, searchQuery, selectedCategory, selectedRegion, selectedSort]);

  const isUserSavedRouteId = (id: string) => userSavedRoutes.some(r => r.id === id);

  const handleRemove = (item: CourseItem) => {
    Alert.alert('저장 삭제', `"${item.title}" 코스를 저장 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          if (isUserSavedRouteId(item.id)) deleteUserRoute(item.id);
          else removeSavedCourse(item.id);
          if (viewingCourseId === item.id) setViewingCourseId(null);
        },
      },
    ]);
  };

  const openRouteCreateEdit = (routeId: string, collaborative: boolean) => {
    stackNav.getParent()?.navigate('RouteCreate', {
      editRouteId: routeId,
      collaborative,
    });
  };

  const openRouteCreateFromMockCourse = (mockCourseId: string) => {
    stackNav.getParent()?.navigate('RouteCreate', { seedMockCourseId: mockCourseId });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* 헤더 배너 */}
      <View className="overflow-hidden">
        <ImageBackground
          source={require('../assets/banner-water.png')}
          resizeMode="cover"
          style={{ width: '100%', minHeight: 100 }}
          imageStyle={{ opacity: 0.9 }}
        >
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <View
            className="flex-row items-center px-5 pt-2 pb-5"
            style={{ zIndex: 1, minHeight: 100 }}
          >
            <Text className="text-2xl font-bold text-white">내 코스</Text>
            <View
              style={{
                width: 1,
                height: 30,
                backgroundColor: 'rgba(255,255,255,0.9)',
                marginHorizontal: 16,
              }}
            />
            <View className="justify-center flex-1">
              <Text className="text-sm text-white opacity-95">나만의 경로를 짜고</Text>
              <Text className="mt-0.5 text-sm text-white opacity-95">동선을 파악해 보아요!</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => stackNav.getParent()?.navigate('RouteCreate')}
              className="px-3 py-2 rounded-xl bg-white/20 active:opacity-90"
            >
              <Text className="text-xs font-bold text-white">루트 제작</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* 검색 + 필터 */}
      <View className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-100">
        <View className="flex-1 flex-row items-center rounded-xl bg-gray-100 px-4 py-2.5">
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            placeholder="루트 이름, 장소 검색"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-base text-gray-800"
          />
        </View>
        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          className="items-center justify-center w-10 h-10 bg-gray-100 rounded-xl"
        >
          <Ionicons name="options-outline" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* 저장 코스 수 */}
      <View className="px-4 py-2.5 border-b border-gray-100">
        <Text className="text-sm text-gray-500">
          {filteredCourses.length}개의 코스를 저장했어요
        </Text>
      </View>

      {/* 코스 리스트 */}
      {filteredCourses.length === 0 ? (
        <View className="items-center justify-center flex-1 px-8">
          <View className="p-6 bg-gray-100 rounded-full">
            <Ionicons name="bookmark-outline" size={48} color="#9ca3af" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
            저장한 코스가 없습니다
          </Text>
          <Text className="mt-2 text-sm text-center text-gray-500">
            루트 제작에서 직접 저장하거나, 공유 루트에서 코스를 저장해 보세요.
          </Text>
        </View>
      ) : (
        <FlatList<CourseItem>
          data={filteredCourses}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CourseCard
              item={item}
              onPressCard={() => setViewingCourseId(item.id)}
              onRemove={() => handleRemove(item)}
              onEdit={() => {
                if (isUserSavedRouteId(item.id)) openRouteCreateEdit(item.id, false);
                else openRouteCreateFromMockCourse(item.id);
              }}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedSort={selectedSort}
        onCategoryToggle={cat => setSelectedCategory(prev => (prev === cat ? null : cat))}
        onRegionToggle={region => setSelectedRegion(prev => (prev === region ? null : region))}
        onSortToggle={opt => setSelectedSort(prev => (prev === opt ? null : opt))}
        onReset={() => {
          setSelectedCategory(null);
          setSelectedRegion(null);
          setSelectedSort(null);
        }}
        onApply={() => {}}
      />

      {/* 코스 상세 보기 모달 */}
      <Modal
        visible={!!viewingCourseId}
        transparent
        animationType="slide"
        onRequestClose={() => setViewingCourseId(null)}
      >
        <View style={{ flex: 1 }}>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(107,114,128,0.45)' }]}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setViewingCourseId(null)}
          />

          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View
              className="overflow-hidden rounded-t-3xl"
              style={{ maxHeight: '82%', backgroundColor: '#0f172a' }}
            >
              {viewingCourseId &&
                (() => {
                  const ur = userSavedRoutes.find(r => r.id === viewingCourseId);
                  const courseFromMock = MOCK_COURSES.find(c => c.id === viewingCourseId);
                  const course = courseFromMock ?? (ur ? userRouteToCourseItem(ur) : null);
                  if (!course) return null;

                  const hours = (course.overallDurationMinutes / 60).toFixed(1);
                  let pathPts: { latitude: number; longitude: number }[] | undefined;
                  if (ur && userRouteMapPath(ur).length >= 1) {
                    pathPts = userRouteMapPath(ur).map(p => ({
                      latitude: p.latitude,
                      longitude: p.longitude,
                    }));
                  } else if (course.routeSteps.length >= 1) {
                    pathPts = course.routeSteps.map((_, i) => {
                      const p = getCourseStepMapPoint(course.id, i);
                      return { latitude: p.lat, longitude: p.lng };
                    });
                  } else {
                    pathPts = undefined;
                  }
                  const mapMarkers =
                    pathPts && pathPts.length >= 1
                      ? pathPts.map((pt, i) => ({
                          latitude: pt.latitude,
                          longitude: pt.longitude,
                          label: `${i + 1}`,
                        }))
                      : undefined;
                  const polylinePath =
                    detailMergedPath && detailMergedPath.length >= 2 ? detailMergedPath : pathPts;
                  const fallbackCenter = ur
                    ? userRouteMapCenter(ur)
                    : getCourseMapCenter(course.id);
                  const mapCenter = mapFocus ?? fallbackCenter;
                  const mapLevel = polylinePath && polylinePath.length >= 2 ? 5 : 4;
                  const startStepName = course.routeSteps[0]?.name ?? course.departure;
                  const endStepName =
                    course.routeSteps[course.routeSteps.length - 1]?.name ?? course.arrival;

                  return (
                    <>
                      <View
                        style={{
                          backgroundColor: '#0f172a',
                          paddingTop: 14,
                          paddingBottom: 14,
                          borderTopLeftRadius: 24,
                          borderTopRightRadius: 24,
                          overflow: 'hidden',
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: '#1e293b',
                        }}
                      >
                        <View className="flex-row items-center justify-between px-4 mb-2">
                          <Text className="text-sm font-semibold text-white/90">코스 위치</Text>
                          <TouchableOpacity onPress={() => setViewingCourseId(null)} hitSlop={12}>
                            <Ionicons name="close" size={26} color="#e2e8f0" />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            height: 200,
                            marginHorizontal: 10,
                            borderRadius: 14,
                            overflow: 'hidden',
                            backgroundColor: '#0f172a',
                            borderWidth: 2,
                            borderColor: '#0f172a',
                            position: 'relative',
                          }}
                        >
                          <AppMapView
                            key={
                              ur
                                ? `ur-${ur.id}-${mapCenter.lat}-${mapCenter.lng}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}`
                                : `mc-${course.id}-${mapCenter.lat}-${mapCenter.lng}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}`
                            }
                            latitude={mapCenter.lat}
                            longitude={mapCenter.lng}
                            level={mapLevel}
                            avoidLineOverlap
                            path={polylinePath && polylinePath.length >= 1 ? polylinePath : undefined}
                            stops={polylinePath && polylinePath.length >= 1 ? polylinePath : undefined}
                            markers={mapMarkers}
                            style={{ width: '100%', height: 200 }}
                          />
                          {detailPathLoading ? (
                            <View
                              style={{
                                position: 'absolute',
                                right: 10,
                                top: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: 'rgba(15,23,42,0.82)',
                              }}
                            >
                              <ActivityIndicator size="small" color="#e2e8f0" />
                              <Text style={{ fontSize: 11, color: '#e2e8f0', fontWeight: '600' }}>
                                경로 반영 중
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="mt-2 px-4 text-[11px] font-medium text-slate-300">
                          {pathPts && pathPts.length >= 2
                            ? `선 방향: 1번(${startStepName}) → ${pathPts.length}번(${endStepName})`
                            : '선 방향: 출발 지점 기준'}
                        </Text>
                      </View>

                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        className="bg-white"
                        contentContainerStyle={{
                          paddingHorizontal: 20,
                          paddingTop: 16,
                          paddingBottom: 28,
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-4">
                          <Text className="text-xl font-bold text-gray-900">코스 상세</Text>
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => {
                                setViewingCourseId(null);
                                if (ur) openRouteCreateEdit(ur.id, ur.collaborative === true);
                                else openRouteCreateFromMockCourse(course.id);
                              }}
                              className="flex-row items-center gap-1 rounded-xl bg-blue-50 px-3 py-2"
                            >
                              <Ionicons name="create-outline" size={16} color="#2563eb" />
                              <Text className="text-sm font-semibold text-blue-600">수정</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setViewingCourseId(null);
                                handleRemove(course);
                              }}
                              className="flex-row items-center gap-1 rounded-xl bg-red-50 px-3 py-2"
                            >
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                              <Text className="text-sm font-semibold text-red-500">저장 삭제</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text className="mb-1 text-base font-semibold text-gray-900">
                          {course.title}
                        </Text>
                        <Text className="mb-2 text-sm text-gray-500">{course.meta}</Text>

                        <View className="flex-row flex-wrap items-center gap-2 mb-3">
                          <View className="px-3 py-1 bg-gray-100 rounded-full">
                            <Text className="text-xs text-gray-700">{course.category}</Text>
                          </View>
                          <View className="px-3 py-1 bg-gray-100 rounded-full">
                            <Text className="text-xs text-gray-700">{course.region}</Text>
                          </View>
                          <View className="px-3 py-1 rounded-full bg-blue-50">
                            <Text className="text-xs text-blue-700">예상 소요 약 {hours}시간</Text>
                          </View>
                          <View className="px-3 py-1 rounded-full bg-yellow-50">
                            <Text className="text-xs text-yellow-700">
                              ★ {course.rating.toFixed(1)} ({course.reviewCount}명)
                            </Text>
                          </View>
                        </View>

                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          <View className="flex-row items-center">
                            <View className="px-2 py-1 bg-green-100 rounded">
                              <Text className="text-xs font-medium text-green-700">출발</Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.departure}
                            </Text>
                          </View>
                          <View className="flex-row items-center mt-2">
                            <View className="px-2 py-1 bg-red-100 rounded">
                              <Text className="text-xs font-medium text-red-700">도착</Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.arrival}
                            </Text>
                          </View>
                        </View>

                        <Text className="mb-2 text-sm font-semibold text-gray-900">코스 경로</Text>
                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          {course.routeSteps.map((step, index) => (
                            <TouchableOpacity
                              key={step.id}
                              onPress={() => {
                                if (ur) setMapFocus(getUserRouteStepPoint(ur, index));
                                else setMapFocus(getCourseStepMapPoint(course.id, index));
                                setSelectedStepId(step.id);
                              }}
                              className="flex-row items-start py-1.5"
                              style={[
                                index > 0 ? { borderTopWidth: 1, borderTopColor: '#e5e7eb' } : null,
                                selectedStepId === step.id
                                  ? { backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 8 }
                                  : null,
                              ]}
                            >
                              <Text className="mt-0.5 w-5 text-xs font-semibold text-gray-500">
                                {index + 1}.
                              </Text>
                              <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-900">
                                  {step.name}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </>
                  );
                })()}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
