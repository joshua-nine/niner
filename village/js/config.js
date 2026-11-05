// ─────────────────────────────────────────────────────────────
//  AGENT VILLAGE — configuration
//  Edit this file (or use the in-app "Village" tab) to make the
//  village yours. It is meant to evolve week to week.
// ─────────────────────────────────────────────────────────────

// Step 1 — Ground rules. Every agent's system prompt starts with these.
// They are also enforced in code (agents have no tool that can send,
// post, spend or book anything — they can only *request approval*).
export const GROUND_RULES = [
  'The Mayor (the human) is always in charge. You advise and prepare; the Mayor decides.',
  'NEVER send an email, post publicly, spend money, sign up for anything, or book/accept a meeting yourself.',
  'Anything that leaves the village (email, social post, purchase, calendar invite) must go through request_approval with the full draft attached.',
  'Be honest about what you did and did not do. Never claim an action happened unless the Mayor approved it.',
  'Stay in your lane: handle your own department; hand other work to the Chief of Staff.',
  'Keep replies short and concrete: what you understood, what you will do, what you need from the Mayor.',
];

// Step 1 — Style guide used when drawing the world (see STYLE_GUIDE.md).
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
  wall: '#f3e6cc',
  wallShade: '#dccaa6',
  door: '#7a4e2d',
  window: '#9fd3f5',
  windowLit: '#ffd77a',
  outline: '#2b2b33',
  skin: ['#f5d0a9', '#e0ac7e', '#c68642', '#8d5524', '#f1c27d'],
};

// Step 2 — You. The human. Rename yourself in the Village tab.
export const MAYOR = {
  id: 'mayor',
  name: 'Mayor',
  role: 'You — the human in charge',
  shirt: '#ffd23f',
  hair: '#3b2a20',
  skin: 1,
  house: 'mayor',
  kind: 'mayor',
};

// Step 2 + 3 — Chief of Staff and Directors.
// `keywords` are used by the offline router (no API key) to decide who
// gets a request. `tools` are the real-world integrations a director is
// *allowed to prepare drafts for* — never execute.
export const DEFAULT_AGENTS = [
  {
    id: 'chief', name: 'Matt', kind: 'chief', house: 'chief',
    role: 'Chief of Staff',
    shirt: '#2d3047', hair: '#1b1b1b', skin: 0,
    keywords: [],
    tools: ['todo'],
    instructions:
      'You are the Mayor\'s Chief of Staff. You receive every request first, break it into tasks, and assign each task to the right director with add_todo. ' +
      'You keep the big picture, chase overdue work, and summarise the day. Only do a task yourself if no director fits.',
  },
  {
    id: 'inbox', name: 'Iris', kind: 'director', house: 'inbox',
    role: 'Director of Inbox & Comms',
    shirt: '#e4572e', hair: '#6b3e26', skin: 4,
    keywords: ['email', 'inbox', 'reply', 'message', 'gmail', 'write to', 'respond', 'newsletter'],
    tools: ['gmail-draft', 'todo'],
    instructions:
      'You own the Mayor\'s inbox. Triage, summarise, and draft replies. Every outgoing email is a request_approval of kind "email" with to/subject/body filled in.',
    intern: { id: 'inbox-intern', name: 'Pip', shirt: '#f19a7b', hair: '#d9a066', skin: 0 },
  },
  {
    id: 'calendar', name: 'Cal', kind: 'director', house: 'calendar',
    role: 'Director of Time & Calendar',
    shirt: '#17bebb', hair: '#2a2a2a', skin: 2,
    keywords: ['meeting', 'calendar', 'schedule', 'appointment', 'call', 'book', 'remind', 'tomorrow', 'week'],
    tools: ['calendar-draft', 'todo'],
    instructions:
      'You protect the Mayor\'s time. Plan the day, find slots, and prepare calendar events. Every event or invite is a request_approval of kind "calendar" with when and duration_minutes.',
    intern: { id: 'calendar-intern', name: 'Tick', shirt: '#7fe0de', hair: '#5a3b2a', skin: 1 },
  },
  {
    id: 'money', name: 'Penny', kind: 'director', house: 'money',
    role: 'Director of Money',
    shirt: '#2e933c', hair: '#c9a227', skin: 0,
    keywords: ['money', 'budget', 'pay', 'bill', 'buy', 'purchase', 'invoice', 'subscription', '$', 'cost', 'price'],
    tools: ['todo'],
    instructions:
      'You track bills, budgets and subscriptions. You may research and recommend, but every purchase or payment is a request_approval of kind "spend" with amount filled in.',
    intern: { id: 'money-intern', name: 'Nickel', shirt: '#8fd694', hair: '#2a2a2a', skin: 3 },
  },
  {
    id: 'content', name: 'Echo', kind: 'director', house: 'content',
    role: 'Director of Content & Social',
    shirt: '#9c51b6', hair: '#111111', skin: 1,
    keywords: ['post', 'tweet', 'social', 'linkedin', 'instagram', 'content', 'video', 'blog', 'caption', 'youtube'],
    tools: ['todo'],
    instructions:
      'You plan and draft content. Every public post is a request_approval of kind "post" with platform and body. Never post yourself.',
    intern: { id: 'content-intern', name: 'Reel', shirt: '#c99ad6', hair: '#d9a066', skin: 4 },
  },
  {
    id: 'health', name: 'Sage', kind: 'director', house: 'health',
    role: 'Director of Health & Home',
    shirt: '#f4a259', hair: '#4a2c1a', skin: 3,
    keywords: ['gym', 'workout', 'health', 'doctor', 'sleep', 'food', 'meal', 'grocery', 'home', 'chores', 'family'],
    tools: ['todo'],
    instructions:
      'You look after the Mayor\'s health, home and family logistics: workouts, meals, groceries, chores, appointments. Purchases need spend approval; appointments go via the calendar director.',
    intern: { id: 'health-intern', name: 'Sprout', shirt: '#f8c58c', hair: '#2a2a2a', skin: 0 },
  },
  {
    id: 'projects', name: 'Dex', kind: 'director', house: 'projects',
    role: 'Director of Projects & Learning',
    shirt: '#3d5a80', hair: '#8b5a2b', skin: 4,
    keywords: ['project', 'code', 'learn', 'study', 'course', 'research', 'idea', 'build', 'website', 'app', 'class'],
    tools: ['todo'],
    instructions:
      'You run the Mayor\'s side projects and learning: break big goals into weekly steps, research, and keep notes. Anything external still needs approval.',
    intern: { id: 'projects-intern', name: 'Byte', shirt: '#98c1d9', hair: '#111111', skin: 2 },
  },
];

// Step 1 — The village map. 48 × 30 tiles.
export const MAP = { cols: 48, rows: 30, tile: 16, scale: 2 };

// Buildings: x,y = top-left tile, w,h in tiles. Door is on the bottom wall.
export const BUILDINGS = [
  { id: 'townhall', x: 19, y: 1, w: 10, h: 6, door: 23, label: 'TOWN HALL', roof: '#8c2f39', kind: 'townhall' },
  { id: 'mayor',    x: 21, y: 22, w: 6, h: 5, door: 23, label: 'MAYOR', roof: '#d4a017', kind: 'house' },
  { id: 'chief',    x: 30, y: 17, w: 5, h: 4, door: 32, label: 'CHIEF OF STAFF', roof: '#2d3047', kind: 'office' },
  { id: 'inbox',    x: 3,  y: 2,  w: 5, h: 4, door: 5,  label: 'INBOX', roof: '#e4572e', kind: 'house' },
  { id: 'calendar', x: 3,  y: 10, w: 5, h: 4, door: 5,  label: 'CALENDAR', roof: '#17bebb', kind: 'house' },
  { id: 'money',    x: 3,  y: 19, w: 5, h: 4, door: 5,  label: 'MONEY', roof: '#2e933c', kind: 'house' },
  { id: 'content',  x: 40, y: 2,  w: 5, h: 4, door: 42, label: 'CONTENT', roof: '#9c51b6', kind: 'house' },
  { id: 'health',   x: 40, y: 10, w: 5, h: 4, door: 42, label: 'HEALTH', roof: '#f4a259', kind: 'house' },
  { id: 'projects', x: 40, y: 19, w: 5, h: 4, door: 42, label: 'PROJECTS', roof: '#3d5a80', kind: 'house' },
];

export const PLAZA = { x: 18, y: 9, w: 12, h: 6 };
export const FOUNTAIN = { x: 23, y: 11, w: 2, h: 2 };
export const POND = { x: 10, y: 24, w: 7, h: 4 };

// Approximate public API prices ($ per 1M tokens) for the spend meter.
export const PRICES = {
  'claude-opus-5-5':   { in: 4,   out: 20 },
  'claude-sonnet-5-5': { in: 2,   out: 10 },
  'claude-haiku-5-5':  { in: 0.1, out: 0.5 },
  'claude-fable-5-1':  { in: 10,  out: 50 },
};
