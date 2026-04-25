import { BackButton } from "@/components/chat/BackButton";
import { View, Text } from "react-native";

interface RoomHeaderProps {
  roomName?: string;
}

export const RoomHeader = ({ roomName = "채팅방" }: RoomHeaderProps) => {
  return (
    <View
      className="w-full bg-blue-500 flex-row items-center mt-6 px-4"
      style={{ height: 64 }}
    >
      <BackButton />
      <Text className="text-white text-lg font-bold flex-1 text-center">
        {roomName}
      </Text>
      <View className="w-6" />
    </View>
  );
};
