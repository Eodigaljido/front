// @ts-nocheck - NativeWind(className) 타입이 @types/react-native와 병합되지 않아 일시 비활성화
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';


type TabId = 'all' | 'popular' | 'date' | 'friends';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'popular', label: '인기코스' },
  { id: 'date', label: '데이트' },
  { id: 'friends', label: '친구모임' },
];

const CATEGORIES = ['데이트', '친구모임', '맛집', '카페', '자연', '액티비티'];
const SORT_OPTIONS = ['최신순', '인기순', '거리순', '추천순', '조회순', '저장순'];

type CourseItem = {
  id: string;
  title: string;
  meta: string;
  departure: string;
  arrival: string;
  thumbnail: string | null;
};

const MOCK_COURSES: CourseItem[] = [
  {
    id: '1',
    title: '솔로들은 보지마라 왜냐하면 이게...',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '스페이클럽 폴링장',
    arrival: '오티티프라이빗 동성로점',
    thumbnail: null,
  },
  {
    id: '2',
    title: '집에서도 게임하면서 게임장 왜 가...',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '경소고-키즈카페-밥집',
    arrival: '경소고-키즈카페-밥집',
    thumbnail: null,
  },
  {
    id: '3',
    title: '동성로 피규어 공략',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '경소고-키즈카페-밥집',
    arrival: '경소고-키즈카페-밥집',
    thumbnail: null,
  },
];

const CARD_STYLE = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

function CourseCard({
  item,
  isDropdownOpen,
  onPressCard,
  onAddToMyRoute,
  onView,
}: {
  item: CourseItem;
  isDropdownOpen: boolean;
  onPressCard: () => void;
  onAddToMyRoute: () => void;
  onView: () => void;
}) {
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-2xl bg-white" style={CARD_STYLE}>
      <Pressable
        onPress={onPressCard}
        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
      >
        {/* 상단: 썸네일 + 제목/메타 + 드롭다운 아이콘 */}
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
            <Ionicons
              name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={22}
              color="#1f2937"
            />
          </View>
        </View>

        {/* 경로 안내: [출발] 장소명 | [도착] 장소명 */}
        <View className="flex-row items-center border-b border-gray-100 px-3.5 py-2.5">
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

      {/* 드롭다운: 가로 구분선 아래 두 개 버튼(회색 블록 스타일) */}
      {isDropdownOpen && (
        <View className="rounded-b-2xl bg-gray-50 px-3 py-3">
          <View className="flex-row gap-2.5">
            <Pressable
              onPress={onAddToMyRoute}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3.5 active:opacity-90"
              style={{
                backgroundColor: '#059669',
                shadowColor: '#059669',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text className="ml-2 text-sm font-semibold text-white">내 루트에 추가하기</Text>
            </Pressable>
            <Pressable
              onPress={onView}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3.5 active:opacity-90"
              style={{
                backgroundColor: '#3b82f6',
                shadowColor: '#3b82f6',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text className="ml-2 text-sm font-semibold text-white">보기</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function FilterBottomSheet({
  visible,
  onClose,
  selectedCategory,
  selectedSort,
  onCategoryToggle,
  onSortToggle,
  onReset,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  selectedSort: string | null;
  onCategoryToggle: (v: string) => void;
  onSortToggle: (v: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      backdropOpacity.setValue(0);
    }
  }, [visible, backdropOpacity]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1">
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              opacity: backdropOpacity,
            }}
          />
        </Pressable>
        <View className="rounded-t-3xl bg-gray-100 pb-8 pt-5" style={{ paddingHorizontal: 20 }}>
        <Text className="mb-4 text-xl font-bold text-black">필터</Text>

        <Text className="mb-2 text-sm font-medium text-gray-600">카테고리</Text>
        <View className="mb-5 flex-row flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => onCategoryToggle(cat)}
              className={`rounded-full px-4 py-2.5 ${selectedCategory === cat ? 'bg-green-600' : 'bg-gray-200'}`}
            >
              <Text className={`text-sm ${selectedCategory === cat ? 'font-semibold text-white' : 'text-gray-600'}`}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mb-2 text-sm font-medium text-gray-600">정렬기준</Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onSortToggle(opt)}
              className={`rounded-full px-4 py-2.5 ${selectedSort === opt ? 'bg-green-600' : 'bg-gray-200'}`}
            >
              <Text className={`text-sm ${selectedSort === opt ? 'font-semibold text-white' : 'text-gray-600'}`}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={onReset}
            className="flex-1 items-center rounded-xl bg-gray-200 py-3"
          >
            <Text className="font-medium text-gray-700">초기화</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onApply();
              onClose();
            }}
            className="flex-1 items-center rounded-xl bg-gray-200 py-3"
          >
            <Text className="font-medium text-gray-700">적용하기</Text>
          </Pressable>
        </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SharedRouteScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };
  const handleSortToggle = (opt: string) => {
    setSelectedSort((prev) => (prev === opt ? null : opt));
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* 헤더 배너 - 이미지 배경 + 내부 흐림(오버레이) */}
      <View className="overflow-hidden rounded-b-2xl">
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
        data={MOCK_COURSES}
        keyExtractor={(item: CourseItem) => item.id}
        renderItem={({ item }: { item: CourseItem }) => (
          <CourseCard
            item={item}
            isDropdownOpen={expandedCardId === item.id}
            onPressCard={() =>
              setExpandedCardId((prev) => (prev === item.id ? null : item.id))
            }
            onAddToMyRoute={() => {
              setExpandedCardId(null);
              // TODO: 내 루트에 추가 API/네비게이션
            }}
            onView={() => {
              setExpandedCardId(null);
              // TODO: 코스 상세 보기 화면 이동
            }}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedSort={selectedSort}
        onCategoryToggle={handleCategoryToggle}
        onSortToggle={handleSortToggle}
        onReset={() => {
          setSelectedCategory(null);
          setSelectedSort(null);
        }}
        onApply={() => {
          // 실제 적용 시 필터 상태로 API 호출 등
        }}
      />
    </SafeAreaView>
  );
}
