// Pixel-art royals, wizards and dragons, drawn procedurally from each
// agent's palette. `look` (config.js) picks the sprite.
import { STYLE, MAP } from './config.js';

const S = MAP.scale;
const HEIGHT = { wizard: 29, apprentice: 25, king: 23, queen: 24, princess: 22, prince: 22, duchess: 22, dragon: 21, whelp: 30, owl: 30, jester: 24, squire: 21 };
const ROBED = new Set(['wizard', 'apprentice', 'queen', 'princess', 'duchess']);
const FLYING = new Set(['owl', 'whelp']);

// How tall the sprite is (art pixels × scale), for placing icons/bubbles.
export function spriteHeight(p, small) { return (HEIGHT[p.look] || 22) * (small ? 0.78 : 1) * S; }
export const isFlying = (p) => FLYING.has(p.look);

// (cx, by) = centre-bottom of the sprite in canvas pixels.
export function drawPerson(ctx, cx, by, p, dir, frame, small = false) {
  const look = p.look || 'villager';
  const now = performance.now();
  const k = small ? 0.78 : 1;
  let u = S * k;                        // one "art pixel"
  // shadow on the ground
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, by - u, (look === 'dragon' ? 10 : FLYING.has(look) ? 3.5 : 5) * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();

  if (look === 'dragon') return drawDragon(ctx, cx, by, p, dir, frame, u, now, false);
  if (look === 'whelp') return drawDragon(ctx, cx, by - (9 + Math.sin(now / 160) * 1.5) * u, p, dir, frame, u * 0.62, now, true);
  if (look === 'owl') return drawOwl(ctx, cx, by - (11 + Math.sin(now / 150) * 1.5) * u, p, dir, u, now);

  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * u), Math.round(by + y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  const skin = STYLE.skin[p.skin ?? 0];
  const step = frame % 2 === 1;
  const facing = dir === 'left' ? -1 : 1;

  // cape behind the body (king, prince)
  const cape = p.cape || (look === 'king' ? '#b3132c' : null);
  if (cape && (look === 'king' || look === 'prince')) {
    if (dir === 'up') r(-5, -12, 10, 11, cape);
    else { r(-6, -12, 2, 10, cape); r(4, -12, 2, 10, cape); }
  }

  if (ROBED.has(look)) {
    // long robe / gown: a trapezoid down to the ground, feet peeking out
    r(-4, -11, 8, 3, p.shirt); r(-5, -8, 10, 3, p.shirt); r(-6, -5, 12, 4, p.shirt);
    r(-6, -2, 12, 1, 'rgba(0,0,0,0.25)');
    r(step ? -3 : -2, -1, 2, 1, '#2b2d42'); r(step ? 1 : 2, -1, 2, 1, '#2b2d42');
    if (look === 'queen' || look === 'princess' || look === 'duchess') r(-4, -9, 8, 1, STYLE.gold);   // jewelled belt
  } else {
    r(-3, -5 + (step ? -1 : 0), 2, 4 + (step ? 1 : 0), look === 'squire' ? '#6b6f7a' : '#2b2d42');
    r(1, -5 + (step ? 0 : -1), 2, 4 + (step ? 0 : 1), look === 'squire' ? '#6b6f7a' : '#2b2d42');
    r(-4, -11, 8, 7, p.shirt);
    r(-4, -5, 8, 1, 'rgba(0,0,0,0.25)');
    if (look === 'jester') { r(-4, -11, 4, 7, '#f4d03f'); }
    if (look === 'squire') { r(-1, -11, 2, 7, '#c0392b'); }
  }
  // ermine collar for the King
  if (look === 'king') { r(-5, -12, 10, 2, '#f7f7f2'); r(-3, -12, 1, 1, '#111'); r(1, -12, 1, 1, '#111'); }
  // arms
  const sw = step ? 1 : -1;
  r(-5, -10 + sw * 0.5, 1, 5, p.shirt); r(4, -10 - sw * 0.5, 1, 5, p.shirt);
  r(-5, -5 + sw * 0.5, 1, 1, skin);      r(4, -5 - sw * 0.5, 1, 1, skin);

  // held items
  const hand = facing > 0 ? 5 : -6;
  if (look === 'wizard' || look === 'apprentice') {
    r(hand, -18, 1, 17, '#6d4c2f');
    const glow = 0.6 + Math.sin(now / 220) * 0.4;
    ctx.fillStyle = `rgba(120,230,255,${glow})`;
    ctx.beginPath(); ctx.arc(cx + (hand + 0.5) * u, by - 19 * u, 2 * u, 0, Math.PI * 2); ctx.fill();
  }
  if (look === 'king') { r(hand, -14, 1, 9, STYLE.gold); r(hand - 0.5, -15.5, 2, 2, '#e74c3c'); }
  if (look === 'squire' && dir !== 'up') { r(-facing * 6 - 1, -10, 3, 5, '#7f8c8d'); r(-facing * 6, -9, 1, 3, '#c0392b'); }

  // head
  r(-3, -17, 6, 6, skin);
  // hair (long for the ladies)
  const long = look === 'queen' || look === 'princess' || look === 'duchess';
  if (dir === 'up') r(-3, -17, 6, long ? 8 : 5, p.hair);
  else {
    r(-3, -18, 6, 2, p.hair); r(-3, -16, 1, long ? 6 : 2, p.hair); r(2, -16, 1, long ? 6 : 2, p.hair);
  }
  // eyes
  if (dir !== 'up') {
    const ox = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    r(-2 + ox, -14, 1, 1, '#1b1b1b'); r(1 + ox, -14, 1, 1, '#1b1b1b');
  }
  // beards
  if (look === 'wizard' && dir !== 'up') { r(-3, -12, 6, 2, p.hair); r(-2, -10, 4, 2, p.hair); r(-1, -8, 2, 1, p.hair); }
  if (look === 'king' && dir !== 'up') r(-3, -12, 6, 1, p.hair);

  // headwear
  const G = STYLE.gold;
  if (look === 'king') {
    r(-3, -20, 6, 2, G); r(-3, -22, 1, 2, G); r(-0.5, -22.5, 1, 2.5, G); r(2, -22, 1, 2, G);
    r(-0.5, -19.5, 1, 1, '#e74c3c');
  } else if (look === 'queen') {
    r(-3, -20, 6, 2, G); r(-2, -22, 1, 2, G); r(-0.5, -23, 1, 3, G); r(1, -22, 1, 2, G); r(-0.5, -20, 1, 1, '#5dade2');
  } else if (look === 'princess') {
    r(-2, -19.5, 4, 1.5, '#e8e8f0'); r(-0.5, -21, 1, 1.5, '#e8e8f0'); r(-0.5, -20.5, 1, 1, '#ff6fb1');
  } else if (look === 'prince') {
    r(-3, -19.5, 6, 1.5, G); r(-3, -21, 1, 1.5, G); r(2, -21, 1, 1.5, G);
  } else if (look === 'duchess') {
    r(-3, -19, 6, 1, G); r(-2, -20, 1, 1, '#fff'); r(1, -20, 1, 1, '#fff');
  } else if (look === 'wizard' || look === 'apprentice') {
    const hat = p.hat || p.shirt, tall = look === 'wizard' ? 10 : 7;
    r(-5, -18, 10, 1.5, hat);
    for (let i = 0; i < tall; i++) {
      const w = Math.max(1, 6 - i * 0.6), bend = i > tall - 3 ? facing * (i - tall + 3) : 0;
      r(-w / 2 + bend, -19 - i, w, 1, hat);
    }
    if (look === 'wizard') { r(-1, -22, 1, 1, G); r(1, -24, 1, 1, G); }
  } else if (look === 'squire') {
    r(-3.5, -18.5, 7, 4, '#9aa3ad'); r(-3, -15, 6, 0.8, '#2b2b33'); r(-0.5, -20, 1, 1.5, '#c0392b');
  } else if (look === 'jester') {
    r(-3, -19, 6, 2, '#9c51b6'); r(-5, -21, 3, 2, '#9c51b6'); r(2, -21, 3, 2, '#f4d03f');
    r(-6, -22, 1, 1, G); r(5, -22, 1, 1, G);
  }
}

function drawDragon(ctx, cx, by, p, dir, frame, u, now, flying) {
  const f = dir === 'left' ? -1 : 1;
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + (f > 0 ? x : -x - w) * u), Math.round(by + y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  const body = p.shirt, belly = p.belly || '#e9d58a', dark = 'rgba(0,0,0,0.28)';
  const flap = Math.sin(now / (flying ? 90 : 260));
  const step = frame % 2 === 1;
  // wing (behind)
  ctx.fillStyle = p.hair || body;
  const wx = cx - 2 * f * u, wy = by - 11 * u;
  ctx.beginPath(); ctx.moveTo(wx, wy);
  ctx.lineTo(wx - 7 * f * u, wy - (7 + flap * 4) * u);
  ctx.lineTo(wx - 10 * f * u, wy - (1 + flap * 2) * u);
  ctx.lineTo(wx + 3 * f * u, wy + 1 * u); ctx.closePath(); ctx.fill();
  // tail
  r(-12, -7, 5, 2, body); r(-15, -9, 3, 2, body); r(-17, -11, 2, 3, '#f1c40f');
  // legs
  if (!flying) {
    r(-6, -4 + (step ? -1 : 0), 2, 4, body); r(3, -4 + (step ? 0 : -1), 2, 4, body);
    r(-6, -1, 3, 1, dark); r(3, -1, 3, 1, dark);
  }
  // body + belly + back spikes
  r(-8, -11, 15, 7, body); r(-7, -6, 12, 2, belly);
  for (let i = -6; i <= 3; i += 3) r(i, -12.5, 1.5, 1.5, '#f1c40f');
  // neck + head
  r(5, -15, 3, 5, body);
  r(6, -19, 6, 4, body); r(11, -17.5, 3, 2.5, body);            // snout
  r(8, -18, 1, 1, '#111');                                      // eye
  r(7, -20.5, 1, 1.5, '#f5f0e1'); r(9, -20.5, 1, 1.5, '#f5f0e1'); // horns
  r(13, -17, 1, 1, '#111');                                     // nostril
  r(-8, -5, 15, 1, dark);
  // a puff of smoke / a flicker of fire now and then
  const puff = (now / 1000 + (p.id?.length || 0)) % 6;
  if (puff < 0.6) {
    ctx.fillStyle = flying ? 'rgba(255,170,60,0.9)' : 'rgba(220,220,220,0.7)';
    ctx.beginPath(); ctx.arc(cx + (15 + puff * 6) * f * u, by - (17 + puff * 3) * u, (1.5 + puff * 2) * u, 0, Math.PI * 2); ctx.fill();
  }
}

function drawOwl(ctx, cx, by, p, dir, u, now) {
  const flap = Math.sin(now / 80);
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * u), Math.round(by + y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  // wings
  ctx.fillStyle = p.hair;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + sgn * 3 * u, by - 7 * u);
    ctx.lineTo(cx + sgn * 9 * u, by - (8 + flap * 4) * u);
    ctx.lineTo(cx + sgn * 3 * u, by - 3 * u); ctx.closePath(); ctx.fill();
  }
  r(-3, -9, 6, 8, p.shirt);                   // body
  r(-2, -8, 4, 3, '#f1e0c5');                 // face disc
  if (dir !== 'up') { r(-1.5, -7.5, 1, 1, '#111'); r(0.5, -7.5, 1, 1, '#111'); r(-0.5, -6.5, 1, 1, '#f39c12'); }
  r(-3, -10, 1, 1.5, p.hair); r(2, -10, 1, 1.5, p.hair);   // ear tufts
  r(-1, -1, 2, 1.5, '#fdfaf0');               // the letter it carries
}

// A wild dragon that circles the eastern mountains (pure decoration).
export function drawWildDragon(ctx, x, y, t, facing) {
  drawDragon(ctx, x, y, { shirt: '#8e2a20', hair: '#5d1a14', belly: '#f5c78a', id: 'wild-dragon' }, facing < 0 ? 'left' : 'right', 0, S * 1.1, t, true);
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
