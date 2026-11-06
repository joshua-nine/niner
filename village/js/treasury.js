// The Royal Treasury: a money tracker that lives inside the kingdom.
//
// • Stored in the kingdom's state, so it syncs live between your devices
//   (entries merge one by one; budgets: last edit wins).
// • You edit it in the Treasury tab; Penny the Treasury Dragon edits it when
//   you tell her things like "spent $12 on lunch" or "got paid $2000".
// • Download it as a CSV spreadsheet (opens in Excel / Google Sheets), or
//   import one back.
// Recording money is bookkeeping only: actual purchases still need the
// King's seal, and nothing here moves money.
import { state, save, uid, log, agentById } from './store.js';

export const DEFAULT_CATEGORIES = ['Income', 'Housing', 'Bills & utilities', 'Groceries', 'Eating out', 'Transport', 'Health', 'Shopping', 'Subscriptions', 'Fun', 'Savings', 'Other'];
const DEFAULT_BUDGETS = { Housing: 0, 'Bills & utilities': 0, Groceries: 0, 'Eating out': 0, Transport: 0, Fun: 0 };

export function freshTreasury() {
  return { entries: [], budgets: { ...DEFAULT_BUDGETS }, budgetsUpdated: 0, categories: [...DEFAULT_CATEGORIES], currency: '$' };
}
export const treasury = () => (state.treasury ||= freshTreasury());
export const liveEntries = () => treasury().entries.filter(e => !e.deleted);

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthKey = (date) => (date || today()).slice(0, 7);
export const money = (n) => `${n < 0 ? '−' : ''}${treasury().currency}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Editing ──────────────────────────────────────────────────
// amount: positive = money in, negative = money out.
export function addEntry({ date = today(), desc, category, amount, by = 'mayor', note = '' }) {
  const now = Date.now();
  const e = { id: uid('L'), date, desc: String(desc || '').slice(0, 120) || 'Entry', category: category || guessCategory(desc, amount), amount: Math.round(Number(amount) * 100) / 100, by, note, created: now, updated: now };
  if (!isFinite(e.amount) || e.amount === 0) throw new Error('Amount must be a number other than 0.');
  treasury().entries.unshift(e);
  if (by !== 'mayor') log(by, `Recorded in the Treasury: ${e.desc} ${money(e.amount)} (${e.category})`, 'ok');
  save();
  return e;
}
export function updateEntry(id, patch) {
  const e = treasury().entries.find(x => x.id === id);
  if (!e) return null;
  Object.assign(e, patch, { updated: Date.now() });
  if ('amount' in patch) e.amount = Math.round(Number(patch.amount) * 100) / 100;
  save();
  return e;
}
export const deleteEntry = (id) => updateEntry(id, { deleted: true });

export function setBudget(category, amount) {
  const t = treasury();
  t.budgets[category] = Math.max(0, Math.round(Number(amount) * 100) / 100 || 0);
  if (!t.categories.includes(category)) t.categories.push(category);
  t.budgetsUpdated = Date.now();
  save();
}

// ── Understanding plain words ────────────────────────────────
const CAT_WORDS = [
  ['Income', /\b(salary|paycheck|pay ?check|wage|got paid|paid me|income|bonus|refund|sold|freelance|patreon|tip(s)?)\b/],
  ['Housing', /\b(rent|mortgage|landlord|hoa)\b/],
  ['Bills & utilities', /\b(electric|electricity|power|water|gas bill|internet|wifi|phone bill|utility|utilities|insurance|bill)\b/],
  ['Groceries', /\b(grocer(y|ies)|supermarket|walmart|costco|aldi|kroger|food shop)\b/],
  ['Eating out', /\b(lunch|dinner|breakfast|coffee|restaurant|takeout|take-out|pizza|burger|starbucks|mcdonald'?s|doordash|uber ?eats)\b/],
  ['Transport', /\b(gas|fuel|petrol|uber|lyft|taxi|bus|train|parking|car|toll)\b/],
  ['Health', /\b(doctor|dentist|pharmacy|medicine|meds|prescription|gym|therapy|hospital)\b/],
  ['Subscriptions', /\b(netflix|spotify|hulu|disney|subscription|membership|prime|youtube premium|claude|chatgpt)\b/],
  ['Fun', /\b(movies?|cinema|game|games|steam|concert|bar|drinks|d&d|dnd|hobby|book|books)\b/],
  ['Savings', /\b(saving|savings|invest|investment|retirement|401k|ira)\b/],
  ['Shopping', /\b(amazon|clothes|shoes|shopping|bought|target)\b/],
];
export function guessCategory(text = '', amount = -1) {
  const t = String(text).toLowerCase();
  for (const [cat, re] of CAT_WORDS) if (re.test(t)) return cat === 'Income' && amount < 0 ? 'Other' : cat;
  return amount > 0 ? 'Income' : 'Other';
}

// "spent $12 on lunch", "paid $900 rent", "got paid 2000", "earned $50 from Patreon",
// "lunch $12", "$40 gas". Returns {desc, amount, category} or null.
export function parseMoney(text) {
  const t = String(text).trim();
  const lower = t.toLowerCase();
  const m = t.match(/(?:\$|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:\$|dollars?|bucks|usd)\b/i)
        || (/\b(spent|paid|earned|got paid|received|made|bought|cost)\b/i.test(t) && t.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\b/));
  if (!m) return null;
  const amount = Number(String(m[1] || m[2]).replace(/,/g, ''));
  if (!amount) return null;
  // A request to buy something later ("buy dog food for $20", "can you order…") is not a record:
  // it stays a task, and the purchase comes to the King as a petition.
  if (/^(please |pls )?((can|could|would|will) you |remind me to |i (need|want) to |let'?s )?(buy|order|purchase|pay for|subscribe|get me|book|budget)\b/.test(lower)) return null;
  const isIncome = /\b(got paid|earned|received|income|salary|paycheck|made \$?\d|sold|refund|bonus|paid me|deposit)\b/.test(lower);
  const isSpend = /\b(spent|paid|bought|cost|bill|purchased|spend)\b/.test(lower) && !/\bgot paid\b|\bpaid me\b/.test(lower);
  // Without a verb, accept short notes like "lunch $12" or "$40 gas".
  const shortNote = /\$|£|€/.test(t) && t.split(/\s+/).length <= 5;
  if (!isIncome && !isSpend && !shortNote) return null;
  // Description: whatever follows "on/for/from", else the text without the money words.
  const stripAmounts = (x) => x.replace(/(?:\$|£|€)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars?|bucks|usd)?\b/g, '').trim();
  let desc = stripAmounts((lower.match(/\b(?:on|for|from|at)\s+(.+)$/) || [])[1] || '')
    || lower.replace(/(?:\$|£|€)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars?|bucks|usd)?/g, '')
      .replace(/\b(i|just|today|yesterday|spent|paid|got|earned|received|made|bought|it|cost|a|an|the|my|me|for|on|at|from)\b/g, '').trim();
  desc = desc.replace(/[.!?]+$/, '').replace(/^(the|a|an|my)\s+/, '').replace(/\s+/g, ' ').trim() || (isIncome ? (/paid|salary|paycheck|wage/.test(lower) ? 'Pay' : 'Income') : 'Expense');
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  const signed = isIncome && !isSpend ? amount : -amount;
  return { desc, amount: signed, category: guessCategory(lower, signed) };
}

// "budget $300 for groceries", "set my eating out budget to 150"
export function parseBudget(text) {
  const lower = String(text).toLowerCase();
  if (!/\bbudget\b/.test(lower)) return null;
  const m = lower.match(/(?:\$|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)|\b(\d[\d,]*(?:\.\d{1,2})?)\b/);
  if (!m) return null;
  const amount = Number(String(m[1] || m[2]).replace(/,/g, ''));
  const cats = treasury().categories;
  let category = cats.find(c => lower.includes(c.toLowerCase()));
  if (!category) { const g = guessCategory(lower, -1); category = g !== 'Other' ? g : null; }
  return category && amount >= 0 ? { category, amount } : null;
}

// ── Summaries (used by the tab and by Penny) ─────────────────
export function monthSummary(month = monthKey()) {
  const list = liveEntries().filter(e => monthKey(e.date) === month);
  const income = list.filter(e => e.amount > 0).reduce((n, e) => n + e.amount, 0);
  const spent = -list.filter(e => e.amount < 0).reduce((n, e) => n + e.amount, 0);
  const byCat = {};
  for (const e of list) if (e.amount < 0) byCat[e.category] = (byCat[e.category] || 0) - e.amount;
  return { month, income, spent, net: income - spent, byCat, count: list.length };
}
export function treasuryBrief() {
  const s = monthSummary();
  const b = treasury().budgets;
  const over = Object.entries(b).filter(([c, lim]) => lim > 0 && (s.byCat[c] || 0) > lim).map(([c]) => c);
  return `This month: income ${money(s.income)}, spent ${money(s.spent)}, balance ${money(s.net)} across ${s.count} entries.` +
    (over.length ? ` Over budget: ${over.join(', ')}.` : '');
}

// Penny sets up the Treasury the first time she's asked for a tracker.
export function setUpTreasury(by = 'money') {
  const t = treasury();
  const fresh = !t.entries.length && !t.budgetsUpdated;
  t.budgetsUpdated ||= Date.now();
  save();
  const name = agentById(by)?.name || 'Penny';
  return fresh
    ? `Your Royal Treasury is ready, Your Majesty: open the 💰 Treasury tab. Set a monthly budget for each category there, and tell me what you spend or earn ("spent $12 on lunch", "got paid $2000") and I'll record it. You can download it as a spreadsheet any time. — ${name}`
    : `The Treasury is already open in the 💰 Treasury tab. ${treasuryBrief()} — ${name}`;
}

// ── Spreadsheet (CSV) ────────────────────────────────────────
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCSV() {
  const rows = [['Date', 'Description', 'Category', 'Amount', 'Type', 'Added by', 'Note']];
  for (const e of liveEntries().slice().sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([e.date, e.desc, e.category, e.amount.toFixed(2), e.amount > 0 ? 'Income' : 'Expense', agentById(e.by)?.name || e.by, e.note || '']);
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
// Accepts our own export, or any sheet with Date / Description / Amount columns.
export function importCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('No rows found.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
  const iDate = col('date'), iDesc = col('desc', 'name', 'memo', 'payee'), iCat = col('categ'), iAmt = col('amount', 'value'), iType = col('type');
  if (iAmt < 0) throw new Error('Needs an "Amount" column.');
  const have = new Set(liveEntries().map(e => `${e.date}|${e.desc}|${e.amount}`));
  let added = 0;
  for (const r of rows.slice(1)) {
    let amount = Number(String(r[iAmt] || '').replace(/[$£€,\s]/g, ''));
    if (!amount) continue;
    if (iType >= 0 && /expense|debit|out/i.test(r[iType] || '') && amount > 0) amount = -amount;
    const raw = iDate >= 0 ? new Date(r[iDate]) : new Date();
    const date = isNaN(raw) ? today() : `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
    const desc = (iDesc >= 0 ? r[iDesc] : '') || 'Imported';
    if (have.has(`${date}|${desc}|${Math.round(amount * 100) / 100}`)) continue;     // skip duplicates
    addEntry({ date, desc, category: iCat >= 0 && r[iCat] ? r[iCat] : undefined, amount, by: 'mayor' });
    added++;
  }
  return added;
}

// ── Merging two devices' copies (called from store.mergeStates) ──
export function mergeTreasury(local, remote) {
  if (!remote) return local || freshTreasury();
  if (!local) return remote;
  const map = new Map(local.entries.map(e => [e.id, e]));
  for (const e of remote.entries || []) { const m = map.get(e.id); if (!m || (e.updated || 0) > (m.updated || 0)) map.set(e.id, e); }
  const newerBudgets = (remote.budgetsUpdated || 0) > (local.budgetsUpdated || 0);
  return {
    ...local,
    entries: [...map.values()].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 3000),
    budgets: newerBudgets ? remote.budgets : local.budgets,
    budgetsUpdated: Math.max(local.budgetsUpdated || 0, remote.budgetsUpdated || 0),
    categories: [...new Set([...(local.categories || []), ...(remote.categories || [])])],
  };
}
