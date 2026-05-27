import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CourseItem } from "../data/mockData";
import { useAuthorProfileVisible } from "../hooks/useAuthorProfileVisible";
import {
  getCourseAuthorLabel,
  isOwnServerCourse,
  type CourseAuthorContext,
} from "../utils/formatCourseAuthor";
import { CourseCardAuthorRow } from "./CourseCardAuthorRow";

type Props = {
  course: CourseItem;
  authorCtx: CourseAuthorContext;
};

/** 공유 루트 카드 — 비공개 프로필이면 제작자 행 숨김 */
export function CourseAuthorCardRow({
  course,
  authorCtx,
}: Props): React.JSX.Element | null {
  const isOwn = isOwnServerCourse(course, authorCtx);
  const visible = useAuthorProfileVisible(course.authorUuid, {
    isOwn,
    apiFlag: course.authorProfilePublic,
  });
  if (visible !== true) return null;
  return <CourseCardAuthorRow label={getCourseAuthorLabel(course, authorCtx)} />;
}

type DetailProps = Props & {
  onPress: () => void;
};

/** 공유 루트 상세 — 비공개 프로필이면 제작자 칩·프로필 이동 숨김 */
export function CourseAuthorDetailChip({
  course,
  authorCtx,
  onPress,
}: DetailProps): React.JSX.Element | null {
  const isOwn = isOwnServerCourse(course, authorCtx);
  const visible = useAuthorProfileVisible(course.authorUuid, {
    isOwn,
    apiFlag: course.authorProfilePublic,
  });
  if (visible !== true) return null;

  const authorLabel = getCourseAuthorLabel(course, authorCtx);
  const authorUuid = String(course.authorUuid ?? "").trim();
  const authorUserId = String(course.authorUserId ?? "").trim();
  const canOpenProfile = !isOwn && Boolean(authorUuid || authorUserId);

  return (
    <Pressable
      disabled={!canOpenProfile}
      onPress={onPress}
      className="mb-2 flex-row items-center self-start rounded-full px-3 py-1.5"
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
        제작자 {authorLabel}
      </Text>
    </Pressable>
  );
}
