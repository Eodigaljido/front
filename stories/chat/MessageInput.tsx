import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  StyleSheet,
  Text,
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
        multiline
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
        <Text style={styles.sendButtonText}>전송</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  input: {
    flex: 1,
    maxHeight: 80,
    paddingHorizontal: 14,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    fontSize: 14,
    color: "#333",
    marginRight: 8,
    textAlignVertical: "center",
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#555ab9",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#c0c0c0",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
