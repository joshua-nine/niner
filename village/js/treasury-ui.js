// The 💰 Treasury tab: see, edit and download the King's money tracker.
import { state, onChange, agentById } from './store.js';
import {
  treasury, liveEntries, addEntry, updateEntry, deleteEntry, setBudget, monthSummary,
  money, toCSV, importCSV, guessCategory,
} from './treasury.js';

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

let month = new Date().toISOString().slice(0, 7);
let editing = null;
let toastFn = () => {};
const monthName = (m) => new Date(`${m}-15T12:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const shiftMonth = (m, n) => { const d = new Date(`${m}-15T12:00`); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
const catOptions = (sel) => treasury().categories.map(c => h('option', { value: c, selected: c === sel }, c));

export function renderTreasury() {
  const panel = $('#panel-treasury');
  if (!panel) return;
  // Don't rebuild under the King's fingers while they're typing.
  if (panel.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const t = treasury();
  const s = monthSummary(month);
  const entries = liveEntries().filter(e => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date) || (b.created - a.created));

  const body = $('#treasury-body'); body.replaceChildren();

  // Month + totals
  body.append(
    h('div', { class: 'month-nav' },
      h('button', { class: 'btn btn-ghost', onclick: () => { month = shiftMonth(month, -1); renderTreasury(); } }, '‹'),
      h('b', {}, monthName(month)),
      h('button', { class: 'btn btn-ghost', onclick: () => { month = shiftMonth(month, 1); renderTreasury(); } }, '›')),
    h('div', { class: 'totals' },
      h('div', { class: 'total in' }, h('span', {}, 'Income'), h('b', {}, money(s.income))),
      h('div', { class: 'total out' }, h('span', {}, 'Spent'), h('b', {}, money(s.spent))),
      h('div', { class: `total ${s.net >= 0 ? 'in' : 'out'}` }, h('span', {}, 'Balance'), h('b', {}, money(s.net)))),
  );

  // Budgets: spent vs limit, limits editable
  const cats = [...new Set([...Object.keys(t.budgets), ...Object.keys(s.byCat)])].filter(c => c !== 'Income');
  body.append(h('h3', {}, 'Budgets this month'));
  if (!cats.length) body.append(h('p', { class: 'note' }, 'No spending yet this month.'));
  for (const c of cats) {
    const spent = s.byCat[c] || 0, lim = t.budgets[c] || 0;
    const pct = lim ? Math.min(100, (spent / lim) * 100) : 0;
    const input = h('input', { type: 'number', min: '0', step: '1', inputmode: 'decimal', value: lim || '', placeholder: 'no limit', 'aria-label': `${c} monthly budget` });
    input.addEventListener('change', () => { setBudget(c, input.value); toastFn(`${c} budget saved.`); input.blur(); });
    body.append(h('div', { class: 'budget' },
      h('div', { class: 'card-top' }, h('span', {}, c), h('span', { class: `meta ${lim && spent > lim ? 'over' : ''}` }, `${money(spent)}${lim ? ` of ${money(lim)}` : ''}`)),
      lim ? h('div', { class: 'progress' }, h('i', { style: `width:${pct}%;background:${spent > lim ? 'var(--red)' : pct > 80 ? 'var(--gold)' : 'var(--neon)'}` })) : null,
      h('label', { class: 'inline' }, 'Monthly limit', input)));
  }

  // Add an entry
  const f = {
    date: h('input', { type: 'date', value: month === today().slice(0, 7) ? today() : `${month}-01`, 'aria-label': 'Date' }),
    desc: h('input', { placeholder: 'What was it? e.g. Lunch', maxlength: '120', 'aria-label': 'Description' }),
    amount: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', placeholder: 'Amount', 'aria-label': 'Amount' }),
    type: h('select', { 'aria-label': 'Money in or out' }, h('option', { value: 'out' }, 'Spent'), h('option', { value: 'in' }, 'Received')),
    cat: h('select', { 'aria-label': 'Category' }, h('option', { value: '' }, 'Category: auto'), ...catOptions('')),
  };
  body.append(h('h3', {}, 'Add an entry'),
    h('form', { class: 'entry-form', onsubmit: (e) => {
      e.preventDefault();
      const amt = Math.abs(Number(f.amount.value));
      if (!f.desc.value.trim() || !amt) { toastFn('Add a description and an amount.'); return; }
      const signed = f.type.value === 'in' ? amt : -amt;
      addEntry({ date: f.date.value || today(), desc: f.desc.value.trim(), amount: signed, category: f.cat.value || guessCategory(f.desc.value, signed), by: 'mayor' });
      document.activeElement?.blur(); toastFn('Recorded.'); renderTreasury();
    } },
      h('div', { class: 'two' }, f.date, f.type), f.desc, h('div', { class: 'two' }, f.amount, f.cat),
      h('button', { class: 'btn', type: 'submit' }, 'Add to the Treasury')),
    h('p', { class: 'note' }, 'Or just tell Penny (or the Queen) in Talk: “spent $12 on lunch”, “got paid $2000”, “budget $300 for groceries”.'));

  // Entries
  body.append(h('h3', {}, `Entries (${entries.length})`));
  if (!entries.length) body.append(h('p', { class: 'note' }, 'Nothing recorded this month yet.'));
  for (const e of entries.slice(0, 200)) {
    if (editing === e.id) {
      const ed = {
        date: h('input', { type: 'date', value: e.date }), desc: h('input', { value: e.desc, maxlength: '120' }),
        amount: h('input', { type: 'number', step: '0.01', value: Math.abs(e.amount), inputmode: 'decimal' }),
        type: h('select', {}, h('option', { value: 'out', selected: e.amount < 0 }, 'Spent'), h('option', { value: 'in', selected: e.amount > 0 }, 'Received')),
        cat: h('select', {}, ...catOptions(e.category)),
      };
      body.append(h('div', { class: 'card entry editing' },
        h('div', { class: 'two' }, ed.date, ed.type), ed.desc, h('div', { class: 'two' }, ed.amount, ed.cat),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => {
            const amt = Math.abs(Number(ed.amount.value)); if (!amt) { toastFn('Amount must be more than 0.'); return; }
            updateEntry(e.id, { date: ed.date.value, desc: ed.desc.value.trim() || e.desc, amount: ed.type.value === 'in' ? amt : -amt, category: ed.cat.value });
            editing = null; document.activeElement?.blur(); renderTreasury();
          } }, 'Save'),
          h('button', { class: 'btn btn-ghost', onclick: () => { editing = null; renderTreasury(); } }, 'Cancel'),
          h('button', { class: 'btn btn-danger', onclick: () => { deleteEntry(e.id); editing = null; renderTreasury(); } }, 'Delete'))));
    } else {
      body.append(h('button', { class: 'card entry', title: 'Tap to edit', onclick: () => { editing = e.id; renderTreasury(); } },
        h('div', { class: 'card-top' }, h('span', { class: 'card-title' }, e.desc), h('b', { class: e.amount < 0 ? 'neg' : 'pos' }, money(e.amount))),
        h('div', { class: 'card-top' }, h('span', { class: 'meta' }, `${e.date} · ${e.category}`), h('span', { class: 'meta' }, e.by === 'mayor' ? 'you' : (agentById(e.by)?.name || e.by)))));
    }
  }
}

function download() {
  const blob = new Blob(['﻿' + toCSV()], { type: 'text/csv;charset=utf-8' });   // BOM so Excel reads symbols
  const a = h('a', { href: URL.createObjectURL(blob), download: `royal-treasury-${today()}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toastFn('Spreadsheet downloaded (opens in Excel or Google Sheets).');
}

export function initTreasury(toast) {
  toastFn = toast || toastFn;
  $('#treasury-download').addEventListener('click', download);
  $('#treasury-import').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const n = importCSV(await file.text()); toastFn(`Imported ${n} entr${n === 1 ? 'y' : 'ies'}.`); renderTreasury(); }
    catch (err) { toastFn(`Import failed: ${err.message}`); }
    e.target.value = '';
  });
  onChange(() => { if ($('#panel-treasury')?.classList.contains('active')) renderTreasury(); });
  renderTreasury();
}
