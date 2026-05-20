import { create } from 'zustand';
import { Achievement } from '../types/achievement';
import { ALL_ACHIEVEMENTS } from '../data/achievements';

interface AchievementStore {
  achievements: Achievement[];
  pendingRewardIds: string[];
  completeAchievement: (id: string) => void;
  updateProgress: (id: string, current: number) => void;
  clearPendingReward: (id: string) => void;
  isCompleted: (id: string) => boolean;
}

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  achievements: ALL_ACHIEVEMENTS.map((a) => ({ ...a })),
  pendingRewardIds: [],

  completeAchievement: (id) => {
    const { achievements } = get();
    const existing = achievements.find((a) => a.id === id);
    if (!existing || existing.completed) return;
    set({
      achievements: achievements.map((a) =>
        a.id === id ? { ...a, completed: true, completedAt: Date.now() } : a
      ),
      pendingRewardIds: [...get().pendingRewardIds, id],
    });
  },

  updateProgress: (id, current) => {
    const { achievements } = get();
    set({
      achievements: achievements.map((a) =>
        a.id === id && a.progress ? { ...a, progress: { ...a.progress, current } } : a
      ),
    });
  },

  clearPendingReward: (id) => {
    set({ pendingRewardIds: get().pendingRewardIds.filter((r) => r !== id) });
  },

  isCompleted: (id) => !!get().achievements.find((a) => a.id === id)?.completed,
}));
