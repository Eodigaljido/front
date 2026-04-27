import { View, Text, ViewStyle, StyleProp, StyleSheet, TouchableOpacity } from "react-native";

export interface BubbleChatProps {
  text: string;
  isMine: boolean;
  sentAt: Date;
  profileImageUrl?: string;
  userName?: string;
  style?: StyleProp<ViewStyle>;
  onLongPress?: () => void;
  isEdited?: boolean;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function BubbleChat({ text, isMine, sentAt, style, onLongPress, isEdited }: BubbleChatProps) {
  return (
    <View
      style={[
        styles.wrapper,
        isMine ? styles.wrapperMine : styles.wrapperOther,
        style,
      ]}
    >
      <TouchableOpacity
        onLongPress={onLongPress}
        disabled={!onLongPress}
        activeOpacity={onLongPress ? 0.7 : 1}
      >
        <View
          style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
        >
          <Text
            style={[styles.text, isMine ? styles.textMine : styles.textOther]}
          >
            {text}
          </Text>
        </View>
      </TouchableOpacity>
      <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
        {isEdited ? `(수정됨) ${formatTime(sentAt)}` : formatTime(sentAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: "100%",
    marginTop: 5,
    marginVertical: 3,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  wrapperMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  wrapperOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: "#0088FF",
  },
  bubbleOther: {
    backgroundColor: "#E5E5EA",
  },
  text: {
    fontSize: 16,
  },
  textMine: {
    color: "#FFFFFF",
  },
  textOther: {
    color: "#000000",
  },
  time: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
  timeMine: {
    alignSelf: "flex-end",
  },
  timeOther: {
    alignSelf: "flex-start",
  },
});
