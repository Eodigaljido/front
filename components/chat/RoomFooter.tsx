import { MessageInput } from "@/stories/chat/MessageInput";
import { View } from "react-native";

interface RoomFooterProps {
  onSend?: (message: string) => void;
}

export function RoomFooter({ onSend }: RoomFooterProps) {
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
    >
      <MessageInput onSend={onSend} />
    </View>
  );
}
