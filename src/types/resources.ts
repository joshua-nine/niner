export interface Resources {
  essenceShards: number;
  gold: number;
  manaStones: number;
  craftingMaterials: Record<string, number>;
}

export interface ResourceRates {
  essenceShardsPerSec: number;
  goldPerSec: number;
  manaStonePerSec: number;
  expPerSec: number;
}

export const EMPTY_RESOURCES: Resources = {
  essenceShards: 0,
  gold: 0,
  manaStones: 0,
  craftingMaterials: {},
};

export const BASE_RATES: ResourceRates = {
  essenceShardsPerSec: 1,
  goldPerSec: 0.5,
  manaStonePerSec: 0,
  expPerSec: 0.2,
};

export const OFFLINE_PROGRESS_CAP_SECONDS = 8 * 3600;
