import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AllScreen from '../screens/AllScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';

export type AllStackParamList = {
  AllMain: undefined;
  ProfileSettings: undefined;
};

const Stack = createNativeStackNavigator<AllStackParamList>();

export default function AllStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f5f5f9' },
      }}
    >
      <Stack.Screen name="AllMain" component={AllScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
    </Stack.Navigator>
  );
}
