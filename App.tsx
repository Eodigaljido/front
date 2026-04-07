import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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
  Map: undefined;
  Chat: undefined;
  All: undefined;
  Start: undefined;
  Login: undefined;
  Signup: undefined;

  // 온보드 관련
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Tabs: undefined;
  HomeScreen: undefined;
  Start: undefined;
  RouteCreate:
    | { editRouteId?: string; collaborative?: boolean; seedMockCourseId?: string }
    | undefined;
  ProfileSettings: undefined;

  // Auth 관련
  Login: undefined;
  Signup: undefined;

  // 온보드 관련
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  AgeOnBoard: undefined;
  ActivityOnBoard: undefined;
  GenderOnBoard: undefined;
  OnBoardEnd: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const icons: Record<keyof RootTabParamList, string> = {
            Home: 'home',
            SharedRoute: 'paper-plane',
            MyRoute: 'map',
            Map: 'navigate-outline',
            Chat: 'chatbubble',
            All: 'menu',
            OnBoardStart: 'onboard start',
            AreaOnBoard: 'area onboard',
            AgeOnBoard: 'age onboard',
            ActivityOnBoard: 'activity onboard',
            GenderOnBoard: 'gender onboard',
            OnBoardEnd: 'onboard end',
            Login: 'log-in',
            Signup: 'person-add',
            Start: 'rocket',
          };
          return (
            <Ionicons name={icons[route.name]} size={24} color={focused ? '#007AFF' : '#000'} />
          );
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#000',
        tabBarStyle: {
          position: 'absolute',
          width: '88%',
          alignSelf: 'center',
          bottom: 24,
          marginHorizontal: '6%',
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: '#fff',
          borderRadius: 28,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.06)',
          elevation: 24,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
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
        options={{ headerShown: false, title: '홈', tabBarLabel: '홈' }}
      />
      <Tab.Screen
        name="SharedRoute"
        component={SharedRouteScreen}
        options={{ headerShown: false, title: '공유 루트', tabBarLabel: '공유 루트' }}
      />
      <Tab.Screen
        name="MyRoute"
        component={MyRouteScreen}
        options={{ headerShown: false, title: '내 루트', tabBarLabel: '내 루트' }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false, title: '채팅', tabBarLabel: '채팅' }}
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <MockDataProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="RouteCreate" component={RouteCreateScreen} />
          <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
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
  );
}
