import { View, Text } from "react-native";
import { Map, Info } from "lucide-react-native";
import { RoomFooter } from "./RoomFooter";

export const RoomHeader = () => {
  return (
    <View
      className="w-full bg-blue-500 justify-center items-center mt-6"
      style={{ height: 64 }}
    >
      <Text className="text-white text-lg font-bold">방 이름</Text>
      <RoomFooter />
    </View>
  );
};
