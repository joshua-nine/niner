// Pixel-art villagers, drawn procedurally from each agent's palette.
import { STYLE, MAP } from './config.js';

const S = MAP.scale;

// (cx, by) = centre-bottom of the sprite in canvas pixels.
export function drawPerson(ctx, cx, by, p, dir, frame, small = false) {
  const k = small ? 0.78 : 1;
  const u = S * k;                       // one "art pixel"
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * u), Math.round(by + y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  const skin = STYLE.skin[p.skin ?? 0];
  const step = frame % 2 === 1;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, by - u, 5 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();

  // legs
  r(-3, -5 + (step ? -1 : 0), 2, 4 + (step ? 1 : 0), '#2b2d42');
  r(1, -5 + (step ? 0 : -1), 2, 4 + (step ? 0 : 1), '#2b2d42');
  // body
  r(-4, -11, 8, 7, p.shirt);
  r(-4, -5, 8, 1, 'rgba(0,0,0,0.25)');
  // arms
  const sw = step ? 1 : -1;
  r(-5, -10 + sw * 0.5, 1, 5, p.shirt); r(4, -10 - sw * 0.5, 1, 5, p.shirt);
  r(-5, -5 + sw * 0.5, 1, 1, skin);      r(4, -5 - sw * 0.5, 1, 1, skin);
  // accessories
  if (p.kind === 'chief') { r(-0.5, -11, 1, 4, '#c1121f'); }
  // head
  r(-3, -17, 6, 6, skin);
  // hair
  if (dir === 'up') r(-3, -17, 6, 5, p.hair);
  else { r(-3, -18, 6, 2, p.hair); r(-3, -16, 1, 2, p.hair); r(2, -16, 1, 2, p.hair); }
  // eyes
  if (dir !== 'up') {
    const ox = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    r(-2 + ox, -14, 1, 1, '#1b1b1b'); r(1 + ox, -14, 1, 1, '#1b1b1b');
  }
  if (p.kind === 'mayor') {            // gold crown for the human in charge
    r(-3, -20, 6, 2, '#ffd23f'); r(-3, -21, 1, 1, '#ffd23f'); r(-0.5, -21, 1, 1, '#ffd23f'); r(2, -21, 1, 1, '#ffd23f');
  }
}

export function drawLabel(ctx, cx, y, text, color = '#fff', bg = 'rgba(20,20,30,0.75)') {
  ctx.font = `${6 * S}px "Share Tech Mono", monospace`;
  const w = ctx.measureText(text).width + 4 * S;
  ctx.fillStyle = bg;
  ctx.fillRect(Math.round(cx - w / 2), Math.round(y - 4 * S), Math.round(w), 8 * S);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 0.5);
}

export function drawBubble(ctx, cx, by, text) {
  ctx.font = `${6 * S}px "Exo 2", sans-serif`;
  const maxW = 90 * S;
  const words = text.split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    if (lines.length === 3) break;
  }
  if (lines.length < 3 && line) lines.push(line);
  if (lines.length === 3 && words.join(' ').length > lines.join(' ').length) lines[2] = lines[2].replace(/\s*\S*$/, '…');
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 8 * S;
  const lh = 7 * S, h = lines.length * lh + 5 * S;
  const x = Math.round(cx - w / 2), y = Math.round(by - h - 4 * S);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = S;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 3 * S); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 3 * S, y + h); ctx.lineTo(cx, y + h + 4 * S); ctx.lineTo(cx + 3 * S, y + h); ctx.fill();
  ctx.fillStyle = '#1b1b24'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 3 * S + i * lh));
}

export function drawIcon(ctx, cx, y, icon) {
  ctx.font = `${9 * S}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, cx, y);
}
