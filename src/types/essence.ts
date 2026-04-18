import { Rank, Rarity } from './character';

export type EssenceCategory = 'Damage' | 'Support' | 'Control' | 'Summon' | 'Stealth';

export interface ResourceBonus {
  essenceShardsPerSec?: number;
  goldPerSec?: number;
  manaStonePerSec?: number;
  expPerSec?: number;
}

export interface EssenceAbility {
  id: string;
  name: string;
  rarity: Rarity;
  rankRequired: Rank;
  cooldown: number;
  description: string;
  passiveBonus?: ResourceBonus;
}

export interface Essence {
  id: string;
  name: string;
  rarity: Rarity;
  category: EssenceCategory;
  abilities: EssenceAbility[];
  lore: string;
  discovered: boolean;
  discoveryChance: number;
}
