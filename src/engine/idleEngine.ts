import { useResourceStore } from '../store/resourceStore';
import { useCharacterStore } from '../store/characterStore';
import { runAchievementChecks } from './achievementEngine';

const TICK_INTERVAL_MS = 1000;

let tickInterval: ReturnType<typeof setInterval> | null = null;

export function startIdleEngine(): void {
  if (tickInterval) return;
  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
}

export function stopIdleEngine(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function tick(): void {
  const { applyTick, recordTick } = useResourceStore.getState();
  const { addExperience, incrementPlaytime } = useCharacterStore.getState();

  const { exp } = applyTick(1);
  addExperience(exp);
  incrementPlaytime(1);
  recordTick();

  runAchievementChecks();
}

export function applyOfflineProgress(): { shards: number; gold: number; seconds: number } | null {
  const result = useResourceStore.getState().applyOfflineProgress();
  if (result) {
    const { addExperience } = useCharacterStore.getState();
    const expGained = useResourceStore.getState().rates.expPerSec * result.seconds;
    addExperience(expGained);
    runAchievementChecks();
  }
  return result;
}
