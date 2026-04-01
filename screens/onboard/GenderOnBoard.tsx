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
import SubmitButton from "@/components/onboard/SubmitButton";

export default function GenderOnBoard(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedGender, setSelectedGender] = React.useState<string | null>(
    null,
  );

  const toggle = (item: string) => {
    setSelectedGender(item);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View>
        <ProgressBar value={4} />
      </View>
      <View className="px-6 pt-8">
        <Title>
          <Text className="text-blue-500">성별</Text>이{"\n"}
          무엇인가요?
        </Title>
        <Description desc={`성별에 따라 가장 있기있는 장소를 알려드릴게요!`} />
        <View className="mt-6">
          <RadioButton
            label="남성"
            value={selectedGender === "남성"}
            onPress={() => toggle("남성")}
          />

          <RadioButton
            label="여성"
            value={selectedGender === "여성"}
            onPress={() => toggle("여성")}
          />

          <RadioButton
            label="기타"
            value={selectedGender === "기타"}
            onPress={() => toggle("기타")}
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between px-10 mt-20">
        <PreviousButton
          onPress={() => navigation.navigate("ActivityOnBoard")}
        />
        <SubmitButton
          disabled={selectedGender === null}
          onPress={() => navigation.navigate("OnBoardEnd")}
        />
      </View>
    </SafeAreaView>
  );
}
