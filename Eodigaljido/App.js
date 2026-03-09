import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import SharedRouteScreen from './screens/SharedRouteScreen';
import MyRouteScreen from './screens/MyRouteScreen';
import ChatScreen from './screens/ChatScreen';
import AllScreen from './screens/AllScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
  screenOptions={({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => {
      const icons = {
        Home: 'home',
        SharedRoute: 'paper-plane',
        MyRoute: 'map',
        Chat: 'chatbubble',
        All: 'menu',
      };

      return (
        <Ionicons
          name={icons[route.name]}
          size={24}
          color={focused ? '#007AFF' : '#000'}
        />
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
      // 입체감: 강한 하단 그림자
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 24,
      // 상단 얇은 테두리로 빛 받는 느낌
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
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈', tabBarLabel: '홈' }} />
        <Tab.Screen name="SharedRoute" component={SharedRouteScreen} options={{ title: '공유 루트', tabBarLabel: '공유 루트' }} />
        <Tab.Screen name="MyRoute" component={MyRouteScreen} options={{ title: '내 루트', tabBarLabel: '내 루트' }} />
        <Tab.Screen name="Chat" component={ChatScreen} options={{ title: '채팅', tabBarLabel: '채팅' }} />
        <Tab.Screen name="All" component={AllScreen} options={{ title: '전체', tabBarLabel: '전체' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
