import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ResultType = 'success' | 'error' | 'warning' | 'info';

type Props = {
  visible: boolean;
  type: ResultType;
  title: string;
  message: string;
  confirmText?: string;
  onClose: () => void;
};

const CONFIG: Record<ResultType, { icon: React.ComponentProps<typeof Ionicons>['name']; iconColor: string; iconBg: string; btnColor: string }> = {
  success: { icon: 'checkmark-circle', iconColor: '#16a34a', iconBg: '#dcfce7', btnColor: '#2563eb' },
  error:   { icon: 'close-circle',     iconColor: '#ef4444', iconBg: '#fee2e2', btnColor: '#374151' },
  warning: { icon: 'warning',           iconColor: '#d97706', iconBg: '#fef3c7', btnColor: '#d97706' },
  info:    { icon: 'information-circle',iconColor: '#2563eb', iconBg: '#dbeafe', btnColor: '#2563eb' },
};

export default function ResultModal({ visible, type, title, message, confirmText = '확인', onClose }: Props) {
  const c = CONFIG[type];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation()} style={{ width: 280 }}>
          <View style={{ alignItems: 'center', borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 28 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name={c.icon} size={40} color={c.iconColor} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' }}>
              {title}
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', lineHeight: 20, textAlign: 'center', marginBottom: 24 }}>
              {message}
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                width: '100%',
                alignItems: 'center',
                borderRadius: 12,
                paddingVertical: 12,
                backgroundColor: c.btnColor,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
