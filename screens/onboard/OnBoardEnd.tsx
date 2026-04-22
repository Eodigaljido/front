import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  BackHandler,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";
import { getOnboardingAnswers } from "../../api/onboard/answer";
import { submitOnboarding } from "../../api/onboard/submit";

import rooti_run_onboard from "../../assets/onboard/rooti_run_onboard.png";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnBoardEnd(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const answers = await getOnboardingAnswers();

      await submitOnboarding({
        region: answers.region ?? "",
        age: answers.age ?? "",
        activity: answers.activity ?? [],
        gender: answers.gender ?? "",
      });

      navigation.navigate("Home");
    } catch (e) {
      Alert.alert("오류", "제출 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

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
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-center">
                서비스 시작하기
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
