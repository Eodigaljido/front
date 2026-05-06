// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
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
  const windowH = Dimensions.get('window').height;
  const sheetMaxH = useMemo(() => Math.min(windowH * 0.9, 720), [windowH]);
  /** 헤더·핸들·하단 버튼 줄 확보 후 칩 영역만 스크롤 */
  const filterScrollMaxH = useMemo(
    () => Math.max(160, sheetMaxH - 200),
    [sheetMaxH],
  );
  const sheetOffY = useMemo(() => Math.min(420, windowH * 0.5), [windowH]);
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
          <View
            className="rounded-t-3xl bg-white pt-3 pb-2"
            style={{ paddingHorizontal: 18, maxHeight: sheetMaxH }}
          >
            <View className="items-center pb-2">
              <View className="h-1.5 w-12 rounded-full bg-gray-200" />
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[22px] font-extrabold text-gray-900">필터</Text>
              <Pressable
                onPress={onClose}
                className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
              >
                <Text className="text-base font-bold text-gray-500">×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: filterScrollMaxH }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text className="mb-2 text-xs font-semibold tracking-wide text-gray-400">카테고리</Text>
              <View className="mb-5 flex-row flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  (() => {
                    const selected = selectedCategory === cat;
                    return (
                  <Pressable
                    key={cat}
                    onPress={() => onCategoryToggle(cat)}
                    className="rounded-full border px-4 py-2.5"
                    style={{
                      borderColor: selected ? '#047857' : '#e5e7eb',
                      backgroundColor: selected ? '#059669' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? '#ffffff' : '#4b5563' }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                    );
                  })()
                ))}
              </View>

              <Text className="mb-2 text-xs font-semibold tracking-wide text-gray-400">지역</Text>
              <View className="mb-5 flex-row flex-wrap gap-2">
                {REGIONS.map(region => (
                  (() => {
                    const selected = selectedRegion === region;
                    return (
                  <Pressable
                    key={region}
                    onPress={() => onRegionToggle(region)}
                    className="rounded-full border px-4 py-2.5"
                    style={{
                      borderColor: selected ? '#047857' : '#e5e7eb',
                      backgroundColor: selected ? '#059669' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? '#ffffff' : '#4b5563' }}
                    >
                      {region}
                    </Text>
                  </Pressable>
                    );
                  })()
                ))}
              </View>

              <Text className="mb-2 text-xs font-semibold tracking-wide text-gray-400">정렬기준</Text>
              <View className="mb-2 flex-row flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => (
                  (() => {
                    const selected = selectedSort === opt;
                    return (
                  <Pressable
                    key={opt}
                    onPress={() => onSortToggle(opt)}
                    className="rounded-full border px-4 py-2.5"
                    style={{
                      borderColor: selected ? '#047857' : '#e5e7eb',
                      backgroundColor: selected ? '#059669' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? '#ffffff' : '#4b5563' }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                    );
                  })()
                ))}
              </View>
            </ScrollView>

            <View className="mt-3 flex-row border-t border-gray-100 pt-3">
              <Pressable
                onPress={onReset}
                className="items-center rounded-2xl border border-gray-200 bg-white py-3.5"
                style={{ width: '48%' }}
              >
                <Text className="font-semibold text-gray-700">초기화</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onApply();
                  onClose();
                }}
                className="items-center rounded-2xl bg-emerald-500 py-3.5"
                style={{ width: '48%', marginLeft: '4%' }}
              >
                <Text className="font-semibold text-white">적용</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ height: Math.max(insets.bottom, 0), backgroundColor: '#ffffff' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
