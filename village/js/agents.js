// Step 4: Make them move. Each courtier runs a small state machine:
//   idle → choose a goal → walk (A*, yielding to others) → do the thing.
// Directors walk home to work on tasks, then report to the Queen.
// The Queen carries petitions awaiting the royal seal to the King's Keep.
// Apprentices, squires, the owl and the whelp run errands meanwhile.
import { MAP } from './config.js';
import { doorSpot, walkable, plazaSpots, meetingSpots, randomWalkableNear, size } from './world.js';
import { findPath, tileKey } from './path.js';
import { drawPerson, drawLabel, drawBubble, drawIcon, spriteHeight } from './sprites.js';
import { state, allPeople, agentById, openTasksFor, updateTask, pendingApprovals, log } from './store.js';

const T = size.T, S = MAP.scale;
const WORK_SECONDS = 22;
const WORK_ICON = { wizard: '🔮', apprentice: '🔮', dragon: '💰', whelp: '💰', owl: '✉️', queen: '📜', princess: '📯', prince: '🗺️', duchess: '🍲', squire: '🛡️', jester: '🎭' };
const ROYAL = new Set(['queen', 'princess', 'prince', 'duchess']);

export const sims = new Map();
// canWork: only one of your devices does the work when you're signed in on several.
export const hooks = { onTaskWorked: async () => {}, canWork: () => true, visitLine: () => '', delegate: () => null };
let meeting = null;           // { spots: Map<id, tile> }

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function homeSpot(p) { return doorSpot(p.house); }

export function initAgents() {
  const existing = new Set(sims.keys());
  for (const p of allPeople()) {
    existing.delete(p.id);
    if (sims.has(p.id)) continue;
    const start = randomWalkableNear(homeSpot(p).x, homeSpot(p).y + 1, 2);
    sims.set(p.id, {
      id: p.id, x: start.x, y: start.y, tx: start.x, ty: start.y,
      path: [], next: null, goal: null, state: 'idle', timer: rand(0.5, 3),
      dir: 'down', frame: 0, anim: 0, wait: 0, bubble: null, icon: null,
      speed: p.kind === 'intern' ? 3.6 : 3.0, task: null, after: null,
    });
  }
  for (const id of existing) sims.delete(id);   // removed agents
}

// ── Occupancy (no clipping through each other) ───────────────
function occupied(exceptId) {
  const set = new Set();
  for (const s of sims.values()) {
    if (s.id === exceptId) continue;
    set.add(tileKey(s.tx, s.ty));
    if (s.next) set.add(tileKey(s.next.x, s.next.y));
  }
  return set;
}
function claimedGoals(exceptId) {
  const set = new Set();
  for (const s of sims.values()) if (s.id !== exceptId && s.goal) set.add(tileKey(s.goal.x, s.goal.y));
  return set;
}
// Nearest free tile to `spot` that nobody stands on or is heading to.
function freeNear(id, spot) {
  const taken = new Set([...occupied(id), ...claimedGoals(id)]);
  for (let r = 0; r <= 4; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = spot.x + dx, y = spot.y + dy;
      if (walkable(x, y) && !taken.has(tileKey(x, y))) return { x, y };
    }
  return spot;
}

function goTo(s, spot, then, { exact = false } = {}) {
  const target = exact ? spot : freeNear(s.id, spot);
  const path = findPath({ x: s.tx, y: s.ty }, target);
  if (!path) { s.state = 'idle'; s.timer = rand(1, 2); return false; }
  s.goal = target; s.path = path; s.state = 'walk'; s.after = then; s.wait = 0;
  return true;
}

export function setIcon(id, icon) { const s = sims.get(id); if (s) s.icon = icon; }

export function say(id, text, secs = 4, exclusive = false) {
  if (exclusive) for (const o of sims.values()) o.bubble = null;   // one speaker at a time
  const s = sims.get(id);
  if (s) s.bubble = { text, until: performance.now() + secs * 1000 };
}

// ── Decide what to do next ───────────────────────────────────
function plan(s) {
  const p = agentById(s.id);
  if (!p) return;
  s.icon = null;

  if (meeting) {
    const seat = meeting.spots.get(s.id);
    if (seat && (s.tx !== seat.x || s.ty !== seat.y)) { goTo(s, seat, () => { s.state = 'meeting'; s.dir = 'up'; }, { exact: true }); return; }
    s.state = 'meeting'; s.dir = 'up'; return;
  }

  if (p.kind === 'mayor') {
    if (Math.random() < 0.25) goTo(s, pick(plazaSpots()), () => rest(s, 4, 9));
    else goTo(s, homeSpot(p), () => rest(s, 6, 14));
    return;
  }

  // Anyone with work (Chief, directors, interns) walks to their desk.
  const task = openTasksFor(p.id)[0];
  if (task && p.kind === 'chief' && hooks.canWork()) {      // the Queen hands work out
    const to = hooks.delegate(task);
    if (to) { s.icon = '📜'; say(s.id, `${to.name}, this one is yours: “${task.title}”.`, 5); rest(s, 2, 4); return; }
  }
  if (task && p.kind !== 'mayor') {
    goTo(s, homeSpot(p), () => {
      s.state = 'work'; s.task = task.id; s.icon = WORK_ICON[p.look] || '📜'; s.dir = 'up';
      updateTask(task.id, { status: 'doing' });
    }, { exact: p.kind === 'director' });
    return;
  }

  if (p.kind === 'chief') {
    const pending = pendingApprovals().length;
    if (pending && (!s.lastDelivery || performance.now() - s.lastDelivery > 45000)) {
      goTo(s, doorSpot('mayor'), () => {
        s.lastDelivery = s.lastVisit = performance.now();
        s.icon = '📋';
        say(s.id, `Your Majesty, ${pending} petition${pending > 1 ? 's await' : ' awaits'} your royal seal. I've reviewed each one.`, 5);
        rest(s, 4, 6);
      });
      return;
    }
    // Moral support: every few minutes she walks over just to check on you.
    if (!s.lastVisit) s.lastVisit = performance.now() - 120000;
    if (performance.now() - s.lastVisit > 200000) {
      goTo(s, doorSpot('mayor'), () => {
        s.lastVisit = performance.now();
        s.icon = '💜';
        say(s.id, hooks.visitLine(), 6);
        rest(s, 5, 8);
      });
      return;
    }
    if (Math.random() < 0.5) goTo(s, homeSpot(p), () => { s.icon = '📜'; rest(s, 5, 10); });
    else goTo(s, pick(plazaSpots()), () => rest(s, 3, 7));
    return;
  }

  if (p.kind === 'director') {
    const r = Math.random();
    if (r < 0.45) goTo(s, homeSpot(p), () => rest(s, 5, 12), { exact: true });
    else if (r < 0.8) goTo(s, pick(plazaSpots()), () => rest(s, 3, 8));
    else {
      const other = pick(state.agents.filter(a => a.id !== p.id));
      goTo(s, doorSpot(other.house), () => { say(s.id, pick(['A word, friend?', 'How fares your list?', 'Hail and well met!', 'Mead later?', 'Any news from court?']), 3); rest(s, 3, 5); });
    }
    return;
  }

  if (p.kind === 'intern') {
    const boss = sims.get(p.boss);
    if (boss && boss.state === 'work') {
      const b = pick(['townhall', 'chief', ...state.agents.map(a => a.house)]);
      goTo(s, doorSpot(b), () => { s.icon = '✉️'; rest(s, 1, 3); });
    } else if (boss) {
      goTo(s, { x: boss.tx, y: boss.ty + 1 }, () => rest(s, 2, 5));
    } else rest(s, 2, 4);
  }
}

function rest(s, a, b) { s.state = 'idle'; s.timer = rand(a, b); s.goal = s.goal; }

// ── Per-frame update ─────────────────────────────────────────
export function update(dt) {
  for (const s of sims.values()) {
    if (s.bubble && performance.now() > s.bubble.until) s.bubble = null;

    if (s.state === 'idle') {
      s.timer -= dt;
      if (s.timer <= 0) { s.goal = null; plan(s); }
    } else if (s.state === 'walk') {
      stepWalk(s, dt);
    } else if (s.state === 'work') {
      const task = state.tasks.find(t => t.id === s.task);
      if (!task || task.status !== 'doing') { s.state = 'idle'; s.timer = 0.5; continue; }
      if (!hooks.canWork()) continue;          // another of your devices is doing the work
      task.progress = Math.min(1, (task.progress || 0) + dt / WORK_SECONDS);
      if (task.progress >= 1) finishWork(s, task);
    } else if (s.state === 'meeting' && !meeting) {
      s.state = 'idle'; s.timer = rand(0.5, 2);
    }
  }
}

async function finishWork(s, task) {
  s.state = 'thinking'; s.icon = '🤔';
  let summary = '';
  try { summary = await hooks.onTaskWorked(s.id, task); }
  catch (e) { summary = `Hit a snag: ${e.message}`; log(s.id, `Error while working: ${e.message}`, 'warn'); }
  // Report to the Chief of Staff in person.
  s.icon = '📯';
  goTo(s, doorSpot('chief'), () => {
    say(s.id, summary ? `Report: ${summary}` : `Finished “${task.title}”.`, 5);
    say('chief', 'Well done. It is recorded.', 3);
    rest(s, 3, 5);
  });
}

function stepWalk(s, dt) {
  if (!s.next) {
    if (!s.path.length) { s.state = 'arrived'; s.next = null; const f = s.after; s.after = null; s.state = 'idle'; s.timer = 0.3; if (f) f(); return; }
    const n = s.path[0];
    if (occupied(s.id).has(tileKey(n.x, n.y))) {
      s.wait += dt;
      if (s.wait > 0.7) {                     // try to route around
        const alt = findPath({ x: s.tx, y: s.ty }, s.goal, occupied(s.id));
        if (alt && alt.length) { s.path = alt; s.wait = 0.35; }
        else if (s.wait > 3) { s.path = []; s.after = null; s.state = 'idle'; s.timer = rand(0.5, 1.5); }
      }
      return;
    }
    s.wait = 0;
    s.next = s.path.shift();
    s.dir = s.next.x > s.tx ? 'right' : s.next.x < s.tx ? 'left' : s.next.y > s.ty ? 'down' : 'up';
    if (s.dir === 'left' || s.dir === 'right') s.face = s.dir;
  }
  const dx = s.next.x - s.x, dy = s.next.y - s.y;
  const dist = Math.hypot(dx, dy), stepLen = s.speed * dt;
  s.anim += dt;
  if (dist <= stepLen) { s.x = s.tx = s.next.x; s.y = s.ty = s.next.y; s.next = null; }
  else { s.x += (dx / dist) * stepLen; s.y += (dy / dist) * stepLen; }
}

// ── Town Hall (Step 6) ───────────────────────────────────────
export function startMeeting() {
  const seats = meetingSpots();
  const order = ['mayor', 'chief', ...state.agents.filter(a => a.kind === 'director').map(a => a.id),
    ...state.agents.filter(a => a.intern).map(a => a.intern.id)];
  meeting = { spots: new Map() };
  order.forEach((id, i) => { if (seats[i]) meeting.spots.set(id, seats[i]); });
  for (const s of sims.values()) { s.state = 'idle'; s.timer = Math.random() * 0.8; s.path = []; s.next = null; s.after = null; s.goal = null; }
}
export function endMeeting() { meeting = null; }
export const inMeeting = () => !!meeting;

// The King can be steered by clicking the map.
export function moveMayorTo(tile) {
  const s = sims.get('mayor');
  if (s && walkable(tile.x, tile.y)) goTo(s, tile, () => rest(s, 15, 25));
}

export function busyHouses() {
  const set = new Set();
  for (const s of sims.values()) if (s.state === 'work') { const p = agentById(s.id); if (p) set.add(p.house); }
  return set;
}

// ── Render ───────────────────────────────────────────────────
export function render(ctx, selectedId) {
  const list = [...sims.values()].sort((a, b) => a.y - b.y);
  for (const s of list) {
    const p = agentById(s.id);
    if (!p) continue;
    const cx = s.x * T + T / 2, by = (s.y + 1) * T - S;
    const moving = s.state === 'walk' && s.next;
    const frame = moving ? Math.floor(s.anim * 8) : 0;
    if (s.id === selectedId) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = S;
      ctx.beginPath(); ctx.ellipse(cx, by - S, 7 * S, 2.6 * S, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const sideways = p.look === 'dragon' || p.look === 'whelp';     // dragons are drawn side-on
    drawPerson(ctx, cx, by, p, sideways ? (s.face || 'right') : s.dir, frame, p.kind === 'intern');
    const labelColor = p.kind === 'mayor' ? '#ffd23f' : ROYAL.has(p.look) ? '#f7c6ff' : p.look === 'wizard' ? '#9ad1ff' : p.look === 'dragon' ? '#9cf09c' : '#ffffff';
    drawLabel(ctx, cx, by + 4 * S, p.name, labelColor);
    const headY = by - spriteHeight(p, p.kind === 'intern') + 2 * S;
    if (s.state === 'work') {
      const task = state.tasks.find(t => t.id === s.task);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - 8 * S, headY - 12 * S, 16 * S, 2 * S);
      ctx.fillStyle = '#00ff88'; ctx.fillRect(cx - 8 * S, headY - 12 * S, 16 * S * (task?.progress || 0), 2 * S);
    }
    if (s.bubble) drawBubble(ctx, cx, headY, s.bubble.text);
    else if (s.icon) drawIcon(ctx, cx, headY - 4 * S, s.icon);
  }
}

export function agentAt(px, py) {
  let best = null, bd = Infinity;
  for (const s of sims.values()) {
    const cx = s.x * T + T / 2, cy = (s.y + 0.4) * T;
    const d = Math.hypot(px - cx, py - cy);
    if (d < T * 0.9 && d < bd) { bd = d; best = s.id; }
  }
  return best;
}
