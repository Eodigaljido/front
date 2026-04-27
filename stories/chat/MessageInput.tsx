import { ImageUp, Map, Send, Sticker, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export interface MessageInputProps {
  placeholder?: string;
  onSend?: (message: string) => void;
  onImageSend?: () => void;
  onStickerSend?: () => void;
  onCourseSend?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  editingText?: string | null;
  onCancelEdit?: () => void;
}

export const MessageInput = ({
  placeholder = "메세지 입력",
  onSend,
  onImageSend,
  onStickerSend,
  onCourseSend,
  disabled = false,
  style,
  editingText,
  onCancelEdit,
}: MessageInputProps) => {
  const [text, setText] = useState("");

  useEffect(() => {
    if (editingText != null) {
      setText(editingText);
    } else {
      setText("");
    }
  }, [editingText]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText("");
  };

  const canSend = !!text.trim() && !disabled;

  const isEditing = editingText != null;

  return (
    <View style={[style]}>
      {isEditing && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingLabel}>메시지 수정 중</Text>
          <TouchableOpacity onPress={onCancelEdit} accessibilityLabel="수정 취소">
            <X size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}
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
  editingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: "95%",
    maxWidth: "95%",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    marginBottom: 6,
  },
  editingLabel: {
    fontSize: 12,
    color: "#0055cc",
    fontWeight: "600",
  },
});
