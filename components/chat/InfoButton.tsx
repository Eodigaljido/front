import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Info } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { RootStackParamList } from "@/App";
import React from "react";

interface InfoButtonProps {
  roomUuid: string;
  roomName: string;
}

export const InfoButton = ({ roomUuid, roomName }: InfoButtonProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("ChatRoomInfoScreen", { roomUuid, roomName })
      }
      accessibilityRole="button"
      accessibilityLabel="정보 보기"
    >
      <View className="w-6 h-6 rounded-full justify-center items-center">
        <Info size={25} color="black" />
      </View>
    </TouchableOpacity>
  );
};
