import { BackButton } from "@/components/chat/BackButton";
import { View, Text } from "react-native";

export const RoomHeader = () => {
  return (
    <View
      className="w-full bg-blue-500 flex-row items-center mt-6 px-4"
      style={{ height: 64 }}
    >
      <BackButton />
      <Text className="text-white text-lg font-bold flex-1 text-center">
        방 이름
      </Text>
      <View className="w-6" />
    </View>
  );
};
