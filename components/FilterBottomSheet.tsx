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
export const SORT_OPTIONS = [
  '즐겨찾기순',
  '최신순',
  '인기순',
  '거리순',
  '추천순',
  '조회순',
  '저장순',
];

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
  const sheetMaxH = useMemo(() => Math.min(windowH * 0.88, 680), [windowH]);
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
            className="rounded-t-3xl bg-[#F8FBFF] pt-3"
            style={{
              backgroundColor: '#F8FBFF',
              paddingHorizontal: 18,
              height: sheetMaxH,
              borderTopWidth: 0.5,
              borderColor: 'rgba(37,99,235,0.15)',
              overflow: 'hidden',
              flexDirection: 'column',
            }}
          >
            <View className="items-center pb-2">
              <View className="h-1.5 w-12 rounded-full bg-blue-100" />
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-semibold text-[#1A1A2E]">필터</Text>
              <Pressable
                onPress={onClose}
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                style={{ borderWidth: 0.5, borderColor: 'rgba(37,99,235,0.15)' }}
              >
                <Text className="text-base font-bold text-gray-500">×</Text>
              </Pressable>
            </View>

            <View style={{ flex: 1, minHeight: 0 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
              <Text className="mb-2 text-xs font-semibold tracking-wide text-slate-400">카테고리</Text>
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
                      borderColor: selected ? '#2563EB' : '#dbeafe',
                      backgroundColor: selected ? '#2563EB' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: selected ? '#ffffff' : '#4b5563' }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                    );
                  })()
                ))}
              </View>

              <Text className="mb-2 text-xs font-semibold tracking-wide text-slate-400">지역</Text>
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
                      borderColor: selected ? '#2563EB' : '#dbeafe',
                      backgroundColor: selected ? '#2563EB' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: selected ? '#ffffff' : '#4b5563' }}
                    >
                      {region}
                    </Text>
                  </Pressable>
                    );
                  })()
                ))}
              </View>

              <Text className="mb-2 text-xs font-semibold tracking-wide text-slate-400">정렬기준</Text>
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
                      borderColor: selected ? '#2563EB' : '#dbeafe',
                      backgroundColor: selected ? '#2563EB' : '#ffffff',
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
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
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexShrink: 0,
                zIndex: 2,
                backgroundColor: '#F8FBFF',
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: '#dbeafe',
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 12),
              }}
            >
              <Pressable
                onPress={onReset}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  backgroundColor: '#ffffff',
                  paddingVertical: 14,
                  marginRight: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: '#4b5563' }}>초기화</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onApply();
                  onClose();
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: '#2563EB',
                  paddingVertical: 14,
                  marginLeft: 6,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#ffffff' }}>적용</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
