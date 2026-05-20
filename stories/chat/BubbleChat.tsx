import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  Image,
  ViewStyle,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

export interface BubbleChatProps {
  isMine: boolean;
  text?: string;
  imageUrl?: string | null;
  sentAt?: Date;
  profileImageUrl?: string;
  userName?: string;
  style?: StyleProp<ViewStyle>;
  onLongPress?: () => void;
  isEdited?: boolean;
  isTyping?: boolean;
  onImageLoad?: () => void;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function BubbleChat({
  text,
  imageUrl,
  isMine,
  sentAt,
  userName,
  style,
  onLongPress,
  isEdited,
  isTyping,
  onImageLoad,
}: BubbleChatProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTyping) return;

    const makeAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -5,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(480),
        ]),
      );

    const a1 = makeAnim(dot1, 0);
    const a2 = makeAnim(dot2, 160);
    const a3 = makeAnim(dot3, 320);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [isTyping]);

  if (isTyping) {
    return (
      <View
        style={[
          styles.wrapper,
          isMine ? styles.wrapperMine : styles.wrapperOther,
          style,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleOther,
            typingStyles.bubble,
          ]}
        >
          <Animated.View
            style={[
              typingStyles.dot,
              isMine ? typingStyles.dotMine : typingStyles.dotOther,
              { transform: [{ translateY: dot1 }] },
            ]}
          />
          <Animated.View
            style={[
              typingStyles.dot,
              isMine ? typingStyles.dotMine : typingStyles.dotOther,
              { transform: [{ translateY: dot2 }] },
            ]}
          />
          <Animated.View
            style={[
              typingStyles.dot,
              isMine ? typingStyles.dotMine : typingStyles.dotOther,
              { transform: [{ translateY: dot3 }] },
            ]}
          />
        </View>
        {userName && (
          <Text
            style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}
          >
            {userName}
          </Text>
        )}
      </View>
    );
  }

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
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoad={onImageLoad}
          />
        ) : (
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            <Text
              style={[styles.text, isMine ? styles.textMine : styles.textOther]}
            >
              {text?.replace(/ /g, " ")}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {sentAt && (
        <Text
          style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}
        >
          {isEdited ? `(수정됨) ${formatTime(sentAt)}` : formatTime(sentAt)}
        </Text>
      )}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotMine: {
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  dotOther: {
    backgroundColor: "#8E8E93",
  },
});

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
    wordBreak: "break-all",
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
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
});
