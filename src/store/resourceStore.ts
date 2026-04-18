import { create } from 'zustand';
import { Resources, ResourceRates, EMPTY_RESOURCES, BASE_RATES, OFFLINE_PROGRESS_CAP_SECONDS } from '../types/resources';

interface ResourceStore {
  resources: Resources;
  rates: ResourceRates;
  lastTickTimestamp: number;
  lifetimeShardsCollected: number;
  offlineSecondsEarned: number;
  addResources: (delta: Partial<Resources>) => void;
  applyTick: (deltaSeconds: number) => { shards: number; gold: number; exp: number };
  applyOfflineProgress: () => { shards: number; gold: number; seconds: number } | null;
  setRates: (rates: Partial<ResourceRates>) => void;
  recordTick: () => void;
}

export const useResourceStore = create<ResourceStore>((set, get) => ({
  resources: { ...EMPTY_RESOURCES },
  rates: { ...BASE_RATES },
  lastTickTimestamp: Date.now(),
  lifetimeShardsCollected: 0,
  offlineSecondsEarned: 0,

  addResources: (delta) => {
    const { resources } = get();
    set({
      resources: {
        ...resources,
        essenceShards: resources.essenceShards + (delta.essenceShards ?? 0),
        gold: resources.gold + (delta.gold ?? 0),
        manaStones: resources.manaStones + (delta.manaStones ?? 0),
        craftingMaterials: {
          ...resources.craftingMaterials,
          ...delta.craftingMaterials,
        },
      },
      lifetimeShardsCollected: get().lifetimeShardsCollected + (delta.essenceShards ?? 0),
    });
  },

  applyTick: (deltaSeconds) => {
    const { rates, addResources } = get();
    const shards = rates.essenceShardsPerSec * deltaSeconds;
    const gold = rates.goldPerSec * deltaSeconds;
    const manaStones = rates.manaStonePerSec * deltaSeconds;
    const exp = rates.expPerSec * deltaSeconds;
    addResources({ essenceShards: shards, gold, manaStones });
    return { shards, gold, exp };
  },

  applyOfflineProgress: () => {
    const { lastTickTimestamp, rates } = get();
    const now = Date.now();
    const elapsedMs = now - lastTickTimestamp;
    const elapsedSeconds = Math.min(elapsedMs / 1000, OFFLINE_PROGRESS_CAP_SECONDS);

    if (elapsedSeconds < 30) return null;

    const shards = rates.essenceShardsPerSec * elapsedSeconds;
    const gold = rates.goldPerSec * elapsedSeconds;
    const manaStones = rates.manaStonePerSec * elapsedSeconds;

    get().addResources({ essenceShards: shards, gold, manaStones });
    set({ lastTickTimestamp: now, offlineSecondsEarned: elapsedSeconds });
    return { shards, gold, seconds: elapsedSeconds };
  },

  setRates: (newRates) => {
    set({ rates: { ...get().rates, ...newRates } });
  },

  recordTick: () => {
    set({ lastTickTimestamp: Date.now() });
  },
}));
