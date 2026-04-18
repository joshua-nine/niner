import { useCharacterStore } from '../store/characterStore';
import { useResourceStore } from '../store/resourceStore';
import { RANK_EXP_REQUIRED } from '../types/character';
import { runAchievementChecks } from './achievementEngine';

export function checkAndApplyRankUp(): boolean {
  const character = useCharacterStore.getState().character;
  if (!character) return false;

  const required = RANK_EXP_REQUIRED[character.rank];
  if (character.experience < required) return false;
  if (character.rank === 'Transcendent') return false;

  useCharacterStore.getState().rankUp();

  const { rates, setRates } = useResourceStore.getState();
  setRates({
    essenceShardsPerSec: rates.essenceShardsPerSec * 1.5,
    goldPerSec: rates.goldPerSec * 1.5,
    expPerSec: rates.expPerSec * 1.2,
  });

  runAchievementChecks();
  return true;
}
