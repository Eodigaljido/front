import { create } from 'zustand';

type TabStore = {
  forcedActiveTab: string | null;
  setForcedActiveTab: (tab: string | null) => void;
};

export const useTabStore = create<TabStore>(set => ({
  forcedActiveTab: null,
  setForcedActiveTab: tab => set({ forcedActiveTab: tab }),
}));
