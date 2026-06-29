import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore, type AppAlertType, type AppAlertButton } from '../store/alertStore';

const CONFIG: Record<
  AppAlertType,
  { icon: React.ComponentProps<typeof Ionicons>['name']; iconColor: string; iconBg: string; accent: string }
> = {
  success: { icon: 'checkmark-circle', iconColor: '#16a34a', iconBg: '#dcfce7', accent: '#2563eb' },
  error: { icon: 'close-circle', iconColor: '#ef4444', iconBg: '#fee2e2', accent: '#ef4444' },
  warning: { icon: 'warning', iconColor: '#d97706', iconBg: '#fef3c7', accent: '#d97706' },
  info: { icon: 'information-circle', iconColor: '#2563eb', iconBg: '#dbeafe', accent: '#2563eb' },
};

function buttonColors(
  style: AppAlertButton['style'],
  accent: string,
): { bg: string; border?: string; text: string } {
  switch (style) {
    case 'destructive':
      return { bg: '#ef4444', text: '#fff' };
    case 'cancel':
      return { bg: '#fff', border: '#e5e7eb', text: '#6b7280' };
    default:
      return { bg: accent, text: '#fff' };
  }
}

export default function AppAlert(): React.JSX.Element {
  const visible = useAlertStore(s => s.visible);
  const config = useAlertStore(s => s.config);
  const hide = useAlertStore(s => s.hide);

  const type = config?.type ?? 'info';
  const c = CONFIG[type];
  const buttons: AppAlertButton[] =
    config?.buttons && config.buttons.length > 0 ? config.buttons : [{ text: '확인' }];

  const handlePress = (btn: AppAlertButton) => {
    hide();
    btn.onPress?.();
  };

  // 취소 버튼은 바깥 영역 탭 시 동작 (없으면 단순 닫기)
  const onBackdrop = () => {
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    hide();
    cancelBtn?.onPress?.();
  };

  // 버튼 2개면 가로 배치, 그 외 세로 배치
  const horizontal = buttons.length === 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onBackdrop}>
      <Pressable
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
        onPress={onBackdrop}
      >
        <Pressable onPress={e => e.stopPropagation()} style={{ width: 300 }}>
          <View
            style={{
              alignItems: 'center',
              borderRadius: 16,
              backgroundColor: '#fff',
              paddingHorizontal: 24,
              paddingVertical: 28,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: c.iconBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name={c.icon} size={40} color={c.iconColor} />
            </View>

            {!!config?.title && (
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: config?.message ? 8 : 20,
                  textAlign: 'center',
                }}
              >
                {config.title}
              </Text>
            )}
            {!!config?.message && (
              <Text
                style={{
                  fontSize: 14,
                  color: '#6b7280',
                  lineHeight: 20,
                  textAlign: 'center',
                  marginBottom: 24,
                }}
              >
                {config.message}
              </Text>
            )}

            <View
              style={{
                flexDirection: horizontal ? 'row' : 'column',
                justifyContent: horizontal ? 'space-between' : 'flex-start',
                alignSelf: 'stretch',
              }}
            >
              {buttons.map((btn, idx) => {
                const bc = buttonColors(btn.style, c.accent);
                const spacing = idx === 0 ? 0 : 10;
                return (
                  <Pressable
                    key={`${btn.text}-${idx}`}
                    onPress={() => handlePress(btn)}
                    android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                    style={{
                      width: horizontal ? '48%' : '100%',
                      marginTop: horizontal ? 0 : spacing,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      paddingVertical: 13,
                      backgroundColor: bc.bg,
                      borderWidth: bc.border ? 1 : 0,
                      borderColor: bc.border ?? 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: bc.text }}>
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
