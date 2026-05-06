// @ts-nocheck
import React from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import ProgressBar from "@/components/onboard/ProgressBar";
import Title from "@/components/onboard/Title";
import Description from "@/components/onboard/Description";
import AreaRadioButton from "@/components/onboard/AreaRadioButton";
import PreviousButton from "@/components/onboard/PreviousButton";
import NextButton from "@/components/onboard/NextButton";
import { useAuthStore } from "@/store/authStore";
import { completeOnboardingStep } from "@/api/onboard/step";

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

const SCREEN_PADDING = 24; // px-6
const COLUMNS_VISIBLE = 3;
const COLUMN_GAP = 8;
const ITEMS_PER_COLUMN = 6;

// ITEMS_PER_COLUMN개씩 묶어 세로 컬럼 구성
const REGION_COLUMNS = REGIONS.reduce<string[][]>((acc, region, i) => {
  const colIdx = Math.floor(i / ITEMS_PER_COLUMN);
  if (!acc[colIdx]) acc[colIdx] = [];
  acc[colIdx].push(region);
  return acc;
}, []);

export default function AreaOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedArea, setSelectedArea] = React.useState<string>("");
  const accessToken = useAuthStore((s) => s.accessToken);
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth =
    (screenWidth - SCREEN_PADDING * 2 - COLUMN_GAP * (COLUMNS_VISIBLE - 1)) /
    COLUMNS_VISIBLE;

  const handleNext = async () => {
    await completeOnboardingStep(accessToken!, 1, selectedArea);
    navigation.navigate("AgeOnBoard");
  };

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-6"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: COLUMN_GAP }}
        >
          {REGION_COLUMNS.map((col, colIdx) => (
            <View key={colIdx} style={{ width: columnWidth, gap: COLUMN_GAP }}>
              {col.map((region) => (
                <View key={region} style={{ flexDirection: "row" }}>
                  <AreaRadioButton
                    label={region}
                    value={selectedArea === region}
                    onPress={() => setSelectedArea(region)}
                  />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
        <View className="items-end mt-6">
          <NextButton disabled={!selectedArea} onPress={handleNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}
