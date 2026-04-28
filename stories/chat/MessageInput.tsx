import { ImageUp, Key, Map, Send, Sticker, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const RESEND_INTERVAL_MS = 2000;
const DEBOUNCE_MS = 2000;
const STOP_DELAY_MS = 5000;

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
  onTypingChange?: (isTyping: boolean) => void;
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
  onTypingChange,
}: MessageInputProps) => {
  const [text, setText] = useState("");

  const onTypingChangeRef = useRef(onTypingChange);
  useEffect(() => {
    onTypingChangeRef.current = onTypingChange;
  });

  const isTypingActiveRef = useRef(false);
  const lastTrueSentAtRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTextRef = useRef("");

  const clearTypingTimers = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  useEffect(() => () => clearTypingTimers(), []);

  useEffect(() => {
    if (editingText != null) {
      setText(editingText);
      currentTextRef.current = editingText;
    } else {
      setText("");
      currentTextRef.current = "";
    }
  }, [editingText]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    currentTextRef.current = newText;

    if (!onTypingChangeRef.current) return;

    clearTypingTimers();

    const now = Date.now();
    if (
      !isTypingActiveRef.current ||
      now - lastTrueSentAtRef.current >= RESEND_INTERVAL_MS
    ) {
      onTypingChangeRef.current(true);
      isTypingActiveRef.current = true;
      lastTrueSentAtRef.current = now;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!currentTextRef.current.trim()) {
        onTypingChangeRef.current?.(false);
        isTypingActiveRef.current = false;
      } else {
        stopTimerRef.current = setTimeout(() => {
          stopTimerRef.current = null;
          onTypingChangeRef.current?.(false);
          isTypingActiveRef.current = false;
        }, STOP_DELAY_MS);
      }
    }, DEBOUNCE_MS);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    clearTypingTimers();
    if (isTypingActiveRef.current) {
      onTypingChangeRef.current?.(false);
      isTypingActiveRef.current = false;
    }

    onSend?.(trimmed);
    setText("");
    currentTextRef.current = "";
  };

  const canSend = !!text.trim() && !disabled;

  const isEditing = editingText != null;

  return (
    <View style={[styles.container, style]}>
      {isEditing && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingLabel}>메시지 수정 중</Text>
          <TouchableOpacity
            onPress={onCancelEdit}
            accessibilityLabel="수정 취소"
          >
            <X size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
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
  container: {
    width: "90%",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
    borderRadius: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 15,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 15,
  },
  input: {
    flex: 1,
    fontSize: 13,
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
