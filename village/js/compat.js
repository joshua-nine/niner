// Loaded as a classic script before the kingdom starts.
// 1. Fills in a few newer browser features for older phones and browsers.
// 2. If the kingdom ever fails to start, shows the error on screen instead
//    of a blank page, so it can be screenshotted and fixed.
(function () {
  // structuredClone (Chrome 98+, Safari 15.4+). Our data is plain JSON.
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = function (v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); };
  }

  // CanvasRenderingContext2D.roundRect (Chrome 99+, Safari 16+).
  var C = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
  if (C && typeof C.roundRect !== 'function') {
    C.roundRect = function (x, y, w, h, r) {
      r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  // ── Start-up safety net ────────────────────────────────────
  var lastError = '';
  function remember(msg) { if (msg && !lastError) lastError = String(msg); }
  window.addEventListener('error', function (e) { remember(e.message || (e.target && e.target.src ? 'Could not load ' + e.target.src : '')); }, true);
  window.addEventListener('unhandledrejection', function (e) { remember(e.reason && (e.reason.message || e.reason)); });

  function showProblem() {
    if (window.__kingdomBooted || document.getElementById('boot-problem')) return;
    var box = document.createElement('div');
    box.id = 'boot-problem';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:10000;background:#2a0f17;color:#ffd6de;' +
      'border:1px solid #ff4d6d;border-radius:8px;padding:14px 16px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    box.innerHTML = '<b>The kingdom couldn’t start.</b> Try refreshing. If it keeps happening, screenshot this box and send it to your builder.' +
      '<div style="margin-top:8px;font:12px/1.4 monospace;color:#ffb3c1;word-break:break-word"></div>' +
      '<button style="margin-top:10px;background:#ff4d6d;color:#fff;border:0;border-radius:5px;padding:7px 14px;font-weight:600">Refresh</button>';
    box.querySelector('div').textContent = 'Error: ' + (lastError || 'unknown (startup timed out)') + '\nBrowser: ' + navigator.userAgent;
    box.querySelector('button').onclick = function () { location.reload(); };
    document.body.appendChild(box);
  }
  window.addEventListener('load', function () { setTimeout(showProblem, 6000); });
})();
