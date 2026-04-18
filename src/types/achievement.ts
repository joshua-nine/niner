import { GameMode } from './gameMode';
import { Resources } from './resources';

export type AchievementCategory =
  | 'progression'
  | 'exploration'
  | 'combat'
  | 'collection'
  | 'memory'
  | 'special';

export interface AchievementReward {
  type: 'resources' | 'essence' | 'skill' | 'title' | 'echo';
  resourceAmount?: Partial<Resources>;
  essenceId?: string;
  skillId?: string;
  title?: string;
  echoId?: string;
}

export interface AchievementProgress {
  current: number;
  required: number;
  label: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  completed: boolean;
  completedAt?: number;
  reward?: AchievementReward;
  unlocksMode?: GameMode;
  progress?: AchievementProgress;
  hidden: boolean;
}
