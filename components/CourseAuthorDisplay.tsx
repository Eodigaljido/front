import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CourseItem } from "../data/mockData";
import { useAuthorProfileVisible } from "../hooks/useAuthorProfileVisible";
import {
  getCourseAuthorLabel,
  getCourseModifierLabel,
  hasDistinctCourseModifier,
  isOwnServerCourse,
  type CourseAuthorContext,
} from "../utils/formatCourseAuthor";
import { isForkDerivedCourse } from "../utils/enrichForkOriginAuthor";
import { CourseCardAuthorRow } from "./CourseCardAuthorRow";

type Props = {
  course: CourseItem;
  authorCtx: CourseAuthorContext;
};

type ChipProps = {
  roleLabel: string;
  displayLabel: string;
  uuid?: string;
  userId?: string;
  apiFlag?: boolean;
  isSelf: boolean;
  onPress?: () => void;
};

function AuthorRoleChip({
  roleLabel,
  displayLabel,
  uuid,
  userId,
  apiFlag,
  isSelf,
  onPress,
}: ChipProps): React.JSX.Element | null {
  const visible = useAuthorProfileVisible(uuid, {
    isOwn: isSelf,
    apiFlag,
    authorUserId: userId,
  });
  if (visible !== true) return null;

  const canOpenProfile = !isSelf && Boolean(uuid || userId);

  return (
    <Pressable
      disabled={!canOpenProfile || !onPress}
      onPress={onPress}
      className="flex-row items-center rounded-full px-3 py-1.5"
      style={{
        backgroundColor: canOpenProfile ? "#EFF6FF" : "#F3F4F6",
      }}
    >
      <Ionicons
        name={canOpenProfile ? "person-circle-outline" : "person-outline"}
        size={14}
        color={canOpenProfile ? "#2563EB" : "#6B7280"}
      />
      <Text
        className="ml-1 text-xs font-semibold"
        style={{ color: canOpenProfile ? "#1D4ED8" : "#6B7280" }}
      >
        {roleLabel} {displayLabel}
      </Text>
    </Pressable>
  );
}

function isSelfModifier(
  course: CourseItem,
  authorCtx: CourseAuthorContext,
): boolean {
  const myUuid = String(authorCtx.myUuid ?? "").trim();
  const myUserId = String(authorCtx.myUserId ?? "").trim();
  const modUuid = String(course.modifierUuid ?? "").trim();
  const modUserId = String(course.modifierUserId ?? "").trim();
  if (myUuid && modUuid && myUuid === modUuid) return true;
  if (myUserId && modUserId && myUserId === modUserId) return true;
  return false;
}

/** 공유 루트 카드 — 제작자·수정자 */
export function CourseAuthorCardRow({
  course,
  authorCtx,
}: Props): React.JSX.Element | null {
  const creatorLabel = getCourseAuthorLabel(course, authorCtx);
  const showModifier = hasDistinctCourseModifier(course);
  const modifierLabel = showModifier
    ? getCourseModifierLabel(course, authorCtx)
    : null;

  const forkDerived = isForkDerivedCourse(course);
  const showCreator =
    forkDerived ||
    Boolean(
      String(course.authorUuid ?? "").trim() ||
        String(course.authorUserId ?? "").trim(),
    );

  const creatorVisible = useAuthorProfileVisible(course.authorUuid, {
    isOwn: isOwnServerCourse(course, authorCtx),
    apiFlag: course.authorProfilePublic,
    authorUserId: course.authorUserId,
  });

  const creatorShown =
    showCreator && (forkDerived || creatorVisible === true);

  if (!creatorShown && !showModifier) return null;

  if (!showModifier) {
    return <CourseCardAuthorRow label={creatorLabel} role="creator" />;
  }

  return (
    <View className="mt-1 flex-row flex-wrap items-center gap-x-1.5">
      {creatorShown ? (
        <CourseCardAuthorRow label={creatorLabel} role="creator" inline />
      ) : null}
      {creatorShown ? (
        <Text className="text-xs text-slate-400">·</Text>
      ) : null}
      <CourseCardAuthorRow
        label={modifierLabel ?? ""}
        role="modifier"
        inline
      />
    </View>
  );
}

type DetailProps = Props & {
  onPressCreator?: () => void;
  onPressModifier?: () => void;
};

/** 공유 루트 상세 — 제작자·수정자 칩 */
export function CourseAuthorDetailChip({
  course,
  authorCtx,
  onPressCreator,
  onPressModifier,
}: DetailProps): React.JSX.Element | null {
  const showModifier = hasDistinctCourseModifier(course);
  const forkDerived = isForkDerivedCourse(course);
  const creatorLabel = getCourseAuthorLabel(course, authorCtx);
  const modifierLabel = getCourseModifierLabel(course, authorCtx);
  const isOwnCreator = isOwnServerCourse(course, authorCtx);
  const isOwnModifier = isSelfModifier(course, authorCtx);

  const creatorVisible = useAuthorProfileVisible(course.authorUuid, {
    isOwn: isOwnCreator,
    apiFlag: course.authorProfilePublic,
    authorUserId: course.authorUserId,
  });

  const creatorShown =
    forkDerived ||
    creatorVisible === true ||
    Boolean(String(course.authorUserId ?? "").trim());

  if (!creatorShown && !showModifier) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-2 mb-2">
      {creatorShown ? (
        <AuthorRoleChip
          roleLabel="제작자"
          displayLabel={creatorLabel}
          uuid={String(course.authorUuid ?? "").trim() || undefined}
          userId={String(course.authorUserId ?? "").trim() || undefined}
          apiFlag={course.authorProfilePublic}
          isSelf={isOwnCreator}
          onPress={onPressCreator}
        />
      ) : null}
      {showModifier ? (
        <AuthorRoleChip
          roleLabel="수정자"
          displayLabel={modifierLabel}
          uuid={String(course.modifierUuid ?? "").trim() || undefined}
          userId={String(course.modifierUserId ?? "").trim() || undefined}
          apiFlag={course.modifierProfilePublic}
          isSelf={isOwnModifier}
          onPress={onPressModifier}
        />
      ) : null}
    </View>
  );
}
