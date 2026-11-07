// Kingdom ⇄ Google Sheets, via the small Apps Script bridge in
// village/sheets-bridge/Code.gs that the King pastes into his spreadsheet.
//  • Changes in the Treasury are sent to the sheet automatically (debounced),
//    only from the device that runs the court, so nothing is sent twice.
//  • "Pull from sheet" brings the sheet's bills, accounts and income back in
//    (updates and adds; never deletes).
import { state, save, touchMeta, agentById, onChange, log } from './store.js';
import { treasury } from './treasury.js';
import { importTrackerFile, thisMonth } from './household.js';
import { applyInbox } from './inbox.js';

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
    // The court's to-do list, so Claude can read it from the sheet ("Kingdom – Tasks").
    tasks: state.tasks.filter(k => !k.deleted && (k.status !== 'done' || Date.now() - (k.updated || 0) < 14 * 864e5)).slice(0, 200)
      .map(k => ({ id: k.id, owner: k.owner, ownerName: agentById(k.owner)?.name || k.owner, title: k.title, status: k.status, notes: k.notes || '',
        result: k.result || '', created: new Date(k.created || Date.now()).toISOString().slice(0, 16).replace('T', ' '), byName: k.by === 'mayor' ? (state.mayorName || 'The King') : (agentById(k.by)?.name || k.by) })),
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
  bridgeVersion = r.version || 1;
  emit(`Connected to “${r.sheet}”.` + (bridgeVersion < 2 ? ' Your bridge script is an older version: copy it again and deploy a new version to attach bill documents.' : ''), bridgeVersion >= 2);
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

// ── Bill documents → Google Drive (bridge v2) ───────────────
let bridgeVersion = 0;
const readAsBase64 = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(blob); });
// Photos are shrunk (max 2000px, JPEG) so they upload fast on mobile data.
async function shrinkImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}
export async function uploadDoc(file, { billName = '', month = '' } = {}) {
  if (!sheetReady()) throw new Error('Connect your Google Sheet first (Treasury → Google Sheet). Bill documents are saved to your Google Drive through it.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is over 25 MB.');
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'pdf').toLowerCase();
  const name = `${billName || 'Bill'} – ${month || new Date().toISOString().slice(0, 7)}.${ext}`;
  emit(`Uploading ${name}…`, null);
  let r;
  try { r = await call('POST', { key: sheetSettings().key, action: 'upload', name, mimeType: blob.type || file.type, data: await readAsBase64(blob), billName, month }); }
  catch (e) { throw new Error(/unknown action/i.test(e.message) ? 'Your bridge script is an older version. In Treasury → Google Sheet, copy the script again, paste it in Apps Script, then Deploy → Manage deployments → ✏️ → New version → Deploy.' : e.message); }
  emit(`Saved “${r.name}” to your Drive (Kingdom – Bills).`, true);
  return { id: r.id, url: r.url, name: r.name, size: r.size, mimeType: blob.type || file.type, month, added: Date.now() };
}
export async function trashDoc(doc) {
  if (!sheetReady()) throw new Error('The Google Sheet isn\'t connected.');
  await call('POST', { key: sheetSettings().key, action: 'trash', id: doc.id });
}

// ── Hand-off with Claude: pick up the "Kingdom – Inbox" tab ──
export async function checkInbox({ quiet = false } = {}) {
  if (!sheetReady()) throw new Error('The Google Sheet isn\'t connected yet.');
  let r;
  try { r = await call('GET', null, `?action=inbox&key=${encodeURIComponent(sheetSettings().key)}`); }
  catch (e) { throw new Error(/unknown action/i.test(e.message) ? 'Your bridge script is an older version. Copy it again (Treasury → Google Sheet), paste it in Apps Script, then Deploy → Manage deployments → ✏️ → New version.' : e.message); }
  if (!r.items.length) { if (!quiet) emit('Inbox checked: nothing new from Claude.', true); return { applied: 0, failed: 0 }; }
  const { applied, acks } = applyInbox(r.items);
  await call('POST', { key: sheetSettings().key, action: 'inbox-ack', acks });
  const failed = acks.filter(a => !a.ok).length;
  emit(`Inbox: picked up ${applied} item${applied === 1 ? '' : 's'} from Claude${failed ? `, ${failed} couldn't be applied (see the App note column)` : ''}.`, !failed);
  return { applied, failed };
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
  // Check Claude's inbox on start, every 10 minutes, and when the app comes back to the screen.
  const inboxTick = () => { if (sheetReady() && isLeader()) checkInbox({ quiet: true }).catch(() => {}); };
  setTimeout(inboxTick, 12000);
  setInterval(inboxTick, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(inboxTick, 3000); });
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
