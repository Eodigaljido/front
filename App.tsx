import React from 'react';
import { StatusBar } from 'expo-status-bar';
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

type TabIconName = 'home' | 'paper-plane' | 'map' | 'chatbubble' | 'menu';

const TAB_ICONS: Record<keyof RootTabParamList, TabIconName> = {
  Home: 'home',
  SharedRoute: 'paper-plane',
  MyRoute: 'map',
  Chat: 'chatbubble',
  All: 'menu',
};

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={24} color={focused ? '#007AFF' : '#000'} />
        ),
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
      <Tab.Screen name="All" component={AllScreen} options={{ tabBarLabel: '전체' }} />
    </Tab.Navigator>
  );
}

export default function App(): React.JSX.Element {
  return (
    <MockDataProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Start" component={StartScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="OnBoardStart" component={OnBoardStart} />
          <Stack.Screen name="AreaOnBoard" component={AreaOnBoard} />
          <Stack.Screen name="AgeOnBoard" component={AgeOnBoard} />
          <Stack.Screen name="ActivityOnBoard" component={ActivityOnBoard} />
          <Stack.Screen name="GenderOnBoard" component={GenderOnBoard} />
          <Stack.Screen name="OnBoardEnd" component={OnBoardEnd} />
          <Stack.Screen name="Tabs" component={TabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </MockDataProvider>
  );
}
