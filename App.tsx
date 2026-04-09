import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { MockDataProvider } from "./context/MockDataContext";
import HomeScreen from "./screens/HomeScreen";
import SharedRouteScreen from "./screens/SharedRouteScreen";
import MyRouteScreen from "./screens/MyRouteScreen";
import ChatHomeScreen from "./screens/ChatHomeScreen";
import AllScreen from "./screens/AllScreen";
import OnBoardStart from "./screens/onboard/OnBoardStart";
import AreaOnBoard from "./screens/onboard/AreaOnBoard";
import AgeOnBoard from "./screens/onboard/AgeOnBoard";
import ActivityOnBoard from "./screens/onboard/ActivityOnBoard";
import GenderOnBoard from "./screens/onboard/GenderOnBoard";
import OnBoardEnd from "./screens/onboard/OnBoardEnd";
import { ChatRoomScreen } from "./screens/ChatRoomScreen";

export type RootTabParamList = {
  Home: undefined;
  SharedRoute:
    | { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string }
    | undefined;
  MyRoute: undefined;
  Chat: undefined;
  All: undefined;

  // 온보드 관련
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;

  // 채팅 관련
  ChatRoomScreen: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Tabs: undefined;
  HomeScreen: undefined;

  // 온보드 관련
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;

  // 채팅 관련
  ChatRoomScreen: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const icons: Record<keyof RootTabParamList, string> = {
            Home: "home",
            SharedRoute: "paper-plane",
            MyRoute: "map",
            Chat: "chatbubble",
            All: "menu",
            OnBoardStart: "onboard start",
            AreaOnBoard: "area onboard",
            AgeOnBoard: "age onboard",
            ActivityOnBoard: "activity onboard",
            GenderOnBoard: "gender onboard",
            OnBoardEnd: "onboard end",
            ChatRoomScreen: "chatroom",
          };
          return (
            <Ionicons
              name={icons[route.name]}
              size={24}
              color={focused ? "#007AFF" : "#000"}
            />
          );
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#000",
        tabBarStyle: {
          position: "absolute",
          width: "88%",
          alignSelf: "center",
          bottom: 24,
          marginHorizontal: "6%",
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: "#fff",
          borderRadius: 28,
          borderTopWidth: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 24,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.06)",
          elevation: 24,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false, title: "홈", tabBarLabel: "홈" }}
      />
      <Tab.Screen
        name="SharedRoute"
        component={SharedRouteScreen}
        options={{
          headerShown: false,
          title: "공유 루트",
          tabBarLabel: "공유 루트",
        }}
      />
      <Tab.Screen
        name="MyRoute"
        component={MyRouteScreen}
        options={{ title: "내 루트", tabBarLabel: "내 루트" }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatHomeScreen}
        options={{ headerShown: false, title: "채팅", tabBarLabel: "채팅" }}
      />
      <Tab.Screen
        name="All"
        component={AllScreen}
        options={{ title: "전체", tabBarLabel: "전체" }}
      />
    </Tab.Navigator>
  );
}

export default function App(): React.JSX.Element {
  return (
    <MockDataProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="OnBoardStart" component={OnBoardStart} />
          <Stack.Screen name="AreaOnBoard" component={AreaOnBoard} />
          <Stack.Screen name="AgeOnBoard" component={AgeOnBoard} />
          <Stack.Screen name="ActivityOnBoard" component={ActivityOnBoard} />
          <Stack.Screen name="GenderOnBoard" component={GenderOnBoard} />
          <Stack.Screen name="OnBoardEnd" component={OnBoardEnd} />
          <Stack.Screen name="ChatRoomScreen" component={ChatRoomScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </MockDataProvider>
  );
}
