// @ts-nocheck - NativeWind(className) 타입이 @types/react-native와 병합되지 않아 일시 비활성화
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  MOCK_COURSES,
  getCourseMapCenter,
  getCourseStepMapPoint,
  type CourseItem,
  type CourseReview,
} from '../data/mockData';
import { useMockData } from '../context/MockDataContext';
import AppMapView from '../components/AppMapView';
import { fetchMergedDirectionsPolyline } from '../data/googleDirectionsApi';
import FilterBottomSheet, { CATEGORIES, REGIONS, SORT_OPTIONS } from '../components/FilterBottomSheet';

type SharedRouteParams = {
  openFilter?: boolean;
  openAsPopular?: boolean;
  viewCourseId?: string;
};

type TabId = 'all' | 'popular' | 'date' | 'friends';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'popular', label: '인기코스' },
  { id: 'date', label: '데이트' },
  { id: 'friends', label: '친구모임' },
];

const CARD_STYLE = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

function mergeSharedCourseWithExtraReviews(
  base: CourseItem,
  extras: CourseReview[] | undefined,
): CourseItem {
  const add = extras ?? [];
  const merged = [...base.reviews, ...add].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  const rating =
    merged.length > 0 ? merged.reduce((s, r) => s + r.rating, 0) / merged.length : base.rating;
  return {
    ...base,
    reviews: merged,
    rating,
    reviewCount: base.reviewCount + add.length,
  };
}

function CourseCard({ item, onPress }: { item: CourseItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-3 overflow-hidden rounded-2xl bg-white active:opacity-95"
      style={CARD_STYLE}
    >
      <View className="flex-row border-b border-gray-100 p-3.5">
        <View className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-gray-100">
              <Ionicons name="image-outline" size={28} color="#d1d5db" />
            </View>
          )}
        </View>
        <View className="ml-3 flex-1 min-w-0 justify-center">
          <Text className="text-[15px] font-semibold leading-snug text-gray-900" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="mt-1 text-xs text-gray-500">{item.meta}</Text>
        </View>
        <View className="justify-center pl-1">
          <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
        </View>
      </View>

      <View className="flex-row items-center px-3.5 py-2.5">
        <View className="rounded-md bg-green-500 px-2 py-1">
          <Text className="text-[11px] font-semibold text-white">출발</Text>
        </View>
        <Text className="ml-2 text-[13px] text-gray-900" numberOfLines={1}>
          {item.departure}
        </Text>
        <View className="mx-2 h-3 w-px bg-gray-300" />
        <View className="rounded-md bg-red-500 px-2 py-1">
          <Text className="text-[11px] font-semibold text-white">도착</Text>
        </View>
        <Text className="ml-2 flex-1 text-[13px] text-gray-900" numberOfLines={1}>
          {item.arrival}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SharedRouteScreen(): React.JSX.Element {
  const route = useRoute();
  const params = (route.params || {}) as SharedRouteParams;
  const { addSavedCourse, addSharedCourseReview, extraSharedCourseReviews } = useMockData();

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [courseDetailMergedPath, setCourseDetailMergedPath] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);
  const [courseDetailPathLoading, setCourseDetailPathLoading] = useState(false);

  const [reviewCourseId, setReviewCourseId] = useState<string | null>(null);
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [reviewUserName, setReviewUserName] = useState('나');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [detailModalMounted, setDetailModalMounted] = useState(false);
  const detailBackdropOpacity = useRef(new Animated.Value(0)).current;
  const detailSheetTranslateY = useRef(new Animated.Value(500)).current;
  const detailSheetOffY = useMemo(
    () => Math.min(520, Dimensions.get('window').height * 0.6),
    []
  );
  const viewingCourseIdRef = useRef<string | null>(null);
  viewingCourseIdRef.current = viewingCourseId;

  useEffect(() => {
    if (viewingCourseId) setDetailModalMounted(true);
  }, [viewingCourseId]);

  useEffect(() => {
    if (!(detailModalMounted && viewingCourseId)) return;
    detailSheetTranslateY.setValue(detailSheetOffY);
    detailBackdropOpacity.setValue(0);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(detailBackdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(detailSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 68,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [viewingCourseId, detailModalMounted, detailSheetOffY]);

  const closeCourseDetail = () => {
    if (!viewingCourseIdRef.current) return;
    setReviewComposerOpen(false);
    Animated.parallel([
      Animated.timing(detailBackdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(detailSheetTranslateY, {
        toValue: detailSheetOffY,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setViewingCourseId(null);
        setDetailModalMounted(false);
      }
    });
  };

  useEffect(() => {
    if (params?.openFilter) setFilterVisible(true);
    if (params?.openAsPopular) setSelectedSort('인기순');
    if (params?.viewCourseId) setViewingCourseId(params.viewCourseId);
  }, [params?.openFilter, params?.openAsPopular, params?.viewCourseId]);

  useEffect(() => {
    if (!viewingCourseId) {
      setMapFocus(null);
      setSelectedStepId(null);
      setReviewComposerOpen(false);
      setReviewCourseId(null);
      return;
    }
    setReviewComposerOpen(false);
    setMapFocus(getCourseMapCenter(viewingCourseId));
    setSelectedStepId(null);
  }, [viewingCourseId]);

  useEffect(() => {
    if (!viewingCourseId) {
      setCourseDetailMergedPath(null);
      setCourseDetailPathLoading(false);
      return;
    }
    const course = MOCK_COURSES.find(c => c.id === viewingCourseId);
    if (!course || course.routeSteps.length < 2) {
      setCourseDetailMergedPath(null);
      setCourseDetailPathLoading(false);
      return;
    }
    const stepPoints = course.routeSteps.map((_, i) => {
      const p = getCourseStepMapPoint(course.id, i);
      return { latitude: p.lat, longitude: p.lng };
    });
    const ac = new AbortController();
    setCourseDetailPathLoading(true);
    setCourseDetailMergedPath(null);
    fetchMergedDirectionsPolyline({
      points: stepPoints,
      mode: 'transit',
      transitType: 'subway',
      signal: ac.signal,
    })
      .then(path => {
        if (!ac.signal.aborted && path.length >= 2) setCourseDetailMergedPath(path);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setCourseDetailPathLoading(false);
      });
    return () => ac.abort();
  }, [viewingCourseId]);

  const filteredCourses = useMemo(() => {
    let list = [...MOCK_COURSES];

    if (activeTab === 'date') list = list.filter((c) => c.category === '데이트');
    else if (activeTab === 'friends') list = list.filter((c) => c.category === '친구모임');
    else if (activeTab === 'popular') list = [...list].sort((a, b) => b.views - a.views);

    if (selectedCategory) list = list.filter((c) => c.category === selectedCategory);
    if (selectedRegion) list = list.filter((c) => c.region === selectedRegion);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.meta.toLowerCase().includes(q) ||
          c.departure.toLowerCase().includes(q) ||
          c.arrival.toLowerCase().includes(q)
      );
    }

    if (selectedSort === '인기순') list = [...list].sort((a, b) => b.views - a.views);
    else if (selectedSort === '최신순') list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    else if (selectedSort === '조회순') list = [...list].sort((a, b) => b.views - a.views);
    else if (selectedSort === '거리순' || selectedSort === '추천순' || selectedSort === '저장순') {
      list = [...list].sort((a, b) => b.views - a.views);
    }

    return list;
  }, [activeTab, searchQuery, selectedCategory, selectedRegion, selectedSort]);

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };
  const handleRegionToggle = (region: string) => {
    setSelectedRegion((prev) => (prev === region ? null : region));
  };
  const handleSortToggle = (opt: string) => {
    setSelectedSort((prev) => (prev === opt ? null : opt));
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* 헤더 배너 - 이미지 배경 + 내부 흐림(오버레이) */}
      <View className="overflow-hidden">
        <ImageBackground
          source={require('../assets/banner.jpg')}
          resizeMode="cover"
          style={{ width: '100%', minHeight: 100 }}
          imageStyle={{ opacity: 0.9 }}
        >
          {/* 흐림 효과용 반투명 오버레이 */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          />
          <View
            className="px-5 pb-5 pt-2 flex-row items-center"
            style={{ zIndex: 1, minHeight: 100 }}
          >
            <Text className="text-2xl font-bold text-white">공유 코스</Text>
            <View
              style={{
                width: 1,
                height: 30,
                backgroundColor: 'rgba(255,255,255,0.9)',
                marginHorizontal: 16,
                alignItems: 'center',
              }}
            />
            <View className="flex-1 justify-center">
              <Text className="text-sm text-white opacity-95">
                다른 유저의 경로를 구경하고
              </Text>
              <Text className="mt-0.5 text-sm text-white opacity-95">
                같은 코스를 걸어 보아요!
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* 검색 + 필터 */}
      <View className="flex-row items-center gap-2 border-b border-gray-100 px-4 py-3">
        <View className="flex-1 flex-row items-center rounded-xl bg-gray-100 px-4 py-2.5">
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            placeholder="루트 이름, 장소 검색"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="ml-2 flex-1 text-base text-gray-800"
          />
        </View>
        <Pressable
          onPress={() => setFilterVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100"
        >
          <Ionicons name="options-outline" size={22} color="#374151" />
        </Pressable>
      </View>

      {/* 탭 - 세로 높이 고정으로 불필요한 빈 공간 제거 */}
      <View className="border-b border-gray-100" style={{ height: 40 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            gap: 20,
            alignItems: 'center',
          }}
          style={{ flexGrow: 0 }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.id ? '#ea580c' : 'transparent',
                paddingBottom: 2,
              }}
            >
              <Text
                className={`text-sm font-medium ${activeTab === tab.id ? 'text-orange-600' : 'text-gray-500'}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 코스 리스트 */}
      <FlatList<CourseItem>
        data={filteredCourses}
        keyExtractor={(item: CourseItem) => item.id}
        renderItem={({ item }: { item: CourseItem }) => (
          <CourseCard item={item} onPress={() => setViewingCourseId(item.id)} />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedSort={selectedSort}
        onCategoryToggle={handleCategoryToggle}
        onRegionToggle={handleRegionToggle}
        onSortToggle={handleSortToggle}
        onReset={() => {
          setSelectedCategory(null);
          setSelectedRegion(null);
          setSelectedSort(null);
        }}
        onApply={() => {
          // 실제 적용 시 필터 상태로 API 호출 등
        }}
      />

      {/* 코스 상세 보기 모달 — 배경은 페이드, 시트만 슬라이드 (Modal slide는 백드롭까지 같이 움직임) */}
      <Modal
        visible={detailModalMounted}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (reviewComposerOpen) {
            setReviewComposerOpen(false);
            return;
          }
          closeCourseDetail();
        }}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: detailBackdropOpacity,
              },
            ]}
          >
            <Pressable
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: 'rgba(107,114,128,0.45)' },
              ]}
              onPress={() => {
                if (reviewComposerOpen) {
                  setReviewComposerOpen(false);
                  return;
                }
                closeCourseDetail();
              }}
            />
          </Animated.View>

          <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            style={{
              width: '100%',
              maxHeight: '82%',
              transform: [{ translateY: detailSheetTranslateY }],
            }}
          >
          <View
            className="overflow-hidden rounded-t-3xl"
            style={{ maxHeight: '100%', backgroundColor: '#0f172a' }}
          >
            {viewingCourseId && (() => {
              const courseBase = MOCK_COURSES.find((c) => c.id === viewingCourseId);
              if (!courseBase) return null;
              const course = mergeSharedCourseWithExtraReviews(
                courseBase,
                extraSharedCourseReviews[courseBase.id],
              );

              const hours = (course.overallDurationMinutes / 60).toFixed(1);
              const mapCenter = mapFocus ?? getCourseMapCenter(course.id);

              const pathPts: { latitude: number; longitude: number }[] | undefined =
                course.routeSteps.length >= 1
                  ? course.routeSteps.map((_, i) => {
                      const p = getCourseStepMapPoint(course.id, i);
                      return { latitude: p.lat, longitude: p.lng };
                    })
                  : undefined;
              const polylinePath =
                courseDetailMergedPath && courseDetailMergedPath.length >= 2
                  ? courseDetailMergedPath
                  : pathPts;
                  const startStepName = course.routeSteps[0]?.name ?? course.departure;
                  const endStepName =
                    course.routeSteps[course.routeSteps.length - 1]?.name ?? course.arrival;
              const mapMarkers =
                pathPts && pathPts.length >= 1
                  ? pathPts.map((pt, i) => ({
                      latitude: pt.latitude,
                      longitude: pt.longitude,
                      label: `${i + 1}`,
                    }))
                  : undefined;
              const mapLevel = polylinePath && polylinePath.length >= 2 ? 5 : 4;

              return (
                <>
                  {/* 상단: 어두운 영역 + 지도 */}
                  <View
                    style={{
                      backgroundColor: '#0f172a',
                      paddingHorizontal: 0,
                      paddingTop: 14,
                      paddingBottom: 14,
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      overflow: 'hidden',
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: '#1e293b',
                    }}
                  >
                    <View className="mb-2 flex-row items-center justify-between px-4">
                      <Text className="text-sm font-semibold text-white/90">코스 위치</Text>
                      <Pressable onPress={closeCourseDetail} hitSlop={12}>
                        <Ionicons name="close" size={26} color="#e2e8f0" />
                      </Pressable>
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
                        key={`${course.id}-${mapCenter.lat}-${mapCenter.lng}-${polylinePath?.length ?? 0}-${courseDetailMergedPath?.length ?? 0}`}
                        latitude={mapCenter.lat}
                        longitude={mapCenter.lng}
                        level={mapLevel}
                        allowTap={false}
                        avoidLineOverlap
                        path={polylinePath && polylinePath.length >= 1 ? polylinePath : undefined}
                        stops={polylinePath && polylinePath.length >= 1 ? polylinePath : undefined}
                        markers={mapMarkers}
                        style={{ width: '100%', height: 200 }}
                      />
                      {courseDetailPathLoading ? (
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
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}
                  >
                  <View className="mb-4 flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-xl font-bold text-gray-900">코스 상세</Text>
                    <Pressable
                      onPress={() => {
                        addSavedCourse(course.id);
                        Alert.alert('추가됨', '내 루트에 추가되었습니다.');
                      }}
                      className="flex-row items-center rounded-xl bg-emerald-600 px-3 py-2 active:opacity-90"
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text className="ml-1 text-xs font-bold text-white">내 루트 추가</Text>
                    </Pressable>
                  </View>

                  <Text className="mb-1 text-base font-semibold text-gray-900">{course.title}</Text>
                  <Text className="mb-2 text-sm text-gray-500">{course.meta}</Text>

                  <View className="mb-3 flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full bg-gray-100 px-3 py-1">
                      <Text className="text-xs text-gray-700">{course.category}</Text>
                    </View>
                    <View className="rounded-full bg-gray-100 px-3 py-1">
                      <Text className="text-xs text-gray-700">{course.region}</Text>
                    </View>
                    <View className="rounded-full bg-blue-50 px-3 py-1">
                      <Text className="text-xs text-blue-700">예상 소요 약 {hours}시간</Text>
                    </View>
                    <View className="rounded-full bg-yellow-50 px-3 py-1">
                      <Text className="text-xs text-yellow-700">
                        ★ {course.rating.toFixed(1)} ({course.reviewCount}명)
                      </Text>
                    </View>
                  </View>

                  <Text className="mb-4 text-xs text-gray-400">
                    이용자들이 실제로 코스를 다녀온 기록을 기반으로 한 대략적인 체류 시간입니다.
                  </Text>

                  {/* 출발/도착 요약 */}
                  <View className="mb-6 rounded-xl bg-gray-50 p-3">
                    <View className="flex-row items-center">
                      <View className="rounded bg-green-100 px-2 py-1">
                        <Text className="text-xs font-medium text-green-700">출발</Text>
                      </View>
                      <Text className="ml-2 flex-1 text-sm text-gray-900">{course.departure}</Text>
                    </View>
                    <View className="mt-2 flex-row items-center">
                      <View className="rounded bg-red-100 px-2 py-1">
                        <Text className="text-xs font-medium text-red-700">도착</Text>
                      </View>
                      <Text className="ml-2 flex-1 text-sm text-gray-900">{course.arrival}</Text>
                    </View>
                  </View>

                  {/* 경로 단계별 체류 시간 */}
                  <Text className="mb-2 text-sm font-semibold text-gray-900">코스 경로</Text>
                  <View className="mb-6 rounded-xl bg-gray-50 p-3">
                    {course.routeSteps.map((step, index) => (
                      <Pressable
                        key={step.id}
                        onPress={() => {
                          setMapFocus(getCourseStepMapPoint(course.id, index));
                          setSelectedStepId(step.id);
                        }}
                        className="flex-row items-start py-1.5"
                        style={[
                          index > 0 ? { borderTopWidth: 1, borderTopColor: '#e5e7eb' } : null,
                          selectedStepId === step.id ? { backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 8 } : null,
                        ]}
                      >
                        <Text className="mt-0.5 w-5 text-xs font-semibold text-gray-500">
                          {index + 1}.
                        </Text>
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-gray-900">{step.name}</Text>
                          <Text className="mt-0.5 text-xs text-gray-500">
                            평균 머문 시간 약 {step.stayMinutes}분
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {/* 이용자 후기 */}
                  <Text className="mb-2 text-sm font-semibold text-gray-900">이용자 후기</Text>
                  {course.reviews.length === 0 ? (
                    <View className="mb-2 rounded-xl bg-gray-50 p-3">
                      <Text className="text-xs text-gray-500">
                        아직 등록된 후기가 없습니다. 코스를 다녀온 후 첫 후기를 남겨 보세요.
                      </Text>
                    </View>
                  ) : (
                    <View className="mb-2 rounded-xl bg-gray-50 p-3">
                      {course.reviews.map((review) => (
                        <View key={review.id} className="mb-3 last:mb-0">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-gray-900">
                              {review.userName}
                            </Text>
                            <Text className="text-xs text-yellow-600">
                              ★ {review.rating.toFixed(1)}
                            </Text>
                          </View>
                          <Text className="mt-1 text-xs text-gray-700">{review.text}</Text>
                          <Text className="mt-0.5 text-[11px] text-gray-400">{review.date}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Pressable
                    onPress={() => {
                      setReviewCourseId(course.id);
                      setReviewUserName('나');
                      setReviewRating(5);
                      setReviewBody('');
                      setReviewComposerOpen(true);
                    }}
                    className="mb-2 mt-2 flex-row items-center justify-center rounded-xl bg-amber-500 py-3.5 active:opacity-90"
                  >
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text className="ml-2 text-sm font-bold text-white">리뷰 남기기</Text>
                  </Pressable>

                  <Text className="mt-1 text-[11px] text-gray-400">
                    작성한 후기는 앱(목 데이터)에만 저장되며, 서버 연동 시 동기화될 수 있어요.
                  </Text>
                </ScrollView>
                </>
              );
            })()}
          </View>
          </Animated.View>
          </View>

          {reviewComposerOpen && reviewCourseId ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                zIndex: 200,
              }}
              pointerEvents="box-none"
            >
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                onPress={() => setReviewComposerOpen(false)}
              />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 24,
                }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, width: '100%' }}
              >
                <View className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                  <Text className="text-lg font-bold text-gray-900">리뷰 작성</Text>
                  <Text className="mt-1 text-xs text-gray-500" numberOfLines={2}>
                    {MOCK_COURSES.find((c) => c.id === reviewCourseId)?.title ?? ''}
                  </Text>

                  <Text className="mt-4 text-xs font-semibold text-gray-600">닉네임</Text>
                  <TextInput
                    value={reviewUserName}
                    onChangeText={setReviewUserName}
                    placeholder="표시될 이름"
                    placeholderTextColor="#9ca3af"
                    className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900"
                    maxLength={20}
                  />

                  <Text className="mt-3 text-xs font-semibold text-gray-600">별점</Text>
                  <View className="mt-2 flex-row gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable key={n} onPress={() => setReviewRating(n)} hitSlop={6}>
                        <Ionicons
                          name={n <= reviewRating ? 'star' : 'star-outline'}
                          size={28}
                          color={n <= reviewRating ? '#f59e0b' : '#d1d5db'}
                        />
                      </Pressable>
                    ))}
                  </View>

                  <Text className="mt-4 text-xs font-semibold text-gray-600">후기</Text>
                  <TextInput
                    value={reviewBody}
                    onChangeText={setReviewBody}
                    placeholder="코스 경험을 짧게 남겨 주세요"
                    placeholderTextColor="#9ca3af"
                    multiline
                    className="mt-1 min-h-[100px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900"
                    textAlignVertical="top"
                    maxLength={500}
                  />

                  <View className="mt-5 flex-row gap-2">
                    <Pressable
                      onPress={() => setReviewComposerOpen(false)}
                      className="flex-1 items-center rounded-xl border border-gray-200 py-3 active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-gray-600">취소</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (!reviewCourseId) return;
                        const t = reviewBody.trim();
                        if (!t) {
                          Alert.alert('알림', '후기 내용을 입력해 주세요.');
                          return;
                        }
                        addSharedCourseReview(reviewCourseId, {
                          userName: reviewUserName,
                          rating: reviewRating,
                          text: t,
                        });
                        setReviewComposerOpen(false);
                        Alert.alert('등록됨', '리뷰가 등록되었습니다.');
                      }}
                      className="flex-1 items-center rounded-xl bg-amber-500 py-3 active:opacity-90"
                    >
                      <Text className="text-sm font-bold text-white">등록</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
