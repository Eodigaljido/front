import { View, Text, ViewStyle, StyleProp, StyleSheet } from "react-native";

export interface BubbleChatProps {
  text: string;
  isMine: boolean;
  sentAt: Date;
  profileImageUrl?: string;
  userName?: string;
  style?: StyleProp<ViewStyle>;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function BubbleChat({ text, isMine, sentAt, style }: BubbleChatProps) {
  return (
    <View
      style={[
        styles.wrapper,
        isMine ? styles.wrapperMine : styles.wrapperOther,
        style,
      ]}
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
      <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
        {formatTime(sentAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: "80%",
    marginVertical: 5,
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
    paddingVertical: 12,
    borderRadius: 24,
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
