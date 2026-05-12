import { View, Text, Image, ScrollView } from "react-native";
import { getFriends } from "@/api/friend/index";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState } from "react";

export interface FriendListItem {
  friendId: number;
  uuid: string;
  nickname: string;
  profileImageUrl: string;
  isDefaultImage: boolean;
}

export const ProfileList = ({ size = 60 }: { size?: number }) => {
  const [friends, setFriends] = useState<
    Awaited<ReturnType<typeof getFriends>>
  >([]);

  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    getFriends(accessToken)
      .then(setFriends)
      .catch((err) => console.error("친구 목록 조회 실패:", err));
  }, [accessToken]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false} // 스크롤바 숨기기
      contentContainerStyle={{
        alignItems: "flex-start",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <View className="flex-row gap-5">
        {friends.map((friend) => (
          <View key={friend.friendId} className="items-center">
            <Image
              source={{
                uri: friend.profileImageUrl,
              }}
              className="rounded-full mt-5 border-2 border-gray-300"
              style={{ width: size, height: size }}
            />
            <Text className="text-sm font-semibold mt-3 text-gray-700">
              {friend.nickname}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
