import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { MockDataProvider } from './context/MockDataContext';
import HomeScreen from './screens/HomeScreen';
import SharedRouteScreen from './screens/SharedRouteScreen';
import MyRouteScreen from './screens/MyRouteScreen';
import ChatScreen from './screens/ChatScreen';
import AllStackNavigator from './navigation/AllStackNavigator';
import MapScreen from './screens/MapScreen-Test';

export type RootTabParamList = {
  Home: undefined;
  SharedRoute: { openFilter?: boolean; openAsPopular?: boolean; viewCourseId?: string } | undefined;
  MyRoute: undefined;
  Map: undefined;
  Chat: undefined;
  All: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_BAR_STYLE = {
  position: 'absolute' as const,
  width: '88%' as const,
  alignSelf: 'center' as const,
  bottom: 24,
  marginHorizontal: '6%' as const,
  height: 74,
  paddingTop: 10,
  paddingBottom: 8,
  backgroundColor: '#fff',
  borderRadius: 28,
  borderTopWidth: 0,
  overflow: 'visible' as const,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.22,
  shadowRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.06)',
  elevation: 24,
};

export default function App(): React.JSX.Element {
  return (
    <MockDataProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color }) => {
            const icons: Record<keyof RootTabParamList, string> = {
              Home: 'home',
              SharedRoute: 'paper-plane',
              MyRoute: 'map',
              Map: 'navigate-outline',
              Chat: 'chatbubble',
              All: 'menu',
            };
            return (
              <View
                style={{
                  backgroundColor: focused ? 'rgba(0,122,255,0.12)' : 'transparent',
                  minWidth: 36,
                  minHeight: 30,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={icons[route.name]}
                  size={20}
                  color={color}
                />
              </View>
            );
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: TAB_BAR_STYLE,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },
          tabBarItemStyle: {
            paddingVertical: 5,
            justifyContent: 'center',
            alignItems: 'center',
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, title: '홈', tabBarLabel: '홈' }} />
        <Tab.Screen name="SharedRoute" component={SharedRouteScreen} options={{ headerShown: false, title: '공유 루트', tabBarLabel: '공유 루트' }} />
        <Tab.Screen name="MyRoute" component={MyRouteScreen} options={{ headerShown: false, title: '내 루트', tabBarLabel: '내 루트' }} />
        {/* <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false, title: '지도', tabBarLabel: '지도' }} /> */}
        <Tab.Screen name="Chat" component={ChatScreen} options={{ headerShown: false, title: '채팅', tabBarLabel: '채팅' }} />
        <Tab.Screen
          name="All"
          component={AllStackNavigator}
          options={({ route }) => {
            const nested = getFocusedRouteNameFromRoute(route) ?? 'AllMain';
            const hideTabBar = nested === 'ProfileSettings';
            return {
              headerShown: false,
              title: '전체',
              tabBarLabel: '전체',
              tabBarStyle: hideTabBar ? { display: 'none' } : TAB_BAR_STYLE,
            };
          }}
        />
      </Tab.Navigator>
      </NavigationContainer>
    </MockDataProvider>
  );
}
