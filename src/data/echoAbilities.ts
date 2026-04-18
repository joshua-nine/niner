import { EchoAbility } from '../types/character';

export const ALL_ECHO_ABILITIES: EchoAbility[] = [
  {
    id: 'remnant_step',
    name: 'Remnant Step',
    description: 'You move as someone who has walked these paths before. Speed and evasion increased.',
    memoryIndex: 1,
    flavor:
      '"A flash — you knew this dungeon before it had a name. Your feet found the safe path before your mind did."',
    passiveBonus: {
      essenceShardsPerSec: 0.5,
      expPerSec: 0.15,
    },
  },
  {
    id: 'veil_of_before',
    name: 'Veil of Before',
    description:
      'Draw a thin shroud from your past life around yourself. The System cannot register your actions for a brief moment.',
    memoryIndex: 2,
    flavor:
      '"You remember a face. You do not know whose it is. But when you reached for that memory, something reached back — and gave you this."',
    passiveBonus: {
      essenceShardsPerSec: 0.8,
      manaStonePerSec: 0.1,
    },
  },
  {
    id: 'ashen_ward',
    name: 'Ashen Ward',
    description:
      "Your past life knew the Ashen Circle. This knowledge manifests as a ward that disrupts their rituals.",
    memoryIndex: 3,
    flavor:
      '"The beacon they left in you pulses — but your past life recognises what they are. It recognised them long before you were born."',
    passiveBonus: {
      goldPerSec: 1.0,
      expPerSec: 0.3,
    },
  },
];
