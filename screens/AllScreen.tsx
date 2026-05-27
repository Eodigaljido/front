// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import type { RootTabParamList } from '../App';
import { getMyProfile } from '../api/users';
import { addFriendByCode, getFriends, getFriendRequests, getMyFriendCode } from '../api/friend/friends';
import { shareFriendInvite } from '../utils/shareFriend';
import { useAuthStore } from '../store/authStore';
import { useTabStore } from '../store/tabStore';
import MenuSection, { type MenuItem } from '../components/all/MenuSection';
import ProfileCard from '../components/all/ProfileCard';
import FriendCodeModal from '../components/all/FriendCodeModal';

type AllRouteParams = { friendCode?: string };

export default function AllScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const authUser = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const setForcedActiveTab = useTabStore(s => s.setForcedActiveTab);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friendCodeVisible, setFriendCodeVisible] = useState(false);
  const [friendCodeLoading, setFriendCodeLoading] = useState(false);
  const [addFriendSubmitting, setAddFriendSubmitting] = useState(false);
  const handledInviteCodeRef = useRef<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const [me, friends, reqs] = await Promise.all([
        getMyProfile(),
        getFriends().catch(() => []),
        getFriendRequests().catch(() => []),
      ]);
      setUser({
        id: (me as any).id ?? 0,
        uuid: me.uuid,
        userId: me.userId ?? '',
        email: me.email ?? '',
        nickname: me.nickname ?? '',
        role: me.role ?? 'USER',
        profileImageUrl: me.profileImageUrl ?? null,
      });
      setFriendCount(friends.length);
      setPendingRequestCount(reqs.filter(r => r.direction === 'RECEIVED').length);
    } catch {
      // 프로필 요청 실패 시 기존 상태 유지
    }
  }, [setUser]);

  useFocusEffect(
    useCallback(() => {
      refreshMe();
      setForcedActiveTab(null);
    }, [refreshMe, setForcedActiveTab]),
  );

  const routeMenus: MenuItem[] = [
    {
      id: 'make-route',
      title: '루트 제작하기',
      icon: 'create-outline',
      iconColor: '#2563eb',
      iconBg: '#dbeafe',
      onPress: () => navigation.getParent()?.getParent()?.navigate('RouteCreate'),
    },
    {
      id: 'share-route',
      title: '루트 공유하기',
      icon: 'paper-plane-outline',
      iconColor: '#ea580c',
      iconBg: '#ffedd5',
      onPress: () => { setForcedActiveTab('SharedRoute'); navigation.navigate('AllSharedRoute'); },
    },
    {
      id: 'saved-route',
      title: '저장된 루트',
      icon: 'bookmark-outline',
      iconColor: '#16a34a',
      iconBg: '#dcfce7',
      onPress: () => { setForcedActiveTab('MyRoute'); navigation.navigate('AllMyRoute'); },
    },
    {
      id: 'near-popular',
      title: '내 근처 인기 루트',
      icon: 'location-outline',
      iconColor: '#9333ea',
      iconBg: '#f3e8ff',
      onPress: () => { setForcedActiveTab('SharedRoute'); navigation.navigate('AllSharedRoute', { openAsPopular: true }); },
    },
  ];

  const friendMenus: MenuItem[] = [
    {
      id: 'friend-requests',
      title: '친구 요청',
      icon: 'person-add-outline',
      iconColor: '#2563eb',
      iconBg: '#dbeafe',
      badge: pendingRequestCount,
      onPress: () => navigation.navigate('AllFriendRequests'),
    },
  ];

  const settingMenus: MenuItem[] = [
    {
      id: 'app-setting',
      title: '앱 설정',
      icon: 'settings-outline',
      iconColor: '#60a5fa',
      iconBg: '#dbeafe',
      onPress: () => navigation.navigate('AllAppSettings'),
    },
    {
      id: 'help',
      title: '도움말',
      icon: 'help-circle-outline',
      iconColor: '#4b5563',
      iconBg: '#f3f4f6',
      onPress: () => {},
    },
    {
      id: 'alarm',
      title: '알림 설정',
      icon: 'notifications-outline',
      iconColor: '#6b7280',
      iconBg: '#e5e7eb',
      onPress: () => {},
    },
  ];

  const loadMyFriendCode = useCallback(async () => {
    if (friendCode) return friendCode;
    setFriendCodeLoading(true);
    try {
      const code = await getMyFriendCode();
      setFriendCode(code);
      return code;
    } catch (e: any) {
      Alert.alert(
        '오류',
        e?.response?.data?.message ?? e?.message ?? '친구 코드를 불러오지 못했습니다.',
      );
      return null;
    } finally {
      setFriendCodeLoading(false);
    }
  }, [friendCode]);

  const handleAddFriend = useCallback(async () => {
    setFriendCodeVisible(true);
    await loadMyFriendCode();
  }, [loadMyFriendCode]);

  const handleShareFriendLink = useCallback(async () => {
    const code = friendCode ?? (await loadMyFriendCode());
    if (!code) return;
    void shareFriendInvite({
      friendCode: code,
      inviterName: authUser?.nickname,
    });
  }, [friendCode, loadMyFriendCode, authUser?.nickname]);

  const confirmAddFriendFromLink = useCallback(
    (code: string) => {
      if (addFriendSubmitting) return;
      Alert.alert('친구 추가', `친구 코드「${code}」로 추가할까요?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '추가',
          onPress: async () => {
            setAddFriendSubmitting(true);
            try {
              await addFriendByCode(code);
              Alert.alert('', '친구가 추가되었습니다.');
              navigation.navigate('Chat');
            } catch (e: any) {
              Alert.alert(
                '오류',
                e?.response?.data?.message ?? e?.message ?? '친구 추가에 실패했습니다.',
              );
            } finally {
              setAddFriendSubmitting(false);
            }
          },
        },
      ]);
    },
    [addFriendSubmitting, navigation],
  );

  useEffect(() => {
    const code = String((route.params as AllRouteParams | undefined)?.friendCode ?? '').trim();
    if (!code || handledInviteCodeRef.current === code) return;
    handledInviteCodeRef.current = code;
    navigation.setParams({ friendCode: undefined });
    confirmAddFriendFromLink(code);
  }, [route.params, navigation, confirmAddFriendFromLink]);

  const avatarUri = authUser?.profileImageUrl ?? 'https://i.pravatar.cc/100?img=5';

  return (
    <SafeAreaView className="flex-1 bg-[#F0F5FF]" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">전체</Text>
        <Pressable
          onPress={() => navigation.getParent()?.getParent()?.navigate('NotificationCenter')}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={24} color="#374151" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 120,
        }}
      >
        <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          프로필
        </Text>
        <ProfileCard
          nickname={authUser?.nickname}
          email={authUser?.email}
          avatarUri={avatarUri}
          friendCount={friendCount}
          onAddFriend={handleAddFriend}
          onProfileSettings={() => navigation.getParent()?.navigate('ProfileSettings')}
        />

        <MenuSection label="루트" items={routeMenus} />
        <MenuSection label="친구" items={friendMenus} />
        <MenuSection label="설정" items={settingMenus} />
      </ScrollView>

      <FriendCodeModal
        visible={friendCodeVisible}
        loading={friendCodeLoading}
        friendCode={friendCode}
        onClose={() => setFriendCodeVisible(false)}
        onAddFriendByCode={addFriendByCode}
        onShareLink={handleShareFriendLink}
      />
    </SafeAreaView>
  );
}
