import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Route } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { RootStackParamList } from "@/App";
import React from "react";

export const RouteButton = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("ChatRouteHistory")}
      accessibilityRole="button"
      accessibilityLabel="루트 기록 보기"
    >
      <View className="w-6 h-6 rounded-full justify-center items-center">
        <Route size={25} color="black" />
      </View>
    </TouchableOpacity>
  );
};
