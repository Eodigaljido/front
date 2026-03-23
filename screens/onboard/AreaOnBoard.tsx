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

export default function AreaOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedArea, setSelectedArea] = React.useState("");

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View>
        <ProgressBar value={1} />
      </View>
      <View className="px-6 pt-8">
        <Title>
          <Text className="text-blue-500">거주 지역</Text>이{"\n"}
          어디인가요?
        </Title>
        <Description desc={`거주 지역에 따라서 추천하는 장소가 달라져요!`} />
        <View className="mt-6 gap-3">
          <RadioButton
            label="10대"
            value={selectedArea === "10대"}
            onPress={() => setSelectedArea("10대")}
          />

          <RadioButton
            label="20대"
            value={selectedArea === "20대"}
            onPress={() => setSelectedArea("20대")}
          />

          <RadioButton
            label="30대"
            value={selectedArea === "30대"}
            onPress={() => setSelectedArea("30대")}
          />

          <RadioButton
            label="40대 이상"
            value={selectedArea === "40대 이상"}
            onPress={() => setSelectedArea("40대 이상")}
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between px-10 mt-20">
        <NextButton
          disabled={!selectedArea}
          onPress={() => navigation.navigate("AgeOnBoard")}
        />
      </View>
    </SafeAreaView>
  );
}
