// Household finances inside the Royal Treasury: recurring bills (with due
// dates and "paid this month"), income sources, and accounts & debts.
// Shaped after the King's own Recurring Bills Tracker so it can be imported.
// Everything lives in state.treasury, so it syncs live across devices and
// both the King and Penny can edit it. Bookkeeping only: nothing pays a bill.
import { save, uid, log } from './store.js';
import { treasury, addEntry, deleteEntry, money } from './treasury.js';

// ── Dates ────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoDate(new Date());
export const thisMonth = () => todayISO().slice(0, 7);
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();     // m is 1-12
export const niceDate = (iso) => iso ? new Date(`${iso}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
function addMonths(iso, n) {
  const d = new Date(`${iso}T12:00`); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth() + 1)));
  return isoDate(d);
}
export function parseLooseDate(s) {
  if (!s || /^[-—–\s]*$/.test(s)) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? '' : isoDate(d);
}
export const toNumber = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s || /^[-—–]$/.test(s)) return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return isFinite(n) ? (neg ? -n : n) : 0;
};

// ── Collections ──────────────────────────────────────────────
export const FREQUENCIES = ['Monthly', 'Biweekly', 'Weekly', 'Quarterly', 'Annual', 'As needed'];
export const ACCOUNT_TYPES = ['Checking', 'Savings', 'Credit Card', 'Loan', 'Investment', 'Other'];
const list = (name) => (treasury()[name] ||= []);
export const live = (name) => list(name).filter(x => !x.deleted);
export const bills = () => live('bills');
export const incomes = () => live('incomes');
export const accounts = () => live('accounts');
export const people = () => (treasury().people ||= []);

export function addItem(name, fields) {
  const now = Date.now();
  const item = { id: uid(name[0].toUpperCase()), created: now, updated: now, ...fields };
  list(name).push(item);
  for (const p of [fields.owner].filter(Boolean)) if (!people().includes(p)) people().push(p);
  save();
  return item;
}
export function updateItem(name, id, patch) {
  const item = list(name).find(x => x.id === id);
  if (!item) return null;
  Object.assign(item, patch, { updated: Date.now() });
  if (patch.owner && !people().includes(patch.owner)) people().push(patch.owner);
  save();
  return item;
}
export const removeItem = (name, id) => updateItem(name, id, { deleted: true });

// ── Bills ────────────────────────────────────────────────────
// When is a bill due in a given month ("YYYY-MM")? Monthly bills repeat on
// the day of their Next Due date; annual/quarterly ones only in their month.
export function dueInMonth(bill, month = thisMonth()) {
  if (bill.frequency === 'As needed') return null;
  const [y, m] = month.split('-').map(Number);
  if (bill.frequency === 'Monthly' || bill.frequency === 'Biweekly' || bill.frequency === 'Weekly') {
    if (!bill.nextDue) return { date: '', undated: true };
    const day = Math.min(Number(bill.nextDue.slice(8, 10)), daysInMonth(y, m));
    return { date: `${month}-${pad(day)}` };
  }
  if (!bill.nextDue) return null;
  // Annual/quarterly: due this month if Next Due (or a step of it) falls here
  const step = bill.frequency === 'Quarterly' ? 3 : 12;
  let d = bill.nextDue;
  for (let i = 0; i < 40 && d.slice(0, 7) < month; i++) d = addMonths(d, step);
  for (let i = 0; i < 40 && d.slice(0, 7) > month; i++) { const back = addMonths(d, -step); if (back.slice(0, 7) < month) break; d = back; }
  return d.slice(0, 7) === month ? { date: d } : null;
}
export const isPaid = (bill, month = thisMonth()) => !!(bill.paidMonths && bill.paidMonths[month]);
export const monthlyAmount = (b) => b.frequency === 'Monthly' ? b.amount : b.frequency === 'Biweekly' ? b.amount * 26 / 12 : b.frequency === 'Weekly' ? b.amount * 52 / 12 : 0;
export const annualAmount = (b) => ({ Monthly: 12, Biweekly: 26, Weekly: 52, Quarterly: 4, Annual: 1 }[b.frequency] || 0) * (b.amount || 0);

// The list for a month: every bill due that month, with its status.
export function billsForMonth(month = thisMonth()) {
  const today = todayISO();
  return bills().map(b => {
    const due = dueInMonth(b, month);
    if (!due) return null;
    const paid = isPaid(b, month);
    const status = paid ? 'paid' : due.undated ? 'nodate' : due.date < today ? 'overdue' : (new Date(`${due.date}T12:00`) - new Date(`${today}T12:00`)) / 864e5 <= 3 ? 'soon' : 'upcoming';
    return { bill: b, due: due.date, status };
  }).filter(Boolean).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.bill.name.localeCompare(b.bill.name));
}

// Mark paid: records the payment as a Treasury entry and ticks the month.
// Annual/quarterly bills also roll their Next Due forward.
export function markPaid(billId, { month = thisMonth(), by = 'mayor', amount } = {}) {
  const b = list('bills').find(x => x.id === billId);
  if (!b || isPaid(b, month)) return null;
  const amt = Math.abs(amount ?? b.amount ?? 0);
  let entryId = null;
  if (amt > 0) entryId = addEntry({ date: month === thisMonth() ? todayISO() : `${month}-01`, desc: b.name, category: b.group || 'Bills & utilities', amount: -amt, by, note: 'Bill payment' }).id;
  const patch = { paidMonths: { ...(b.paidMonths || {}), [month]: entryId || true } };
  if (b.frequency === 'Annual' || b.frequency === 'Quarterly') {
    const due = dueInMonth(b, month);
    if (due?.date) patch.nextDue = addMonths(due.date, b.frequency === 'Quarterly' ? 3 : 12);
  }
  updateItem('bills', b.id, patch);
  if (by !== 'mayor') log(by, `Marked paid: ${b.name} ${money(-amt)}`, 'ok');
  return b;
}
export function unmarkPaid(billId, month = thisMonth()) {
  const b = list('bills').find(x => x.id === billId);
  if (!b || !isPaid(b, month)) return null;
  const ref = b.paidMonths[month];
  if (typeof ref === 'string') deleteEntry(ref);
  const pm = { ...b.paidMonths }; delete pm[month];
  updateItem('bills', b.id, { paidMonths: pm });
  return b;
}

// ── Totals ───────────────────────────────────────────────────
export function incomeTotals() {
  let typical = 0, avg = 0;
  for (const i of incomes()) {
    const a = i.amount || 0;
    if (i.frequency === 'Biweekly') { typical += a * 2; avg += a * 26 / 12; }
    else if (i.frequency === 'Weekly') { typical += a * 4; avg += a * 52 / 12; }
    else if (i.frequency === 'Annual') { avg += a / 12; }
    else { typical += a; avg += a; }
  }
  return { typical, avg };
}
export function billTotals() {
  const monthly = bills().reduce((n, b) => n + monthlyAmount(b), 0);
  const yearly = bills().reduce((n, b) => n + annualAmount(b), 0);
  return { monthly, yearly, avgMonth: yearly / 12 };
}
export function accountTotals() {
  const cash = accounts().filter(a => ['Checking', 'Savings', 'Investment'].includes(a.type)).reduce((n, a) => n + (a.balance || 0), 0);
  const debt = accounts().filter(a => ['Credit Card', 'Loan'].includes(a.type)).reduce((n, a) => n + Math.abs(a.balance || 0), 0);
  return { cash, debt, net: cash - debt };
}

// ── Penny understands bills in plain words ───────────────────
const STOP = new Set(['the', 'bill', 'bills', 'card', 'payment', 'paid', 'pay', 'monthly', 'for', 'and', 'my', 'personal', 'account', 'credit', 'tv', 'premium', 'subscription']);
export function matchBill(text) {
  const t = String(text).toLowerCase();
  let best = null, score = 0;
  for (const b of bills()) {
    const words = b.name.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9&+]+/).filter(w => w.length >= 3 && !STOP.has(w));
    const s = words.reduce((n, w) => n + (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t) ? 1 : 0), 0);
    if (s > score) { score = s; best = b; }
  }
  return score > 0 ? best : null;
}
export function upcomingBills(days = 7) {
  const today = todayISO();
  const limit = isoDate(new Date(Date.now() + days * 864e5));
  const months = [thisMonth(), limit.slice(0, 7)].filter((m, i, a) => a.indexOf(m) === i);
  return months.flatMap(billsForMonth)
    .filter(x => x.status !== 'paid' && x.due && (x.due <= limit))
    .filter((x, i, a) => a.findIndex(y => y.bill.id === x.bill.id) === i)
    .map(x => ({ ...x, overdue: x.due < today }));
}
export function billsBrief(days = 7) {
  const up = upcomingBills(days);
  if (!bills().length) return '';
  if (!up.length) return `No unpaid bills due in the next ${days} days.`;
  return `Bills due in the next ${days} days: ` + up.slice(0, 8).map(x => `${x.bill.name} ${money(x.bill.amount)} (${x.overdue ? 'OVERDUE ' : ''}${niceDate(x.due)})`).join('; ') + (up.length > 8 ? `; and ${up.length - 8} more` : '') + '.';
}
export function debtBrief() {
  const a = accountTotals();
  const cards = accounts().filter(x => ['Credit Card', 'Loan'].includes(x.type) && Math.abs(x.balance || 0) > 0)
    .sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance));
  if (!accounts().length) return '';
  return `Cash ${money(a.cash)}, debts ${money(a.debt)}, net ${money(a.net)}.` + (cards.length ? ' Largest balances: ' + cards.slice(0, 4).map(c => `${c.name} ${money(Math.abs(c.balance))}`).join(', ') + '.' : '');
}
export function cashFlowBrief() {
  const i = incomeTotals(), b = billTotals();
  if (!incomes().length && !bills().length) return '';
  return `Typical month: income ${money(i.typical)}, bills ${money(b.monthly)}, left over ${money(i.typical - b.monthly)}. Average month (incl. extra paychecks and annual bills): income ${money(i.avg)}, bills ${money(b.avgMonth)}, left over ${money(i.avg - b.avgMonth)}.`;
}

// ── Import: a tracker file, or a CSV exported from the King's sheet ──
// File format: { kind: 'agent-kingdom-treasury', version: 1, people, bills, incomes, accounts, budgets, categories }
export function importTrackerFile(obj) {
  if (!obj || obj.kind !== 'agent-kingdom-treasury') throw new Error('That isn\'t a kingdom tracker file.');
  const t = treasury();
  const counts = { bills: 0, incomes: 0, accounts: 0 };
  for (const name of ['bills', 'incomes', 'accounts']) {
    for (const src of obj[name] || []) {
      const existing = list(name).find(x => !x.deleted && (x.importKey && x.importKey === src.importKey));
      const fields = { ...src }; delete fields.id;
      if (existing) updateItem(name, existing.id, fields); else addItem(name, fields);
      counts[name]++;
    }
  }
  for (const p of obj.people || []) if (!people().includes(p)) people().push(p);
  if (obj.budgets) { Object.assign(t.budgets, obj.budgets); t.budgetsUpdated = Date.now(); }
  if (obj.categories) t.categories = [...new Set([...(t.categories || []), ...obj.categories])];
  save();
  return counts;
}

// ── Spreadsheets (CSV) ───────────────────────────────────────
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows) => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
export function billsCSV() {
  return csv([['Group', 'Bill', 'Amount', 'Frequency', 'Next Due', 'Annual Cost', 'Owner', 'Paid With', 'Balance Owed', 'Notes', `Paid ${thisMonth()}`],
    ...bills().slice().sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.name.localeCompare(b.name))
      .map(b => [b.group, b.name, (b.amount || 0).toFixed(2), b.frequency, b.nextDue, annualAmount(b).toFixed(2), b.owner, b.paidWith, b.balance ? b.balance.toFixed(2) : '', b.notes, isPaid(b) ? 'Yes' : ''])]);
}
export function incomeCSV() {
  return csv([['Income', 'Owner', 'Deposits To', 'Amount', 'Frequency', 'Notes'],
    ...incomes().map(i => [i.name, i.owner, i.depositsTo, (i.amount || 0).toFixed(2), i.frequency, i.notes])]);
}
export function accountsCSV() {
  return csv([['Account', 'Institution', 'Last 4', 'Owner', 'Type', 'Balance', 'As Of', 'Notes'],
    ...accounts().map(a => [a.name, a.institution, a.last4, a.owner, a.type, (a.balance || 0).toFixed(2), a.asOf, a.notes])]);
}
