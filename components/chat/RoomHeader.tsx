import { BackButton } from "@/components/chat/BackButton";
import { View, Text } from "react-native";
import { InfoButton } from "./InfoButton";

interface RoomHeaderProps {
  roomName?: string;
}

export const RoomHeader = ({ roomName = "채팅방" }: RoomHeaderProps) => {
  return (
    <View
      className="w-full bg-white flex-row items-center mt-10 px-4"
      style={{ height: 80 }}
    >
      <BackButton />
      <View
        className="absolute left-0 right-0 items-center justify-center"
        style={{ height: 50 }}
        pointerEvents="none"
      >
        <Text className="text-black text-lg font-bold">{roomName}</Text>
      </View>
      <View className="flex-1" />
      <InfoButton />
    </View>
  );
};
