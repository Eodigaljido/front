import { MessageInput } from "@/stories/chat/MessageInput";
import { View } from "react-native";

interface RoomFooterProps {
  onSend?: (message: string) => void;
  editingText?: string | null;
  onCancelEdit?: () => void;
}

export function RoomFooter({
  onSend,
  editingText,
  onCancelEdit,
}: RoomFooterProps) {
  return (
    <View
      className="w-full bg-gray-200 justify-center items-center"
      style={{
        position: "absolute",
        bottom: "4%",
        left: 0,
        right: 0,
        paddingVertical: 10,
      }}
    >
      <MessageInput
        onSend={onSend}
        editingText={editingText}
        onCancelEdit={onCancelEdit}
      />
    </View>
  );
}
