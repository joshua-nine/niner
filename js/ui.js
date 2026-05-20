// ── Toast Notifications ──────────────────────────────────────
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : type === 'warn' ? ' toast-warn' : type === 'info' ? ' toast-info' : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

// ── Modal Helpers ─────────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}
export function setupModalClose(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(id);
  });
}

// ── Tab System ────────────────────────────────────────────────
export function setupTabs(containerSelector) {
  document.querySelectorAll(`${containerSelector} .tab-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(`${containerSelector} .tab-btn`).forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`${containerSelector} .tab-pane`).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// ── Dice Roller ───────────────────────────────────────────────
const rollHistory = [];
let advantageMode = null; // 'adv' | 'dis' | null

export function initDiceRoller() {
  const fab   = document.getElementById('dice-fab');
  const panel = document.getElementById('dice-panel');
  if (!fab || !panel) return;

  fab.addEventListener('click', () => panel.classList.toggle('open'));

  // Die buttons
  panel.querySelectorAll('.die-btn[data-sides]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sides = parseInt(btn.dataset.sides);
      rollDie(sides);
    });
  });

  // Custom roll
  const customInput = document.getElementById('custom-roll-input');
  const customBtn   = document.getElementById('custom-roll-btn');
  if (customBtn && customInput) {
    customBtn.addEventListener('click', () => rollCustom(customInput.value.trim()));
    customInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') rollCustom(customInput.value.trim());
    });
  }

  // Advantage / Disadvantage toggles
  panel.querySelectorAll('.adv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (advantageMode === mode) {
        advantageMode = null;
        panel.querySelectorAll('.adv-btn').forEach(b => b.classList.remove('active-adv', 'active-dis'));
      } else {
        advantageMode = mode;
        panel.querySelectorAll('.adv-btn').forEach(b => b.classList.remove('active-adv', 'active-dis'));
        btn.classList.add(mode === 'adv' ? 'active-adv' : 'active-dis');
      }
    });
  });
}

function rand(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollDie(sides) {
  let result, label;
  if (sides === 20 && advantageMode) {
    const r1 = rand(20), r2 = rand(20);
    result = advantageMode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
    label  = `d20 (${advantageMode === 'adv' ? 'ADV' : 'DIS'}: ${r1}, ${r2})`;
  } else {
    result = rand(sides);
    label  = `d${sides}`;
  }
  displayRoll(result, label);
}

function rollCustom(expr) {
  if (!expr) return;
  const match = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const num = parseInt(expr);
    if (!isNaN(num) && num > 0 && num <= 1000) {
      displayRoll(rand(num), `d${num}`);
    }
    return;
  }
  const count  = Math.min(parseInt(match[1]), 20);
  const sides  = parseInt(match[2]);
  const bonus  = match[3] ? parseInt(match[3]) : 0;
  const rolls  = Array.from({ length: count }, () => rand(sides));
  const sum    = rolls.reduce((a, b) => a + b, 0) + bonus;
  const label  = `${expr.toUpperCase()}: [${rolls.join(', ')}]${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`;
  displayRoll(sum, label);
}

function displayRoll(result, label) {
  const resultEl  = document.getElementById('dice-result');
  const historyEl = document.getElementById('dice-history-list');
  if (!resultEl) return;

  resultEl.textContent = result;
  resultEl.style.animation = 'none';
  void resultEl.offsetWidth;
  resultEl.style.animation = 'rollPop 0.3s ease';

  rollHistory.unshift({ result, label });
  if (rollHistory.length > 10) rollHistory.pop();

  if (historyEl) {
    historyEl.innerHTML = rollHistory
      .map(r => `<div class="dice-history-item">${r.label} = <span class="text-neon">${r.result}</span></div>`)
      .join('');
  }
}

// ── Auth Guard ────────────────────────────────────────────────
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

export function requireAuth(redirectTo = 'index.html') {
  return new Promise(resolve => {
    onAuthStateChanged(auth, user => {
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

export function redirectIfLoggedIn(redirectTo = 'dashboard.html') {
  onAuthStateChanged(auth, user => {
    if (user) window.location.href = redirectTo;
  });
}

// ── Inject shared HTML (navbar + dice panel + toast) ─────────
export function injectSharedUI(activeUser) {
  // Toast container
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  // Dice FAB
  if (!document.getElementById('dice-fab')) {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="dice-fab" title="Dice Roller">🎲</button>
      <div id="dice-panel">
        <div class="dice-panel-title">// Dice Roller</div>
        <div class="adv-row">
          <button class="adv-btn" data-mode="adv">Advantage</button>
          <button class="adv-btn" data-mode="dis">Disadvantage</button>
        </div>
        <div class="dice-grid">
          <button class="die-btn" data-sides="4">d4</button>
          <button class="die-btn" data-sides="6">d6</button>
          <button class="die-btn" data-sides="8">d8</button>
          <button class="die-btn" data-sides="10">d10</button>
          <button class="die-btn" data-sides="12">d12</button>
          <button class="die-btn" data-sides="20">d20</button>
          <button class="die-btn" data-sides="100">d100</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <input id="custom-roll-input" type="text" placeholder="2d6+3" style="flex:1;padding:7px 10px;font-size:13px;">
          <button class="btn btn-ghost" id="custom-roll-btn" style="white-space:nowrap;padding:7px 12px;font-size:11px;">Roll</button>
        </div>
        <div class="dice-result" id="dice-result">—</div>
        <div class="dice-history">
          <div id="dice-history-list"></div>
        </div>
      </div>
    `);
    initDiceRoller();
  }
}

// Inject roll animation keyframes once
const style = document.createElement('style');
style.textContent = `@keyframes rollPop { 0%{transform:scale(1.4);opacity:0.5} 100%{transform:scale(1);opacity:1} }`;
document.head.appendChild(style);
