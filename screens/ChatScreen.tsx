// @ts-nocheck
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import Title from "../components/chat/Title";
import RecentContacts from "../components/chat/RecentContacts";
import ChatList from "../components/chat/ChatList";
import { ProfileIcon } from "@/components/chat/ProfileIcon";
import { ChatRoom } from "@/components/chat/ChatRoom";

export default function ChatScreen(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-4 pt-6">
          {/* 헤더 */}
          <View className="flex-row items-center justify-between mb-6">
            <Title />
            <Search size={25} strokeWidth={3} color="#000" />
          </View>
          {/* 최근 연락 목록 */}
          <View className="mt-5">
            <Text className="text-lg font-bold text-gray-500">친구 목록</Text>
            <View className="-mx-4">
              <ProfileIcon />
            </View>
          </View>
          {/* 채팅 목록 */}
          <View className="mt-10">
            <Text className="text-lg font-bold text-gray-500">채팅</Text>
            <ChatRoom />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
