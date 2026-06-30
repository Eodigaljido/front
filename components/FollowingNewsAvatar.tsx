import React, { useState } from "react";
import { View, Text, Image } from "react-native";
import { bustProfileImageUri } from "../utils/profileImageUri";
import { isRemoteThumbnailUri } from "../utils/courseThumbnailUri";

type Props = {
  displayName: string;
  profileImageUrl?: string | null;
  size?: number;
};

export default function FollowingNewsAvatar({
  displayName,
  profileImageUrl,
  size = 40,
}: Props): React.JSX.Element {
  const [failedForUrl, setFailedForUrl] = useState<string | null>(null);
  const name = String(displayName ?? "").trim() || "?";
  const remote = String(profileImageUrl ?? "").trim();
  const failed = failedForUrl === remote && remote.length > 0;
  const uri =
    remote && isRemoteThumbnailUri(remote) && !failed
      ? bustProfileImageUri(remote)
      : null;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "#DBEAFE",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailedForUrl(remote)}
        />
      ) : (
        <Text
          style={{
            fontSize: Math.max(11, Math.round(size * 0.32)),
            fontWeight: "600",
            color: "#2563EB",
          }}
        >
          {name.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}
