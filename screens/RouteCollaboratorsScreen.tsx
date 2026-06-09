// @ts-nocheck
import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCollaborativeRouteMembers } from '../hooks/useCollaborativeRouteMembers';
import { safeGoBack } from '../navigation/rootNavigation';

const CARD = {
  borderWidth: 0.5,
  borderColor: 'rgba(37,99,235,0.12)',
  borderRadius: 16,
  backgroundColor: '#fff',
};

export default function RouteCollaboratorsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeId = String(route.params?.routeId ?? '').trim();
  const routeTitle = String(route.params?.routeTitle ?? '루트').trim() || '루트';
  const chatRoomUuid = route.params?.chatRoomUuid ?? null;
  const { members, loading } = useCollaborativeRouteMembers({
    routeId: routeId || 'new',
    chatRoomUuid,
    enabled: Boolean(routeId),
  });

  const host = members.find((m) => m.role === 'host');
  const participants = members.filter((m) => m.role !== 'host');

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-blue-100/80 bg-white">
        <Pressable
          onPress={() => safeGoBack(navigation)}
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-90"
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <View className="flex-1 ml-3">
          <Text className="text-lg font-bold text-gray-900">작업 멤버</Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {routeTitle}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="mt-3 text-sm text-gray-500">멤버 목록 불러오는 중…</Text>
          </View>
        ) : null}

        <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          방장
        </Text>
        {host ? (
          <View className="flex-row items-center p-4 mb-6" style={CARD}>
            <Image
              source={{ uri: host.avatarUri }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 2,
                borderColor: '#2563eb',
              }}
            />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-semibold text-gray-900">{host.name}</Text>
                <View className="rounded-md bg-blue-100 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-blue-700">방장</Text>
                </View>
              </View>
              <Text className="mt-1 text-xs text-gray-500">루트 편집·멤버 초대 권한</Text>
            </View>
            <View className="h-2 w-2 rounded-full bg-green-500" />
          </View>
        ) : null}

        <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          참여 중 ({participants.length}명)
        </Text>
        {participants.length === 0 ? (
          <View className="items-center py-10 px-6" style={CARD}>
            <Text className="text-sm text-gray-500">아직 초대된 멤버가 없어요.</Text>
            <Text className="mt-1 text-xs text-center text-gray-400">
              공유 버튼으로 친구를 초대해 보세요.
            </Text>
          </View>
        ) : (
          participants.map((m) => (
            <View key={m.id} className="flex-row items-center p-4 mb-2" style={CARD}>
              <Image
                source={{ uri: m.avatarUri }}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e2e8f0' }}
              />
              <View className="flex-1 ml-3">
                <Text className="text-[15px] font-semibold text-gray-900">{m.name}</Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  {m.online !== false ? '편집 가능' : '오프라인'}
                </Text>
              </View>
              {m.online !== false ? (
                <View className="h-2 w-2 rounded-full bg-green-500" />
              ) : (
                <View className="h-2 w-2 rounded-full bg-gray-300" />
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
