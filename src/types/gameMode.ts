export type GameMode = 'idle' | 'adventure' | 'outworlder' | 'hero' | 'transcendent';

export interface GameModeConfig {
  id: GameMode;
  name: string;
  description: string;
  flavor: string;
  unlockAchievementIds: string[];
  isUnlocked: boolean;
  comingSoon: boolean;
  route: string;
}
