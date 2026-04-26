import { ImageUp, Map, Send, Sticker } from "lucide-react-native";
import { useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

export interface MessageInputProps {
  placeholder?: string;
  onSend?: (message: string) => void;
  onImageSend?: () => void;
  onStickerSend?: () => void;
  onCourseSend?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const MessageInput = ({
  placeholder = "메세지 입력",
  onSend,
  onImageSend,
  onStickerSend,
  onCourseSend,
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

  const canSend = !!text.trim() && !disabled;

  return (
    <View style={[style]}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          editable={!disabled}
        />

        <TouchableOpacity
          onPress={onCourseSend}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="루트 생성 및 공유"
        >
          <Map size={25} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onImageSend}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="이미지 보내기"
        >
          <ImageUp size={25} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onStickerSend}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="이모티콘 및 gif 보내기"
        >
          <Sticker size={25} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="전송"
        >
          <Send size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    minWidth: "95%",
    maxWidth: "95%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 30,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 15,
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontSize: 13,
    color: "#000",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0088FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#b0d4ff",
  },
});
