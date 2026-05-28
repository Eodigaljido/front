import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type CourseCardAuthorRole = "creator" | "modifier";

export function CourseCardAuthorRow({
  label,
  role = "creator",
  inline = false,
}: {
  label: string;
  role?: CourseCardAuthorRole;
  /** 목록 카드에서 제작·수정을 한 줄에 나란히 */
  inline?: boolean;
}) {
  const isModifier = role === "modifier";
  const fallback = isModifier ? "수정자 미표시" : "제작자 미표시";
  const text = String(label ?? "").trim() || fallback;
  const prefix = isModifier ? "수정" : "제작";

  return (
    <View
      className={
        inline ? "flex-row items-center" : "mt-1 flex-row items-center"
      }
    >
      <Ionicons name="person-circle-outline" size={14} color="#64748b" />
      <Text className="ml-1 text-xs text-slate-600" numberOfLines={1}>
        {prefix} {text}
      </Text>
    </View>
  );
}
