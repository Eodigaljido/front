import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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

const SECTIONS: { id: RouteSection; label: string }[] = [
  { id: 'shared', label: '공유' },
  { id: 'my', label: '내 루트' },
];

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

  const switchSection = useCallback(
    (next: RouteSection) => {
      if (next === section) return;
      setSection(next);
      // @ts-expect-error Route 탭 params
      navigation.setParams({ section: next, viewCourseId: undefined });
    },
    [section, navigation, params],
  );

  useFocusEffect(
    useCallback(() => {
      if (params.section) {
        setSection(params.section);
      }
      if (params.openAsPopular || params.openFilter) {
        setSection('shared');
      }
    }, [params.section, params.openAsPopular, params.openFilter]),
  );

  return (
    <RouteScreenContext.Provider value={{ section, setSection }}>
      <View className="flex-1 bg-[#F0F5FF]">
        <SafeAreaView edges={['top']} className="bg-[#F0F5FF]">
          <View className="flex-row items-center gap-2 px-4 pb-1.5 pt-1">
            <View className="h-9 min-w-0 flex-1 flex-row rounded-xl border border-blue-100 bg-white p-0.5">
              {SECTIONS.map((s) => {
                const on = section === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => switchSection(s.id)}
                    className={`flex-1 items-center justify-center rounded-lg ${
                      on ? 'bg-blue-600' : 'bg-transparent'
                    }`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={s.label}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        on ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* 너비 고정 — 토글 폭이 탭마다 바뀌지 않게 */}
            <View className="h-9 w-9 shrink-0">
              {section === 'my' ? (
                <Pressable
                  onPress={() => rootNavigate('RouteCreate')}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600 active:opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel="루트 제작"
                >
                  <Text className="text-sm font-semibold text-white">+</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        <View className="flex-1">
          {section === 'shared' ? (
            <SharedRouteScreen key="route-shared" embedded />
          ) : (
            <MyRouteScreen key="route-my" embedded />
          )}
        </View>
      </View>
    </RouteScreenContext.Provider>
  );
}
