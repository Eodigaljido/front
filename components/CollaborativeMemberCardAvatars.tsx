import React from 'react';
import { View } from 'react-native';
import { hasCollaboratorPeers } from '../data/collaborativeRoute';
import { useCollaborativeRouteMembers } from '../hooks/useCollaborativeRouteMembers';
import CollaboratorAvatarStack from './CollaboratorAvatarStack';

type Props = {
  routeId: string;
  chatRoomUuid?: string | null;
  size?: number;
};

/** 루트 카드용 — 공동 멤버 최대 3명 + … */
export function CollaborativeMemberCardAvatars({
  routeId,
  chatRoomUuid,
  size = 26,
}: Props): React.JSX.Element | null {
  const { members, loading } = useCollaborativeRouteMembers({
    routeId,
    chatRoomUuid,
    enabled: Boolean(String(routeId ?? '').trim()),
  });

  if (!hasCollaboratorPeers(members)) {
    return null;
  }

  return (
    <View className="mt-1.5 flex-row items-center">
      <CollaboratorAvatarStack
        members={members}
        size={size}
        maxVisible={3}
        overflowLabel="ellipsis"
      />
    </View>
  );
}
