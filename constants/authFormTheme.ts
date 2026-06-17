import type { StyleProp, TextStyle } from 'react-native';

/** 로그인·회원가입 등 — Android 다크 모드에서도 동일한 대비 유지 */
export const AUTH_FORM_COLORS = {
  text: '#111827',
  placeholder: '#9ca3af',
  pageBackground: '#ffffff',
} as const;

export const authTextInputColorProps = {
  placeholderTextColor: AUTH_FORM_COLORS.placeholder,
} as const;

export function authInputStyle(extra?: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const base: TextStyle = { color: AUTH_FORM_COLORS.text };
  if (!extra) return base;
  return [base, extra];
}
