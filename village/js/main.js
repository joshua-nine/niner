// Boot: draw the world, spawn villagers, run the loop, wire clicks.
import { renderStatic, renderDynamic, size, buildingAt } from './world.js';
import { initAgents, update, render, agentAt, hooks, moveMayorTo, busyHouses, say } from './agents.js';
import { state, log } from './store.js';
import { workOnTask } from './brain.js';
import { initUI, ui, selectAgent } from './ui.js';

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
initUI();
ui.onSelect = () => {};

if (!state.log.length) {
  log('chief', 'Village founded. Talk to me (the Chief of Staff) to get started.', 'ok');
  setTimeout(() => say('chief', `Welcome home, ${state.mayorName}! Click me to give the team work.`, 7), 1200);
}

// Night falls with your local clock.
function nightLevel() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 7 && h <= 18) return 0;
  if (h > 18 && h < 21) return (h - 18) / 3 * 0.45;
  if (h >= 5 && h < 7) return (7 - h) / 2 * 0.45;
  return 0.45;
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
