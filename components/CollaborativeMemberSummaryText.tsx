import React, { useMemo } from 'react';
import { Text } from 'react-native';
import type { CourseItem } from '../data/mockData';
import { buildContributorSummary } from '../utils/buildContributorSummary';
import type { CourseAuthorContext } from '../utils/formatCourseAuthor';
import { useCollaborativeRouteMembers } from '../hooks/useCollaborativeRouteMembers';

type Props = {
  course: CourseItem;
  routeId: string;
  chatRoomUuid?: string | null;
  authorCtx: CourseAuthorContext;
  className?: string;
  numberOfLines?: number;
};

export function CollaborativeMemberSummaryText({
  course,
  routeId,
  chatRoomUuid,
  authorCtx,
  className = 'text-[10px] font-semibold text-orange-700',
  numberOfLines = 2,
}: Props): React.JSX.Element | null {
  const { memberNames } = useCollaborativeRouteMembers({
    routeId,
    chatRoomUuid,
    enabled: Boolean(String(routeId ?? '').trim()),
  });

  const summary = useMemo(
    () => buildContributorSummary(course, authorCtx, memberNames),
    [course, authorCtx, memberNames],
  );

  if (!summary) return null;

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {summary}
    </Text>
  );
}
