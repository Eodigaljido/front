import { create } from 'zustand';

export type AppAlertType = 'success' | 'error' | 'warning' | 'info';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertConfig {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  type?: AppAlertType;
}

interface AlertState {
  visible: boolean;
  config: AppAlertConfig | null;
  show: (config: AppAlertConfig) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>(set => ({
  visible: false,
  config: null,
  show: config => set({ visible: true, config }),
  hide: () => set({ visible: false }),
}));
