/* ============================================================
   macOS 27 — Mammoth · glass.js
   The Liquid Glass material engine:
    · pushes live material tokens into CSS custom properties
    · samples the wallpaper behind every window → adaptive tint
    · refracts the wallpaper through an animated SVG displacement
      field clipped to the union of window rects ("real" refraction)
    · click ripples on glass surfaces
   ============================================================ */
'use strict';

const Glass = (() => {
  const root = document.documentElement;
  const refract = $('#refract');
  const rctx = refract.getContext('2d');
  const lensFilter = $('#lens');
  const lensMap = lensFilter.querySelector('feDisplacementMap');
  let lastClipUpdate = 0;
  let lastTint = 0;
  let frameSkip = 0;

  function apply() {
    const g = Settings.get('glass', true);
    document.body.classList.toggle('no-glass', !g);
    document.body.classList.toggle('no-rim', !Settings.get('glassRim', true));
    root.style.setProperty('--glass-blur', Settings.get('glassBlur', 26) + 'px');
    root.style.setProperty('--glass-sat', (Settings.get('glassSat', 190) / 100).toFixed(2));
    root.style.setProperty('--glass-bright', (Settings.get('glassBright', 112) / 100).toFixed(2));
    root.style.setProperty('--glass-alpha', String(Settings.get('glassAlpha', 0.16)));
    const accent = Settings.get('accent', '#0A84FF');
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', hexToRgb(accent));
    refreshRefraction();
  }

  /* ---- refraction stage ---- */
  function refreshRefraction() {
    const on = Settings.get('glass', true) && Settings.get('refraction', true);
    refract.style.display = on ? '' : 'none';
    updateClip();
  }

  /* rounded-ish polygon for each window rect (expanded so displaced
     samples near the rim still have wallpaper behind them) */
  function updateClip() {
    const now = Date.now();
    if (now - lastClipUpdate < 60) return;
    lastClipUpdate = now;
    const rects = typeof WM !== 'undefined' ? WM.visibleRects() : [];
    if (!rects.length) { refract.style.clipPath = 'none'; return; }
    const M = 44, R = 30;
    const pts = [];
    for (const r of rects) {
      const x0 = r.left - M, y0 = r.top - M, x1 = r.right + M, y1 = r.bottom + M;
      pts.push(
        `${x0 + R},${y0}`, `${x1 - R},${y0}`, `${x1},${y0 + R}`, `${x1},${y1 - R}`,
        `${x1 - R},${y1}`, `${x0 + R},${y1}`, `${x0},${y1 - R}`, `${x0},${y0 + R}`);
    }
    refract.style.clipPath = `polygon(${pts.join(',')})`;
  }

  function onWallFrame(t) {
    if (!Settings.get('glass') || !Settings.get('refraction')) return;
    const count = typeof WM !== 'undefined' ? WM.list().filter(w => !w.minimized && !w.closing).length : 0;
    /* adaptive: too many windows → drop refraction to keep the UI smooth */
    if (count > 12) { if (refract.style.display !== 'none') refract.style.display = 'none'; return; }
    if (refract.style.display === 'none') refract.style.display = '';   // restore after heavy load
    if (count > 6) { frameSkip = (frameSkip + 1) % 2; if (frameSkip) return; }  // halve rate

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (refract.width !== Math.round(innerWidth * dpr)) {
      refract.width = Math.round(innerWidth * dpr);
      refract.height = Math.round(innerHeight * dpr);
    }
    const snap = Wallpaper.snapshot();
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, innerWidth, innerHeight);
    rctx.drawImage(snap, 0, 0, innerWidth, innerHeight);
    /* breathe the lens: slow, liquid, never distracting */
    const base = Settings.get('glassBlur', 26) >= 20 ? 30 : 22;
    lensMap.setAttribute('scale', String(base * (1 + 0.16 * Math.sin(t * 0.55))));
    /* refresh window tints a few times per second */
    if (t * 1000 - lastTint > 220 && typeof WM !== 'undefined') {
      lastTint = t * 1000;
      WM.refreshTints();
    }
  }

  /* ---- adaptive tint: average wallpaper color behind a rect ---- */
  function tintWindow(winEl, rect) {
    if (!winEl) return;
    const snap = Wallpaper.snapshot();
    const c = snap.getContext('2d');
    const W = snap.width, H = snap.height;
    const sx = W / innerWidth, sy = H / innerHeight;
    let r = 0, g = 0, b = 0, n = 0;
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + rect.width * 0.22, rect.top + rect.height * 0.25],
      [rect.left + rect.width * 0.78, rect.top + rect.height * 0.3],
      [rect.left + rect.width * 0.3, rect.top + rect.height * 0.8],
    ];
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const px = c.getImageData(clamp(Math.round(x * sx), 0, W - 1), clamp(Math.round(y * sy), 0, H - 1), 1, 1).data;
      r += px[0]; g += px[1]; b += px[2]; n++;
    }
    if (!n) return;
    r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
    /* push colors toward their brighter, more saturated selves — glass prefers glow */
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const k = 1.35;
    r = clamp(Math.round(r * k), 0, 255);
    g = clamp(Math.round(g * k), 0, 255);
    b = clamp(Math.round(b * k), 0, 255);
    winEl.style.setProperty('--tint-rgb', `${r},${g},${b}`);
    return lum;
  }

  /* ---- click ripple ---- */
  function ripple(x, y, parent) {
    if (!Settings.get('glass', true)) return;
    const host = parent || document.body;
    const d = el('span', { class: 'glass-ripple', style: { left: x + 'px', top: y + 'px' } });
    host.append(d);
    setTimeout(() => d.remove(), 750);
  }

  /* ---- wire settings ---- */
  on('settings:glass', apply);
  on('settings:glassRim', apply);
  on('settings:glassBlur', apply);
  on('settings:glassSat', apply);
  on('settings:glassBright', apply);
  on('settings:glassAlpha', apply);
  on('settings:accent', apply);
  on('settings:refraction', refreshRefraction);
  on('geometry', updateClip);
  on('open', updateClip);
  on('close', updateClip);

  Wallpaper.onFrame(onWallFrame);
  apply();

  return { apply, tintWindow, ripple, updateClip, refreshRefraction, size: refreshRefraction };
})();
