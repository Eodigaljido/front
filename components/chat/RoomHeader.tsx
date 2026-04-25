import { BackButton } from "@/components/chat/BackButton";
import { View, Text } from "react-native";

interface RoomHeaderProps {
  roomName?: string;
}

export const RoomHeader = ({ roomName = "채팅방" }: RoomHeaderProps) => {
  return (
    <View
      className="w-full bg-white flex-row items-center mt-10 px-4"
      style={{ height: 50 }}
    >
      <BackButton />
      <Text className="text-black text-lg font-bold flex-1 text-center">
        {roomName}
      </Text>
      <View className="w-6" />
    </View>
  );
};
