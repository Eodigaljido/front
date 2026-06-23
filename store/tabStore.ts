import { create } from 'zustand';

type TabStore = {
  forcedActiveTab: string | null;
  setForcedActiveTab: (tab: string | null) => void;
  /** 가로 스크롤 영역 위에서는 스와이프 탭 이동을 막기 위한 잠금 플래그 */
  swipeLocked: boolean;
  setSwipeLocked: (locked: boolean) => void;
};

export const useTabStore = create<TabStore>(set => ({
  forcedActiveTab: null,
  setForcedActiveTab: tab => set({ forcedActiveTab: tab }),
  swipeLocked: false,
  setSwipeLocked: locked => set({ swipeLocked: locked }),
}));
