/* ============================================================
   macOS 27 — Mammoth · wallpaper.js
   Live procedural wallpapers. Draws every frame into the main
   stage canvas + a small snapshot used for refraction & tinting.
   ============================================================ */
'use strict';

const Wallpaper = (() => {
  const canvas = $('#wallpaper');
  const ctx = canvas.getContext('2d');
  const snap = document.createElement('canvas');
  snap.width = 320; snap.height = 180;
  const sctx = snap.getContext('2d');

  let raf = 0;
  let t0 = performance.now();
  let animating = true;
  let current = Settings.get('wallpaper', 'tahoe');
  let frameHook = null;   // Glass engine hooks here

  const PRESETS = {
    /* Tahoe — the default: deep water blues with drifting violet/pink/cyan light */
    tahoe: {
      base: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0a1030'); g.addColorStop(0.55, '#131a4a'); g.addColorStop(1, '#1c0f3e');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      },
      blobs: [
        { c: '#8a5cff', x: .72, y: .30, r: .42, sx: .13, sy: .10, ph: 0.0, a: .55 },
        { c: '#ff4fa3', x: .28, y: .66, r: .38, sx: .10, sy: .14, ph: 2.1, a: .42 },
        { c: '#3f8cff', x: .55, y: .85, r: .46, sx: .07, sy: .12, ph: 4.2, a: .40 },
        { c: '#25e0c9', x: .18, y: .22, r: .20, sx: .16, sy: .11, ph: 1.3, a: .30 },
        { c: '#b39dff', x: .88, y: .78, r: .24, sx: .11, sy: .15, ph: 3.0, a: .30 },
      ],
    },
    /* Mammoth — golden-hour reds over alpine purple */
    mammoth: {
      base: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#200a2e'); g.addColorStop(0.5, '#4a1230'); g.addColorStop(1, '#8a2f18');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      },
      blobs: [
        { c: '#ff8a3d', x: .30, y: .40, r: .44, sx: .12, sy: .09, ph: 0.5, a: .5 },
        { c: '#ff3d6e', x: .70, y: .62, r: .40, sx: .09, sy: .13, ph: 2.6, a: .42 },
        { c: '#8a4dff', x: .85, y: .22, r: .30, sx: .14, sy: .10, ph: 4.0, a: .35 },
        { c: '#ffc24d', x: .12, y: .80, r: .26, sx: .10, sy: .12, ph: 1.1, a: .30 },
      ],
    },
    /* Aurora — cold night greens with vertical light streaks */
    aurora: {
      base: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#020d0b'); g.addColorStop(1, '#05231c');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      },
      streaks: true,
      blobs: [
        { c: '#2ee6a8', x: .62, y: .34, r: .26, sx: .10, sy: .06, ph: 0.2, a: .50 },
        { c: '#1f8fff', x: .34, y: .52, r: .22, sx: .08, sy: .07, ph: 2.8, a: .38 },
        { c: '#7cffcb', x: .80, y: .70, r: .18, sx: .13, sy: .06, ph: 4.9, a: .28 },
      ],
    },
    /* Sequoia — canyon orange dusk */
    sequoia: {
      base: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2a0f0a'); g.addColorStop(0.5, '#5c1a0d'); g.addColorStop(1, '#7a2a10');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      },
      blobs: [
        { c: '#ffb35c', x: .68, y: .30, r: .42, sx: .11, sy: .09, ph: 1.7, a: .5 },
        { c: '#ff6a3d', x: .26, y: .58, r: .40, sx: .09, sy: .12, ph: 3.3, a: .44 },
        { c: '#d94f30', x: .50, y: .86, r: .34, sx: .13, sy: .10, ph: 5.0, a: .36 },
        { c: '#ffd9a0', x: .90, y: .80, r: .16, sx: .15, sy: .08, ph: 2.2, a: .26 },
      ],
    },
    /* Mono — calm graphite for focus */
    mono: {
      base: (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#16161a'); g.addColorStop(1, '#26262c');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      },
      blobs: [
        { c: '#4a4a55', x: .60, y: .34, r: .40, sx: .08, sy: .07, ph: 1.0, a: .35 },
        { c: '#3a3a44', x: .30, y: .70, r: .36, sx: .07, sy: .08, ph: 3.4, a: .3 },
      ],
    },
  };

  function draw(c, w, h, t, presetName) {
    const p = PRESETS[presetName] || PRESETS.tahoe;
    p.base(c, w, h);
    const cx = w / 2, cy = h / 2;
    for (const b of p.blobs) {
      const x = (b.x + Math.sin(t * b.sx + b.ph) * 0.06) * w;
      const y = (b.y + Math.cos(t * b.sy + b.ph) * 0.06) * h;
      const r = b.r * Math.max(w, h) * (1 + 0.05 * Math.sin(t * 0.5 + b.ph));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, b.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save();
      c.globalCompositeOperation = 'screen';
      c.globalAlpha = b.a;
      c.fillStyle = g;
      c.beginPath();
      if (p.streaks) c.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
      else c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    /* soft vignette for depth */
    const v = c.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.34)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }

  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    draw(ctx, innerWidth, innerHeight, t, current);
    draw(sctx, snap.width, snap.height, t, current);
    if (frameHook) frameHook(t);
    if (animating) raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    size();
    draw(ctx, innerWidth, innerHeight, 2.7, current);
    draw(sctx, snap.width, snap.height, 2.7, current);
    if (frameHook) frameHook(2.7);
  }

  /* draw current preset into an arbitrary canvas (screenshots) */
  function renderTo(canvas, w, h) {
    const c = canvas.getContext('2d');
    c.save();
    c.scale(w / 1280, h / 720);
    draw(c, 1280, 720, 2.7, current);
    c.restore();
  }

  return {
    start() {
      size();
      const reduced = Settings.get('reduceMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
      animating = !reduced;
      cancelAnimationFrame(raf);
      if (animating) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
      else renderStatic();
    },
    stop() { animating = false; cancelAnimationFrame(raf); },
    set(name) {
      if (!PRESETS[name]) return;
      current = name;
      Settings.set('wallpaper', name);
      if (!animating) renderStatic();
    },
    get() { return current; },
    list() { return Object.keys(PRESETS); },
    snapshot() { return snap; },
    onFrame(fn) { frameHook = fn; },
    renderStatic,
    renderTo,
  };
})();

window.addEventListener('resize', debounce(() => {
  Wallpaper.start();
  Glass.size?.();
  WM.clampAll?.();
}, 150));
