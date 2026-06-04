// @ts-nocheck
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import type { RouteMember } from '../data/collaborativeRoute';

const DEFAULT_SIZE = 32;
const MAX_VISIBLE = 5;

type Props = {
  members: RouteMember[];
  onPress: () => void;
  size?: number;
};

/** 프로필 원형 + 반씩 겹친 스택 (Slack/Notion 스타일) */
export default function CollaboratorAvatarStack({
  members,
  onPress,
  size = DEFAULT_SIZE,
}: Props): React.JSX.Element {
  const visible = members.slice(0, MAX_VISIBLE);
  const extra = members.length - visible.length;
  const overlap = Math.round(size * 0.5);

  if (visible.length === 0) {
    return <View />;
  }

  const stackWidth =
    size + Math.max(0, visible.length - 1) * (size - overlap) + (extra > 0 ? size - overlap : 0);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="공동 작업 멤버 보기"
      className="active:opacity-85"
      hitSlop={8}
    >
      <View style={{ width: stackWidth, height: size, position: 'relative' }}>
        {visible.map((m, i) => (
          <View
            key={m.id}
            style={{
              position: 'absolute',
              left: i * (size - overlap),
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: m.role === 'host' ? '#2563eb' : '#ffffff',
              backgroundColor: '#e2e8f0',
              overflow: 'hidden',
              zIndex: visible.length - i,
            }}
          >
            <Image
              source={{ uri: m.avatarUri }}
              accessibilityLabel={`${m.name}${m.role === 'host' ? ' 방장' : ''}`}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        ))}
        {extra > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: visible.length * (size - overlap),
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: '#ffffff',
              backgroundColor: '#2563eb',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 0,
            }}
          >
            <Text className="text-[10px] font-bold text-white">+{extra}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
