// ── Auto-calculation helpers for D&D 5e ──────────────────────

export function getMod(score) {
  return Math.floor((score - 10) / 2);
}

export function formatMod(mod) {
  return (mod >= 0 ? '+' : '') + mod;
}

export function getProfBonus(level) {
  return Math.ceil(level / 4) + 1;
}

// Skill → ability score mapping
export const SKILL_ABILITY = {
  acrobatics:     'dex', animalHandling: 'wis', arcana:       'int',
  athletics:      'str', deception:      'cha', history:      'int',
  insight:        'wis', intimidation:   'cha', investigation: 'int',
  medicine:       'wis', nature:         'int', perception:   'wis',
  performance:    'cha', persuasion:     'cha', religion:     'int',
  sleightOfHand:  'dex', stealth:        'dex', survival:     'wis'
};

export const SKILL_LABELS = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History',
  insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
  medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
  sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
};

export function getSkillBonus(skillKey, scores, proficient, profBonus, expertise = false) {
  const ability = SKILL_ABILITY[skillKey];
  const mod     = getMod(scores[ability] || 10);
  return mod + (proficient ? (expertise ? profBonus * 2 : profBonus) : 0);
}

export function getSavingThrowBonus(ability, scores, proficient, profBonus) {
  return getMod(scores[ability] || 10) + (proficient ? profBonus : 0);
}

export function getPassivePerception(scores, skills, profBonus) {
  return 10 + getSkillBonus('perception', scores, skills?.perception || false, profBonus);
}

export function getInitiative(dex) {
  return getMod(dex);
}

// Level-based spell slots table (5e PHB)
export const SPELL_SLOTS_BY_LEVEL = {
  1:  [2,0,0,0,0,0,0,0,0],
  2:  [3,0,0,0,0,0,0,0,0],
  3:  [4,2,0,0,0,0,0,0,0],
  4:  [4,3,0,0,0,0,0,0,0],
  5:  [4,3,2,0,0,0,0,0,0],
  6:  [4,3,3,0,0,0,0,0,0],
  7:  [4,3,3,1,0,0,0,0,0],
  8:  [4,3,3,2,0,0,0,0,0],
  9:  [4,3,3,3,1,0,0,0,0],
  10: [4,3,3,3,2,0,0,0,0],
  11: [4,3,3,3,2,1,0,0,0],
  12: [4,3,3,3,2,1,0,0,0],
  13: [4,3,3,3,2,1,1,0,0],
  14: [4,3,3,3,2,1,1,0,0],
  15: [4,3,3,3,2,1,1,1,0],
  16: [4,3,3,3,2,1,1,1,0],
  17: [4,3,3,3,2,1,1,1,1],
  18: [4,3,3,3,3,1,1,1,1],
  19: [4,3,3,3,3,2,1,1,1],
  20: [4,3,3,3,3,2,2,1,1]
};

// ── Debounce utility ──────────────────────────────────────────
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
