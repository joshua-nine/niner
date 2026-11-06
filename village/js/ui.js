// Side panel: Talk, To-Do, Approvals, Royal Court, Kingdom settings.
import { GROUND_RULES } from './config.js';
import {
  state, save, onChange, agentById, allPeople, addTask, updateTask, resolveApproval,
  pendingApprovals, log, resetVillage, exportState, importState, touchMeta, deleteTask,
  liveTasks, totalUsage,
} from './store.js';
import { sync, onSyncChange, signIn, signUp, signOutSync, resetPassword, friendlyAuthError } from './sync.js';
import { chat, townhallTurn, hasKey, routeDirector } from './brain.js';
import { say, startMeeting, endMeeting, inMeeting, initAgents, sims } from './agents.js';

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const dot = (p) => h('span', { class: 'dot', style: `background:${p.shirt}` });
const chipFor = (id) => { const p = agentById(id); return p ? h('span', { class: 'chip small' }, dot(p), p.name) : id; };
const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const ui = { selected: 'chief', onSelect: () => {} };

export function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

// ── Tabs ─────────────────────────────────────────────────────
export function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
}

// ── Talk ─────────────────────────────────────────────────────
export function selectAgent(id, focus = true) {
  if (id === 'mayor') id = 'chief';
  ui.selected = id;
  ui.onSelect(id);
  renderPeople(); renderChat();
  showTab('chat');
  if (focus) $('#chat-input').focus({ preventScroll: true });
}

function renderPeople() {
  const box = $('#people'); box.replaceChildren();
  for (const p of allPeople()) {
    if (p.id === 'mayor') continue;
    box.append(h('button', { class: `chip${p.id === ui.selected ? ' active' : ''}`, onclick: () => selectAgent(p.id) }, dot(p), p.name));
  }
}

let typing = new Set();
function renderChat() {
  const p = agentById(ui.selected);
  $('#who').replaceChildren(h('b', {}, p.name), ` — ${p.role}`);
  $('#queen-quick').classList.toggle('hidden', p.id !== 'chief');
  const logEl = $('#chat-log'); logEl.replaceChildren();
  const hist = state.chats[ui.selected] || [];
  if (!hist.length) logEl.append(h('div', { class: 'msg assistant' }, h('span', { class: 'from' }, p.name),
    p.kind === 'chief'
      ? `Your Majesty, I am ${p.name}, your Queen and Chief of Staff. Tell me what you need and I'll send it to the right member of the court.`
      : p.look === 'dragon' ? `*a rumble of smoke* Your Majesty. I am ${p.name}, ${p.role}. Not a coin leaves my hoard without your seal. What do you need?`
      : `Hail, Your Majesty! I am ${p.name}, ${p.role}. What may I take off your hands?`));
  for (const m of hist) logEl.append(h('div', { class: `msg ${m.role}` },
    h('span', { class: 'from' }, m.role === 'user' ? state.mayorName : p.name, ' · ', timeStr(m.ts)), m.text));
  if (typing.has(ui.selected)) logEl.append(h('div', { class: 'msg assistant typing' }, `${p.name} is thinking…`));
  logEl.scrollTop = logEl.scrollHeight;
}

async function sendChat(e) {
  e.preventDefault();
  const input = $('#chat-input'); const text = input.value.trim();
  if (!text) return;
  const id = ui.selected;
  input.value = '';
  typing.add(id);
  state.chats[id] ||= [];
  renderChat();
  say(id, '…', 30);
  const reply = await chat(id, text);
  typing.delete(id);
  say(id, reply, 6);
  renderChat();
}

// ── To-Do ────────────────────────────────────────────────────
function fillOwnerSelects() {
  const owners = allPeople().filter(p => p.id !== 'mayor');
  const sel = $('#task-owner'), filt = $('#task-filter-owner');
  const keep = filt.value, keepOwner = sel.value || 'auto';
  sel.replaceChildren(h('option', { value: 'auto' }, '👑 Let the Queen assign it'),
    ...owners.filter(p => p.id !== 'chief').map(p => h('option', { value: p.id }, `${p.name} (${p.role})`)));
  sel.value = [...sel.options].some(o => o.value === keepOwner) ? keepOwner : 'auto';
  filt.replaceChildren(h('option', { value: '' }, 'Everyone'), ...owners.map(p => h('option', { value: p.id }, p.name)));
  filt.value = keep;
}

function renderTasks() {
  const owner = $('#task-filter-owner').value, status = $('#task-filter-status').value;
  const OPEN = ['todo', 'doing', 'review'];
  const list = liveTasks().filter(t => (!owner || t.owner === owner) && (
    status === 'all' || (status === 'open' ? OPEN.includes(t.status) : t.status === status)));
  const box = $('#task-list'); box.replaceChildren();
  if (!list.length) box.append(h('p', { class: 'note' }, 'Nothing here. Ask the Queen for something, or add a task above.'));
  for (const t of list.slice(0, 80)) {
    box.append(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, t.title), h('span', { class: `status ${t.status}` }, STATUS_LABEL[t.status] || t.status)),
      h('div', { class: 'card-top' }, chipFor(t.owner), h('span', { class: 'meta' }, `${t.id} · from ${agentById(t.by)?.name || t.by} · ${timeStr(t.created)}`)),
      t.status === 'doing' ? h('div', { class: 'progress' }, h('i', { style: `width:${Math.round((t.progress || 0) * 100)}%` })) : null,
      t.notes ? h('div', { class: 'meta' }, t.notes) : null,
      t.result ? h('div', { class: 'result' }, t.result) : null,
      t.queenNote ? h('div', { class: 'queen-note' }, `👑 ${agentById('chief')?.name || 'The Queen'}: ${t.queenNote}`) : null,
      h('div', { class: 'btn-row' },
        t.status !== 'done' ? h('button', { class: 'btn btn-ghost', onclick: () => { updateTask(t.id, { status: 'done', progress: 1 }); log('mayor', `Marked done: ${t.title}`, 'ok'); } }, 'Mark done') : null,
        h('button', { class: 'btn btn-ghost', onclick: () => deleteTask(t.id) }, 'Delete'),
      ),
    ));
  }
}

const STATUS_LABEL = { todo: 'to do', doing: 'doing', review: 'queen reviewing', needs_approval: 'awaits your seal', done: 'done', declined: 'declined' };

// ── Approvals (Step 7) ───────────────────────────────────────
const FIELDS = {
  email: [['to', 'To'], ['subject', 'Subject'], ['body', 'Body', true]],
  post: [['platform', 'Platform'], ['body', 'Post text', true]],
  spend: [['amount', 'Amount ($)'], ['body', 'Details', true]],
  calendar: [['subject', 'Event title'], ['when', 'Start (YYYY-MM-DDTHH:MM)'], ['duration_minutes', 'Minutes'], ['body', 'Description', true]],
  other: [['body', 'Details', true]],
};
const ICON = { email: '✉️', post: '📣', spend: '💳', calendar: '📅', other: '📝' };

function gcalDates(when, mins) {
  const d = new Date(when);
  if (isNaN(d)) return '';
  const end = new Date(d.getTime() + (Number(mins) || 30) * 60000);
  const f = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
  return `${f(d)}/${f(end)}`;
}

// The human performs the final action. We only open a pre-filled draft.
function carryOut(a) {
  const d = a.details;
  if (a.kind === 'email') {
    const u = new URL('https://mail.google.com/mail/');
    u.search = new URLSearchParams({ view: 'cm', fs: '1', to: d.to || '', su: d.subject || '', body: d.body || '' });
    window.open(u, '_blank', 'noopener');
    toast('Opened a Gmail draft. Review it and press Send yourself.');
  } else if (a.kind === 'calendar') {
    const u = new URL('https://calendar.google.com/calendar/render');
    const p = { action: 'TEMPLATE', text: d.subject || a.summary, details: d.body || '' };
    const dates = gcalDates(d.when, d.duration_minutes); if (dates) p.dates = dates;
    u.search = new URLSearchParams(p);
    window.open(u, '_blank', 'noopener');
    toast('Opened Google Calendar. Click Save there to add it.');
  } else if (a.kind === 'post') {
    navigator.clipboard?.writeText(d.body || '').then(() => toast('Post copied. Paste it wherever you want to publish.'), () => toast('Copy the post text manually.'));
  } else if (a.kind === 'spend') {
    toast(`Approved $${d.amount ?? '?'} — make the purchase yourself. No money was moved.`, 4000);
  } else toast('Approved.');
}

let approvalsSig = '';
function renderApprovals(force = false) {
  const pending = pendingApprovals();
  // Don't wipe half-edited drafts: only rebuild when the queue itself changes.
  const sig = state.approvals.map(a => a.id + a.status + (a.stage || '')).join('|');
  if (!force && sig === approvalsSig) return;
  approvalsSig = sig;
  const box = $('#approval-list'); box.replaceChildren();
  if (!pending.length) box.append(h('p', { class: 'note' }, 'No petitions await your seal. 🎉'));
  for (const a of pending) {
    const inputs = {};
    const fields = (FIELDS[a.kind] || FIELDS.other).map(([k, label, big]) => {
      const el = big ? h('textarea', { rows: 5 }) : h('input', {});
      el.value = a.details[k] ?? '';
      inputs[k] = el;
      return h('label', {}, label, el);
    });
    const collect = () => { for (const [k, el] of Object.entries(inputs)) a.details[k] = k === 'amount' || k === 'duration_minutes' ? Number(el.value) || el.value : el.value; };
    box.append(h('div', { class: 'card pending' },
      h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, `${ICON[a.kind] || ''} ${a.summary}`), h('span', { class: 'status pending' }, a.kind)),
      h('div', { class: 'card-top' }, chipFor(a.from), h('span', { class: 'meta' }, `${a.id}${a.taskId ? ' · ' + a.taskId : ''} · ${timeStr(a.created)}`)),
      a.queenNote ? h('div', { class: 'queen-note' }, `👑 Reviewed by ${agentById('chief')?.name || 'the Queen'}: ${a.queenNote}`) : null,
      ...fields,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-gold', onclick: () => { collect(); resolveApproval(a.id, true); carryOut(a); say(a.from, 'Thank you, Your Majesty!', 3); } },
          a.kind === 'email' ? '👑 Seal → open Gmail draft' : a.kind === 'calendar' ? '👑 Seal → open Calendar' : a.kind === 'post' ? '👑 Seal → copy post' : '👑 Approve'),
        h('button', { class: 'btn btn-ghost', onclick: () => { resolveApproval(a.id, false); say(a.from, 'As you wish. It is struck.', 3); } }, 'Decline'),
      ),
    ));
  }
  const hist = $('#approval-history'); hist.replaceChildren();
  const inReview = state.approvals.filter(x => x.status === 'pending' && x.stage === 'queen').length;
  if (inReview) box.prepend(h('p', { class: 'note' }, `👑 The Queen is reviewing ${inReview} more petition${inReview > 1 ? 's' : ''} before ${inReview > 1 ? 'they reach' : 'it reaches'} you.`));
  for (const a of state.approvals.filter(x => x.status !== 'pending').slice(0, 30)) {
    hist.append(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('span', {}, `${ICON[a.kind] || ''} ${a.summary}`), h('span', { class: `status ${a.status}` }, a.status)),
      h('span', { class: 'meta' }, `${agentById(a.from)?.name || a.from} · ${timeStr(a.created)}`)));
  }
  const n = pending.length;
  $('#approvals-count').textContent = n;
  $('#tab-badge').textContent = n; $('#tab-badge').classList.toggle('hidden', !n);
}

// ── Royal Court (Step 6) ───────────────────────────────────────
let meetingBusy = false;
function renderTownhall() {
  const box = $('#th-log'); box.replaceChildren();
  if (!state.townhall.length) box.append(h('p', { class: 'note' }, 'Summon the court and everyone gathers before the Great Hall. The Queen opens, then each member of the court speaks in turn.'));
  for (const m of state.townhall) {
    const p = agentById(m.from);
    if (m.from === 'topic') { box.append(h('div', { class: 'msg user' }, h('span', { class: 'from' }, `${state.mayorName} · topic`), m.text)); continue; }
    box.append(h('div', { class: 'msg assistant' }, h('span', { class: 'from' }, p ? `${p.name} · ${p.role}` : m.from), m.text));
  }
  if (meetingBusy) box.append(h('div', { class: 'msg assistant typing' }, 'Next speaker is thinking…'));
  box.scrollTop = box.scrollHeight;
}

async function runMeeting(e) {
  e.preventDefault();
  if (meetingBusy) return;
  const topic = $('#th-topic').value.trim(); if (!topic) return;
  meetingBusy = true; $('#th-start').disabled = true; $('#th-end').classList.remove('hidden');
  state.townhall = [{ from: 'topic', text: topic, ts: Date.now() }];
  save(); renderTownhall();
  startMeeting();
  log('chief', `The court is summoned: ${topic}`, 'task');
  await new Promise(r => setTimeout(r, 4500));          // let everyone walk over
  const speakers = ['chief', ...state.agents.filter(a => a.kind === 'director').map(a => a.id)];
  for (const id of speakers) {
    if (!meetingBusy) break;
    const transcript = state.townhall.filter(m => m.from !== 'topic');
    say(id, '…', 20, true);
    const text = await townhallTurn(id, topic, transcript);
    if (!meetingBusy) break;
    state.townhall.push({ from: id, text, ts: Date.now() });
    say(id, text, 7, true);
    save(); renderTownhall();
    await new Promise(r => setTimeout(r, 1800));
  }
  const finished = meetingBusy;
  meetingBusy = false; $('#th-start').disabled = false;
  renderTownhall();
  if (finished) setTimeout(() => { if (!meetingBusy) adjourn(); }, 12000);   // everyone heads back to work
}
function adjourn() {
  if (!inMeeting()) return;
  meetingBusy = false; endMeeting();
  $('#th-end').classList.add('hidden'); $('#th-start').disabled = false;
  log('chief', 'The court is adjourned', 'info');
  renderTownhall();
}

// ── Kingdom settings ─────────────────────────────────────────
function renderSettings() {
  $('#set-name').value = state.mayorName;
  $('#set-key').value = state.settings.apiKey;
  $('#set-model').value = state.settings.model;
  $('#set-effort').value = state.settings.effort;
  $('#set-autowork').checked = state.settings.autoWork;
  const sel = $('#edit-agent'), keep = sel.value;
  sel.replaceChildren(...state.agents.map(a => h('option', { value: a.id }, `${a.name} — ${a.role}`)));
  sel.value = keep || 'chief';
  loadEditor();
  $('#rules').replaceChildren(...GROUND_RULES.map(r => h('li', {}, r)));
}
function loadEditor() {
  const a = state.agents.find(x => x.id === $('#edit-agent').value) || state.agents[0];
  $('#ed-name').value = a.name; $('#ed-role').value = a.role; $('#ed-instructions').value = a.instructions || '';
  $('#ed-keywords').value = (a.keywords || []).join(', ');
  $('#ed-intern').value = a.intern?.name || ''; $('#ed-intern').disabled = !a.intern;
}
function saveEditor() {
  const a = state.agents.find(x => x.id === $('#edit-agent').value);
  if (!a) return;
  a.name = $('#ed-name').value.trim() || a.name;
  a.role = $('#ed-role').value.trim() || a.role;
  a.instructions = $('#ed-instructions').value.trim();
  a.keywords = $('#ed-keywords').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (a.intern && $('#ed-intern').value.trim()) a.intern.name = $('#ed-intern').value.trim();
  touchMeta(); toast(`${a.name} updated.`); renderAll();
}

function renderFeed() {
  const ul = $('#feed'); ul.replaceChildren();
  for (const e of state.log.slice(0, 40)) {
    ul.append(h('li', { class: e.kind }, h('span', { class: 't' }, timeStr(e.ts)), `${agentById(e.who)?.name || e.who}: ${e.text}`));
  }
}

function renderTop() {
  const live = hasKey();
  const m = $('#mode');
  m.textContent = live ? `● Claude · ${state.settings.model.replace('claude-', '')}` : '● Free mode';
  m.className = `stat pill ${live ? 'live' : 'offline'}`;
  const u = totalUsage();
  $('#spend').textContent = `$${u.cost.toFixed(2)} · ${u.calls} calls`;
  const sp = $('#sync-pill');
  const label = { local: '💾 This device only', connecting: '☁️ Syncing…', synced: '☁️ Synced', error: '⚠️ Sync problem' }[sync.status];
  sp.textContent = label; sp.className = `stat pill sync-${sync.status}`;
  sp.title = sync.error || (sync.user ? `Signed in as ${sync.user.email}` : 'Sign in under Kingdom → Your devices to sync phone and computer');
}

// ── Your devices (sync) ──────────────────────────────────────
function renderSync() {
  const box = $('#sync-box'); if (!box) return;
  box.querySelector('#sync-in').classList.toggle('hidden', !!sync.user);
  box.querySelector('#sync-out').classList.toggle('hidden', !sync.user);
  if (sync.user) {
    $('#sync-who').textContent = sync.user.email;
    const when = sync.lastSynced ? ` · last synced ${timeStr(sync.lastSynced)}` : '';
    $('#sync-state').textContent = (sync.status === 'error' ? `⚠️ ${sync.error}` : sync.status === 'synced' ? `☁️ Synced${when}` : '☁️ Connecting…') +
      (sync.leader ? ' · this device is running the court' : ' · another of your devices is running the court');
  }
  $('#sync-msg').textContent = !sync.user && sync.error ? sync.error : '';
  renderTop();
}

function initSyncUI() {
  const email = () => $('#sync-email').value.trim(), pass = () => $('#sync-pass').value;
  const run = async (fn, okMsg) => {
    $('#sync-msg').textContent = '';
    try { await fn(); if (okMsg) toast(okMsg); }
    catch (e) { $('#sync-msg').textContent = friendlyAuthError(e); }
  };
  $('#sync-signin').addEventListener('click', e => { e.preventDefault(); run(() => signIn(email(), pass()), 'Signed in. Syncing your kingdom…'); });
  $('#sync-signup').addEventListener('click', e => { e.preventDefault(); run(() => signUp(email(), pass()), 'Account created. Your kingdom is now saved to it.'); });
  $('#sync-forgot').addEventListener('click', e => { e.preventDefault(); if (!email()) { $('#sync-msg').textContent = 'Type your email first.'; return; } run(() => resetPassword(email()), 'Password reset email sent.'); });
  $('#sync-signout').addEventListener('click', () => run(() => signOutSync(), 'Signed out. This device keeps its own copy.'));
  onSyncChange(renderSync);
  renderSync();
}

export function renderAll() {
  renderTop(); renderPeople(); renderChat(); fillOwnerSelects(); renderTasks(); renderApprovals(true); renderTownhall(); renderFeed();
}

export function initUI() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#approvals-btn').addEventListener('click', () => showTab('approvals'));
  $('#chat-form').addEventListener('submit', sendChat);
  $('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) sendChat(e); });
  document.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', e => { $('#chat-input').value = b.dataset.say; sendChat(e); }));
  initSyncUI();
  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#task-title').value.trim(); if (!title) return;
    const chosen = $('#task-owner').value;
    if (chosen === 'auto' || chosen === 'chief') {
      const to = routeDirector(title);
      addTask({ title, owner: to.id, notes: `Assigned by ${agentById('chief')?.name || 'the Queen'}.`, by: 'chief' });
      say('chief', `${to.name}, this one is yours: “${title}”.`, 5);
      toast(`The Queen gave it to ${to.name}.`);
    } else {
      addTask({ title, owner: chosen, by: 'mayor' });
    }
    $('#task-title').value = '';
  });
  $('#task-filter-owner').addEventListener('change', renderTasks);
  $('#task-filter-status').addEventListener('change', renderTasks);
  $('#th-form').addEventListener('submit', runMeeting);
  $('#th-end').addEventListener('click', adjourn);

  $('#set-name').addEventListener('change', e => { state.mayorName = e.target.value.trim() || 'The King'; touchMeta(); renderAll(); });
  $('#set-key').addEventListener('change', e => { state.settings.apiKey = e.target.value.trim(); save(); toast(state.settings.apiKey ? 'Key saved. The court now thinks with Claude.' : 'Key removed. Back to free mode.'); });
  $('#set-model').addEventListener('change', e => { state.settings.model = e.target.value; touchMeta(); });
  $('#set-effort').addEventListener('change', e => { state.settings.effort = e.target.value; touchMeta(); });
  $('#set-autowork').addEventListener('change', e => { state.settings.autoWork = e.target.checked; touchMeta(); });
  $('#edit-agent').addEventListener('change', loadEditor);
  $('#ed-save').addEventListener('click', saveEditor);
  $('#export').addEventListener('click', () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `agent-kingdom-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('#import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importState(await f.text()); sims.clear(); initAgents(); renderSettings(); toast('Kingdom restored.'); }
    catch (err) { toast(`Import failed: ${err.message}`); }
    e.target.value = '';
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm('Reset tasks, chats, petitions and court edits? Your API key is kept.')) return;
    resetVillage(); sims.clear(); initAgents(); renderSettings(); toast('A fresh kingdom.');
  });

  renderSettings();
  renderAll();
  // Cheap re-render on any state change; progress bars refresh on a timer.
  let raf = 0;
  onChange(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderTop(); renderPeople(); renderTasks(); renderApprovals(); renderFeed(); renderTownhall(); if (!typing.size) renderChat(); }); });
  setInterval(() => { if ($('#panel-tasks').classList.contains('active')) renderTasks(); }, 1000);
}
