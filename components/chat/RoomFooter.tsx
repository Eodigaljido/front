import { MessageInput } from "@/stories/chat/MessageInput";
import { View } from "react-native";

interface RoomFooterProps {
  onSend?: (message: string) => void;
  editingText?: string | null;
  onCancelEdit?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
}

export function RoomFooter({
  onSend,
  editingText,
  onCancelEdit,
  onTypingChange,
}: RoomFooterProps) {
  return (
    <View className="w-full items-center justify-center">
      <MessageInput
        onSend={onSend}
        editingText={editingText}
        onCancelEdit={onCancelEdit}
        onTypingChange={onTypingChange}
      />
    </View>
  );
}
