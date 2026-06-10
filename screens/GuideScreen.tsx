// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type DetailCard = {
  icon: string;
  title: string;
  desc: string;
};

type GuideStep = {
  id: string;
  icon: string;
  title: string;
  cards: DetailCard[];
  tip?: string;
  checklist?: { heading: string; items: string[] };
};

const STEPS: GuideStep[] = [
  {
    id: 'create',
    icon: '🗺️',
    title: '루트 제작하기',
    cards: [
      {
        icon: '📍',
        title: '장소 담기',
        desc: '지도에서 가고 싶은 장소를 골라 나만의 산책·여행 루트에 차곡차곡 담아보세요.',
      },
      {
        icon: '🔀',
        title: '순서 정하기',
        desc: '담은 장소의 순서를 자유롭게 바꿔 가장 편한 동선으로 루트를 완성할 수 있어요.',
      },
    ],
    tip: '이동 거리와 소요 시간을 미리 확인하면 더 알찬 루트를 만들 수 있어요!',
  },
  {
    id: 'share',
    icon: '🧭',
    title: '루트 공유 & 발견',
    cards: [
      {
        icon: '📤',
        title: '내 루트 공유하기',
        desc: '직접 만든 루트를 다른 사용자들과 공유해 함께 즐겨보세요.',
      },
      {
        icon: '🔥',
        title: '내 근처 인기 루트',
        desc: '현재 위치 주변에서 인기 있는 루트를 둘러보고 마음에 드는 루트를 찾아보세요.',
      },
    ],
    checklist: {
      heading: '이런 루트를 찾아보세요',
      items: ['산책하기 좋은 코스', '맛집 투어 코스', '데이트 코스', '드라이브 코스'],
    },
  },
  {
    id: 'friends',
    icon: '👥',
    title: '친구와 모임으로 함께하기',
    cards: [
      {
        icon: '➕',
        title: '친구 추가',
        desc: '프로필의 친구 추가 버튼이나 친구 코드로 친구를 맺을 수 있어요.',
      },
      {
        icon: '📨',
        title: '친구 요청 확인',
        desc: '받은 친구 요청을 확인하고 수락하면 함께 루트를 즐길 수 있어요.',
      },
      {
        icon: '💬',
        title: '1:1 채팅',
        desc: '친구와 1:1 채팅으로 루트를 공유하고 함께 갈 약속을 잡아보세요.',
      },
      {
        icon: '🙌',
        title: '모임 참여하기',
        desc: '관심사가 비슷한 사람들과 모임에 참여해 더 많은 사람과 루트를 함께 즐겨보세요. (예: 자전거 동호회)',
      },
      {
        icon: '🗨️',
        title: '모임 안의 여러 채팅방',
        desc: '한 모임 안에서 여러 채팅방을 만들 수 있어요. 어떤 그룹은 대구 일주, 어떤 그룹은 부산 일주처럼 목적별로 나눠 대화하세요.',
      },
      {
        icon: '📢',
        title: '모임 공지 & 활동',
        desc: '모임 내에 공지사항을 올리거나 활동 소식을 공유해 멤버들과 소통할 수 있어요.',
      },
    ],
    tip: '친구 코드를 공유하면 더 빠르게 친구를 추가할 수 있어요. 모임에서 만난 사람도 친구로 추가할 수 있어요.',
  },
];

function DetailCardView({ icon, title, desc }: DetailCard) {
  return (
    <View className="flex-row gap-3 px-4 py-3 mb-2 bg-gray-50 rounded-xl">
      <Text className="text-2xl">{icon}</Text>
      <View className="flex-1">
        <Text className="text-sm font-bold text-gray-900">{title}</Text>
        <Text className="mt-1 text-xs leading-5 text-gray-500">{desc}</Text>
      </View>
    </View>
  );
}

function StepCard({
  step,
  index,
  expanded,
  onToggle,
}: {
  step: GuideStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, { duration: 220 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      className="mb-3 overflow-hidden bg-white border border-gray-200 rounded-2xl"
    >
      <Pressable
        onPress={onToggle}
        className="flex-row items-center px-4 py-4 active:opacity-80"
      >
        <View className="items-center justify-center w-8 h-8 mr-3 rounded-full bg-orange-50">
          <Text className="text-sm font-extrabold text-orange-500">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-base font-bold text-gray-900">
          {step.icon}  {step.title}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={20} color="#9ca3af" />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(150)}
          className="px-4 pb-4"
        >
          {step.cards.map((card, i) => (
            <DetailCardView key={i} {...card} />
          ))}

          {step.checklist && (
            <View className="px-4 py-3 mt-1 border border-blue-100 bg-blue-50 rounded-xl">
              <Text className="text-sm font-bold text-blue-900">
                🔍 {step.checklist.heading}
              </Text>
              <View className="mt-2">
                {step.checklist.items.map((item, i) => (
                  <Text key={i} className="py-0.5 text-xs text-blue-800">
                    ✓ {item}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {step.tip && (
            <View className="flex-row gap-2 px-4 py-3 mt-1 border border-amber-100 bg-amber-50 rounded-xl">
              <Text className="text-base">💡</Text>
              <Text className="flex-1 text-xs leading-5 text-amber-800">
                <Text className="font-bold">Tip: </Text>
                {step.tip}
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default function GuideScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // 탭바 높이(64) + 탭바 bottom 오프셋 + 여유 16
  const scrollPaddingBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 10) + 64 + 16;
  const [activeId, setActiveId] = useState<string | null>(STEPS[0].id);

  const toggle = (id: string) => {
    setActiveId(prev => (prev === id ? null : id));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#F0F5FF] px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#f97316" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">가이드</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: scrollPaddingBottom,
        }}
      >
        <View className="px-5 py-6 mb-4 bg-white border border-gray-200 rounded-2xl">
          <Text className="text-xl font-extrabold text-gray-900">🏠 앱 사용 가이드</Text>
          <Text className="mt-2 text-sm leading-6 text-gray-500">
            루트를 만들고 친구와 함께 즐기기까지, 단계별로 사용법을 확인해 보세요!
          </Text>
        </View>

        {STEPS.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            expanded={activeId === step.id}
            onToggle={() => toggle(step.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
