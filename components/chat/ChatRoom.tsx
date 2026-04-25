import { View, Text, TouchableOpacity, Image } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { getChatRooms, ChatRoom as ChatRoomType } from "@/api/chat/chat";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useChatSocket, ChatSocketEvent } from "@/hooks/useChatSocket";

type RootStackParamList = {
  ChatRoomScreen: { roomUuid: string; roomName: string };
};

interface ChatRoomProps {
  searchQuery?: string;
}

// 시간 포맷 함수
// TODO: 1분전, 2시간전, 3일전 등으로 포맷하기
function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } else if (diffDays === 1) {
    return "어제";
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return date.toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    });
  }
}

export const ChatRoom = ({ searchQuery = "" }: ChatRoomProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [chatRooms, setChatRooms] = useState<ChatRoomType[]>([]);
  const accessToken = useAuthStore((s) => s.accessToken);

  // 방 목록이 로드된 후 모든 방을 구독해 실시간 업데이트 수신
  useChatSocket(
    chatRooms.map((r) => r.uuid),
    (event: ChatSocketEvent) => {
      if (event.eventType === "MESSAGE_CREATED") {
        getChatRooms(accessToken!).then(setChatRooms).catch(console.error);
      }
    },
  );

  const fetchChatRooms = () => {
    if (!accessToken) return;
    getChatRooms(accessToken)
      .then(setChatRooms)
      .catch((err) => {
        console.error("채팅방 목록 불러오기 실패:", err);
      });
  };

  useEffect(() => {
    fetchChatRooms();
  }, [accessToken]);

  const filteredRooms = searchQuery
    ? chatRooms.filter(
        (room) =>
          room.name.includes(searchQuery) ||
          room.lastMessage?.includes(searchQuery),
      )
    : chatRooms;

  return (
    <View>
      {filteredRooms.map((room) => (
        <TouchableOpacity
          key={room.uuid}
          className="flex-row items-center justify-between py-3 mb-2"
          activeOpacity={0.5}
          onPress={() =>
            navigation.navigate("ChatRoomScreen", {
              roomUuid: room.uuid,
              roomName: room.name,
            })
          }
        >
          <View className="flex-row items-center flex-1">
            <View style={{ position: "relative" }}>
              <View
                className="rounded-full bg-blue-100 items-center justify-center"
                style={{ width: 50, height: 50 }}
              >
                <Image
                  source={{ uri: room.profileImageUrl }}
                  className="w-full h-full rounded-full"
                />
              </View>
              {room.unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    backgroundColor: "#5c8efa",
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{ color: "white", fontSize: 11, fontWeight: "bold" }}
                  >
                    {room.unreadCount > 9 ? "9+" : room.unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <View
              className="justify-center"
              style={{ marginLeft: 10, flex: 1 }}
            >
              <Text className="text-base font-semibold">{room.name}</Text>
              <Text
                className={`text-sm ${
                  room.unreadCount > 0
                    ? "font-semibold text-blue-500"
                    : "font-medium text-gray-500"
                }`}
                numberOfLines={1}
              >
                {room.lastMessage ?? ""}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-700 ml-2">
            {formatTime(room.lastMessageAt)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
