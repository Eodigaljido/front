import type { TextStyle } from 'react-native';

export const TEXT_STYLE = {
  tabLabelInactive: {
    fontSize: 11,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: -0.1,
    color: '#64748b',
  },
  tabLabelActive: {
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.1,
    color: '#2563eb',
  },
} as const;
