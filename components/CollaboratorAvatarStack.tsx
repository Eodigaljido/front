// @ts-nocheck
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import type { RouteMember } from '../data/collaborativeRoute';
import { getOnlineMembers } from '../data/collaborativeRoute';

const AVATAR_SIZE = 28;
const OVERLAP = 10;
const MAX_VISIBLE = 4;

type Props = {
  members: RouteMember[];
  onPress: () => void;
  size?: number;
};

export default function CollaboratorAvatarStack({
  members,
  onPress,
  size = AVATAR_SIZE,
}: Props): React.JSX.Element {
  const online = getOnlineMembers(members);
  const visible = online.slice(0, MAX_VISIBLE);
  const extra = online.length - visible.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="공동 작업 멤버 보기"
      className="flex-row items-center active:opacity-85"
      hitSlop={8}
    >
      <View className="flex-row items-center">
        {visible.map((m, i) => (
          <Image
            key={m.id}
            source={{ uri: m.avatarUri }}
            accessibilityLabel={`${m.name}${m.role === 'host' ? ' 방장' : ''}`}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: m.role === 'host' ? '#f97316' : '#fff',
              marginLeft: i === 0 ? 0 : -OVERLAP,
              backgroundColor: '#e2e8f0',
            }}
          />
        ))}
        {extra > 0 ? (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: visible.length > 0 ? -OVERLAP : 0,
              backgroundColor: '#2563eb',
              borderWidth: 2,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-[10px] font-bold text-white">+{extra}</Text>
          </View>
        ) : null}
      </View>
      <Text className="ml-2 text-[11px] font-medium text-gray-600">멤버</Text>
    </Pressable>
  );
}
