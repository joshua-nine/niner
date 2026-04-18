import { create } from 'zustand';
import { Character, Gender, Rank, RANK_EXP_REQUIRED, RANK_ORDER } from '../types/character';
import { EchoAbility } from '../types/character';

interface CharacterStore {
  character: Character | null;
  createCharacter: (name: string, gender: Gender) => void;
  addExperience: (amount: number) => void;
  discoverEssence: (essenceId: string) => void;
  unlockEcho: (echo: EchoAbility) => void;
  rankUp: () => void;
  incrementPlaytime: (seconds: number) => void;
  unlockMemory: (index: number) => void;
}

function buildBaseCharacter(name: string, gender: Gender): Character {
  return {
    name,
    gender,
    rank: 'Iron',
    systemRank: '???',
    level: 1,
    experience: 0,
    experienceToNext: RANK_EXP_REQUIRED['Iron'],
    essenceSlots: 4,
    equippedEssenceIds: [],
    equippedSkillIds: [],
    echoAbilities: [],
    attributes: { power: 10, speed: 10, spirit: 10, recovery: 10, toughness: 10 },
    spirit: null,
    conditions: [],
    pastLifeMemoriesUnlocked: 0,
    totalPlaytimeSeconds: 0,
  };
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: null,

  createCharacter: (name, gender) => {
    set({ character: buildBaseCharacter(name, gender) });
  },

  addExperience: (amount) => {
    const { character } = get();
    if (!character) return;
    const newExp = character.experience + amount;
    const newLevel = Math.min(100, Math.floor((newExp / character.experienceToNext) * 100) + 1);
    set({ character: { ...character, experience: newExp, level: newLevel } });
  },

  discoverEssence: (essenceId) => {
    const { character } = get();
    if (!character) return;
    if (character.equippedEssenceIds.includes(essenceId)) return;
    if (character.equippedEssenceIds.length >= character.essenceSlots) return;
    set({
      character: {
        ...character,
        equippedEssenceIds: [...character.equippedEssenceIds, essenceId],
      },
    });
  },

  unlockEcho: (echo) => {
    const { character } = get();
    if (!character) return;
    if (character.echoAbilities.find((e) => e.id === echo.id)) return;
    set({
      character: {
        ...character,
        echoAbilities: [...character.echoAbilities, echo],
      },
    });
  },

  unlockMemory: (index) => {
    const { character } = get();
    if (!character) return;
    if (character.pastLifeMemoriesUnlocked >= index) return;
    set({
      character: {
        ...character,
        pastLifeMemoriesUnlocked: index,
      },
    });
  },

  rankUp: () => {
    const { character } = get();
    if (!character) return;
    const currentIndex = RANK_ORDER.indexOf(character.rank);
    if (currentIndex >= RANK_ORDER.length - 1) return;
    const nextRank: Rank = RANK_ORDER[currentIndex + 1];
    set({
      character: {
        ...character,
        rank: nextRank,
        systemRank: nextRank,
        level: 1,
        experience: 0,
        experienceToNext: RANK_EXP_REQUIRED[nextRank],
        attributes: {
          power: character.attributes.power + 5,
          speed: character.attributes.speed + 5,
          spirit: character.attributes.spirit + 5,
          recovery: character.attributes.recovery + 5,
          toughness: character.attributes.toughness + 5,
        },
      },
    });
  },

  incrementPlaytime: (seconds) => {
    const { character } = get();
    if (!character) return;
    set({
      character: {
        ...character,
        totalPlaytimeSeconds: character.totalPlaytimeSeconds + seconds,
      },
    });
  },
}));
