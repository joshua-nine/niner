import { useAchievementStore } from '../store/achievementStore';
import { useCharacterStore } from '../store/characterStore';
import { useResourceStore } from '../store/resourceStore';
import { useGameModeStore } from '../store/gameModeStore';
import { ALL_ECHO_ABILITIES } from '../data/echoAbilities';
import { GameMode } from '../types/gameMode';

type TriggerFn = () => boolean;

function buildTriggers(): Record<string, TriggerFn> {
  return {
    first_shard: () => useResourceStore.getState().lifetimeShardsCollected >= 1,
    shard_100: () => useResourceStore.getState().lifetimeShardsCollected >= 100,
    shard_1000: () => useResourceStore.getState().lifetimeShardsCollected >= 1000,
    first_essence: () => (useCharacterStore.getState().character?.equippedEssenceIds.length ?? 0) >= 1,
    essence_collector: () => (useCharacterStore.getState().character?.equippedEssenceIds.length ?? 0) >= 3,
    iron_level_10: () => {
      const c = useCharacterStore.getState().character;
      return !!c && c.rank === 'Iron' && c.level >= 10;
    },
    bronze_aspirant: () => {
      const c = useCharacterStore.getState().character;
      return !!c && c.experience >= 10000;
    },
    reach_bronze: () => {
      const c = useCharacterStore.getState().character;
      return !!c && c.rank !== 'Iron';
    },
    reach_silver: () => {
      const c = useCharacterStore.getState().character;
      return !!c && ['Silver', 'Gold', 'Diamond', 'Transcendent'].includes(c.rank);
    },
    reach_gold: () => {
      const c = useCharacterStore.getState().character;
      return !!c && ['Gold', 'Diamond', 'Transcendent'].includes(c.rank);
    },
    reach_diamond: () => {
      const c = useCharacterStore.getState().character;
      return !!c && ['Diamond', 'Transcendent'].includes(c.rank);
    },
    system_anomaly: () => {
      return useCharacterStore.getState().character?.systemRank === '???';
    },
    offline_8h: () => useResourceStore.getState().offlineSecondsEarned >= 8 * 3600,
    // Memory triggers
    memory_1: () => {
      const c = useCharacterStore.getState().character;
      return !!c && c.rank === 'Iron' && c.level >= 5;
    },
    memory_2: () => {
      const c = useCharacterStore.getState().character;
      return !!c && c.rank === 'Bronze';
    },
    memory_3: () => useAchievementStore.getState().isCompleted('reach_bronze'),
  };
}

function updateProgressValues(): void {
  const { updateProgress } = useAchievementStore.getState();
  const lifetimeShards = useResourceStore.getState().lifetimeShardsCollected;
  const character = useCharacterStore.getState().character;

  updateProgress('first_shard', lifetimeShards);
  updateProgress('shard_100', lifetimeShards);
  updateProgress('shard_1000', lifetimeShards);
  updateProgress('iron_level_10', character?.level ?? 0);
  updateProgress('bronze_aspirant', character?.experience ?? 0);
  updateProgress('essence_collector', character?.equippedEssenceIds.length ?? 0);
}

export function runAchievementChecks(): void {
  const { achievements, completeAchievement, isCompleted } = useAchievementStore.getState();
  const triggers = buildTriggers();

  updateProgressValues();

  for (const ach of achievements) {
    if (ach.completed) continue;
    const trigger = triggers[ach.id];
    if (trigger && trigger()) {
      completeAchievement(ach.id);
      handleReward(ach.id, ach.reward?.echoId, ach.unlocksMode as GameMode | undefined);
    }
  }
}

function handleReward(achId: string, echoId?: string, unlocksMode?: GameMode): void {
  if (echoId) {
    const echo = ALL_ECHO_ABILITIES.find((e) => e.id === echoId);
    if (echo) {
      useCharacterStore.getState().unlockEcho(echo);
      const memoryIndex = echo.memoryIndex;
      useCharacterStore.getState().unlockMemory(memoryIndex);
    }
  }

  if (unlocksMode) {
    useGameModeStore.getState().unlockMode(unlocksMode);
  }
}
