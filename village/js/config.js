// ─────────────────────────────────────────────────────────────
//  AGENT KINGDOM: configuration
//  Edit this file (or use the in-app "Kingdom" tab) to make the
//  realm yours. It is meant to evolve week to week.
//
//  Internal ids are unchanged from the village version ("mayor" is
//  you, "chief" is your Chief of Staff) so saved tasks keep working.
// ─────────────────────────────────────────────────────────────

// Step 1: Ground rules. Every agent's system prompt starts with these.
// They are also enforced in code (agents have no tool that can send,
// post, spend or book anything; they can only *petition for approval*).
export const GROUND_RULES = [
  'The King (the human) is always in charge. You advise and prepare; the King decides.',
  'NEVER send an email, post publicly, spend gold (money), sign up for anything, or book/accept a meeting yourself.',
  'Anything that leaves the kingdom (email, social post, purchase, calendar invite) must go through request_approval with the full draft attached, so the King can set the royal seal on it.',
  'Be honest about what you did and did not do. Never claim an action happened unless the King approved it.',
  'Stay in your lane: handle your own domain; hand other work to the Queen, who oversees every task.',
  'Keep replies short and concrete: what you understood, what you will do, what you need from the King. A light medieval flavour is welcome; vagueness is not.',
];

// Step 1: Style guide used when drawing the world (see STYLE_GUIDE.md).
export const STYLE = {
  grass: ['#5fae4e', '#58a548', '#64b553'],
  path: '#d8b77a',
  pathEdge: '#c49f61',
  plaza: '#c9c2b4',
  plazaLine: '#b5ad9d',
  water: '#4aa3df',
  waterDeep: '#3b8cc6',
  tree: ['#2f7d3a', '#3a8f45', '#276b31'],
  trunk: '#7a4e2d',
  stone: '#a9a39a',
  stoneDark: '#8a847b',
  stoneLight: '#c4beb4',
  mountain: ['#7d7368', '#8c8276', '#6e655b'],
  snow: '#f4f6fb',
  wall: '#f3e6cc',
  wallShade: '#dccaa6',
  door: '#5a3a22',
  gold: '#ffd23f',
  window: '#2b2b40',
  windowLit: '#ffd77a',
  outline: '#2b2b33',
  skin: ['#f5d0a9', '#e0ac7e', '#c68642', '#8d5524', '#f1c27d'],
};

// Step 2: You. The King. Rename yourself in the Kingdom tab.
export const MAYOR = {
  id: 'mayor',
  name: 'The King',
  role: 'You: the King, ruler of the realm',
  look: 'king',
  shirt: '#7b1e3a',        // royal robe
  cape: '#b3132c',
  hair: '#3b2a20',
  skin: 1,
  house: 'mayor',
  kind: 'mayor',
};

// Step 2 + 3: The Queen (Chief of Staff) and the Court (directors).
// `look` picks the sprite: queen, wizard, dragon, princess, prince,
// duchess, owl, whelp, apprentice, squire, jester.
// `keywords` are used by the offline router (no API key) to decide who
// gets a request. `tools` are the real-world integrations a director is
// *allowed to prepare drafts for*, never execute.
export const DEFAULT_AGENTS = [
  {
    id: 'chief', name: 'Queen Elara', kind: 'chief', look: 'queen', house: 'chief',
    role: 'Queen: Moral Support & Overseer of the Court',
    shirt: '#5b2a86', hair: '#2a1a12', skin: 0,
    keywords: [],
    tools: ['todo'],
    instructions:
      'You are the Queen: the King\'s moral support and the overseer of the whole court.\n' +
      'MORAL SUPPORT: You are in the King\'s corner. Notice how the King is doing, not just what they need done. Celebrate wins, big and small, by name. ' +
      'When the King sounds tired, stressed, discouraged or overwhelmed, lead with warmth and empathy before any task talk, then offer one small, concrete way to lighten the load ' +
      '(for example taking something off their plate, moving it to tomorrow, or suggesting a break). Be sincere and specific, never preachy, never fake. ' +
      'If the King ever seems to be in real distress or mentions wanting to hurt themselves, gently encourage reaching out to someone they trust or a local crisis line, and stay kind.\n' +
      'SUPERVISION: Every task in the kingdom passes through you. Requests reach you first: break them into tasks and assign each to the right member of the court with add_todo. ' +
      'When a courtier finishes, you review the work before it is marked done or reaches the King: is it correct, complete, honest, and within the ground rules? ' +
      'Keep the big picture, chase overdue work, and only do a task yourself if nobody at court fits.\n' +
      'You can see every open task in the kingdom below; use that when the King asks how things are going.',
  },
  {
    id: 'inbox', name: 'Iris', kind: 'director', look: 'wizard', house: 'inbox',
    role: 'Court Wizard of Messages',
    shirt: '#3a5bd9', hat: '#2b44a8', hair: '#d8d8e0', skin: 4,
    keywords: ['email', 'inbox', 'reply', 'message', 'gmail', 'write to', 'respond', 'newsletter', 'letter'],
    tools: ['gmail-draft', 'todo'],
    instructions:
      'You keep the Owl Post: the King\'s inbox. Triage, summarise, and draft replies. Every outgoing email is a request_approval of kind "email" with to/subject/body filled in.',
    intern: { id: 'inbox-intern', name: 'Pip', look: 'owl', shirt: '#a07850', hair: '#6b4a2a', skin: 0 },
  },
  {
    id: 'calendar', name: 'Cal', kind: 'director', look: 'wizard', house: 'calendar',
    role: 'Wizard of Time & Calendar',
    shirt: '#138a87', hat: '#0e6866', hair: '#9a9a9a', skin: 2,
    keywords: ['meeting', 'calendar', 'schedule', 'appointment', 'call', 'book', 'remind', 'tomorrow', 'week'],
    tools: ['calendar-draft', 'todo'],
    instructions:
      'You guard the King\'s hours from the Time Tower. Plan the day, find slots, and prepare calendar events. Every event or invite is a request_approval of kind "calendar" with when and duration_minutes.',
    intern: { id: 'calendar-intern', name: 'Tick', look: 'apprentice', shirt: '#5fd0cd', hair: '#5a3b2a', skin: 1 },
  },
  {
    id: 'money', name: 'Penny', kind: 'director', look: 'dragon', house: 'money',
    role: 'Treasury Dragon',
    shirt: '#2e933c', belly: '#e9d58a', hair: '#1e6b2a', skin: 0,
    keywords: ['money', 'budget', 'pay', 'bill', 'buy', 'purchase', 'invoice', 'subscription', '$', 'cost', 'price', 'gold'],
    tools: ['todo'],
    instructions:
      'You are the dragon who guards the royal treasury from the mountain hoard. You track bills, budgets and subscriptions and you hate waste. You may research and recommend, but every purchase or payment is a request_approval of kind "spend" with amount filled in.',
    intern: { id: 'money-intern', name: 'Nickel', look: 'whelp', shirt: '#c0392b', belly: '#f5c78a', hair: '#8e2a20', skin: 0 },
  },
  {
    id: 'content', name: 'Princess Echo', kind: 'director', look: 'princess', house: 'content',
    role: 'Royal Herald (Content & Social)',
    shirt: '#e05a9a', hair: '#e8c15a', skin: 1,
    keywords: ['post', 'tweet', 'social', 'linkedin', 'instagram', 'content', 'video', 'blog', 'caption', 'youtube', 'announce'],
    tools: ['todo'],
    instructions:
      'You are the Royal Herald: you plan and draft the kingdom\'s proclamations (content and social posts). Every public post is a request_approval of kind "post" with platform and body. Never post yourself.',
    intern: { id: 'content-intern', name: 'Reel', look: 'jester', shirt: '#9c51b6', hair: '#d9a066', skin: 4 },
  },
  {
    id: 'health', name: 'Duchess Sage', kind: 'director', look: 'duchess', house: 'health',
    role: 'Duchess of the Hearth (Health & Home)',
    shirt: '#d9822b', hair: '#4a2c1a', skin: 3,
    keywords: ['gym', 'workout', 'health', 'doctor', 'sleep', 'food', 'meal', 'grocery', 'home', 'chores', 'family'],
    tools: ['todo'],
    instructions:
      'You look after the King\'s health, household and family logistics: training, meals, provisions, chores, appointments. Purchases need spend approval; appointments go via the Wizard of Time.',
    intern: { id: 'health-intern', name: 'Sprout', look: 'squire', shirt: '#f8c58c', hair: '#2a2a2a', skin: 0 },
  },
  {
    id: 'projects', name: 'Prince Dex', kind: 'director', look: 'prince', house: 'projects',
    role: 'Prince of Quests (Projects & Learning)',
    shirt: '#2f4f8f', cape: '#1d3461', hair: '#8b5a2b', skin: 4,
    keywords: ['project', 'code', 'learn', 'study', 'course', 'research', 'idea', 'build', 'website', 'app', 'class', 'quest'],
    tools: ['todo'],
    instructions:
      'You lead the King\'s quests: side projects and learning. Break big goals into weekly steps, research, and keep notes. Anything external still needs approval.',
    intern: { id: 'projects-intern', name: 'Byte', look: 'squire', shirt: '#98c1d9', hair: '#111111', skin: 2 },
  },
];

// Step 1: The kingdom map. 48 × 30 tiles.
export const MAP = { cols: 48, rows: 30, tile: 16, scale: 2 };

// Buildings: x,y = top-left tile, w,h in tiles. Door is on the bottom wall.
// kind: castle | keep | tower (wizard) | lair (dragon) | manor (royals)
export const BUILDINGS = [
  { id: 'townhall', x: 19, y: 1, w: 10, h: 6, door: 23, label: 'GREAT HALL', roof: '#8c2f39', kind: 'castle' },
  { id: 'mayor',    x: 21, y: 22, w: 6, h: 5, door: 23, label: "KING'S KEEP", roof: '#d4a017', kind: 'keep' },
  { id: 'chief',    x: 30, y: 17, w: 5, h: 4, door: 32, label: "QUEEN'S TOWER", roof: '#5b2a86', kind: 'manor' },
  { id: 'money',    x: 3,  y: 2,  w: 5, h: 4, door: 5,  label: "DRAGON'S HOARD", roof: '#2e933c', kind: 'lair' },
  { id: 'calendar', x: 3,  y: 10, w: 5, h: 4, door: 5,  label: 'TIME TOWER', roof: '#138a87', kind: 'tower' },
  { id: 'inbox',    x: 3,  y: 19, w: 5, h: 4, door: 5,  label: 'OWL POST', roof: '#3a5bd9', kind: 'tower' },
  { id: 'content',  x: 40, y: 2,  w: 5, h: 4, door: 42, label: "HERALD'S HALL", roof: '#e05a9a', kind: 'manor' },
  { id: 'health',   x: 40, y: 10, w: 5, h: 4, door: 42, label: 'HEARTH MANOR', roof: '#d9822b', kind: 'manor' },
  { id: 'projects', x: 40, y: 19, w: 5, h: 4, door: 42, label: 'QUEST KEEP', roof: '#2f4f8f', kind: 'manor' },
];

export const PLAZA = { x: 18, y: 9, w: 12, h: 6 };      // the Royal Courtyard
export const FOUNTAIN = { x: 23, y: 11, w: 2, h: 2 };
export const POND = { x: 10, y: 24, w: 7, h: 4 };       // the Royal Lake

// Mountain ranges (tiles that become impassable peaks).
export const MOUNTAIN_ZONES = [
  (x, y) => (x <= 12 && y <= 1) || (x <= 1 && y <= 9) || (x === 8 && y >= 2 && y <= 4) || (x === 2 && y >= 2 && y <= 6),
  (x, y) => y === 0 && x >= 30,
  (x, y) => x >= 46 && y <= 9,
  (x, y) => (x >= 29 && y >= 25) || (x >= 46 && y >= 16),
];
// Where the wild dragon circles (tile coordinates).
export const DRAGON_PERCH = { x: 38, y: 27 };

// Approximate public API prices ($ per 1M tokens) for the spend meter.
export const PRICES = {
  'claude-opus-5-5':   { in: 4,   out: 20 },
  'claude-sonnet-5-5': { in: 2,   out: 10 },
  'claude-haiku-5-5':  { in: 0.1, out: 0.5 },
  'claude-fable-5-1':  { in: 10,  out: 50 },
};
