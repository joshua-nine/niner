// Kingdom ⇄ Google Sheets, via the small Apps Script bridge in
// village/sheets-bridge/Code.gs that the King pastes into his spreadsheet.
//  • Changes in the Treasury are sent to the sheet automatically (debounced),
//    only from the device that runs the court, so nothing is sent twice.
//  • "Pull from sheet" brings the sheet's bills, accounts and income back in
//    (updates and adds; never deletes).
import { state, save, touchMeta, agentById, onChange, log } from './store.js';
import { treasury } from './treasury.js';
import { importTrackerFile, thisMonth } from './household.js';

export const sheetStatus = { text: '', ok: null, at: 0, listeners: new Set() };
const emit = (text, ok) => { Object.assign(sheetStatus, { text, ok, at: Date.now() }); sheetStatus.listeners.forEach(f => f()); };

export function sheetSettings() {
  const s = (state.settings.sheet ||= { url: '', key: '', auto: true, tickPaid: true });
  if (!s.key) { s.key = newKey(); touchMeta(); }
  return s;
}
export function newKey() {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return 'kk_' + [...a].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 28);
}
export const sheetReady = () => /^https:\/\/script\.google(usercontent)?\.com\//.test(sheetSettings().url || '');

function payload(action) {
  const t = treasury();
  const strip = (arr = []) => arr.filter(x => !x.deleted);
  return {
    key: sheetSettings().key, action, month: thisMonth(), tickPaid: sheetSettings().tickPaid !== false,
    treasury: {
      bills: strip(t.bills), accounts: strip(t.accounts), incomes: strip(t.incomes),
      entries: strip(t.entries).map(e => ({ ...e, byName: e.by === 'mayor' ? (state.mayorName || 'The King') : (agentById(e.by)?.name || e.by) })),
    },
  };
}

async function call(method, body, params = '') {
  const url = sheetSettings().url + params;
  const res = await fetch(url, method === 'POST'
    ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' }
    : { method: 'GET', redirect: 'follow' });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(/<html/i.test(text) ? 'The sheet answered with a web page. Check the URL is the Web app URL and access is set to "Anyone".' : 'Unexpected answer from the sheet.'); }
  if (!data.ok) throw new Error(data.error || 'The sheet refused the request.');
  return data;
}

export async function testSheet() {
  if (!sheetReady()) throw new Error('Paste the Web app URL first (it starts with https://script.google.com/).');
  const r = await call('GET', null, `?action=ping&key=${encodeURIComponent(sheetSettings().key)}`);
  emit(`Connected to “${r.sheet}”.`, true);
  return r;
}

let lastSent = '';
try { lastSent = localStorage.getItem('kingdom-sheet-last') || ''; } catch { /* fine */ }
const fingerprint = () => JSON.stringify(payload('sync').treasury);

export async function sendToSheet({ force = false } = {}) {
  if (!sheetReady()) throw new Error('The Google Sheet isn\'t connected yet.');
  const fp = fingerprint();
  if (!force && fp === lastSent) return null;
  emit('Sending to your sheet…', null);
  const r = await call('POST', payload('sync'));
  lastSent = fp; try { localStorage.setItem('kingdom-sheet-last', fp); } catch { /* fine */ }
  const t = r.ticked;
  emit(`Sheet updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${r.bills} bills, ${r.entries} entries` +
    (t && !t.error ? ` · Paid column: ${t.matched}/${t.of} bills matched` : t?.error ? ` · ${t.error}` : '') + '.', true);
  return r;
}

export async function pullFromSheet() {
  if (!sheetReady()) throw new Error('The Google Sheet isn\'t connected yet.');
  emit('Reading your sheet…', null);
  const r = await call('GET', null, `?action=pull&key=${encodeURIComponent(sheetSettings().key)}`);
  const c = importTrackerFile(r);
  emit(`Pulled from your sheet: ${c.bills} bills, ${c.incomes} income sources, ${c.accounts} accounts updated.`, true);
  log('money', `Updated the Treasury from your Google Sheet (${c.bills} bills, ${c.accounts} accounts)`, 'ok');
  return c;
}

// The bridge script with the King's key already filled in, ready to paste.
export async function bridgeScript() {
  const res = await fetch('sheets-bridge/Code.gs', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the bridge script.');
  return (await res.text()).replace("'PASTE-YOUR-KINGDOM-KEY-HERE'", `'${sheetSettings().key}'`);
}

// Automatic sending: a few seconds after the Treasury changes.
let timer = null;
export function initSheetSync(isLeader) {
  onChange(() => {
    const s = state.settings.sheet;
    if (!s || !s.auto || !sheetReady() || !isLeader()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (fingerprint() === lastSent) return;
      sendToSheet().catch(err => emit(`Couldn't update the sheet: ${err.message}`, false));
    }, 4000);
  });
}
