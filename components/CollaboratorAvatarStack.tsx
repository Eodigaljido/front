// @ts-nocheck
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import {
  isRouteMemberOnline,
  type RouteMember,
} from '../data/collaborativeRoute';

const DEFAULT_SIZE = 32;
const DEFAULT_MAX_VISIBLE = 5;

type Props = {
  members: RouteMember[];
  onPress?: () => void;
  size?: number;
  maxVisible?: number;
  /** 초과 인원 표시: +N 또는 … */
  overflowLabel?: 'count' | 'ellipsis';
};

/** 프로필 원형 + 반씩 겹친 스택 (온라인: 초록 점) */
export default function CollaboratorAvatarStack({
  members,
  onPress,
  size = DEFAULT_SIZE,
  maxVisible = DEFAULT_MAX_VISIBLE,
  overflowLabel = 'count',
}: Props): React.JSX.Element {
  const visible = members.slice(0, maxVisible);
  const extra = members.length - visible.length;
  const overlap = Math.round(size * 0.5);
  const dotSize = Math.max(8, Math.round(size * 0.28));

  if (visible.length === 0) {
    return <View />;
  }

  const stackWidth =
    size +
    Math.max(0, visible.length - 1) * (size - overlap) +
    (extra > 0 ? size - overlap : 0);

  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress
    ? {
        onPress,
        accessibilityLabel: '공동 작업 멤버 보기',
        className: 'active:opacity-85',
        hitSlop: 8,
      }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <View style={{ width: stackWidth, height: size, position: 'relative' }}>
        {visible.map((m, i) => {
          const online = isRouteMemberOnline(m);
          return (
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
                overflow: 'visible',
                zIndex: visible.length - i,
              }}
            >
              <View
                style={{
                  width: size - 4,
                  height: size - 4,
                  borderRadius: (size - 4) / 2,
                  overflow: 'hidden',
                  margin: 0,
                }}
              >
                <Image
                  source={{ uri: m.avatarUri }}
                  accessibilityLabel={`${m.name}${m.role === 'host' ? ' 방장' : ''}${online ? ' 온라인' : ' 오프라인'}`}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -1,
                  bottom: -1,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: online ? '#22c55e' : '#94a3b8',
                  borderWidth: 1.5,
                  borderColor: '#ffffff',
                }}
              />
            </View>
          );
        })}
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
            <Text className="text-[10px] font-bold text-white">
              {overflowLabel === 'ellipsis' ? '…' : `+${extra}`}
            </Text>
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
}
