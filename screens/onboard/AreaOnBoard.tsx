// @ts-nocheck
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import ProgressBar from "@/components/onboard/ProgressBar";
import Title from "@/components/onboard/Title";
import Description from "@/components/onboard/Description";
import AreaRadioButton from "@/components/onboard/AreaRadioButton";
import PreviousButton from "@/components/onboard/PreviousButton";
import NextButton from "@/components/onboard/NextButton";

const REGIONS = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기도",
  "강원도",
  "충청북도",
  "충청남도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주도",
];

export default function AreaOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedArea, setSelectedArea] = React.useState("");

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View>
        <ProgressBar value={1} />
      </View>
      <View className="px-6 pt-8 flex-1">
        <Title>
          <Text className="text-blue-500">거주 지역</Text>이{"\n"}
          어디인가요?
        </Title>
        <Description desc={`거주 지역에 따라서 추천하는 장소가 달라져요!`} />
        <ScrollView className="mt-6" showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap">
            {REGIONS.map((region) => (
              <View key={region} className="w-1/2 p-2">
                <AreaRadioButton
                  label={region}
                  value={selectedArea === region}
                  onPress={() => setSelectedArea(region)}
                />
              </View>
            ))}
          </View>
          <View className="flex-row items-center justify-end px-4 pt-5 pb-4">
            <NextButton
              disabled={!selectedArea}
              onPress={() => navigation.navigate("AgeOnBoard")}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
