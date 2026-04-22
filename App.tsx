import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useAuthStore } from './store/authStore';
import { NavigationContainer } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEXT_STYLE } from './styles/textStyles';

import { MockDataProvider } from './context/MockDataContext';
import HomeScreen from './screens/HomeScreen';
import SharedRouteScreen from './screens/SharedRouteScreen';
import MyRouteScreen from './screens/MyRouteScreen';
import ChatScreen from './screens/ChatScreen';
import AllScreen from './screens/AllScreen';
import OnBoardStart from './screens/onboard/OnBoardStart';
import AreaOnBoard from './screens/onboard/AreaOnBoard';
import AgeOnBoard from './screens/onboard/AgeOnBoard';
import ActivityOnBoard from './screens/onboard/ActivityOnBoard';
import GenderOnBoard from './screens/onboard/GenderOnBoard';
import OnBoardEnd from './screens/onboard/OnBoardEnd';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import StartScreen from './screens/StartScreen';
import RouteCreateScreen from './screens/RouteCreateScreen';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  SharedRoute: { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string } | undefined;
  MyRoute: undefined;
  Chat: undefined;
  All: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Start: undefined;
  RouteCreate:
    | { editRouteId?: string; collaborative?: boolean; seedMockCourseId?: string }
    | undefined;
  ProfileSettings: undefined;

  // Auth 관련
  Login: undefined;
  Signup: undefined;
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ACCENT = '#2563eb';
const TAB_INACTIVE = '#9ca3af';
const TAB_GLASS_BG = 'rgba(255, 255, 255, 0.88)';
const TAB_GLASS_BORDER = 'rgba(148, 163, 184, 0.35)';

// 탭 아이콘 맵을 모듈 스코프에 고정 — tabBarIcon 내부에서 매 렌더마다 생성하는 낭비 제거
const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: 'home',
  SharedRoute: 'paper-plane',
  MyRoute: 'map',
  Chat: 'chatbubble',
  All: 'menu',
};

// 모듈 스코프에 정의해 참조를 안정화 — tabBarBackground는 함수로 호출되어야 함
function TabBarGlassBackground() {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 22,
          backgroundColor: TAB_GLASS_BG,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: TAB_GLASS_BORDER,
        },
      ]}
    />
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 12);

  // tabBar 콜백을 useCallback으로 안정화 — bottomPad가 바뀔 때만 재생성
  const renderTabBar = useCallback(
    (props: any) => (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: bottomPad,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '88%' }}>
          <BottomTabBar {...props} />
        </View>
      </View>
    ),
    [bottomPad],
  );

  // screenOptions를 useMemo로 안정화
  const screenOptions = useMemo(
    () =>
      ({ route }: { route: any }) => ({
        tabBarIcon: ({ color }: { focused: boolean; color: string }) => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 2,
              minHeight: 28,
            }}
          >
            <Ionicons name={TAB_ICONS[route.name as keyof RootTabParamList] as any} size={24} color={color} />
          </View>
        ),
        tabBarActiveTintColor: TAB_ACCENT,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarBackground: TabBarGlassBackground,
        tabBarStyle: {
          position: 'relative' as const,
          height: 56 + insets.bottom,
          paddingHorizontal: 4,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: Platform.OS === 'android' ? 14 : 0,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.18,
          shadowRadius: 20,
          borderRadius: 22,
        },
        tabBarLabelStyle: {
          ...TEXT_STYLE.tabLabelInactive,
          marginTop: 1,
          marginBottom: 0,
        },
        tabBarActiveLabelStyle: {
          ...TEXT_STYLE.tabLabelActive,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center' as const,
        },
      }),
    [bottomPad, insets.bottom],
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={renderTabBar}
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false, tabBarLabel: '홈' }}
      />
      <Tab.Screen
        name="SharedRoute"
        component={SharedRouteScreen}
        options={{ headerShown: false, tabBarLabel: '공유 루트' }}
      />
      <Tab.Screen
        name="MyRoute"
        component={MyRouteScreen}
        options={{ headerShown: false, tabBarLabel: '내 루트' }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false, tabBarLabel: '채팅' }}
      />
      <Tab.Screen
        name="All"
        component={AllScreen}
        options={{ headerShown: false, title: '전체', tabBarLabel: '전체' }}
      />
    </Tab.Navigator>
  );
}

export default function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);
  const restoreSession = useAuthStore(s => s.restoreSession);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    restoreSession().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MockDataProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Stack.Navigator
              screenOptions={{ headerShown: false }}
              initialRouteName={isAuthenticated ? 'Tabs' : 'Login'}
            >
              <Stack.Screen name="Tabs" component={TabNavigator} />
              <Stack.Screen name="RouteCreate" component={RouteCreateScreen} />
              <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
              <Stack.Screen name="OnBoardStart" component={OnBoardStart} />
              <Stack.Screen name="AreaOnBoard" component={AreaOnBoard} />
              <Stack.Screen name="AgeOnBoard" component={AgeOnBoard} />
              <Stack.Screen name="ActivityOnBoard" component={ActivityOnBoard} />
              <Stack.Screen name="GenderOnBoard" component={GenderOnBoard} />
              <Stack.Screen name="OnBoardEnd" component={OnBoardEnd} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="Start" component={StartScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </MockDataProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
