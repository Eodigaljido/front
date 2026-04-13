import { View, Text } from "react-native";

export function RoomFooter() {
  return (
    <View
      className="w-full bg-gray-200 justify-center items-center"
      style={{
        height: 165,
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
      }}
    ></View>
  );
}
