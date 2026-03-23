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

export default function ActivityOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedActivities, setSelectedActivities] = React.useState<string[]>(
    [],
  );

  const toggle = (item: string) => {
    setSelectedActivities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View>
        <ProgressBar value={3} />
      </View>
      <View className="px-6 pt-8">
        <Title>
          좋아하는<Text className="text-blue-500">활동</Text>이{"\n"}
          무엇인가요?
        </Title>
        <Description desc={`취미 활동에 따라서 추천하는 장소가 달라져요!`} />
        <View className="mt-6">
          <RadioButton
            label="운동/건강"
            value={selectedActivities.includes("운동/건강")}
            onPress={() => toggle("운동/건강")}
          />

          <RadioButton
            label="예술/문화"
            value={selectedActivities.includes("예술/문화")}
            onPress={() => toggle("예술/문화")}
          />

          <RadioButton
            label="음악/공연"
            value={selectedActivities.includes("음악/공연")}
            onPress={() => toggle("음악/공연")}
          />

          <RadioButton
            label="여행/레저"
            value={selectedActivities.includes("여행/레저")}
            onPress={() => toggle("여행/레저")}
          />
          <RadioButton
            label="기타"
            value={selectedActivities.includes("기타")}
            onPress={() => toggle("기타")}
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between px-10 mt-20">
        <PreviousButton onPress={() => navigation.navigate("AgeOnBoard")} />
        <NextButton
          disabled={selectedActivities.length === 0}
          onPress={() => navigation.navigate("GenderOnBoard")}
        />
      </View>
    </SafeAreaView>
  );
}
