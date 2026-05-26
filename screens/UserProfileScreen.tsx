// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getUserProfileByUuid } from "../api/users";

type UserProfileRouteParams = {
  userUuid?: string;
  userId?: string;
  nickname?: string;
  profileImageUrl?: string;
};

export default function UserProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as UserProfileRouteParams;

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(String(params.userId ?? "").trim());
  const [nickname, setNickname] = useState(
    String(params.nickname ?? "").trim(),
  );
  const [avatarUri, setAvatarUri] = useState(
    String(params.profileImageUrl ?? "").trim(),
  );
  const [bio, setBio] = useState("");

  const safeUserUuid = useMemo(
    () => String(params.userUuid ?? "").trim(),
    [params.userUuid],
  );

  const loadUserProfile = useCallback(async () => {
    if (!safeUserUuid) return;
    setLoading(true);
    try {
      const profile = await getUserProfileByUuid(safeUserUuid);
      setUserId(String(profile.userId ?? "").trim());
      setNickname(String(profile.nickname ?? "").trim());
      setAvatarUri(String(profile.profileImageUrl ?? "").trim());
      setBio(String(profile.bio ?? profile.introduction ?? "").trim());
    } catch {
      // 상세 조회 실패 시 전달받은 기본값 유지
    } finally {
      setLoading(false);
    }
  }, [safeUserUuid]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const displayName = nickname || userId || "사용자";

  return (
    <SafeAreaView className="flex-1 bg-[#f5f5f9]" edges={["top"]}>
      <View className="flex-row items-center gap-2 border-b border-gray-200 bg-[#f5f5f9] px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white active:opacity-80"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#f97316" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">
          사용자 프로필
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 28,
        }}
      >
        <View className="items-center rounded-2xl border border-gray-200 bg-white px-4 py-6">
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              className="h-24 w-24 rounded-full bg-gray-100"
            />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="person" size={42} color="#9ca3af" />
            </View>
          )}
          {loading ? (
            <View className="absolute right-6 top-6 rounded-full bg-white/90 px-2 py-1">
              <ActivityIndicator size="small" color="#111827" />
            </View>
          ) : null}
          <Text className="mt-4 text-lg font-bold text-gray-900">
            {displayName}
          </Text>
          {userId ? (
            <Text className="mt-1 text-sm text-gray-500">@{userId}</Text>
          ) : null}
        </View>

        <View className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            소개
          </Text>
          <Text className="mt-2 text-sm leading-6 text-gray-700">
            {bio || "등록된 소개가 없습니다."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
