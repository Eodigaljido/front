import React, { useState } from "react";
import {
  Image,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export default function ProfileAvatar({
  uri,
  size = 56,
  style,
  imageStyle,
}: Props): React.JSX.Element {
  const trimmed = String(uri ?? "").trim();
  const [failedForUri, setFailedForUri] = useState<string | null>(null);
  const failed = failedForUri === trimmed && trimmed.length > 0;
  const radius = size / 2;

  if (!trimmed || failed) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: "#DBEAFE",
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <Ionicons name="person" size={Math.round(size * 0.46)} color="#2563EB" />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: "#e5e7eb",
        },
        style,
      ]}
    >
      <Image
        key={trimmed}
        source={{ uri: trimmed }}
        style={[{ width: size, height: size }, imageStyle]}
        resizeMode="cover"
        onError={() => setFailedForUri(trimmed)}
      />
    </View>
  );
}
