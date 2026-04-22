// @ts-nocheck
import React from "react";
import { View, Text, Image, TouchableOpacity, Input } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import ProgressBar from "@/components/onboard/ProgressBar";
import Title from "@/components/onboard/Title";
import Description from "@/components/onboard/Description";
import RadioButton from "@/components/onboard/RadioButton";
import PreviousButton from "@/components/onboard/PreviousButton";
import NextButton from "@/components/onboard/NextButton";
import { useAuthStore } from "@/store/authStore";
import { completeOnboardingStep } from "@/api/onboard/step";

export default function AgeOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedAge, setSelectedAge] = React.useState("");

  const handleNext = async () => {
    await completeOnboardingStep(accessToken!, 2, selectedAge);
    navigation.navigate("ActivityOnBoard");
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View>
        <ProgressBar value={2} />
      </View>
      <View className="px-6 pt-8">
        <Title>
          <Text className="text-blue-500">나이</Text>가{"\n"}
          어떻게 되시나요?
        </Title>
        <Description desc={`나이에 따라서 추천하는 장소가 달라져요!`} />
        <View className="mt-6 gap-1">
          <RadioButton
            label="10대"
            value={selectedAge === "10대"}
            onPress={() => setSelectedAge("10대")}
          />

          <RadioButton
            label="20대"
            value={selectedAge === "20대"}
            onPress={() => setSelectedAge("20대")}
          />

          <RadioButton
            label="30대"
            value={selectedAge === "30대"}
            onPress={() => setSelectedAge("30대")}
          />

          <RadioButton
            label="40대 이상"
            value={selectedAge === "40대 이상"}
            onPress={() => setSelectedAge("40대 이상")}
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between px-10 mt-10">
        <PreviousButton onPress={() => navigation.navigate("AreaOnBoard")} />
        <NextButton disabled={!selectedAge} onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}
