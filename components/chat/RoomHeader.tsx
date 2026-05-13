import { BackButton } from "@/components/chat/BackButton";
import { View, Text } from "react-native";
import { InfoButton } from "./InfoButton";

interface RoomHeaderProps {
  roomName?: string;
  roomUuid: string;
}

export const RoomHeader = ({ roomName = "채팅방", roomUuid }: RoomHeaderProps) => {
  return (
    <View
      className="w-full bg-white flex-row items-center mt-10 px-4"
      style={{ height: 80 }}
    >
      <View className="flex-1 items-start">
        <BackButton />
      </View>
      <Text className="text-black text-lg font-bold">{roomName}</Text>
      <View className="flex-1 items-end">
        <InfoButton roomUuid={roomUuid} roomName={roomName} />
      </View>
    </View>
  );
};
