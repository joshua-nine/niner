// Boot: draw the world, spawn villagers, run the loop, wire clicks.
import { renderStatic, renderDynamic, size, buildingAt } from './world.js';
import { initAgents, update, render, agentAt, hooks, moveMayorTo, busyHouses, say, setIcon } from './agents.js';
import { state, log, onChange } from './store.js';
import { workOnTask, superviseNext, nextForReview, queenVisitLine } from './brain.js';
import { initSync, sync } from './sync.js';
import { initUI, ui, selectAgent } from './ui.js';
import { drawWildDragon } from './sprites.js';
import { DRAGON_PERCH } from './config.js';

const canvas = document.getElementById('map');
canvas.width = size.w; canvas.height = size.h;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let world = null;
// Wait for fonts so building signs render in the pixel font.
(document.fonts?.ready || Promise.resolve()).then(() => { world = renderStatic(); });
world = renderStatic();

initAgents();
hooks.onTaskWorked = (id, task) => workOnTask(id, task);
hooks.canWork = () => sync.leader;          // only one of your devices runs the court
hooks.visitLine = queenVisitLine;
onChange(() => initAgents());               // the court may change on another device
initUI();
ui.onSelect = () => {};
initSync();

// ── The Queen supervises every task ──────────────────────────
// Finished tasks and new petitions wait for her review. She takes them one
// at a time; only the device that runs the court does this.
let reviewing = false;
setInterval(async () => {
  if (reviewing || !sync.leader) return;
  const next = nextForReview();
  if (!next) return;
  reviewing = true;
  const who = state.agents.find(a => a.id === (next.type === 'task' ? next.item.owner : next.item.from))
    || state.agents.flatMap(a => a.intern ? [{ ...a.intern }] : []).find(i => i.id === (next.item.owner || next.item.from));
  setIcon('chief', '🔍');
  say('chief', `Reviewing ${who?.name || 'the court'}'s work…`, 30);
  try {
    await new Promise(r => setTimeout(r, 2500));
    const res = await superviseNext();
    if (res) say('chief', res.verdict === 'revise' ? `Back to you, ${res.owner?.name}: ${res.feedback || res.note}` : `Approved: ${res.note}`, 6);
  } catch (e) {
    log('chief', `Review failed: ${e.message}`, 'warn');
  } finally {
    setIcon('chief', null);
    reviewing = false;
  }
}, 4000);

if (!state.log.length) {
  log('chief', 'The kingdom is founded. Speak to me, the Queen, to get started.', 'ok');
  setTimeout(() => say('chief', `Welcome home, Your Majesty! Click me to give the court its orders.`, 7), 1200);
}

// Night falls with your local clock.
function nightLevel() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 7 && h <= 18) return 0;
  if (h > 18 && h < 21) return (h - 18) / 3 * 0.45;
  if (h >= 5 && h < 7) return (7 - h) / 2 * 0.45;
  return 0.45;
}

// A wild dragon circles the eastern peaks and now and then sweeps over the realm.
const smooth = (x) => x * x * (3 - 2 * x);
function wildDragon(now) {
  const T = size.T, sec = now / 1000, cycle = sec % 60;
  const sweep = cycle > 44 ? smooth(Math.min(1, (cycle - 44) / 3)) * smooth(Math.min(1, (60 - cycle) / 3)) : 0;
  const cx = (DRAGON_PERCH.x + (24 - DRAGON_PERCH.x) * sweep) * T, cy = (DRAGON_PERCH.y + (14 - DRAGON_PERCH.y) * sweep) * T;
  const rx = (4 + 14 * sweep) * T, ry = (1.8 + 8 * sweep) * T, a = sec * 0.7;
  const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';                       // shadow far below
  ctx.beginPath(); ctx.ellipse(x, y + 2.2 * T, 0.9 * T, 0.25 * T, 0, 0, Math.PI * 2); ctx.fill();
  drawWildDragon(ctx, x, y, now, -Math.sin(a));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  update(dt);
  ctx.drawImage(world, 0, 0);
  const night = nightLevel();
  renderDynamic(ctx, now, night, busyHouses());
  if (night > 0) { ctx.fillStyle = `rgba(10,15,45,${night})`; ctx.fillRect(0, 0, size.w, size.h); }
  render(ctx, ui.selected);
  wildDragon(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(() => {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const px = (e.clientX - r.left) * (canvas.width / r.width);
  const py = (e.clientY - r.top) * (canvas.height / r.height);
  const who = agentAt(px, py);
  if (who) return selectAgent(who);
  const tx = Math.floor(px / size.T), ty = Math.floor(py / size.T);
  const b = buildingAt(tx, ty);
  if (b) {
    const owner = b.id === 'townhall' ? null : b.id === 'chief' ? 'chief' : state.agents.find(a => a.house === b.id)?.id;
    if (b.id === 'townhall') return document.querySelector('[data-tab="townhall"]').click();
    if (owner) return selectAgent(owner);
    return;
  }
  moveMayorTo({ x: tx, y: ty });
});
