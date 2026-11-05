// Step 1 — Build the world: tile grid, roads, buildings, nature, and a
// pre-rendered static layer drawn from the STYLE palette.
import { MAP, BUILDINGS, PLAZA, FOUNTAIN, POND, STYLE } from './config.js';

const { cols, rows, tile, scale } = MAP;
const T = tile * scale;           // on-canvas pixels per tile

export const G = { GRASS: 0, PATH: 1, PLAZA: 2, BUILDING: 3, TREE: 4, WATER: 5, FOUNTAIN: 6, FLOWER: 7 };

export const grid = Array.from({ length: rows }, () => new Array(cols).fill(G.GRASS));
const deco = Array.from({ length: rows }, () => new Array(cols).fill(0));

// Deterministic RNG so the village looks the same every visit.
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

road(9, 16, 38, 16);           // main street
road(23, 7, 24, 16);           // town hall ⇄ plaza ⇄ main street
road(23, 27, 20, 27); road(20, 27, 20, 16);   // mayor's front path
road(32, 21, 35, 21); road(35, 21, 35, 16);   // chief's front path
road(9, 6, 9, 23);             // west lane
road(38, 6, 38, 23);           // east lane
for (const id of ['inbox', 'calendar', 'money']) { const d = doorSpot(id); road(d.x, d.y, 9, d.y); }
for (const id of ['content', 'health', 'projects']) { const d = doorSpot(id); road(d.x, d.y, 38, d.y); }

// Trees and flowers on free grass, keeping a clear ring around everything.
function nearNonGrass(x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const v = grid[y + dy]?.[x + dx];
    if (v !== undefined && v !== G.GRASS && v !== G.TREE) return true;
  }
  return false;
}
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  if (grid[y][x] !== G.GRASS || nearNonGrass(x, y)) continue;
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

// Seats for a Town Hall meeting: a semicircle in front of the hall.
export function meetingSpots() {
  const hall = doorSpot('townhall');
  const spots = [];
  for (let ring = 1; ring <= 4 && spots.length < 30; ring++) {
    for (let dx = -ring - 2; dx <= ring + 2; dx++) {
      const p = { x: hall.x + dx, y: hall.y + 1 + ring };
      if (walkable(p.x, p.y) && !spots.some(s => s.x === p.x && s.y === p.y)) spots.push(p);
    }
  }
  return spots;
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

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawGround(ctx) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const X = x * T, Y = y * T, v = grid[y][x];
    px(ctx, X, Y, T, T, STYLE.grass[(x * 7 + y * 13) % 3]);
    if (v === G.PATH) {
      px(ctx, X, Y, T, T, STYLE.path);
      ctx.fillStyle = STYLE.pathEdge;
      for (let i = 0; i < 3; i++) ctx.fillRect(X + ((x * 11 + i * 9) % 13) * scale, Y + ((y * 5 + i * 7) % 13) * scale, scale * 2, scale);
    } else if (v === G.PLAZA || v === G.FOUNTAIN) {
      px(ctx, X, Y, T, T, STYLE.plaza);
      ctx.strokeStyle = STYLE.plazaLine; ctx.lineWidth = 1;
      ctx.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
    } else if (v === G.WATER) {
      px(ctx, X, Y, T, T, (x + y) % 2 ? STYLE.water : STYLE.waterDeep);
    } else if (deco[y][x]) {
      const c = ['#ff6b8a', '#ffe066', '#ffffff'][deco[y][x] - 1];
      px(ctx, X + 4 * scale, Y + 5 * scale, 2 * scale, 2 * scale, c);
      px(ctx, X + 10 * scale, Y + 10 * scale, 2 * scale, 2 * scale, c);
      px(ctx, X + 5 * scale, Y + 7 * scale, scale, 2 * scale, '#2f7d3a');
    }
  }
  // Pond rim
  ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = scale * 1.5;
  ctx.strokeRect(POND.x * T, POND.y * T, POND.w * T, POND.h * T);
}

function drawTree(ctx, x, y) {
  const X = x * T, Y = y * T, s = scale;
  px(ctx, X + 7 * s, Y + 10 * s, 2 * s, 5 * s, STYLE.trunk);
  ctx.fillStyle = STYLE.tree[(x + y) % 3];
  ctx.beginPath(); ctx.arc(X + 8 * s, Y + 7 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(X + 6 * s, Y + 5 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
}

function drawBuilding(ctx, b) {
  const s = scale, X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  const roofH = Math.round(H * 0.45);
  // shadow
  px(ctx, X + 3 * s, Y + 3 * s, W, H, 'rgba(0,0,0,0.18)');
  // walls
  px(ctx, X, Y + roofH, W, H - roofH, STYLE.wall);
  px(ctx, X, Y + H - 3 * s, W, 3 * s, STYLE.wallShade);
  // roof
  ctx.fillStyle = b.roof;
  ctx.beginPath();
  ctx.moveTo(X - 2 * s, Y + roofH);
  ctx.lineTo(X + W / 2, Y);
  ctx.lineTo(X + W + 2 * s, Y + roofH);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 1; i < 4; i++) ctx.fillRect(X, Y + (roofH * i) / 4, W, s);
  if (b.kind === 'townhall') {
    for (let i = 0; i < 5; i++) px(ctx, X + (i + 0.6) * (W / 5.2), Y + roofH + 2 * s, 3 * s, H - roofH - 5 * s, '#e6dccb');
    px(ctx, X + W / 2 - s / 2, Y - 10 * s, s, 12 * s, '#555');
    px(ctx, X + W / 2 + s / 2, Y - 10 * s, 7 * s, 4 * s, '#00d4ff');
  }
  // windows
  const winY = Y + roofH + 4 * s;
  for (const wx of [X + 6 * s, X + W - 14 * s]) {
    px(ctx, wx, winY, 8 * s, 6 * s, STYLE.outline);
    px(ctx, wx + s, winY + s, 6 * s, 4 * s, STYLE.window);
  }
  // door
  const dX = b.door * T + 3 * s;
  px(ctx, dX, Y + H - 13 * s, 10 * s, 13 * s, STYLE.door);
  px(ctx, dX + 7 * s, Y + H - 7 * s, s, s, '#ffd700');
  // sign
  ctx.font = `bold ${7 * s}px "Share Tech Mono", monospace`;
  const tw = ctx.measureText(b.label).width + 6 * s;
  const sx = X + W / 2 - tw / 2, sy = Y + roofH - 12 * s;
  px(ctx, sx, sy, tw, 10 * s, '#3b2a20');
  ctx.fillStyle = '#fff6dd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.label, X + W / 2, sy + 5 * s + 1);
  ctx.strokeStyle = STYLE.outline; ctx.lineWidth = s;
  ctx.strokeRect(X, Y + roofH, W, H - roofH);
}

function drawFountain(ctx) {
  const s = scale, X = FOUNTAIN.x * T, Y = FOUNTAIN.y * T, W = FOUNTAIN.w * T;
  ctx.fillStyle = '#9a9488';
  ctx.beginPath(); ctx.arc(X + W / 2, Y + W / 2, W / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = STYLE.water;
  ctx.beginPath(); ctx.arc(X + W / 2, Y + W / 2, W / 2 - 3 * s, 0, Math.PI * 2); ctx.fill();
  px(ctx, X + W / 2 - 2 * s, Y + W / 2 - 6 * s, 4 * s, 8 * s, '#cfc8ba');
}

export function renderStatic() {
  const c = document.createElement('canvas');
  c.width = size.w; c.height = size.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx);
  drawFountain(ctx);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x] === G.TREE) drawTree(ctx, x, y);
  for (const b of BUILDINGS) drawBuilding(ctx, b);
  return c;
}

// Lit windows + fountain sparkle (drawn every frame).
export function renderDynamic(ctx, t, night, busy) {
  const s = scale;
  for (const b of BUILDINGS) {
    const roofH = Math.round(b.h * T * 0.45);
    const winY = b.y * T + roofH + 4 * s;
    const lit = night > 0.25 || busy.has(b.id);
    if (!lit) continue;
    for (const wx of [b.x * T + 6 * s, b.x * T + b.w * T - 14 * s]) {
      ctx.fillStyle = STYLE.windowLit;
      ctx.fillRect(wx + s, winY + s, 6 * s, 4 * s);
    }
  }
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
