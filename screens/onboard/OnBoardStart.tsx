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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

import rooti_map_onboard from "../../assets/onboard/rooti_map_onboard.png";

type RootParamList = {
  OnBoardStart: undefined;
  AreaOnBoard: undefined;
  Tabs: undefined;
};

export default function OnBoardStart(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();

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
              source={rooti_map_onboard}
              className="w-64 h-64"
              style={{ marginLeft: -(SCREEN_WIDTH * 0.25) }}
            />
            <Image source={rooti_map_onboard} className="w-64 h-64 mx-4" />
            <Image
              source={rooti_map_onboard}
              className="w-64 h-64"
              style={{ marginRight: -(SCREEN_WIDTH * 0.25) }}
            />
          </View>

          <Text className="text-3xl font-bold text-gray-800 mb-4">
            나는 어떤 사람일까?
          </Text>

          <Text className="text-lg text-gray-400 text-center font-bold mb-10">
            설문 조사를 통해 사용자님에 대한 정보를{"\n"}
            저희에게 알려주세요!
          </Text>

          <TouchableOpacity
            className="bg-blue-500 rounded-full py-3 px-6 w-[275px]"
            onPress={() => navigation.navigate("AreaOnBoard")}
          >
            <Text className="text-white font-bold text-center">시작하기</Text>
          </TouchableOpacity>

          <Text
            className="text-base text-gray-400 text-center mt-10 font-bold"
            onPress={() => navigation.replace("Tabs")}
          >
            지금은 안할래요
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
