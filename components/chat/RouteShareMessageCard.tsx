import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChatMessage } from "@/api/chat/chat";
import {
  collaborativeAccessDeniedMessage,
  ensureCollaborativeRouteAccess,
} from "@/api/collaborativeCourse";
import { rootNavigate } from "@/navigation/rootNavigation";
import { buildCollaborativeRouteCreateParams } from "@/utils/pendingShareLink";

type Props = {
  message: Pick<
    ChatMessage,
    "routeUuid" | "routeTitle" | "routeThumbnailUrl" | "content"
  >;
  isMine?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function resolveRouteShareTitle(
  message: Pick<ChatMessage, "routeTitle" | "content">,
): string {
  const fromApi = String(message.routeTitle ?? "").trim();
  if (fromApi) return fromApi;
  const content = String(message.content ?? "").trim();
  if (content && !/^https?:\/\//i.test(content)) return content;
  return "루트";
}

export async function openRouteShareFromChat(
  routeUuid: string | null | undefined,
): Promise<void> {
  const id = String(routeUuid ?? "").trim();
  if (!id || id.startsWith("ur-")) return;

  const result = await ensureCollaborativeRouteAccess(id);
  if (!result.ok) {
    Alert.alert("", collaborativeAccessDeniedMessage(result.reason));
    return;
  }

  rootNavigate("RouteCreate", buildCollaborativeRouteCreateParams(id));
}

export function RouteShareMessageCard({
  message,
  isMine = false,
  style,
}: Props): React.JSX.Element {
  const [joining, setJoining] = useState(false);
  const routeId = String(message.routeUuid ?? "").trim();
  const title = resolveRouteShareTitle(message);
  const thumb = String(message.routeThumbnailUrl ?? "").trim();
  const canOpen = Boolean(routeId) && !routeId.startsWith("ur-");

  const handleJoinPress = () => {
    if (!canOpen || joining) return;
    setJoining(true);
    void openRouteShareFromChat(routeId).finally(() => setJoining(false));
  };

  return (
    <View
      style={[
        {
          maxWidth: 280,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: isMine ? "#E0F2FE" : "#F3F4F6",
          borderWidth: 1,
          borderColor: isMine ? "#BAE6FD" : "#E5E7EB",
        },
        style,
      ]}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: "100%", height: 120, backgroundColor: "#dbeafe" }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            height: 72,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isMine ? "#BAE6FD" : "#E5E7EB",
          }}
        >
          <Ionicons
            name="map-outline"
            size={28}
            color={isMine ? "#0369A1" : "#64748B"}
          />
        </View>
      )}
      <View
        style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: "#111827",
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Pressable
          onPress={handleJoinPress}
          disabled={!canOpen || joining}
          style={{
            marginTop: 10,
            borderRadius: 10,
            backgroundColor: canOpen && !joining ? "#2563EB" : "#94A3B8",
            paddingVertical: 10,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 40,
          }}
          accessibilityRole="button"
          accessibilityLabel={`${title} 루트 제작 참여`}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              루트 제작 참여
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
