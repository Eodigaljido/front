import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import SharedRouteScreen from './SharedRouteScreen';
import MyRouteScreen from './MyRouteScreen';
import {
  RouteScreenContext,
  type RouteSection,
} from '../context/RouteScreenContext';
import { rootNavigate } from '../navigation/rootNavigation';

export type RouteTabParams = {
  section?: RouteSection;
  openFilter?: boolean;
  openAsPopular?: boolean;
  viewCourseId?: string;
  initialQuery?: string;
};

const SECTIONS: { id: RouteSection; label: string; hint: string }[] = [
  { id: 'shared', label: '공유 코스', hint: '다른 사람의 경로 탐색' },
  { id: 'my', label: '내 루트', hint: '저장·제작한 내 경로' },
];

const SUBTITLES: Record<RouteSection, string> = {
  shared: '다른 유저의 경로를 탐색하고 저장해 보세요',
  my: '저장한 코스와 내가 만든 코스를 관리해요',
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function resolveInitialSection(params: RouteTabParams): RouteSection {
  if (params.section === 'my' || params.section === 'shared') {
    return params.section;
  }
  return 'shared';
}

export default function RouteScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params || {}) as RouteTabParams;
  const [section, setSection] = useState<RouteSection>(() =>
    resolveInitialSection(params),
  );
  const [segmentWidth, setSegmentWidth] = useState(0);
  const slideX = useRef(
    new Animated.Value(resolveInitialSection(params) === 'my' ? 1 : 0),
  ).current;
  const fade = useRef(new Animated.Value(1)).current;

  const switchSection = useCallback(
    (next: RouteSection) => {
      if (next === section) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.parallel([
        Animated.spring(slideX, {
          toValue: next === 'my' ? 1 : 0,
          useNativeDriver: true,
          friction: 9,
          tension: 72,
        }),
        Animated.sequence([
          Animated.timing(fade, {
            toValue: 0.92,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      setSection(next);
      navigation.setParams({
        ...params,
        section: next,
        viewCourseId: undefined,
      } as RouteTabParams);
    },
    [section, navigation, params, slideX, fade],
  );

  useFocusEffect(
    useCallback(() => {
      if (params.section) {
        setSection(params.section);
        slideX.setValue(params.section === 'my' ? 1 : 0);
      }
      if (params.openAsPopular || params.openFilter) {
        setSection('shared');
        slideX.setValue(0);
      }
    }, [params.section, params.openAsPopular, params.openFilter, slideX]),
  );

  const indicatorTranslateX =
    segmentWidth > 0
      ? slideX.interpolate({
          inputRange: [0, 1],
          outputRange: [0, segmentWidth / 2],
        })
      : 0;

  return (
    <RouteScreenContext.Provider value={{ section, setSection }}>
      <View className="flex-1 bg-[#F0F5FF]">
        <SafeAreaView edges={['top']} className="bg-[#F0F5FF]">
          <View className="px-4 pb-2 pt-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[22px] font-bold text-gray-900">루트</Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  {SUBTITLES[section]}
                </Text>
              </View>
              {section === 'my' ? (
                <Pressable
                  onPress={() => rootNavigate('RouteCreate')}
                  className="rounded-full bg-blue-600 px-3.5 py-2 active:opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel="루트 제작"
                >
                  <Text className="text-xs font-semibold text-white">
                    + 제작
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              className="mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-white p-1"
              style={{
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width - 8;
                if (w > 0 && Math.abs(w - segmentWidth) > 1) {
                  setSegmentWidth(w);
                }
              }}
            >
              {segmentWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: 4,
                    width: segmentWidth / 2,
                    borderRadius: 12,
                    backgroundColor: '#2563EB',
                    transform: [{ translateX: indicatorTranslateX }],
                  }}
                />
              ) : null}
              <View className="flex-row">
                {SECTIONS.map((s) => {
                  const on = section === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => switchSection(s.id)}
                      className="flex-1 items-center rounded-xl py-2.5"
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={s.label}
                    >
                      <Text
                        className={`text-[13px] font-bold ${
                          on ? 'text-white' : 'text-gray-600'
                        }`}
                      >
                        {s.label}
                      </Text>
                      <Text
                        className={`mt-0.5 text-[10px] ${
                          on ? 'text-blue-100' : 'text-gray-400'
                        }`}
                        numberOfLines={1}
                      >
                        {s.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </SafeAreaView>

        <Animated.View className="flex-1" style={{ opacity: fade }}>
          <View
            className="flex-1"
            style={{ display: section === 'shared' ? 'flex' : 'none' }}
          >
            <SharedRouteScreen embedded />
          </View>
          <View
            className="flex-1"
            style={{ display: section === 'my' ? 'flex' : 'none' }}
          >
            <MyRouteScreen embedded />
          </View>
        </Animated.View>
      </View>
    </RouteScreenContext.Provider>
  );
}
