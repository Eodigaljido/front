// @ts-nocheck
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Title from "../components/chat/Title";
import RecentContacts from "../components/chat/RecentContacts";
import ChatList from "../components/chat/ChatList";
import { ProfileList } from "@/components/chat/ProfileList";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { SearchBar } from "@/components/chat/SearchBar";
import { ChatCreatingButton } from "@/components/chat/ChatCreateButton";
import { getChatRooms, ChatRoom as ChatRoomType } from "@/api/chat/chat";
import { useAuthStore } from "@/store/authStore";

export default function ChatHomeScreen(): React.JSX.Element {
  const [chatRooms, setChatRooms] = useState<ChatRoomType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const fetchChatRooms = async () => {
      if (!accessToken) return;
      try {
        const response = await fetch("/api/chat/rooms");
        const data = await response.json();
        console.log("Fetched chat rooms:", data);
        setChatRooms(data.rooms);
        const rooms = await getChatRooms(accessToken);
        setChatRooms(rooms);
      } catch (error) {
        console.error("Failed to fetch chat rooms:", error);
      }
    };

    fetchChatRooms();
  }, [accessToken]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-10 pt-6">
          {/* 헤더 */}
          <View className="flex-row items-center justify-between mb-6 gap-5">
            <Text className="text-2xl font-bold text-black">메세지</Text>
          </View>
          <SearchBar onSearch={setSearchQuery} />
          {/* 최근 연락 목록 */}
          <View>
            <Text className="text-lg font-bold text-gray-600 mt-10">
              친구 목록
            </Text>
            <View className="-mx-4 mt-3">
              <ProfileList />
            </View>
          </View>
          {/* 채팅 목록 */}
          <View className="mt-10">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-gray-600">채팅</Text>
              <ChatCreatingButton />
            </View>
            <View className="border-b border-gray-200 mb-5" />
            <ChatRoom searchQuery={searchQuery} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
