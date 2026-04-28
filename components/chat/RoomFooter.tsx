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
      className="w-full bg-white items-center justify-center"
      style={{
        height: 80,
        bottom: "4%",
        left: 0,
        right: 0,
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
