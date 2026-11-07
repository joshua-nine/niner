// Hand-off with Claude through the King's Google Sheet ("Kingdom – Inbox").
// Claude, running on the King's subscription in the Claude app or Claude
// Code, appends rows; the kingdom applies them and acknowledges each one.
// See village/INBOX.md for the row format Claude follows.
//
//   Type      To            Title                 Details
//   task      courtier/—    what to do            notes
//   result    —             app Task ID or title  the finished work
//   note      courtier      (optional)            message for their chat
//   petition  courtier      one-line summary      kind:/to:/subject: lines, blank line, body
//   bill      —             bill name             amount:/due:/notes:/link: lines
import { state, save, agentById, allPeople, addTask, updateTask, chatNote, requestApproval, log, liveTasks } from './store.js';
import { bills, updateItem, toNumber, parseLooseDate } from './household.js';

const FROM = 'Claude (via your sheet)';

// "Penny", "penny the treasury dragon", "money", "Queen", "iris" → courtier id
export function resolveCourtier(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  const people = allPeople().filter(p => p.id !== 'mayor');
  const exact = people.find(p => p.id === t || p.name.toLowerCase() === t);
  if (exact) return exact.id;
  const byWord = people.find(p => p.name.toLowerCase().split(/\s+/).some(w => w.length > 2 && t.includes(w)) || t.includes(p.id));
  if (byWord) return byWord.id;
  if (/queen|chief|elara/.test(t)) return 'chief';
  if (/treasur|money|dragon|financ|bill/.test(t)) return 'money';
  if (/inbox|mail|message/.test(t)) return 'inbox';
  if (/calendar|time|schedul/.test(t)) return 'calendar';
  if (/content|social|herald|post/.test(t)) return 'content';
  if (/health|home|hearth/.test(t)) return 'health';
  if (/project|quest|learn/.test(t)) return 'projects';
  return null;
}

// "key: value" lines, then a blank line, then free text (the body).
export function parseFields(details) {
  const lines = String(details || '').replace(/\r/g, '').split('\n');
  const fields = {}; let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([a-z][a-z _-]{0,20}):\s*(.*)$/i);
    if (!m) break;
    fields[m[1].trim().toLowerCase().replace(/[ _-]+/g, '')] = m[2].trim();
  }
  const body = lines.slice(i).join('\n').replace(/^\n+/, '').trim();
  if (/^\s*\{/.test(details || '')) { try { return { fields: JSON.parse(details), body: '' }; } catch { /* not JSON */ } }
  return { fields, body };
}

function findTask(ref) {
  const r = String(ref || '').trim();
  if (!r) return null;
  const tasks = liveTasks();
  return tasks.find(t => t.id === r) || tasks.find(t => t.title.toLowerCase() === r.toLowerCase())
    || tasks.find(t => t.title.toLowerCase().includes(r.toLowerCase()));
}

// Apply one inbox item. Returns a short note for the sheet's "App note" column.
export function applyItem(item) {
  const type = (item.type || 'task').toLowerCase();
  if (type === 'task') {
    const owner = resolveCourtier(item.to) || 'chief';          // no one named: the Queen assigns it
    const t = addTask({ title: item.title || item.details.split('\n')[0].slice(0, 90), owner, notes: item.details ? `${item.details}\n(From ${FROM})` : `From ${FROM}`, by: 'chief' });
    return `Task ${t.id} for ${agentById(owner)?.name}`;
  }
  if (type === 'result') {
    const t = findTask(item.title);
    if (!t) throw new Error(`No task matches “${item.title}”.`);
    updateTask(t.id, { result: item.details, status: t.owner === 'chief' ? 'done' : 'review', progress: 1 });
    chatNote(t.owner, `📬 Claude finished “${t.title}” for me and left it in your sheet. The Queen is checking it now.`);
    return `Result added to ${t.id} (with the Queen for review)`;
  }
  if (type === 'note') {
    const who = resolveCourtier(item.to) || 'chief';
    chatNote(who, `${item.title ? item.title + '\n\n' : ''}${item.details}`.trim());
    return `Note posted to ${agentById(who)?.name}`;
  }
  if (type === 'petition') {
    const { fields, body } = parseFields(item.details);
    const kind = ['email', 'post', 'spend', 'calendar', 'other'].includes((fields.kind || '').toLowerCase()) ? fields.kind.toLowerCase() : 'email';
    const from = resolveCourtier(item.to) || ({ email: 'inbox', calendar: 'calendar', spend: 'money', post: 'content' }[kind] || 'chief');
    const details = { ...fields, body: body || fields.body || '' };
    if (details.amount) details.amount = toNumber(details.amount);
    if (details.duration) { details.duration_minutes = toNumber(details.duration); delete details.duration; }
    delete details.kind;
    const task = fields.task ? findTask(fields.task) : null;
    const a = requestApproval({ from, kind, summary: item.title || `${kind} from Claude`, details, taskId: task?.id || null });
    return `Petition ${a.id} (Queen reviews, then your seal)`;
  }
  if (type === 'bill') {
    const { fields, body } = parseFields(item.details);
    const name = (item.title || fields.name || '').toLowerCase();
    const b = bills().find(x => x.name.toLowerCase() === name) || bills().find(x => name && x.name.toLowerCase().includes(name));
    if (!b) throw new Error(`No bill named “${item.title}”.`);
    const patch = {};
    if (fields.amount) patch.amount = toNumber(fields.amount);
    if (fields.due || fields.nextdue) patch.nextDue = parseLooseDate(fields.due || fields.nextdue) || b.nextDue;
    if (fields.balance) patch.balance = toNumber(fields.balance);
    if (fields.notes || body) patch.notes = fields.notes || body;
    if (fields.link) patch.docs = [...(b.docs || []), { id: `link-${Date.now()}`, url: fields.link, name: fields.linkname || `${b.name} document`, month: (patch.nextDue || '').slice(0, 7), added: Date.now() }];
    updateItem('bills', b.id, patch);
    log('money', `Updated ${b.name} from Claude: ${Object.keys(patch).join(', ')}`, 'ok');
    chatNote('money', `🧾 Claude updated ${b.name}: ${Object.entries(patch).filter(([k]) => k !== 'docs').map(([k, v]) => `${k} ${v}`).join(', ')}${patch.docs ? ' (document linked)' : ''}.`);
    return `Bill ${b.name} updated`;
  }
  throw new Error(`Unknown type “${item.type}”. Use task, result, note, petition or bill.`);
}

// Apply a batch from the sheet; skip anything this kingdom already applied.
export function applyInbox(items) {
  const seen = (state.inboxSeen ||= {});
  const acks = [];
  let applied = 0;
  for (const item of items) {
    if (seen[item.id]) { acks.push({ id: item.id, ok: true, note: seen[item.id].note || 'already applied' }); continue; }
    try {
      const note = applyItem(item);
      seen[item.id] = { at: Date.now(), note };
      acks.push({ id: item.id, ok: true, note });
      applied++;
    } catch (e) {
      acks.push({ id: item.id, ok: false, note: e.message });
    }
  }
  // keep the memory of applied items small
  const keys = Object.keys(seen);
  if (keys.length > 500) keys.sort((a, b) => seen[a].at - seen[b].at).slice(0, keys.length - 500).forEach(k => delete seen[k]);
  if (applied) log('chief', `Picked up ${applied} item${applied > 1 ? 's' : ''} from Claude in your sheet`, 'ok');
  save();
  return { applied, acks };
}
