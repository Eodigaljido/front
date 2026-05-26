import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function CourseCardAuthorRow({ label }: { label: string }) {
  const text = String(label ?? '').trim() || '제작자 미표시';
  return (
    <View className="mt-1 flex-row items-center">
      <Ionicons name="person-circle-outline" size={14} color="#64748b" />
      <Text className="ml-1 text-xs text-slate-600" numberOfLines={1}>
        제작 · {text}
      </Text>
    </View>
  );
}
