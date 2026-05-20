import { create } from 'zustand';
import { GameModeConfig, GameMode } from '../types/gameMode';
import { ALL_GAME_MODES } from '../data/gameModes';

interface GameModeStore {
  modes: GameModeConfig[];
  activeMode: GameMode;
  unlockMode: (modeId: GameMode) => void;
  setActiveMode: (modeId: GameMode) => void;
  isUnlocked: (modeId: GameMode) => boolean;
}

export const useGameModeStore = create<GameModeStore>((set, get) => ({
  modes: ALL_GAME_MODES.map((m) => ({ ...m })),
  activeMode: 'idle',

  unlockMode: (modeId) => {
    set({
      modes: get().modes.map((m) => (m.id === modeId ? { ...m, isUnlocked: true } : m)),
    });
  },

  setActiveMode: (modeId) => {
    set({ activeMode: modeId });
  },

  isUnlocked: (modeId) => !!get().modes.find((m) => m.id === modeId)?.isUnlocked,
}));
