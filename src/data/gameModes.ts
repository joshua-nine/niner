import { GameModeConfig } from '../types/gameMode';

export const ALL_GAME_MODES: GameModeConfig[] = [
  {
    id: 'idle',
    name: 'Idle',
    description: 'Passively gather essence shards and discover your power. The beginning of everything.',
    flavor: '"You arrived with nothing. The System gave you a rank it could barely read. Start there."',
    unlockAchievementIds: [],
    isUnlocked: true,
    comingSoon: false,
    route: '/(tabs)/idle',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    description: 'Enter dungeons, fight monsters, and claim loot. Bronze rank opens the first gates.',
    flavor: '"The Wanderer\'s Society will take almost anyone. Almost."',
    unlockAchievementIds: ['reach_bronze'],
    isUnlocked: false,
    comingSoon: false,
    route: '/modes/adventure',
  },
  {
    id: 'outworlder',
    name: 'Outworlder',
    description:
      'Navigate faction politics and society quests. Silver rank makes you someone worth manipulating.',
    flavor: '"At Silver, you stop being a curiosity and start being a piece on someone\'s board."',
    unlockAchievementIds: ['reach_silver'],
    isUnlocked: false,
    comingSoon: true,
    route: '/modes/outworlder',
  },
  {
    id: 'hero',
    name: 'Hero',
    description: 'Lead a party into proto-spaces and expedition maps. Gold rank, Gold responsibility.',
    flavor: '"They will follow you because they have seen what you can do. Make sure it\'s worth following."',
    unlockAchievementIds: ['reach_gold'],
    isUnlocked: false,
    comingSoon: true,
    route: '/modes/hero',
  },
  {
    id: 'transcendent',
    name: 'Transcendent',
    description:
      'Astral rifts. Dimensional beings. The truth of your past life. Diamond rank is just the beginning.',
    flavor: '"The System never had a category for you. At Diamond, you stop needing one."',
    unlockAchievementIds: ['reach_diamond'],
    isUnlocked: false,
    comingSoon: true,
    route: '/modes/transcendent',
  },
];
