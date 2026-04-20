// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// prettier-ignore
export const CATEGORIES = ['데이트', '친구모임', '맛집', '카페', '자연', '액티비티'];
// prettier-ignore
export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '제주'];
// prettier-ignore
export const SORT_OPTIONS = ['최신순', '인기순', '거리순', '추천순', '조회순', '저장순'];

type FilterBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  selectedRegion: string | null;
  selectedSort: string | null;
  onCategoryToggle: (v: string) => void;
  onRegionToggle: (v: string) => void;
  onSortToggle: (v: string) => void;
  onReset: () => void;
  onApply: () => void;
};

export default function FilterBottomSheet({
  visible,
  onClose,
  selectedCategory,
  selectedRegion,
  selectedSort,
  onCategoryToggle,
  onRegionToggle,
  onSortToggle,
  onReset,
  onApply,
}: FilterBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetOffY = useMemo(() => Math.min(420, Dimensions.get('window').height * 0.5), []);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(sheetOffY)).current;
  const [renderModal, setRenderModal] = useState(false);

  useEffect(() => {
    if (visible) setRenderModal(true);
  }, [visible]);

  useEffect(() => {
    if (!renderModal) return;
    if (visible) {
      sheetTranslateY.setValue(sheetOffY);
      backdropOpacity.setValue(0);
      const id = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 100,
            tension: 68,
          }),
        ]).start();
      });
      return () => cancelAnimationFrame(id);
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: sheetOffY,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRenderModal(false);
    });
  }, [visible, renderModal, sheetOffY]);

  return (
    <Modal
      visible={renderModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdropOpacity },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
          <View className="rounded-t-3xl bg-gray-100 pt-5 pb-8" style={{ paddingHorizontal: 20 }}>
            <Text className="mb-4 text-xl font-bold text-black">필터</Text>

            <Text className="mb-2 text-sm font-medium text-gray-600">카테고리</Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => onCategoryToggle(cat)}
                  className={`rounded-full px-4 py-2.5 ${selectedCategory === cat ? 'bg-green-600' : 'bg-gray-200'}`}
                >
                  <Text
                    className={`text-sm ${selectedCategory === cat ? 'font-semibold text-white' : 'text-gray-600'}`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-2 text-sm font-medium text-gray-600">지역</Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {REGIONS.map(region => (
                <Pressable
                  key={region}
                  onPress={() => onRegionToggle(region)}
                  className={`rounded-full px-4 py-2.5 ${selectedRegion === region ? 'bg-green-600' : 'bg-gray-200'}`}
                >
                  <Text
                    className={`text-sm ${selectedRegion === region ? 'font-semibold text-white' : 'text-gray-600'}`}
                  >
                    {region}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-2 text-sm font-medium text-gray-600">정렬기준</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {SORT_OPTIONS.map(opt => (
                <Pressable
                  key={opt}
                  onPress={() => onSortToggle(opt)}
                  className={`rounded-full px-4 py-2.5 ${selectedSort === opt ? 'bg-green-600' : 'bg-gray-200'}`}
                >
                  <Text
                    className={`text-sm ${selectedSort === opt ? 'font-semibold text-white' : 'text-gray-600'}`}
                  >
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={onReset}
                className="items-center flex-1 py-3 bg-gray-200 rounded-xl"
              >
                <Text className="font-medium text-gray-700">초기화</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onApply();
                  onClose();
                }}
                className="items-center flex-1 py-3 bg-gray-200 rounded-xl"
              >
                <Text className="font-medium text-gray-700">적용하기</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ height: Math.max(insets.bottom, 0), backgroundColor: '#f3f4f6' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
