import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useAuthStore } from "./store/authStore";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "./navigation/rootNavigation";
import {
  BottomTabBar,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { TEXT_STYLE } from "./styles/textStyles";

import { KeyboardProvider } from "react-native-keyboard-controller";
import { MockDataProvider } from "./context/MockDataContext";
import { ToastProvider } from "./context/ToastContext";
import HomeScreen from "./screens/HomeScreen";
import SharedRouteScreen from "./screens/SharedRouteScreen";
import MyRouteScreen from "./screens/MyRouteScreen";
import AllScreen from "./screens/AllScreen";
import OnBoardStart from "./screens/onboard/OnBoardStart";
import AreaOnBoard from "./screens/onboard/AreaOnBoard";
import AgeOnBoard from "./screens/onboard/AgeOnBoard";
import ActivityOnBoard from "./screens/onboard/ActivityOnBoard";
import GenderOnBoard from "./screens/onboard/GenderOnBoard";
import OnBoardEnd from "./screens/onboard/OnBoardEnd";
import ChatHomeScreen from "./screens/chat/ChatHomeScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import { ChatRoomScreen } from "./screens/chat/ChatRoomScreen";
import ChatCreatingScreen from "./screens/chat/ChatCreatingScreen";
import ChatRoomInfoScreen from "./screens/chat/ChatRoomInfoScreen";
import RouteCreateScreen from "./screens/RouteCreateScreen";
import RouteCollaboratorsScreen from "./screens/RouteCollaboratorsScreen";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen";
import FindAccountScreen from "./screens/FindAccountScreen";
import FollowingNewsScreen from "./screens/FollowingNewsScreen";
import NotificationCenterScreen from "./screens/NotificationCenterScreen";
import CourseGuideScreen from "./screens/CourseGuideScreen";
import { appLinking } from "./constants/shareLinking";
import UserProfileScreen from "./screens/UserProfileScreen";
import { ChatRouteHistory } from "./screens/chat/ChatRouteHistory";

export type RootTabParamList = {
  Home: undefined;
  SharedRoute:
    | { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string }
    | undefined;
  MyRoute: { viewCourseId?: string } | undefined;
  Chat: undefined;
  All: { friendCode?: string } | undefined;

  // 온보드 관련
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;

  // 채팅 관련
  ChatRoomScreen: undefined;
  ChatCreatingScreen: undefined;
  ChatRouteHistory: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  SharedRouteStack:
    | { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string }
    | undefined;
  MyRouteStack: undefined;
  RouteCreate:
    | {
        editRouteId?: string;
        collaborative?: boolean;
        seedSharedCourseId?: string;
      }
    | undefined;
  ProfileSettings: undefined;
  UserProfile: {
    userUuid?: string;
    userId?: string;
    nickname?: string;
    profileImageUrl?: string;
  };

  // Auth 관련
  Login: undefined;
  Signup: undefined;
  FindAccount: undefined;
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;

  // 채팅 관련
  ChatRoomScreen: { roomUuid: string; roomName: string; memberCount?: number };
  ChatCreatingScreen: undefined;
  ChatRouteHistory: undefined;
  ChatRoomInfoScreen: { roomUuid: string; roomName: string };

  FollowingNews: undefined;
  NotificationCenter: undefined;
  /** 내 코스 카드 「안내」 — 지도 중심, 턴바이턴 없음 (방향성.md) */
  CourseGuide: { courseId: string; courseTitle?: string };
  /** 공동 루트 편집 멤버(방장·참여자) */
  RouteCollaborators: {
    routeId: string;
    routeTitle?: string;
  };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ACCENT = "#2563eb";
const TAB_INACTIVE = "#9ca3af";
const TAB_GLASS_BG = "rgba(255, 255, 255, 0.88)";
const TAB_GLASS_BORDER = "rgba(148, 163, 184, 0.35)";

type IonIconName = NonNullable<ComponentProps<typeof Ionicons>["name"]>;

const TAB_ICONS: Record<
  "Home" | "SharedRoute" | "MyRoute" | "Chat" | "All",
  IonIconName
> = {
  Home: "home",
  SharedRoute: "paper-plane",
  MyRoute: "map",
  Chat: "chatbubble",
  All: "menu",
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
  const bottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? 8 : 10);

  // tabBar 콜백을 useCallback으로 안정화 — bottomPad가 바뀔 때만 재생성
  const renderTabBar = useCallback(
    (props: any) => (
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: bottomPad,
          alignItems: "center",
          zIndex: 100,
          elevation: 100,
        }}
      >
        <View style={{ width: "88%" }}>
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
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 2,
              minHeight: 28,
            }}
          >
            <Ionicons
              name={
                TAB_ICONS[
                  route.name as
                    | "Home"
                    | "SharedRoute"
                    | "MyRoute"
                    | "Chat"
                    | "All"
                ]
              }
              size={24}
              color={color}
            />
          </View>
        ),
        tabBarActiveTintColor: TAB_ACCENT,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarBackground: TabBarGlassBackground,
        tabBarStyle: {
          position: "relative" as const,
          height: 64,
          paddingHorizontal: 2,
          paddingTop: 6,
          paddingBottom: 8,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: Platform.OS === "android" ? 14 : 0,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: Platform.OS === "ios" ? 0.12 : 0.18,
          shadowRadius: 20,
          borderRadius: 22,
        },
        tabBarLabelStyle: {
          ...TEXT_STYLE.tabLabelInactive,
          fontSize: 11,
          lineHeight: 14,
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarActiveLabelStyle: {
          ...TEXT_STYLE.tabLabelActive,
          fontSize: 11,
          lineHeight: 14,
        },
        tabBarItemStyle: {
          paddingTop: 1,
          paddingBottom: 1,
          justifyContent: "center" as const,
        },
      }),
    [insets.bottom],
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
        options={{ headerShown: false, tabBarLabel: "홈" }}
      />
      <Tab.Screen
        name="SharedRoute"
        component={SharedRouteScreen}
        options={{ headerShown: false, tabBarLabel: "공유 루트" }}
      />
      <Tab.Screen
        name="MyRoute"
        component={MyRouteScreen}
        options={{ headerShown: false, tabBarLabel: "내 루트" }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatHomeScreen}
        options={{ headerShown: false, title: "채팅", tabBarLabel: "채팅" }}
      />
      <Tab.Screen
        name="All"
        component={AllScreen}
        options={{ headerShown: false, title: "전체", tabBarLabel: "전체" }}
      />
    </Tab.Navigator>
  );
}

export default function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    restoreSession().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <MockDataProvider>
            <NavigationContainer ref={navigationRef} linking={appLinking}>
              <KeyboardProvider>
                <StatusBar style="auto" />
                <Stack.Navigator
                  screenOptions={{ headerShown: false }}
                  initialRouteName={isAuthenticated ? "Tabs" : "Login"}
                >
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="Signup" component={SignupScreen} />
                  <Stack.Screen name="Tabs" component={TabNavigator} />
                  <Stack.Screen
                    name="SharedRouteStack"
                    component={SharedRouteScreen}
                  />
                  <Stack.Screen name="MyRouteStack" component={MyRouteScreen} />
                  <Stack.Screen
                    name="RouteCreate"
                    component={RouteCreateScreen}
                  />
                  <Stack.Screen
                    name="RouteCollaborators"
                    component={RouteCollaboratorsScreen}
                  />
                  <Stack.Screen
                    name="CourseGuide"
                    component={CourseGuideScreen}
                  />
                  <Stack.Screen
                    name="ProfileSettings"
                    component={ProfileSettingsScreen}
                  />
                  <Stack.Screen
                    name="UserProfile"
                    component={UserProfileScreen}
                  />
                  <Stack.Screen name="OnBoardStart" component={OnBoardStart} />
                  <Stack.Screen name="AreaOnBoard" component={AreaOnBoard} />
                  <Stack.Screen name="AgeOnBoard" component={AgeOnBoard} />
                  <Stack.Screen
                    name="ActivityOnBoard"
                    component={ActivityOnBoard}
                  />
                  <Stack.Screen
                    name="GenderOnBoard"
                    component={GenderOnBoard}
                  />
                  <Stack.Screen name="OnBoardEnd" component={OnBoardEnd} />
                  <Stack.Screen
                    name="FindAccount"
                    component={FindAccountScreen}
                  />
                  <Stack.Screen
                    name="ChatCreatingScreen"
                    component={ChatCreatingScreen}
                  />
                  <Stack.Screen
                    name="ChatRouteHistory"
                    component={ChatRouteHistory}
                  />
                  <Stack.Screen
                    name="FollowingNews"
                    component={FollowingNewsScreen}
                  />
                  <Stack.Screen
                    name="NotificationCenter"
                    component={NotificationCenterScreen}
                  />
                  <Stack.Screen
                    name="ChatRoomScreen"
                    component={ChatRoomScreen}
                  />
                  <Stack.Screen
                    name="ChatRoomInfoScreen"
                    component={ChatRoomInfoScreen}
                  />
                </Stack.Navigator>
              </KeyboardProvider>
            </NavigationContainer>
          </MockDataProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
