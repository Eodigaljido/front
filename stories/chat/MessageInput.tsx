import { Send } from "lucide-react-native";
import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
export interface MessageInputProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Called when the send button is pressed */
  onSend?: (message: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const MessageInput = ({
  placeholder = "메세지 입력",
  onSend,
  disabled = false,
  style,
}: MessageInputProps) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText("");
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        editable={!disabled}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        accessibilityRole="button"
        accessibilityLabel="전송"
      >
        <Send color={"#fff"} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopColor: "#e0e0e0",
  },
  input: {
    height: 50,
    width: "70%",
    paddingHorizontal: 15,
    backgroundColor: "#000",
    borderRadius: 30,
    fontSize: 13,
    color: "#fff",
    marginRight: 6,
  },
  sendButton: {
    height: 50,
    width: 50,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: "#0088FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#0088FF",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
