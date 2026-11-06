// Sync your kingdom between phone and computer.
//
// Sign in (same account on every device) and the whole kingdom (tasks,
// petitions, chats, the court, settings) is saved to your Firebase account
// and kept in step in real time. Each device also keeps a local copy, so it
// still works offline and catches up when it reconnects.
//
// • Changes merge record by record (store.js → mergeStates), so editing on
//   two devices at once doesn't overwrite either one.
// • Your Anthropic API key is NOT synced; enter it once on each device.
// • Only one device at a time "runs the court" (does the background work
//   and the Queen's reviews), so nothing happens twice. The device you're
//   looking at takes over within a minute if the other one goes to sleep.
import {
  state, deviceId, persistHooks, mergeStates, applyMerged, shareable, log,
} from './store.js';

const FB = 'https://www.gstatic.com/firebasejs/12.13.0';
const MAX_BYTES = 900_000;                 // Firestore documents top out at 1 MiB

export const sync = {
  user: null,           // { uid, email }
  status: 'local',      // local | connecting | synced | error
  error: '',
  lastSynced: 0,
  leader: true,         // does this device run the court?
  listeners: new Set(),
};
const emit = () => sync.listeners.forEach(fn => fn());
export const onSyncChange = (fn) => sync.listeners.add(fn);

let fb = null;          // loaded Firebase modules
let ref = null;         // this user's kingdom document
let unsub = null;
let lastPushed = '';
let pushTimer = null;
let worker = { device: null, beat: 0 };
let workerSeenAt = 0;

async function loadFirebase() {
  if (fb) return fb;
  const [{ auth, db }, a, f] = await Promise.all([
    import('../../js/firebase-config.js'),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`),
  ]);
  fb = { auth, db, ...a, ...f };
  return fb;
}

function payload() {
  let data = shareable();
  let json = JSON.stringify(data);
  if (json.length > MAX_BYTES) {           // trim old chatter, never tasks/petitions
    for (const id of Object.keys(data.chats)) data.chats[id] = data.chats[id].slice(-30);
    data.log = data.log.slice(0, 60);
    data.townhall = [];
    json = JSON.stringify(data);
  }
  return json;
}

async function pushNow() {
  if (!ref) return;
  const json = payload();
  if (json === lastPushed) return;
  try {
    await fb.setDoc(ref, { json, device: deviceId, updatedAt: fb.serverTimestamp() }, { merge: true });
    lastPushed = json;
    sync.status = 'synced'; sync.lastSynced = Date.now(); sync.error = '';
  } catch (e) {
    sync.status = 'error'; sync.error = e.code === 'permission-denied'
      ? 'Firestore refused the write. Add the "kingdoms" rule from the README.' : e.message;
  }
  emit();
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 1200); }

function mergeIn(json) {
  try {
    const remote = JSON.parse(json);
    applyMerged(mergeStates(state, remote));
    sync.lastSynced = Date.now();
    if (payload() !== json) schedulePush();     // we had changes they didn't: send them back
  } catch (e) { console.warn('Could not merge remote kingdom', e); }
}

// ── Who runs the court ───────────────────────────────────────
function workerFresh() {
  if (!worker.device) return false;
  if (worker.device === deviceId) return Date.now() - worker.beat < 60_000;
  return Date.now() - workerSeenAt < 60_000;
}
async function heartbeat() {
  if (!ref) { sync.leader = true; emit(); return; }
  const visible = document.visibilityState === 'visible';
  if (visible && (!workerFresh() || worker.device === deviceId)) {
    worker = { device: deviceId, beat: Date.now() };
    sync.leader = true;
    try { await fb.updateDoc(ref, { worker }); } catch { /* doc may not exist yet */ }
  } else {
    sync.leader = worker.device === deviceId && visible;
  }
  emit();
}
async function release() {
  if (!ref || worker.device !== deviceId) return;
  worker = { device: null, beat: 0 };
  sync.leader = false;
  try { await fb.updateDoc(ref, { worker }); } catch { /* ignore */ }
}

async function attach(user) {
  sync.user = { uid: user.uid, email: user.email };
  sync.status = 'connecting'; sync.leader = false; emit();
  ref = fb.doc(fb.db, 'kingdoms', user.uid);
  try {
    const snap = await fb.getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      if (d.worker) { worker = d.worker; workerSeenAt = Date.now(); }
      if (d.json) { mergeIn(d.json); lastPushed = d.json; }
      log('chief', 'Your kingdom is synced with your other devices', 'ok');
    } else {
      log('chief', 'Your kingdom is now saved to your account', 'ok');
    }
    await pushNow();
    await heartbeat();
    unsub = fb.onSnapshot(ref, (s) => {
      if (s.metadata.hasPendingWrites || !s.exists()) return;
      const d = s.data();
      if (d.worker && (d.worker.device !== worker.device || d.worker.beat !== worker.beat)) {
        worker = d.worker; workerSeenAt = Date.now();
        sync.leader = worker.device === deviceId && document.visibilityState === 'visible';
      }
      if (d.json && d.json !== lastPushed && d.device !== deviceId) { lastPushed = d.json; mergeIn(d.json); }
      sync.status = 'synced'; emit();
    }, (e) => {
      sync.status = 'error';
      sync.error = e.code === 'permission-denied' ? 'Firestore refused access. Add the "kingdoms" rule from the README.' : e.message;
      emit();
    });
  } catch (e) {
    sync.status = 'error';
    sync.error = e.code === 'permission-denied' ? 'Firestore refused access. Add the "kingdoms" rule from the README.' : e.message;
    emit();
  }
}

function detach() {
  if (unsub) unsub();
  unsub = null; ref = null; lastPushed = '';
  sync.user = null; sync.status = 'local'; sync.leader = true;
  emit();
}

// ── Public API ───────────────────────────────────────────────
export async function initSync() {
  persistHooks.push = () => { if (ref) schedulePush(); };
  try {
    await loadFirebase();
  } catch (e) {
    sync.status = 'local'; sync.error = 'Sync unavailable (could not load Firebase). The kingdom still saves on this device.';
    emit();
    return;
  }
  fb.onAuthStateChanged(fb.auth, (user) => { if (user) attach(user); else detach(); });
  setInterval(heartbeat, 20_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { heartbeat(); if (ref) pushNow(); }
    else { if (ref) pushNow(); release(); }
  });
  window.addEventListener('pagehide', () => { if (ref) pushNow(); });
}

export async function signIn(email, password) {
  await loadFirebase();
  await fb.signInWithEmailAndPassword(fb.auth, email, password);
}
export async function signUp(email, password) {
  await loadFirebase();
  await fb.createUserWithEmailAndPassword(fb.auth, email, password);
}
export async function signOutSync() {
  await pushNow();
  await release();
  await fb.signOut(fb.auth);
}
export async function resetPassword(email) {
  await loadFirebase();
  await fb.sendPasswordResetEmail(fb.auth, email);
}

export function friendlyAuthError(e) {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email or password is wrong.';
  if (c.includes('email-already-in-use')) return 'That email already has an account. Sign in instead.';
  if (c.includes('weak-password')) return 'Use at least 6 characters for the password.';
  if (c.includes('invalid-email')) return 'That email address looks wrong.';
  if (c.includes('network')) return 'No connection. Try again when you\'re online.';
  if (c.includes('unauthorized-domain') || c.includes('operation-not-allowed')) return 'Sign-in isn\'t enabled for this website yet. See the README setup steps.';
  return e?.message || String(e);
}
