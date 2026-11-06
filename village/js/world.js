// Step 1: Build the world. Tile grid, roads, castles, towers, mountains,
// and a pre-rendered static layer drawn from the STYLE palette.
import { MAP, BUILDINGS, PLAZA, FOUNTAIN, POND, STYLE, MOUNTAIN_ZONES } from './config.js';

const { cols, rows, tile, scale } = MAP;
const T = tile * scale;           // on-canvas pixels per tile
const s = scale;                  // one art pixel

export const G = { GRASS: 0, PATH: 1, PLAZA: 2, BUILDING: 3, TREE: 4, WATER: 5, FOUNTAIN: 6, FLOWER: 7, MOUNTAIN: 8 };

export const grid = Array.from({ length: rows }, () => new Array(cols).fill(G.GRASS));
const deco = Array.from({ length: rows }, () => new Array(cols).fill(0));
const peak = Array.from({ length: rows }, () => new Array(cols).fill(1));

// Deterministic RNG so the kingdom looks the same every visit.
let seed = 9;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const inside = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const fill = (r, v) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = v; };
function road(x1, y1, x2, y2) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      if (grid[y][x] === G.GRASS) grid[y][x] = G.PATH;
}

export function doorSpot(id) {
  const b = BUILDINGS.find(b => b.id === id);
  return { x: b.door, y: b.y + b.h };
}
export const building = (id) => BUILDINGS.find(b => b.id === id);

// ── Lay out the map ──────────────────────────────────────────
fill(PLAZA, G.PLAZA);
fill(POND, G.WATER);
for (const b of BUILDINGS) fill(b, G.BUILDING);
fill(FOUNTAIN, G.FOUNTAIN);

road(9, 16, 38, 16);           // the King's Road
road(23, 7, 24, 16);           // Great Hall ⇄ courtyard ⇄ King's Road
road(23, 27, 20, 27); road(20, 27, 20, 16);   // path to the King's Keep
road(32, 21, 35, 21); road(35, 21, 35, 16);   // path to the Queen's Tower
road(9, 6, 9, 23);             // west lane
road(38, 6, 38, 23);           // east lane
for (const id of ['inbox', 'calendar', 'money']) { const d = doorSpot(id); road(d.x, d.y, 9, d.y); }
for (const id of ['content', 'health', 'projects']) { const d = doorSpot(id); road(d.x, d.y, 38, d.y); }

function near(x, y, test) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const v = grid[y + dy]?.[x + dx];
    if (v !== undefined && test(v)) return true;
  }
  return false;
}

// Mountain ranges: clear of roads, allowed to hug buildings (the lair).
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  if (grid[y][x] !== G.GRASS) continue;
  if (!MOUNTAIN_ZONES.some(z => z(x, y))) continue;
  if (near(x, y, v => v === G.PATH || v === G.PLAZA || v === G.WATER)) continue;
  grid[y][x] = G.MOUNTAIN;
  peak[y][x] = 0.8 + rnd() * 0.6;
}

// Trees and flowers on free grass, keeping a clear ring around everything.
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  if (grid[y][x] !== G.GRASS || near(x, y, v => v !== G.GRASS && v !== G.TREE && v !== G.MOUNTAIN)) continue;
  const edge = x < 2 || y < 1 || x > cols - 3 || y > rows - 2;
  const r = rnd();
  if (r < (edge ? 0.55 : 0.07)) grid[y][x] = G.TREE;
  else if (r < (edge ? 0.6 : 0.13)) { deco[y][x] = 1 + Math.floor(rnd() * 3); }
}

export const walkable = (x, y) =>
  x >= 0 && y >= 0 && x < cols && y < rows &&
  (grid[y][x] === G.GRASS || grid[y][x] === G.PATH || grid[y][x] === G.PLAZA || grid[y][x] === G.FLOWER);

export function plazaSpots() {
  const out = [];
  for (let y = PLAZA.y; y < PLAZA.y + PLAZA.h; y++)
    for (let x = PLAZA.x; x < PLAZA.x + PLAZA.w; x++)
      if (walkable(x, y)) out.push({ x, y });
  return out;
}

// Seats for Royal Court: a semicircle in front of the Great Hall gate.
export function meetingSpots() {
  // Staggered rows, one empty tile between neighbours so name tags don't collide.
  const hall = doorSpot('townhall');
  const spots = [];
  for (let ring = 1; ring <= 6; ring++)
    for (let dx = -6 + (ring % 2); dx <= 7; dx += 2) {
      const p = { x: hall.x + dx, y: hall.y + ring, ring, d: Math.abs(dx - 0.5) };
      if (walkable(p.x, p.y)) spots.push(p);
    }
  return spots.sort((a, b) => a.ring - b.ring || a.d - b.d).map(({ x, y }) => ({ x, y }));
}

export function randomWalkableNear(cx, cy, radius) {
  for (let i = 0; i < 40; i++) {
    const x = cx + Math.round((rnd() * 2 - 1) * radius);
    const y = cy + Math.round((rnd() * 2 - 1) * radius);
    if (walkable(x, y)) return { x, y };
  }
  return { x: cx, y: cy };
}

// ── Static render ────────────────────────────────────────────
export const size = { w: cols * T, h: rows * T, T };
const WINDOWS = {};               // building id → [{x,y,w,h}] lit at night / when busy
const GOLD = [];                  // glitter points on the dragon's hoard

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function tri(ctx, x1, y1, x2, y2, x3, y3, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill(); }

function drawGround(ctx) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const X = x * T, Y = y * T, v = grid[y][x];
    px(ctx, X, Y, T, T, STYLE.grass[(x * 7 + y * 13) % 3]);
    if (v === G.PATH) {
      px(ctx, X, Y, T, T, STYLE.path);
      ctx.fillStyle = STYLE.pathEdge;
      for (let i = 0; i < 3; i++) ctx.fillRect(X + ((x * 11 + i * 9) % 13) * s, Y + ((y * 5 + i * 7) % 13) * s, s * 2, s);
    } else if (v === G.PLAZA || v === G.FOUNTAIN) {
      px(ctx, X, Y, T, T, STYLE.plaza);
      ctx.strokeStyle = STYLE.plazaLine; ctx.lineWidth = 1;
      ctx.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
    } else if (v === G.WATER) {
      px(ctx, X, Y, T, T, (x + y) % 2 ? STYLE.water : STYLE.waterDeep);
    } else if (v === G.MOUNTAIN) {
      px(ctx, X, Y, T, T, (x + y) % 2 ? '#7c7a5c' : '#6f8f4e');   // rocky foothills
    } else if (deco[y][x]) {
      const c = ['#ff6b8a', '#ffe066', '#ffffff'][deco[y][x] - 1];
      px(ctx, X + 4 * s, Y + 5 * s, 2 * s, 2 * s, c);
      px(ctx, X + 10 * s, Y + 10 * s, 2 * s, 2 * s, c);
      px(ctx, X + 5 * s, Y + 7 * s, s, 2 * s, '#2f7d3a');
    }
  }
  ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = s * 1.5;
  ctx.strokeRect(POND.x * T, POND.y * T, POND.w * T, POND.h * T);
}

function drawMountain(ctx, x, y) {
  // Only every other tile carries a peak; peaks are big enough to overlap
  // into a range, and the tiles between them read as rocky slopes.
  if ((x + y) % 2) return;
  const k = peak[y][x];
  const cx = x * T + T / 2, base = (y + 1) * T + T * 0.3, w = T * (1.2 + k * 0.35), h = T * (1.6 + k * 0.7);
  const c = STYLE.mountain[(x * 3 + y) % 3];
  tri(ctx, cx - w, base, cx, base - h, cx + w, base, c);
  tri(ctx, cx, base - h, cx + w, base, cx + w * 0.15, base, 'rgba(0,0,0,0.18)');      // shaded face
  tri(ctx, cx - w * 0.3, base - h * 0.7, cx, base - h, cx + w * 0.3, base - h * 0.7, STYLE.snow);
  tri(ctx, cx - w * 0.3, base - h * 0.7, cx - w * 0.12, base - h * 0.62, cx, base - h * 0.7, STYLE.snow);
  tri(ctx, cx, base - h * 0.7, cx + w * 0.15, base - h * 0.6, cx + w * 0.3, base - h * 0.7, '#dfe3ec');
}

function drawTree(ctx, x, y) {
  const X = x * T, Y = y * T;
  px(ctx, X + 7 * s, Y + 10 * s, 2 * s, 5 * s, STYLE.trunk);
  ctx.fillStyle = STYLE.tree[(x + y) % 3];
  ctx.beginPath(); ctx.arc(X + 8 * s, Y + 7 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(X + 6 * s, Y + 5 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
}

// Building pieces ─────────────────────────────────────────────
function stoneBlock(ctx, x, y, w, h) {
  px(ctx, x, y, w, h, STYLE.stone);
  ctx.fillStyle = STYLE.stoneDark;
  for (let row = 0, yy = y + 5 * s; yy < y + h - s; yy += 5 * s, row++)
    for (let xx = x + (row % 2 ? 3 : 7) * s; xx < x + w - s; xx += 9 * s) ctx.fillRect(xx, yy - 4 * s, s, 4 * s);
  for (let yy = y + 5 * s; yy < y + h; yy += 5 * s) ctx.fillRect(x, yy, w, s * 0.6);
  px(ctx, x, y, w, s, STYLE.stoneLight);
  ctx.strokeStyle = STYLE.outline; ctx.lineWidth = s; ctx.strokeRect(x, y, w, h);
}
function battlements(ctx, x, y, w) {
  const m = 4 * s;
  for (let xx = x; xx < x + w - s; xx += m * 2) { px(ctx, xx, y - m, Math.min(m, x + w - xx), m, STYLE.stone); ctx.strokeStyle = STYLE.outline; ctx.lineWidth = s * 0.7; ctx.strokeRect(xx, y - m, Math.min(m, x + w - xx), m); }
}
function cone(ctx, cx, top, base, halfW, color, stars = false) {
  tri(ctx, cx - halfW, base, cx, top, cx + halfW, base, color);
  tri(ctx, cx, top, cx + halfW, base, cx + halfW * 0.25, base, 'rgba(0,0,0,0.2)');
  if (stars) for (let i = 0; i < 4; i++) {
    const t = 0.35 + i * 0.15, xx = cx + (i % 2 ? 0.25 : -0.3) * halfW * t * 1.6;
    px(ctx, xx, top + (base - top) * t, s * 1.5, s * 1.5, STYLE.gold);
  }
}
function flag(ctx, x, y, color) {
  px(ctx, x, y - 9 * s, s, 9 * s, '#444');
  tri(ctx, x + s, y - 9 * s, x + 8 * s, y - 7 * s, x + s, y - 5 * s, color);
}
function gate(ctx, cx, bottom, w, h) {
  ctx.fillStyle = STYLE.door;
  ctx.beginPath(); ctx.moveTo(cx - w / 2, bottom); ctx.lineTo(cx - w / 2, bottom - h + w / 2);
  ctx.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(cx + w / 2, bottom); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let xx = cx - w / 2 + 2 * s; xx < cx + w / 2 - s; xx += 3 * s) ctx.fillRect(xx, bottom - h + w / 2, s * 0.8, h - w / 2);
}
function win(ctx, id, x, y, w, h) {
  px(ctx, x, y, w, h, STYLE.window);
  (WINDOWS[id] ||= []).push({ x, y, w, h });
}
function sign(ctx, cx, y, label) {
  ctx.font = `bold ${7 * s}px "Share Tech Mono", monospace`;
  const tw = ctx.measureText(label).width + 6 * s;
  px(ctx, cx - tw / 2, y, tw, 10 * s, '#3b2a20');
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = s * 0.7; ctx.strokeRect(cx - tw / 2, y, tw, 10 * s);
  ctx.fillStyle = '#fff6dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + 5 * s + 1);
}

function drawCastle(ctx, b, big) {
  const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  const towerW = big ? 2 * T : 1.4 * T;
  const keepTop = Y + H * (big ? 0.28 : 0.32), wallTop = Y + H * 0.5;
  // central keep
  const kx = X + W * 0.28, kw = W * 0.44;
  stoneBlock(ctx, kx, keepTop, kw, H - (keepTop - Y));
  battlements(ctx, kx, keepTop, kw);
  flag(ctx, kx + kw / 2, keepTop - 4 * s, b.roof);
  win(ctx, b.id, kx + kw * 0.2, keepTop + 6 * s, 4 * s, 7 * s);
  win(ctx, b.id, kx + kw * 0.8 - 4 * s, keepTop + 6 * s, 4 * s, 7 * s);
  // curtain wall
  stoneBlock(ctx, X + towerW * 0.6, wallTop, W - towerW * 1.2, H - (wallTop - Y));
  battlements(ctx, X + towerW * 0.6, wallTop, W - towerW * 1.2);
  // corner towers with conical roofs
  for (const tx of [X, X + W - towerW]) {
    const top = Y + H * 0.38;
    stoneBlock(ctx, tx, top, towerW, H - (top - Y));
    cone(ctx, tx + towerW / 2, Y + (big ? 2 : 1) * s, top, towerW / 2 + 2 * s, b.roof);
    flag(ctx, tx + towerW / 2, Y + (big ? 3 : 2) * s, STYLE.gold);
    win(ctx, b.id, tx + towerW / 2 - 2 * s, top + 8 * s, 4 * s, 7 * s);
  }
  // gate centred on the road
  const gx = big ? (b.door + 1) * T : b.door * T + T / 2;
  gate(ctx, gx, Y + H, big ? 1.5 * T : T, big ? 1.6 * T : 1.2 * T);
  // banners either side of the gate
  for (const bx of [gx - (big ? 1.6 : 1.2) * T, gx + (big ? 1.2 : 0.85) * T]) {
    px(ctx, bx, wallTop + 6 * s, 6 * s, 14 * s, b.roof);
    tri(ctx, bx, wallTop + 20 * s, bx + 3 * s, wallTop + 17 * s, bx + 6 * s, wallTop + 20 * s, STYLE.stone);
    px(ctx, bx + 2 * s, wallTop + 9 * s, 2 * s, 2 * s, STYLE.gold);
  }
  if (b.kind === 'keep') {                      // the King's crown over the gate
    const cy = wallTop + 4 * s;
    px(ctx, gx - 5 * s, cy + 3 * s, 10 * s, 3 * s, STYLE.gold);
    for (const dx of [-5, -1, 3]) px(ctx, gx + dx * s, cy, 2 * s, 3 * s, STYLE.gold);
  }
  sign(ctx, gx, wallTop - 1 * s + (big ? 0 : 2 * s), b.label);
}

function drawManor(ctx, b) {
  const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  const bodyTop = Y + H * 0.42;
  stoneBlock(ctx, X + 2 * s, bodyTop, W - 1.4 * T, H - (bodyTop - Y));
  battlements(ctx, X + 2 * s, bodyTop, W - 1.4 * T);
  // round tower on the right with a tall cone
  const tw = 1.3 * T, tx = X + W - tw - 2 * s, top = Y + H * 0.32;
  stoneBlock(ctx, tx, top, tw, H - (top - Y));
  cone(ctx, tx + tw / 2, Y + 2 * s, top, tw / 2 + 3 * s, b.roof);
  flag(ctx, tx + tw / 2, Y + 3 * s, b.roof);
  win(ctx, b.id, tx + tw / 2 - 2 * s, top + 6 * s, 4 * s, 6 * s);
  win(ctx, b.id, X + 8 * s, bodyTop + 6 * s, 5 * s, 6 * s);
  gate(ctx, b.door * T + T / 2, Y + H, 0.6 * T, 0.75 * T);
  sign(ctx, X + W / 2 - 0.4 * T, bodyTop - 13 * s, b.label);
}

function drawTower(ctx, b) {
  const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  const cx = b.door * T + T / 2, tw = 2.2 * T, top = Y + H * 0.42;
  // little study annex on the left
  stoneBlock(ctx, X + 2 * s, Y + H * 0.66, cx - tw / 2 - X, H * 0.34);
  tri(ctx, X, Y + H * 0.66, X + (cx - tw / 2 - X) / 2 + s, Y + H * 0.5, cx - tw / 2 + 2 * s, Y + H * 0.66, b.roof);
  // the tower: round-ish with bands, wizard-hat roof with stars
  stoneBlock(ctx, cx - tw / 2, top, tw, H - (top - Y));
  px(ctx, cx - tw / 2, top + 14 * s, tw, 2 * s, STYLE.stoneDark);
  px(ctx, cx - tw / 2 - 2 * s, top - s, tw + 4 * s, 3 * s, '#6d5a44');            // balcony
  cone(ctx, cx, Y - 0.5 * T, top, tw / 2 + 4 * s, b.roof, true);
  // crescent moon finial
  ctx.fillStyle = STYLE.gold; ctx.beginPath(); ctx.arc(cx, Y - 0.5 * T - 2 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b.roof; ctx.beginPath(); ctx.arc(cx + 1.5 * s, Y - 0.5 * T - 3 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
  win(ctx, b.id, cx - 3 * s, top + 4 * s, 6 * s, 8 * s);
  gate(ctx, cx, Y + H, 0.6 * T, 0.8 * T);
  // signpost out front, beside the door
  const sx = Math.min(X + W - 0.9 * T, cx + 1.7 * T);
  px(ctx, sx - s / 2, Y + H - 9 * s, s, 9 * s, '#5a3a22');
  sign(ctx, sx, Y + H - 19 * s, b.label);
}

function drawLair(ctx, b) {
  const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  // a big rocky mountain with the hoard's cave in its foot
  const peaks = [[X + W * 0.2, Y + H * 0.25, W * 0.36], [X + W * 0.75, Y + H * 0.18, W * 0.38], [X + W * 0.5, Y - 0.6 * T, W * 0.55]];
  for (const [pxx, top, half] of peaks) {
    tri(ctx, pxx - half, Y + H, pxx, top, pxx + half, Y + H, STYLE.mountain[1]);
    tri(ctx, pxx, top, pxx + half, Y + H, pxx + half * 0.2, Y + H, 'rgba(0,0,0,0.18)');
    tri(ctx, pxx - half * 0.28, top + (Y + H - top) * 0.25, pxx, top, pxx + half * 0.28, top + (Y + H - top) * 0.25, STYLE.snow);
  }
  const cx = b.door * T + T / 2;
  ctx.fillStyle = '#17121a';
  ctx.beginPath(); ctx.moveTo(cx - 0.75 * T, Y + H); ctx.arc(cx, Y + H, 0.75 * T, Math.PI, 0); ctx.closePath(); ctx.fill();
  // gold spilling out of the cave
  for (let i = 0; i < 26; i++) {
    const gx = cx - 0.9 * T + rnd() * 1.8 * T, gy = Y + H - rnd() * 0.35 * T;
    px(ctx, gx, gy, 2 * s, 1.5 * s, i % 3 ? STYLE.gold : '#e0a81e');
    if (i % 4 === 0) GOLD.push({ x: gx, y: gy });
  }
  px(ctx, cx + 0.45 * T, Y + H - 6 * s, 4 * s, 4 * s, '#c0392b');           // a ruby
  WINDOWS[b.id] = [{ x: cx - 0.35 * T, y: Y + H - 0.55 * T, w: 0.7 * T, h: 0.3 * T, glow: '#ff7a2f' }];
  sign(ctx, X + W / 2, Y + H * 0.42, b.label);
}

function drawBuilding(ctx, b) {
  if (b.kind === 'castle') drawCastle(ctx, b, true);
  else if (b.kind === 'keep') drawCastle(ctx, b, false);
  else if (b.kind === 'tower') drawTower(ctx, b);
  else if (b.kind === 'lair') drawLair(ctx, b);
  else drawManor(ctx, b);
}

function drawFountain(ctx) {
  const X = FOUNTAIN.x * T, Y = FOUNTAIN.y * T, W = FOUNTAIN.w * T;
  ctx.fillStyle = '#9a9488';
  ctx.beginPath(); ctx.arc(X + W / 2, Y + W / 2, W / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = STYLE.water;
  ctx.beginPath(); ctx.arc(X + W / 2, Y + W / 2, W / 2 - 3 * s, 0, Math.PI * 2); ctx.fill();
  px(ctx, X + W / 2 - 2 * s, Y + W / 2 - 6 * s, 4 * s, 8 * s, '#cfc8ba');
}

export function renderStatic() {
  for (const k of Object.keys(WINDOWS)) delete WINDOWS[k];
  GOLD.length = 0; seed = 77;
  const c = document.createElement('canvas');
  c.width = size.w; c.height = size.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx);
  drawFountain(ctx);
  // Draw back-to-front so nearer things overlap farther ones.
  const items = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (grid[y][x] === G.TREE) items.push([y, () => drawTree(ctx, x, y)]);
    if (grid[y][x] === G.MOUNTAIN) items.push([y, () => drawMountain(ctx, x, y)]);
  }
  for (const b of BUILDINGS) items.push([b.y + b.h - 1, () => drawBuilding(ctx, b)]);
  items.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f());
  return c;
}

// Lit windows, hoard glitter and fountain sparkle (drawn every frame).
export function renderDynamic(ctx, t, night, busy) {
  for (const b of BUILDINGS) {
    const lit = night > 0.25 || busy.has(b.id);
    for (const w of WINDOWS[b.id] || []) {
      if (w.glow) {                               // dragon's fire glows in the cave
        ctx.fillStyle = `rgba(255,122,47,${(busy.has(b.id) ? 0.55 : 0.25) + Math.sin(t / 180) * 0.12})`;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      } else if (lit) { ctx.fillStyle = STYLE.windowLit; ctx.fillRect(w.x + s * 0.5, w.y + s * 0.5, w.w - s, w.h - s); }
    }
  }
  ctx.fillStyle = '#fffbe0';
  GOLD.forEach((g, i) => { if (Math.sin(t / 250 + i * 1.7) > 0.85) ctx.fillRect(g.x, g.y - s, s, s); });
  const fx = (FOUNTAIN.x + 1) * T, fy = (FOUNTAIN.y + 1) * T;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    const a = t / 300 + i * 1.57, r = 6 * s + Math.sin(t / 200 + i) * 2 * s;
    ctx.fillRect(fx + Math.cos(a) * r, fy - 6 * s + Math.sin(a) * r * 0.5, s, s);
  }
}

export function buildingAt(tx, ty) {
  return BUILDINGS.find(b => inside(tx, ty, b));
}
