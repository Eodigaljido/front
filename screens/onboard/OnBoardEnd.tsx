import React, { useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  BackHandler, // 뒤로가기 방지
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";

import rooti_run_onboard from "../../assets/onboard/rooti_run_onboard.png";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnBoardEnd(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // 뒤로가기 방지
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => backHandler.remove();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 justify-center items-center px-6">
        <View className="items-center">
          <View className="flex-row justify-center items-center mb-6 overflow-hidden w-screen">
            <Image
              source={rooti_run_onboard}
              className="w-64 h-64"
              style={{ marginLeft: -(SCREEN_WIDTH * 0.25) }}
            />
            <Image source={rooti_run_onboard} className="w-64 h-64 mx-4" />
            <Image
              source={rooti_run_onboard}
              className="w-64 h-64"
              style={{ marginRight: -(SCREEN_WIDTH * 0.25) }}
            />
          </View>

          <Text className="text-3xl font-bold text-gray-800 mb-4">
            설문조사 <Text className="text-blue-500">성공!</Text>
          </Text>

          <Text className="text-lg text-gray-400 text-center font-bold mb-10">
            설문조사가 끝났어요.{"\n"}
            설문조사 내용은 추후 변경이 가능해요!
          </Text>

          <TouchableOpacity
            className="bg-blue-500 rounded-full py-3 px-6 w-[275px]"
            onPress={() => navigation.navigate("Tabs")}
          >
            <Text className="text-white font-bold text-center">
              서비스 시작하기
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
