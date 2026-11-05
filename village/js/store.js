// Village state: tasks, approvals, chats, settings. Persisted to localStorage.
import { DEFAULT_AGENTS, MAYOR } from './config.js';

const KEY = 'agent-village-v1';
const VERSION = 2;   // 2 = the Kingdom
const listeners = new Set();

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
    usage: { input: 0, output: 0, cost: 0, calls: 0 },
    seq: 1,
    version: VERSION,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw);
    const s = { ...fresh(), ...saved };
    s.settings = { ...fresh().settings, ...s.settings };
    // Village → Kingdom: bring in the new court, keep tasks/chats/settings.
    if ((saved.version || 1) < VERSION) {
      s.agents = structuredClone(DEFAULT_AGENTS);
      if (!s.mayorName || s.mayorName === 'Mayor') s.mayorName = MAYOR.name;
      s.version = VERSION;
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    }
    return s;
  } catch { return fresh(); }
}

export const state = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, 150);
  listeners.forEach(fn => fn());
}

export function onChange(fn) { listeners.add(fn); }

export const uid = (p) => `${p}${state.seq++}`;

export function agentById(id) {
  if (id === 'mayor') return { ...MAYOR, name: state.mayorName };
  for (const a of state.agents) {
    if (a.id === id) return a;
    if (a.intern && a.intern.id === id) return { ...a.intern, kind: 'intern', boss: a.id, role: `Intern to ${a.name}`, house: a.house };
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

// ── Tasks ────────────────────────────────────────────────────
export function addTask({ title, owner, notes = '', by = 'mayor' }) {
  const t = { id: uid('T'), title, owner, notes, by, status: 'todo', progress: 0, created: Date.now(), result: '' };
  state.tasks.unshift(t);
  log(owner, `New task: ${title}`, 'task');
  save();
  return t;
}

export function updateTask(id, patch) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { Object.assign(t, patch); save(); }
  return t;
}

export const openTasksFor = (owner) =>
  state.tasks.filter(t => t.owner === owner && (t.status === 'todo' || t.status === 'doing'));

// ── Approvals (Step 7: human-in-the-loop) ────────────────────
export function requestApproval({ from, kind, summary, details = {}, taskId = null }) {
  const a = { id: uid('A'), from, kind, summary, details, taskId, status: 'pending', created: Date.now() };
  state.approvals.unshift(a);
  if (taskId) updateTask(taskId, { status: 'needs_approval' });
  log(from, `Needs your approval (${kind}): ${summary}`, 'approval');
  save();
  return a;
}

export function resolveApproval(id, approved, note = '') {
  const a = state.approvals.find(x => x.id === id);
  if (!a || a.status !== 'pending') return null;
  a.status = approved ? 'approved' : 'declined';
  a.resolved = Date.now();
  a.note = note;
  if (a.taskId) updateTask(a.taskId, { status: approved ? 'done' : 'declined' });
  log('mayor', `${approved ? 'Approved' : 'Declined'}: ${a.summary}`, approved ? 'ok' : 'warn');
  save();
  return a;
}

export const pendingApprovals = () => state.approvals.filter(a => a.status === 'pending');

export function resetVillage() {
  const s = fresh();
  s.settings.apiKey = state.settings.apiKey;
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, s);
  save();
}

export function exportState() {
  const copy = structuredClone(state);
  copy.settings.apiKey = '';
  return JSON.stringify(copy, null, 2);
}

export function importState(json) {
  const incoming = JSON.parse(json);
  const key = state.settings.apiKey;
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, fresh(), incoming);
  state.settings = { ...fresh().settings, ...incoming.settings, apiKey: key };
  save();
}
