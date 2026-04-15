import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { ProfileImage } from "@/components/ProfileImage";
import { View } from "react-native";
import { Button } from "@/stories/Button";

export const ChatRoomScreen = () => {
  return (
    <View className="flex-1">
      <RoomHeader />
      <View className="flex-1 justify-center items-center"></View>
      <RoomFooter />
    </View>
  );
};
