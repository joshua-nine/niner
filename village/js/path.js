// Step 4 — Pathfinding. A* on the tile grid, 4-directional, preferring
// roads so agents walk like villagers instead of cutting across lawns.
import { walkable, grid, G } from './world.js';

const key = (x, y) => (y << 8) | x;

export function findPath(from, to, blocked = new Set(), maxNodes = 4000) {
  if (!walkable(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const open = [{ x: from.x, y: from.y, g: 0, f: 0 }];
  const came = new Map();
  const gScore = new Map([[key(from.x, from.y), 0]]);
  const h = (x, y) => Math.abs(x - to.x) + Math.abs(y - to.y);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let k = key(cur.x, cur.y);
      while (came.has(k)) { path.unshift({ x: k & 255, y: k >> 8 }); k = came.get(k); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!walkable(nx, ny)) continue;
      if (blocked.has(nk) && !(nx === to.x && ny === to.y)) continue;
      const tileCost = grid[ny][nx] === G.PATH || grid[ny][nx] === G.PLAZA ? 1 : 2.2;
      const g = cur.g + tileCost;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, key(cur.x, cur.y));
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}

export const tileKey = key;
