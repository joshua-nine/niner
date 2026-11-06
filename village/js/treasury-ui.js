// The 💰 Treasury tab: bills, spending & budgets, income, accounts & debts.
// Everything is editable here, Penny edits it from Talk, and it syncs live.
import { onChange, agentById } from './store.js';
import {
  treasury, liveEntries, addEntry, updateEntry, deleteEntry, setBudget, monthSummary,
  money, toCSV, importCSV, guessCategory,
} from './treasury.js';
import {
  bills, incomes, accounts, people, addItem, updateItem, removeItem, billsForMonth, markPaid, unmarkPaid,
  incomeTotals, billTotals, accountTotals, annualAmount, importTrackerFile, billsCSV, incomeCSV, accountsCSV,
  FREQUENCIES, ACCOUNT_TYPES, niceDate, todayISO, toNumber,
} from './household.js';
import { sheetSettings, sheetReady, sheetStatus, newKey, testSheet, sendToSheet, pullFromSheet, bridgeScript } from './sheets.js';
import { touchMeta } from './store.js';

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

let month = todayISO().slice(0, 7);
let editing = null;           // "entry:ID" | "bills:ID" | "incomes:ID" | "accounts:ID" | "new:bills" ...
let ownerFilter = '';
const openSections = new Set(['overview', 'bills', 'spending']);
let toastFn = () => {};
const monthName = (m) => new Date(`${m}-15T12:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' });
const shiftMonth = (m, n) => { const d = new Date(`${m}-15T12:00`); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
const rerender = () => renderTreasury(true);

function section(id, title, ...content) {
  const d = h('details', { class: 'tsec', open: openSections.has(id) }, h('summary', {}, title), ...content);
  d.addEventListener('toggle', () => { d.open ? openSections.add(id) : openSections.delete(id); });
  return d;
}

// Generic editor for bills / incomes / accounts.
const FIELDS = {
  bills: [['name', 'Bill', 'text'], ['amount', 'Amount', 'money'], ['frequency', 'How often', 'select', FREQUENCIES], ['nextDue', 'Next due', 'date'],
    ['group', 'Group', 'text'], ['owner', 'Owner', 'owner'], ['paidWith', 'Paid with', 'text'], ['balance', 'Balance owed', 'money'], ['notes', 'Notes', 'text']],
  incomes: [['name', 'Income', 'text'], ['amount', 'Amount per payment', 'money'], ['frequency', 'How often', 'select', FREQUENCIES.filter(f => f !== 'As needed')],
    ['owner', 'Owner', 'owner'], ['depositsTo', 'Deposits to', 'text'], ['notes', 'Notes', 'text']],
  accounts: [['name', 'Account', 'text'], ['type', 'Type', 'select', ACCOUNT_TYPES], ['balance', 'Balance', 'money'], ['asOf', 'As of', 'date'],
    ['institution', 'Bank', 'text'], ['last4', 'Last 4', 'text'], ['owner', 'Owner', 'owner'], ['notes', 'Notes', 'text']],
};
function editor(kind, item) {
  const inputs = {};
  const rows = FIELDS[kind].map(([key, label, type, opts]) => {
    let el;
    if (type === 'select') el = h('select', {}, ...opts.map(o => h('option', { value: o, selected: (item[key] || opts[0]) === o }, o)));
    else if (type === 'owner') {
      el = h('input', { value: item[key] || '', list: 'treasury-people', placeholder: 'e.g. Josh' });
    } else el = h('input', { type: type === 'money' ? 'number' : type === 'date' ? 'date' : 'text', step: type === 'money' ? '0.01' : undefined, inputmode: type === 'money' ? 'decimal' : undefined, value: item[key] ?? '' });
    inputs[key] = [el, type];
    return h('label', {}, label, el);
  });
  const read = () => Object.fromEntries(Object.entries(inputs).map(([k, [el, type]]) => [k, type === 'money' ? (el.value === '' ? (k === 'balance' ? null : 0) : toNumber(el.value)) : el.value.trim()]));
  const isNew = !item.id;
  return h('div', { class: 'card editing' },
    h('div', { class: 'edit-grid' }, ...rows),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => {
        const v = read(); if (!v.name) { toastFn('Give it a name.'); return; }
        isNew ? addItem(kind, v) : updateItem(kind, item.id, v);
        editing = null; document.activeElement?.blur(); toastFn('Saved.'); rerender();
      } }, isNew ? 'Add' : 'Save'),
      h('button', { class: 'btn btn-ghost', onclick: () => { editing = null; rerender(); } }, 'Cancel'),
      isNew ? null : h('button', { class: 'btn btn-danger', onclick: () => { if (confirm(`Delete ${item.name}?`)) { removeItem(kind, item.id); editing = null; rerender(); } } }, 'Delete')));
}

const STATUS = { paid: ['✓ Paid', 'paid'], overdue: ['Overdue', 'overdue'], soon: ['Due soon', 'soon'], upcoming: ['Upcoming', 'upcoming'], nodate: ['No date', 'nodate'] };

export function renderTreasury(force = false) {
  const panel = $('#panel-treasury');
  if (!panel) return;
  // Don't rebuild under the King's fingers while they're typing.
  if (!force && panel.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const t = treasury();
  const body = $('#treasury-body'); body.replaceChildren();
  body.append(h('datalist', { id: 'treasury-people' }, ...people().map(p => h('option', { value: p }))));
  const hasHousehold = bills().length || incomes().length || accounts().length;

  // ── Overview ───────────────────────────────────────────────
  const inc = incomeTotals(), bt = billTotals(), at = accountTotals(), s = monthSummary(month);
  body.append(section('overview', '📊 Overview',
    hasHousehold ? h('div', { class: 'totals' },
      h('div', { class: 'total in' }, h('span', {}, 'Income / mo'), h('b', {}, money(inc.typical))),
      h('div', { class: 'total out' }, h('span', {}, 'Bills / mo'), h('b', {}, money(bt.monthly))),
      h('div', { class: `total ${inc.typical - bt.monthly >= 0 ? 'in' : 'out'}` }, h('span', {}, 'Left over'), h('b', {}, money(inc.typical - bt.monthly)))) : null,
    accounts().length ? h('div', { class: 'totals' },
      h('div', { class: 'total in' }, h('span', {}, 'Cash'), h('b', {}, money(at.cash))),
      h('div', { class: 'total out' }, h('span', {}, 'Debts'), h('b', {}, money(at.debt))),
      h('div', { class: `total ${at.net >= 0 ? 'in' : 'out'}` }, h('span', {}, 'Net'), h('b', {}, money(at.net)))) : null,
    hasHousehold ? h('p', { class: 'note' }, `Average month, counting extra paychecks and annual bills: income ${money(inc.avg)}, bills ${money(bt.avgMonth)}, left over ${money(inc.avg - bt.avgMonth)}. Yearly bills total ${money(bt.yearly)}.`)
      : h('p', { class: 'note' }, 'Import your tracker file (button above) to bring in your bills, income and accounts, or add them in the sections below.')));

  // ── Bills this month ───────────────────────────────────────
  const monthBills = billsForMonth(month).filter(x => !ownerFilter || x.bill.owner === ownerFilter);
  const paidCount = monthBills.filter(x => x.status === 'paid').length;
  const dueTotal = monthBills.reduce((n, x) => n + (x.bill.amount || 0), 0);
  const paidTotal = monthBills.filter(x => x.status === 'paid').reduce((n, x) => n + (x.bill.amount || 0), 0);
  const billRows = [];
  for (const x of monthBills) {
    const b = x.bill;
    if (editing === `bills:${b.id}`) { billRows.push(editor('bills', b)); continue; }
    const [label, cls] = STATUS[x.status];
    billRows.push(h('div', { class: `card bill ${cls}` },
      h('div', { class: 'card-top' },
        h('button', { class: 'linkish card-title', onclick: () => { editing = `bills:${b.id}`; rerender(); }, title: 'Edit' }, b.name),
        h('b', {}, money(b.amount || 0))),
      h('div', { class: 'card-top' },
        h('span', { class: 'meta' }, [x.due ? `Due ${niceDate(x.due)}` : 'No due date', b.frequency !== 'Monthly' ? b.frequency : '', b.owner, b.paidWith].filter(Boolean).join(' · ')),
        h('span', { class: `pill-s ${cls}` }, label)),
      b.balance ? h('div', { class: 'meta' }, `Balance owed ${money(b.balance)}`) : null,
      b.notes ? h('div', { class: 'meta' }, b.notes) : null,
      h('div', { class: 'btn-row' }, x.status === 'paid'
        ? h('button', { class: 'btn btn-ghost', onclick: () => { unmarkPaid(b.id, month); rerender(); } }, 'Undo paid')
        : h('button', { class: 'btn', onclick: () => { markPaid(b.id, { month }); toastFn(`${b.name} marked paid and recorded.`); rerender(); } }, 'Mark paid'))));
  }
  const owners = people();
  body.append(section('bills', `🧾 Bills · ${monthName(month)}`,
    h('div', { class: 'month-nav' },
      h('button', { class: 'btn btn-ghost', onclick: () => { month = shiftMonth(month, -1); rerender(); } }, '‹'),
      h('b', {}, monthName(month)),
      h('button', { class: 'btn btn-ghost', onclick: () => { month = shiftMonth(month, 1); rerender(); } }, '›')),
    owners.length > 1 ? h('div', { class: 'quick' },
      ...['', ...owners].map(o => h('button', { class: `chip${ownerFilter === o ? ' active' : ''}`, onclick: () => { ownerFilter = o; rerender(); } }, o || 'Everyone'))) : null,
    monthBills.length ? h('div', { class: 'progress' }, h('i', { style: `width:${monthBills.length ? (paidCount / monthBills.length) * 100 : 0}%` })) : null,
    h('p', { class: 'note' }, monthBills.length ? `Paid ${paidCount} of ${monthBills.length} · ${money(paidTotal)} of ${money(dueTotal)}. “Mark paid” also records it in Spending.` : 'No bills due this month.'),
    ...billRows,
    editing === 'new:bills' ? editor('bills', { frequency: 'Monthly' }) : h('button', { class: 'btn btn-ghost', onclick: () => { editing = 'new:bills'; rerender(); } }, '+ Add a bill'),
    (() => {   // As-needed bills, listed for reference
      const asNeeded = bills().filter(b => b.frequency === 'As needed');
      return asNeeded.length ? h('p', { class: 'note' }, 'As needed (not in totals): ' + asNeeded.map(b => `${b.name} ~${money(b.amount || 0)}`).join(', ')) : null;
    })()));

  // ── Spending & budgets ─────────────────────────────────────
  const entries = liveEntries().filter(e => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date) || (b.created - a.created));
  const cats = [...new Set([...Object.keys(t.budgets).filter(c => t.budgets[c] > 0), ...Object.keys(s.byCat)])].filter(c => c !== 'Income');
  const budgetRows = cats.map(c => {
    const spent = s.byCat[c] || 0, lim = t.budgets[c] || 0;
    const pct = lim ? Math.min(100, (spent / lim) * 100) : 0;
    const input = h('input', { type: 'number', min: '0', step: '1', inputmode: 'decimal', value: lim || '', placeholder: 'no limit', 'aria-label': `${c} monthly budget` });
    input.addEventListener('change', () => { setBudget(c, input.value); toastFn(`${c} budget saved.`); input.blur(); });
    return h('div', { class: 'budget' },
      h('div', { class: 'card-top' }, h('span', {}, c), h('span', { class: `meta ${lim && spent > lim ? 'over' : ''}` }, `${money(spent)}${lim ? ` of ${money(lim)}` : ''}`)),
      lim ? h('div', { class: 'progress' }, h('i', { style: `width:${pct}%;background:${spent > lim ? 'var(--red)' : pct > 80 ? 'var(--gold)' : 'var(--neon)'}` })) : null,
      h('label', { class: 'inline' }, 'Monthly limit', input));
  });
  const f = {
    date: h('input', { type: 'date', value: month === todayISO().slice(0, 7) ? todayISO() : `${month}-01`, 'aria-label': 'Date' }),
    desc: h('input', { placeholder: 'What was it? e.g. Lunch', maxlength: '120', 'aria-label': 'Description' }),
    amount: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', placeholder: 'Amount', 'aria-label': 'Amount' }),
    type: h('select', { 'aria-label': 'Money in or out' }, h('option', { value: 'out' }, 'Spent'), h('option', { value: 'in' }, 'Received')),
    cat: h('select', { 'aria-label': 'Category' }, h('option', { value: '' }, 'Category: auto'), ...t.categories.map(c => h('option', { value: c }, c))),
  };
  const entryRows = entries.slice(0, 200).map(e => {
    if (editing === `entry:${e.id}`) {
      const ed = {
        date: h('input', { type: 'date', value: e.date }), desc: h('input', { value: e.desc, maxlength: '120' }),
        amount: h('input', { type: 'number', step: '0.01', value: Math.abs(e.amount), inputmode: 'decimal' }),
        type: h('select', {}, h('option', { value: 'out', selected: e.amount < 0 }, 'Spent'), h('option', { value: 'in', selected: e.amount > 0 }, 'Received')),
        cat: h('select', {}, ...[...new Set([...t.categories, e.category])].map(c => h('option', { value: c, selected: c === e.category }, c))),
      };
      return h('div', { class: 'card entry editing' },
        h('div', { class: 'two' }, ed.date, ed.type), ed.desc, h('div', { class: 'two' }, ed.amount, ed.cat),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => {
            const amt = Math.abs(Number(ed.amount.value)); if (!amt) { toastFn('Amount must be more than 0.'); return; }
            updateEntry(e.id, { date: ed.date.value, desc: ed.desc.value.trim() || e.desc, amount: ed.type.value === 'in' ? amt : -amt, category: ed.cat.value });
            editing = null; document.activeElement?.blur(); rerender();
          } }, 'Save'),
          h('button', { class: 'btn btn-ghost', onclick: () => { editing = null; rerender(); } }, 'Cancel'),
          h('button', { class: 'btn btn-danger', onclick: () => { deleteEntry(e.id); editing = null; rerender(); } }, 'Delete')));
    }
    return h('button', { class: 'card entry', title: 'Tap to edit', onclick: () => { editing = `entry:${e.id}`; rerender(); } },
      h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, e.desc), h('b', { class: e.amount < 0 ? 'neg' : 'pos' }, money(e.amount))),
      h('div', { class: 'card-top' }, h('span', { class: 'meta' }, `${e.date} · ${e.category}`), h('span', { class: 'meta' }, e.by === 'mayor' ? 'you' : (agentById(e.by)?.name || e.by))));
  });
  body.append(section('spending', `💸 Spending · ${monthName(month)}`,
    h('div', { class: 'totals' },
      h('div', { class: 'total in' }, h('span', {}, 'Received'), h('b', {}, money(s.income))),
      h('div', { class: 'total out' }, h('span', {}, 'Spent'), h('b', {}, money(s.spent))),
      h('div', { class: `total ${s.net >= 0 ? 'in' : 'out'}` }, h('span', {}, 'Net'), h('b', {}, money(s.net)))),
    h('h3', {}, 'Budgets'), ...(budgetRows.length ? budgetRows : [h('p', { class: 'note' }, 'No budgets or spending yet this month.')]),
    h('h3', {}, 'Add an entry'),
    h('form', { class: 'entry-form', onsubmit: (ev) => {
      ev.preventDefault();
      const amt = Math.abs(Number(f.amount.value));
      if (!f.desc.value.trim() || !amt) { toastFn('Add a description and an amount.'); return; }
      const signed = f.type.value === 'in' ? amt : -amt;
      addEntry({ date: f.date.value || todayISO(), desc: f.desc.value.trim(), amount: signed, category: f.cat.value || guessCategory(f.desc.value, signed), by: 'mayor' });
      document.activeElement?.blur(); toastFn('Recorded.'); rerender();
    } },
      h('div', { class: 'two' }, f.date, f.type), f.desc, h('div', { class: 'two' }, f.amount, f.cat),
      h('button', { class: 'btn', type: 'submit' }, 'Add to the Treasury')),
    h('p', { class: 'note' }, 'Or tell Penny in Talk: “spent $12 on lunch”, “paid the electric bill”, “what bills are due?”, “how much do I owe?”.'),
    h('h3', {}, `Entries (${entries.length})`),
    ...(entryRows.length ? entryRows : [h('p', { class: 'note' }, 'Nothing recorded this month yet.')])));

  // ── Income ─────────────────────────────────────────────────
  body.append(section('income', `💵 Income · ${money(inc.typical)} typical month`,
    ...incomes().map(i => editing === `incomes:${i.id}` ? editor('incomes', i)
      : h('button', { class: 'card entry', onclick: () => { editing = `incomes:${i.id}`; rerender(); } },
          h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, i.name), h('b', { class: 'pos' }, money(i.amount || 0))),
          h('div', { class: 'meta' }, [i.frequency, i.owner, i.depositsTo && `→ ${i.depositsTo}`].filter(Boolean).join(' · ')))),
    editing === 'new:incomes' ? editor('incomes', { frequency: 'Biweekly' }) : h('button', { class: 'btn btn-ghost', onclick: () => { editing = 'new:incomes'; rerender(); } }, '+ Add income')));

  // ── Accounts & debts ───────────────────────────────────────
  const acctRow = (a) => editing === `accounts:${a.id}` ? editor('accounts', a)
    : h('button', { class: 'card entry', onclick: () => { editing = `accounts:${a.id}`; rerender(); } },
        h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, `${a.name}${a.last4 ? ` …${a.last4}` : ''}`),
          h('b', { class: ['Credit Card', 'Loan'].includes(a.type) ? 'neg' : 'pos' }, money(Math.abs(a.balance || 0)))),
        h('div', { class: 'meta' }, [a.type, a.institution, a.owner, a.asOf && `as of ${niceDate(a.asOf)}`].filter(Boolean).join(' · ')),
        a.notes ? h('div', { class: 'meta' }, a.notes) : null);
  body.append(section('accounts', `🏦 Accounts & debts · net ${money(at.net)}`,
    h('h3', {}, `Cash · ${money(at.cash)}`), ...accounts().filter(a => !['Credit Card', 'Loan'].includes(a.type)).map(acctRow),
    h('h3', {}, `Debts · ${money(at.debt)}`), ...accounts().filter(a => ['Credit Card', 'Loan'].includes(a.type)).sort((x, y) => Math.abs(y.balance || 0) - Math.abs(x.balance || 0)).map(acctRow),
    editing === 'new:accounts' ? editor('accounts', { type: 'Checking', asOf: todayISO() }) : h('button', { class: 'btn btn-ghost', onclick: () => { editing = 'new:accounts'; rerender(); } }, '+ Add an account')));

  body.append(sheetSection());
}

// ── Google Sheet link ────────────────────────────────────────
function sheetSection() {
  const st = sheetSettings();
  const run = (fn, ok) => async () => { try { const r = await fn(); if (ok) toastFn(ok(r)); } catch (e) { toastFn(e.message); sheetStatus.text = e.message; sheetStatus.ok = false; } rerender(); };
  const url = h('input', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: st.url || '', 'aria-label': 'Web app URL' });
  url.addEventListener('change', () => { st.url = url.value.trim(); touchMeta(); toastFn(sheetReady() ? 'Link saved. Tap Test connection.' : 'That doesn\'t look like a Web app URL.'); url.blur(); rerender(); });
  const auto = h('input', { type: 'checkbox', checked: st.auto !== false });
  auto.addEventListener('change', () => { st.auto = auto.checked; touchMeta(); });
  const tick = h('input', { type: 'checkbox', checked: st.tickPaid !== false });
  tick.addEventListener('change', () => { st.tickPaid = tick.checked; touchMeta(); });
  return section('sheet', `🔗 Google Sheet ${sheetReady() ? '· connected' : '· not connected'}`,
    h('p', { class: 'note' }, 'Keeps your Google Sheet up to date. The kingdom writes its own tabs (Kingdom – Bills, Spending, Accounts, Income) and ticks a “Paid <month>” column in your Recurring Bills tab. Your other cells and formulas are never changed.'),
    sheetReady() ? null : h('ol', { class: 'steps' },
      h('li', {}, h('button', { class: 'btn', onclick: run(async () => { await navigator.clipboard.writeText(await bridgeScript()); }, () => 'Script copied, with your key filled in.') }, '📋 Copy the bridge script')),
      h('li', {}, 'Open your tracker sheet → Extensions → Apps Script. Delete what\'s there, paste, and click 💾 Save.'),
      h('li', {}, 'Click Deploy → New deployment → ⚙ Select type → Web app. Set “Execute as: Me” and “Who has access: Anyone”. Click Deploy and allow access (if Google warns the app isn\'t verified: Advanced → Go to project).'),
      h('li', {}, 'Copy the Web app URL and paste it below.')),
    h('label', {}, 'Web app URL', url),
    h('label', { class: 'check' }, auto, 'Send changes to the sheet automatically'),
    h('label', { class: 'check' }, tick, 'Tick the “Paid” column in my Recurring Bills tab'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-ghost', disabled: !sheetReady(), onclick: run(testSheet, r => `Connected to “${r.sheet}”.`) }, 'Test connection'),
      h('button', { class: 'btn', disabled: !sheetReady(), onclick: run(() => sendToSheet({ force: true }), () => 'Sheet updated.') }, '⬆ Send now'),
      h('button', { class: 'btn btn-ghost', disabled: !sheetReady(), onclick: run(() => { if (!confirm('Update the Treasury from your sheet? Bills, accounts and income in the sheet will overwrite the same items here (nothing is deleted).')) throw new Error('Cancelled.'); return pullFromSheet(); }, c => `Pulled ${c.bills} bills from your sheet.`) }, '⬇ Pull from sheet')),
    sheetStatus.text ? h('p', { class: `note ${sheetStatus.ok === false ? 'warn-text' : ''}` }, sheetStatus.text) : null,
    h('details', {}, h('summary', { class: 'note' }, 'Key & advanced'),
      h('p', { class: 'note' }, 'Your bridge key (it\'s inside the copied script; it stops anyone else using your sheet link):'),
      h('code', { class: 'keybox' }, st.key),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-ghost', onclick: run(async () => { await navigator.clipboard.writeText(await bridgeScript()); }, () => 'Script copied.') }, 'Copy script again'),
        h('button', { class: 'btn btn-danger', onclick: () => { if (confirm('Make a new key? You will need to paste the script into your sheet again and redeploy.')) { st.key = newKey(); touchMeta(); rerender(); } } }, 'New key'))));
}

// ── Download / import ────────────────────────────────────────
function saveFile(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });   // BOM so Excel reads symbols
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function download() {
  const what = $('#treasury-what').value, day = todayISO();
  if (what === 'bills') saveFile(`royal-treasury-bills-${day}.csv`, billsCSV());
  else if (what === 'entries') saveFile(`royal-treasury-spending-${day}.csv`, toCSV());
  else if (what === 'income') saveFile(`royal-treasury-income-${day}.csv`, incomeCSV());
  else if (what === 'accounts') saveFile(`royal-treasury-accounts-${day}.csv`, accountsCSV());
  else saveFile(`royal-treasury-everything-${day}.csv`, ['BILLS', billsCSV(), '', 'INCOME', incomeCSV(), '', 'ACCOUNTS & DEBTS', accountsCSV(), '', 'SPENDING', toCSV()].join('\r\n'));
  toastFn('Spreadsheet downloaded (opens in Excel or Google Sheets).');
}

export function initTreasury(toast) {
  toastFn = toast || toastFn;
  $('#treasury-download').addEventListener('click', download);
  $('#treasury-import').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      if (/^\s*\{/.test(text)) {
        const c = importTrackerFile(JSON.parse(text));
        toastFn(`Tracker imported: ${c.bills} bills, ${c.incomes} income sources, ${c.accounts} accounts.`);
      } else {
        const n = importCSV(text); toastFn(`Imported ${n} entr${n === 1 ? 'y' : 'ies'}.`);
      }
      rerender();
    } catch (err) { toastFn(`Import failed: ${err.message}`); }
    e.target.value = '';
  });
  onChange(() => { if ($('#panel-treasury')?.classList.contains('active')) renderTreasury(); });
  sheetStatus.listeners.add(() => { if ($('#panel-treasury')?.classList.contains('active')) renderTreasury(); });
  renderTreasury();
}
