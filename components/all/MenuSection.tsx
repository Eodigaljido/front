import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: 'rgba(37,99,235,0.12)',
  borderRadius: 16,
  backgroundColor: '#fff',
};

export type MenuItem = {
  id: string;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  badge?: number;
  onPress: () => void;
};

type Props = {
  label: string;
  items: MenuItem[];
};

export default function MenuSection({ label, items }: Props) {
  return (
    <View className="mt-5">
      <Text className="mb-2 ml-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        {label}
      </Text>
      <View style={CARD_STYLE} className="overflow-hidden">
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            className="flex-row items-center px-4 py-4 active:opacity-80"
            style={
              index !== items.length - 1
                ? { borderBottomWidth: 0.5, borderBottomColor: 'rgba(37,99,235,0.08)' }
                : undefined
            }
          >
            <View
              className="items-center justify-center w-8 h-8 mr-3 rounded-xl"
              style={{ backgroundColor: item.iconBg }}
            >
              <Ionicons name={item.icon} size={16} color={item.iconColor} />
            </View>
            <Text className="flex-1 text-[15px] font-semibold text-gray-900">{item.title}</Text>
            {item.badge != null && item.badge > 0 && (
              <View className="mr-2 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
                <Text className="text-xs font-bold text-white">{item.badge > 99 ? '99+' : item.badge}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
