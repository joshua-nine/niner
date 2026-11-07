// Kingdom state: tasks, approvals, chats, settings.
// Saved to localStorage on every change, and (when signed in) synced to
// your account so your phone and computer share one kingdom (see sync.js).
//
// Sync-friendly by design:
//  • every task / approval carries an `updated` timestamp, so two devices
//    can merge their changes record by record instead of overwriting;
//  • ids are unique across devices; deletes are tombstones (`deleted`);
//  • API usage is counted per device and summed;
//  • the API key never leaves this device.
import { DEFAULT_AGENTS, MAYOR } from './config.js';
import { mergeTreasury } from './treasury.js';   // used only when merging (call time)

const KEY = 'agent-village-v1';
const VERSION = 4;   // 2 = the Kingdom, 3 = sync + the Queen's supervision, 4 = better routing words
const listeners = new Set();

export const deviceId = (() => {
  try {
    let id = localStorage.getItem('agent-kingdom-device');
    if (!id) { id = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem('agent-kingdom-device', id); }
    return id;
  } catch { return 'd' + Math.random().toString(36).slice(2, 10); }
})();

function fresh() {
  return {
    mayorName: MAYOR.name,
    agents: structuredClone(DEFAULT_AGENTS),
    tasks: [],
    approvals: [],
    log: [],
    chats: {},          // agentId -> [{ role: 'user'|'assistant', text, ts }]
    townhall: [],       // [{ from, text, ts }]
    settings: { apiKey: '', model: 'claude-opus-5-5', effort: 'low', autoWork: true },
    usageByDevice: {},  // deviceId -> { input, output, cost, calls }
    treasury: null,     // the Royal Treasury (treasury.js creates it on first use)
    metaUpdated: 0,     // when name / court / settings last changed
    version: VERSION,
  };
}

function migrate(saved, s) {
  const v = saved.version || 1;
  if (v < 2) {                                   // Village → Kingdom
    s.agents = structuredClone(DEFAULT_AGENTS);
    if (!s.mayorName || s.mayorName === 'Mayor') s.mayorName = MAYOR.name;
  }
  if (v < 3) {                                   // the Queen becomes moral support + overseer
    const q = s.agents.find(a => a.id === 'chief');
    const def = DEFAULT_AGENTS.find(a => a.id === 'chief');
    if (q && def) { q.role = def.role; q.instructions = def.instructions; }
    if (saved.usage) s.usageByDevice = { [deviceId]: saved.usage };
    delete s.usage; delete s.seq;
    const now = Date.now();
    for (const t of s.tasks) t.updated ||= t.created || now;
    for (const a of s.approvals) { a.updated ||= a.resolved || a.created || now; a.stage ||= 'king'; }
  }
  if (v < 4) {                                   // add new routing words, keep the King's own edits
    for (const a of s.agents) {
      const def = DEFAULT_AGENTS.find(d => d.id === a.id);
      if (def) a.keywords = [...new Set([...(a.keywords || []), ...def.keywords])];
    }
    s.metaUpdated = Date.now();
  }
  s.version = VERSION;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw);
    const s = { ...fresh(), ...saved };
    s.settings = { ...fresh().settings, ...s.settings };
    if ((saved.version || 1) < VERSION) {
      migrate(saved, s);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    }
    return s;
  } catch { return fresh(); }
}

export const state = load();

// ── Persistence ──────────────────────────────────────────────
let saveTimer = null;
export const persistHooks = { push: null };   // set by sync.js
export function save({ local = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, 150);
  if (!local && persistHooks.push) persistHooks.push();
  listeners.forEach(fn => fn());
}
export function onChange(fn) { listeners.add(fn); }

// Name, court edits and settings: last edit wins across devices.
export function touchMeta() { state.metaUpdated = Date.now(); save(); }

// Unique across devices: prefix + time + random, e.g. "Tlx3k9a".
export const uid = (p) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;

export function agentById(id) {
  if (id === 'mayor') return { ...MAYOR, name: state.mayorName };
  for (const a of state.agents) {
    if (a.id === id) return a;
    if (a.intern && a.intern.id === id) return { ...a.intern, kind: 'intern', boss: a.id, role: `Helper to ${a.name}`, house: a.house };
  }
  return null;
}

export function allPeople() {
  const out = [agentById('mayor')];
  for (const a of state.agents) {
    out.push(a);
    if (a.intern) out.push(agentById(a.intern.id));
  }
  return out;
}

export function log(who, text, kind = 'info') {
  state.log.unshift({ who, text, kind, ts: Date.now() });
  state.log.length = Math.min(state.log.length, 200);
  save();
}

// ── API usage (per device, summed) ───────────────────────────
export function addUsage(inTok, outTok, cost) {
  const u = (state.usageByDevice[deviceId] ||= { input: 0, output: 0, cost: 0, calls: 0 });
  u.input += inTok; u.output += outTok; u.cost += cost; u.calls += 1;
  save();
}
export function totalUsage() {
  const t = { input: 0, output: 0, cost: 0, calls: 0 };
  for (const u of Object.values(state.usageByDevice || {})) for (const k in t) t[k] += u[k] || 0;
  return t;
}

// ── Tasks ────────────────────────────────────────────────────
// Status flow: todo → doing → review (the Queen checks it) → done
//              … or → needs_approval (the King seals it) → done / declined
export const liveTasks = () => state.tasks.filter(t => !t.deleted);

// A short line from a courtier in their own chat (task news, results…),
// so each courtier's personal page shows what they've been given and done.
export function chatNote(agentId, text) {
  if (!agentId || agentId === 'mayor') return;
  (state.chats[agentId] ||= []).push({ role: 'assistant', text, ts: Date.now(), note: true });
  save();
}

export function addTask({ title, owner, notes = '', by = 'mayor', quiet = false }) {
  const now = Date.now();
  const t = { id: uid('T'), title, owner, notes, by, status: 'todo', progress: 0, created: now, updated: now, result: '', revisions: 0 };
  state.tasks.unshift(t);
  log(owner, `New task: ${title}`, 'task');
  if (!quiet) chatNote(owner, by === 'mayor'
    ? `📜 New task from you: “${title}”. I'll head home and get to work.`
    : `📜 New task from ${agentById(by)?.name || by}: “${title}”.`);
  save();
  return t;
}

export function updateTask(id, patch) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { Object.assign(t, patch, { updated: Date.now() }); save(); }
  return t;
}

export function deleteTask(id) { updateTask(id, { deleted: true }); }

export const openTasksFor = (owner) =>
  liveTasks().filter(t => t.owner === owner && (t.status === 'todo' || t.status === 'doing'));

// ── Approvals (Step 7: human-in-the-loop) ────────────────────
// stage 'queen' = waiting for the Queen's review; 'king' = in your queue.
export function requestApproval({ from, kind, summary, details = {}, taskId = null }) {
  const now = Date.now();
  const stage = from === 'chief' ? 'king' : 'queen';
  const a = { id: uid('A'), from, kind, summary, details, taskId, status: 'pending', stage, created: now, updated: now };
  state.approvals.unshift(a);
  if (taskId) updateTask(taskId, { status: 'needs_approval' });
  log(from, `Drafted a petition (${kind}): ${summary}${stage === 'queen' ? '. The Queen is reviewing it' : ''}`, 'approval');
  save();
  return a;
}

export function updateApproval(id, patch) {
  const a = state.approvals.find(x => x.id === id);
  if (a) { Object.assign(a, patch, { updated: Date.now() }); save(); }
  return a;
}

export function resolveApproval(id, approved, note = '') {
  const a = state.approvals.find(x => x.id === id);
  if (!a || a.status !== 'pending') return null;
  updateApproval(id, { status: approved ? 'approved' : 'declined', resolved: Date.now(), note });
  if (a.taskId) updateTask(a.taskId, { status: approved ? 'done' : 'declined' });
  log('mayor', `${approved ? 'Sealed' : 'Declined'}: ${a.summary}`, approved ? 'ok' : 'warn');
  return a;
}

// Only petitions the Queen has already reviewed reach the King.
export const pendingApprovals = () => state.approvals.filter(a => a.status === 'pending' && (a.stage || 'king') === 'king');

// ── Merging another device's copy (used by sync.js) ──────────
const stamp = (r) => r.updated || r.resolved || r.created || 0;
function mergeById(mine = [], theirs = [], cap) {
  const map = new Map(mine.map(r => [r.id, r]));
  for (const r of theirs) { const m = map.get(r.id); if (!m || stamp(r) > stamp(m)) map.set(r.id, r); }
  return [...map.values()].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, cap);
}
function mergeList(mine = [], theirs = [], key, cap, newestFirst) {
  const map = new Map();
  for (const r of [...mine, ...theirs]) map.set(key(r), r);
  const out = [...map.values()].sort((a, b) => newestFirst ? b.ts - a.ts : a.ts - b.ts);
  return newestFirst ? out.slice(0, cap) : out.slice(-cap);
}

// Pure: returns the merge of two kingdom states. `local` keeps its API key.
export function mergeStates(local, remote) {
  const out = { ...local };
  out.tasks = mergeById(local.tasks, remote.tasks, 400);
  out.approvals = mergeById(local.approvals, remote.approvals, 300);
  out.log = mergeList(local.log, remote.log, r => `${r.ts}|${r.who}|${r.text}`, 200, true);
  out.chats = { ...local.chats };
  for (const [id, msgs] of Object.entries(remote.chats || {}))
    out.chats[id] = mergeList(local.chats?.[id], msgs, m => `${m.ts}|${m.role}|${(m.text || '').slice(0, 60)}`, 120, false);
  const lastTs = (l) => (l && l.length ? l[l.length - 1].ts : 0);
  out.townhall = lastTs(remote.townhall) > lastTs(local.townhall) ? remote.townhall : local.townhall;
  out.usageByDevice = { ...remote.usageByDevice, ...local.usageByDevice };
  for (const [d, u] of Object.entries(remote.usageByDevice || {}))
    if (!local.usageByDevice?.[d] || (u.calls || 0) > (local.usageByDevice[d].calls || 0)) out.usageByDevice[d] = u;
  if ((remote.metaUpdated || 0) > (local.metaUpdated || 0)) {
    out.mayorName = remote.mayorName;
    out.agents = remote.agents;
    out.settings = { ...local.settings, ...remote.settings, apiKey: local.settings.apiKey };
    out.metaUpdated = remote.metaUpdated;
  }
  out.treasury = mergeTreasury(local.treasury, remote.treasury);
  out.inboxSeen = { ...(remote.inboxSeen || {}), ...(local.inboxSeen || {}) };   // inbox items applied on any device
  out.version = Math.max(local.version || 0, remote.version || 0);
  return out;
}

export function applyMerged(merged) {
  for (const k of Object.keys(state)) if (!(k in merged)) delete state[k];
  Object.assign(state, merged);
  save({ local: true });
}

// What gets uploaded: everything except this device's API key.
export function shareable() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.apiKey = '';
  return copy;
}

// ── Reset / import / export ──────────────────────────────────
export function resetVillage() {
  const s = fresh();
  s.settings.apiKey = state.settings.apiKey;
  // Tombstone everything so a reset also clears your other devices.
  const now = Date.now();
  s.tasks = state.tasks.map(t => ({ ...t, deleted: true, updated: now }));
  s.approvals = state.approvals.map(a => ({ ...a, status: a.status === 'pending' ? 'withdrawn' : a.status, updated: now }));
  s.metaUpdated = now;
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, s);
  save();
}

export function exportState() { return JSON.stringify(shareable(), null, 2); }

export function importState(json) {
  const incoming = JSON.parse(json);
  const s = { ...fresh(), ...incoming };
  s.settings = { ...fresh().settings, ...incoming.settings, apiKey: state.settings.apiKey };
  if ((incoming.version || 1) < VERSION) migrate(incoming, s);
  s.metaUpdated = Date.now();
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, s);
  save();
}
