export type Rank = 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Transcendent';
export type SystemRank = Rank | '???';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type Gender = 'male' | 'female' | 'nonbinary';

export interface Attributes {
  power: number;
  speed: number;
  spirit: number;
  recovery: number;
  toughness: number;
}

export interface Condition {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  isPositive: boolean;
}

export interface Spirit {
  id: string;
  name: string;
  description: string;
  bonuses: Partial<Attributes>;
  unlockedAt: Rank;
}

export interface EchoAbility {
  id: string;
  name: string;
  description: string;
  memoryIndex: number;
  flavor: string;
  passiveBonus?: {
    essenceShardsPerSec?: number;
    goldPerSec?: number;
    expPerSec?: number;
    attributeBonus?: Partial<Attributes>;
  };
}

export interface Character {
  name: string;
  gender: Gender;
  rank: Rank;
  systemRank: SystemRank;
  level: number;
  experience: number;
  experienceToNext: number;
  essenceSlots: number;
  equippedEssenceIds: string[];
  equippedSkillIds: string[];
  echoAbilities: EchoAbility[];
  attributes: Attributes;
  spirit: Spirit | null;
  conditions: Condition[];
  pastLifeMemoriesUnlocked: number;
  totalPlaytimeSeconds: number;
}

export const RANK_ORDER: Rank[] = ['Iron', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Transcendent'];

export const RANK_COLORS: Record<Rank, string> = {
  Iron: '#9ca3af',
  Bronze: '#b87333',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Diamond: '#b9f2ff',
  Transcendent: '#e040fb',
};

export const RANK_EXP_REQUIRED: Record<Rank, number> = {
  Iron: 10000,
  Bronze: 50000,
  Silver: 200000,
  Gold: 1000000,
  Diamond: 5000000,
  Transcendent: Infinity,
};
