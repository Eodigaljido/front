// @ts-nocheck
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../App";

type AllScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Tabs"
>;

export default function AllScreen(): React.JSX.Element {
  const navigation = useNavigation<AllScreenNavigationProp>();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-semibold mb-4">전체</Text>
        <TouchableOpacity
          className="bg-blue-500 px-6 py-3 rounded"
          onPress={() => navigation.navigate("OnBoardStart")}
        >
          <Text className="text-white font-bold">온보드 시작</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
