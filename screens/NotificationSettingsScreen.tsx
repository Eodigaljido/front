// @ts-nocheck
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  useAnimatedValue,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import {
  getNotificationSettings,
  patchNotificationSettings,
} from '../api/notificationSettings';

const SECTION_STYLE = {
  borderWidth: 0.5,
  borderColor: 'rgba(37,99,235,0.12)',
  borderRadius: 16,
  backgroundColor: '#fff',
};

type SettingKey =
  | 'chatMessage'
  | 'chatMention'
  | 'chatInvite'
  | 'chatCourseShared'
  | 'chatCourseEdited'
  | 'friendRequest'
  | 'friendAccepted'
  | 'meetJoinRequest'
  | 'meetJoinResult'
  | 'meetNewMember'
  | 'meetNewPost'
  | 'meetNewRoute'
  | 'meetNewChatRoom'
  | 'courseRecommended'
  | 'courseFavoritedOrUsed';

type SettingItem = {
  key: SettingKey;
  title: string;
  description?: string;
};

type SettingGroup = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  items: SettingItem[];
};

const SETTING_GROUPS: SettingGroup[] = [
  {
    label: '채팅',
    icon: 'chatbubble-ellipses-outline',
    iconColor: '#2563eb',
    iconBg: '#dbeafe',
    items: [
      {
        key: 'chatMessage',
        title: '새 채팅 메시지',
        description: '채팅방에 새 메시지가 도착했을 때',
      },
      {
        key: 'chatMention',
        title: '멘션 알림',
        description: '누군가 나를 멘션했을 때',
      },
      {
        key: 'chatInvite',
        title: '채팅방 초대',
        description: '누군가 나를 채팅방에 초대했을 때',
      },
      {
        key: 'chatCourseShared',
        title: '코스 공유',
        description: '채팅방에 누군가 코스를 공유했을 때',
      },
      {
        key: 'chatCourseEdited',
        title: '코스 생성 · 수정',
        description: '채팅방에서 누군가 코스를 생성하거나 수정했을 때',
      },
    ],
  },
  {
    label: '친구',
    icon: 'person-add-outline',
    iconColor: '#ea580c',
    iconBg: '#ffedd5',
    items: [
      {
        key: 'friendRequest',
        title: '친구 요청',
        description: '누군가 나에게 친구 요청을 보냈을 때',
      },
      {
        key: 'friendAccepted',
        title: '친구 요청 수락',
        description: '내 친구 요청이 수락되었을 때',
      },
    ],
  },
  {
    label: '모임',
    icon: 'people-outline',
    iconColor: '#7c3aed',
    iconBg: '#f5f3ff',
    items: [
      {
        key: 'meetJoinRequest',
        title: '가입 신청',
        description: '내가 방장인 모임에 누군가 가입을 신청했을 때',
      },
      {
        key: 'meetJoinResult',
        title: '가입 신청 결과',
        description: '내 가입 신청이 승인되거나 거절되었을 때',
      },
      {
        key: 'meetNewMember',
        title: '새 멤버 참여',
        description: '참여 중인 모임에 새 멤버가 들어왔을 때',
      },
      {
        key: 'meetNewPost',
        title: '새 게시물',
        description: '참여 중인 모임에 새 게시물이 올라왔을 때',
      },
      {
        key: 'meetNewRoute',
        title: '루트 공유',
        description: '참여 중인 모임에 새 루트가 공유되었을 때',
      },
      {
        key: 'meetNewChatRoom',
        title: '새 채팅방',
        description: '참여 중인 모임에 새 채팅방이 생성되었을 때',
      },
    ],
  },
  {
    label: '코스',
    icon: 'map-outline',
    iconColor: '#16a34a',
    iconBg: '#dcfce7',
    items: [
      {
        key: 'courseRecommended',
        title: '맞춤 코스 추천',
        description:
          '내 주변 지역과 관심사(취미·지역·나이·성별) 카테고리의 코스가 공유되었을 때',
      },
      {
        key: 'courseFavoritedOrUsed',
        title: '내 코스 반응',
        description: '내가 공유한 코스가 즐겨찾기되거나 누군가 사용했을 때',
      },
    ],
  },
];

const ALL_KEYS = SETTING_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const DEFAULT_SETTINGS: Record<SettingKey, boolean> = ALL_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: true }),
  {} as Record<SettingKey, boolean>,
);

const storageKey = (uuid?: string) => `notificationSettings:${uuid ?? 'guest'}`;

// 네이티브 Switch와 동일한 색상
const TRACK_OFF = '#e5e7eb';
const TRACK_ON = '#93c5fd';
const THUMB_OFF = '#f4f4f5';
const THUMB_ON = '#2563eb';

// Android 네이티브 스위치 비율: 얇은 트랙 + 트랙보다 큰 thumb(위아래로 살짝 돌출)
const TRACK_W = 32;
const TRACK_H = 14;
const THUMB = 20;
const THUMB_OFFSET = 2; // 양끝에서 thumb가 트랙 밖으로 살짝 돌출되는 정도
const THUMB_TRAVEL_OFF = -THUMB_OFFSET;
const THUMB_TRAVEL_ON = TRACK_W - THUMB + THUMB_OFFSET;

/**
 * 네이티브 Switch의 디자인을 그대로 본뜬 커스텀 스위치.
 * thumb 슬라이드 + 트랙/thumb 색상 크로스페이드를 Animated로 직접 제어해
 * 모든 토글에서 일관된 애니메이션을 보장한다. (네이티브 Switch의 불안정한 애니메이션 대체)
 */
function AnimatedSwitch({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const anim = useAnimatedValue(value ? 1 : 0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_OFF, TRACK_ON],
  });
  const thumbBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFF, THUMB_ON],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_TRAVEL_OFF, THUMB_TRAVEL_ON],
  });

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      disabled={disabled}
      hitSlop={10}
      style={{
        width: TRACK_W,
        height: THUMB,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Animated.View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: trackBg,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: thumbBg,
          transform: [{ translateX }],
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 1,
          elevation: Platform.OS === 'android' ? 1 : 0,
        }}
      />
    </Pressable>
  );
}

/**
 * 설정 한 줄. React.memo로 감싸 자신의 value가 바뀐 행만 리렌더되게 한다.
 * (전체 리렌더로 인해 네이티브 Switch의 thumb 애니메이션이 끊기는 문제 방지)
 */
const SettingRow = React.memo(function SettingRow({
  item,
  value,
  disabled,
  showBorder,
  onToggle,
}: {
  item: SettingItem;
  value: boolean;
  disabled: boolean;
  showBorder: boolean;
  onToggle: (key: SettingKey) => void;
}): React.JSX.Element {
  return (
    <View
      className={`flex-row items-center justify-between py-4 ${
        showBorder ? 'border-b border-gray-100' : ''
      }`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-[15px] font-medium text-gray-900">
          {item.title}
        </Text>
        {item.description ? (
          <Text className="mt-1 text-xs leading-4 text-gray-400">
            {item.description}
          </Text>
        ) : null}
      </View>
      <AnimatedSwitch
        value={value}
        onValueChange={() => onToggle(item.key)}
        disabled={disabled}
      />
    </View>
  );
});

export default function NotificationSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // 탭바 높이(64) + 탭바 bottom 오프셋 + 여유 16
  const scrollPaddingBottom =
    Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 10) + 64 + 16;
  const userUuid = useAuthStore((s) => s.user?.uuid);
  const [settings, setSettings] =
    useState<Record<SettingKey, boolean>>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // 최신 settings를 동기 참조 — 토글 시 updater 밖에서 nextVal 계산용
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) 로컬 캐시 먼저 반영 — 빠른 첫 페인트
      try {
        const raw = await AsyncStorage.getItem(storageKey(userUuid));
        if (active && raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {
        // 저장된 값이 없거나 손상된 경우 기본값 사용
      } finally {
        if (active) setLoaded(true);
      }
      // 2) 서버 설정으로 갱신 — 알 수 없는 key는 무시
      try {
        const server = await getNotificationSettings();
        if (active) {
          const merged = { ...DEFAULT_SETTINGS };
          for (const k of ALL_KEYS) {
            if (typeof server[k] === 'boolean') merged[k] = server[k];
          }
          setSettings(merged);
          AsyncStorage.setItem(
            storageKey(userUuid),
            JSON.stringify(merged),
          ).catch(() => {});
        }
      } catch {
        // 서버 실패 시 캐시/기본값 유지
      }
    })();
    return () => {
      active = false;
    };
  }, [userUuid]);

  const writeStorage = useCallback(
    (next: Record<SettingKey, boolean>) => {
      AsyncStorage.setItem(storageKey(userUuid), JSON.stringify(next)).catch(
        () => {},
      );
    },
    [userUuid],
  );

  // 서버가 돌려준 전체 맵을 권위 있는 값으로 state·캐시에 반영 (모르는 key 무시)
  const applyServerMap = useCallback(
    (server: Record<string, boolean>) => {
      setSettings((prev) => {
        const merged = { ...prev };
        for (const k of ALL_KEYS) {
          if (typeof server[k] === 'boolean') merged[k] = server[k];
        }
        writeStorage(merged);
        return merged;
      });
    },
    [writeStorage],
  );

  const toggle = useCallback(
    (key: SettingKey) => {
      const prev = settingsRef.current;
      const nextVal = !prev[key];
      // 1) 낙관적 반영
      const optimistic = { ...prev, [key]: nextVal };
      setSettings(optimistic);
      writeStorage(optimistic);
      // 2) 서버 부분 변경 → 응답(전체 맵)으로 확정. 실패 시 직전 상태 롤백
      patchNotificationSettings({ [key]: nextVal })
        .then(applyServerMap)
        .catch(() => {
          setSettings(prev);
          writeStorage(prev);
        });
    },
    [applyServerMap, writeStorage],
  );

  const allEnabled = useMemo(
    () => ALL_KEYS.every((k) => settings[k]),
    [settings],
  );

  const toggleAll = useCallback(() => {
    const prev = settingsRef.current;
    const nextVal = !ALL_KEYS.every((k) => prev[k]);
    const updated = ALL_KEYS.reduce(
      (acc, k) => ({ ...acc, [k]: nextVal }),
      {} as Record<SettingKey, boolean>,
    );
    setSettings(updated);
    writeStorage(updated);
    // 15개 key 전체를 동일 값으로 전송 → 응답으로 확정. 실패 시 롤백
    patchNotificationSettings(updated)
      .then(applyServerMap)
      .catch(() => {
        setSettings(prev);
        writeStorage(prev);
      });
  }, [applyServerMap, writeStorage]);

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top']}>
      <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#F0F5FF] px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-full active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">
          알림 설정
        </Text>
      </View>

      {!loaded ? (
        <View className="items-center justify-center flex-1">
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: scrollPaddingBottom,
          }}
        >
          {/* 전체 알림 */}
          <View style={SECTION_STYLE} className="px-4 mb-6">
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center flex-1 gap-3 pr-3">
                <View className="items-center justify-center rounded-full w-9 h-9 bg-blue-50">
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color="#2563eb"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    전체 알림
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    모든 알림을 한 번에 켜고 끕니다
                  </Text>
                </View>
              </View>
              <AnimatedSwitch
                value={allEnabled}
                onValueChange={toggleAll}
                disabled={!loaded}
              />
            </View>
          </View>

          {SETTING_GROUPS.map((group) => (
            <View key={group.label} className="mb-6">
              <View className="flex-row items-center gap-2 mb-2 ml-1">
                <View
                  className="items-center justify-center rounded-full w-7 h-7"
                  style={{ backgroundColor: group.iconBg }}
                >
                  <Ionicons
                    name={group.icon}
                    size={15}
                    color={group.iconColor}
                  />
                </View>
                <Text className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  {group.label}
                </Text>
              </View>

              <View style={SECTION_STYLE} className="px-4">
                {group.items.map((item, idx) => (
                  <SettingRow
                    key={item.key}
                    item={item}
                    value={settings[item.key]}
                    disabled={!loaded}
                    showBorder={idx < group.items.length - 1}
                    onToggle={toggle}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text className="px-1 mt-1 text-xs leading-5 text-gray-400">
            기기의 시스템 알림이 꺼져 있으면 위 설정과 관계없이 알림을 받을 수
            없습니다.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
