import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { MockDataProvider } from './context/MockDataContext';
import HomeScreen from './screens/HomeScreen';
import SharedRouteScreen from './screens/SharedRouteScreen';
import MyRouteScreen from './screens/MyRouteScreen';
import ChatScreen from './screens/ChatScreen';
import AllScreen from './screens/AllScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MapScreen from './screens/MapScreen-Test';

export type RootTabParamList = {
  Home: undefined;
  SharedRoute: { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string } | undefined;
  MyRoute: undefined;
  Map: undefined;
  Chat: undefined;
  All: undefined;
  Login: undefined;
  Signup: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App(): React.JSX.Element {
  return (
    <MockDataProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
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
                Login: 'log-in',
                Signup: 'person-add',
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
          {/* <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false, title: '지도', tabBarLabel: '지도' }} /> */}
          <Tab.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false, title: '채팅', tabBarLabel: '채팅' }}
          />
          <Tab.Screen
            name="All"
            component={AllScreen}
            options={{ title: '전체', tabBarLabel: '전체' }}
          />
          <Tab.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
              title: '로그인',
              tabBarLabel: '로그인',
            }}
          />
          <Tab.Screen
            name="Signup"
            component={SignupScreen}
            options={{
              headerShown: false,
              headerPressOpacity: 0.3,
              tabBarStyle: { display: 'none' },
              title: '회원가입',
              tabBarLabel: '회원가입',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </MockDataProvider>
  );
}
