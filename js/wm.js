/* ============================================================
   macOS 27 — Mammoth · wm.js
   Window manager: windows, focus, z-order, drag, resize,
   snap, minimize-to-dock, zoom, close.
   ============================================================ */
'use strict';

const WM = (() => {
  const layer = $('#windows');
  const windows = new Map();
  let z = 100, counter = 1;
  let activeId = null;

  /* ---------- construction ---------- */
  function template(app, id) {
    const win = el('section', {
      class: 'window', id: 'win-' + id, 'data-app': app.id,
      style: { 'z-index': ++z },
    }, [
      el('div', { class: 'win-rim' }),
      el('header', { class: 'titlebar' }, [
        el('div', { class: 'traffic' }, [
          el('button', { class: 'tl close', 'data-act': 'close', title: 'Close', 'aria-label': 'Close window' },
            el('span', { html: '<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>' })),
          el('button', { class: 'tl min', 'data-act': 'min', title: 'Minimize', 'aria-label': 'Minimize window' },
            el('span', { html: '<svg viewBox="0 0 10 10"><path d="M2 5h6" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>' })),
          el('button', { class: 'tl max', 'data-act': 'fs', title: 'Enter Full Screen', 'aria-label': 'Enter Full Screen' },
            el('span', { html: '<svg viewBox="0 0 10 10"><path d="M2.5 5.5 5.5 2.5h-3ZM7.5 4.5 4.5 7.5h3Z" fill="currentColor"/></svg>' })),
        ]),
        el('div', { class: 'win-title' }, app.name),
      ]),
      el('div', { class: 'win-toolbar' }),
      el('div', { class: 'win-content' }),
      el('div', { class: 'resize n' }), el('div', { class: 'resize s' }),
      el('div', { class: 'resize e' }), el('div', { class: 'resize w' }),
      el('div', { class: 'resize ne' }), el('div', { class: 'resize nw' }),
      el('div', { class: 'resize se' }), el('div', { class: 'resize sw' }),
    ]);
    return win;
  }

  function open(appId, opts = {}) {
    const app = M27.apps[appId];
    if (!app) { console.warn('Unknown app', appId); return null; }

    if (app.single) {
      const ex = find(appId);
      if (ex) { if (ex.minimized) restore(ex); focus(ex); return ex; }
    }

    const id = counter++;
    const elWin = template(app, id);
    const casc = (windows.size % 5) * 34;
    const w = clamp(opts.width ?? app.width, app.minW, innerWidth - 20);
    const h = clamp(opts.height ?? app.height, app.minH, innerHeight - 60);
    const x = clamp(opts.x ?? 120 + casc, 0, Math.max(0, innerWidth - w));
    const y = clamp(opts.y ?? 70 + casc, 32, Math.max(32, innerHeight - h - 80));

    elWin.style.width = w + 'px';
    elWin.style.height = h + 'px';
    elWin.style.left = x + 'px';
    elWin.style.top = y + 'px';

    const win = {
      id, app, el: elWin,
      x, y, w, h,
      minimized: false, maximized: false, fullscreen: false, closing: false,
      space: opts.space ?? (typeof Spaces !== 'undefined' ? Spaces.active : 0),
      prevRect: null,
      cleanup: null,
      args: opts.args,
    };
    layer.append(elWin);
    windows.set(id, win);
    wireChrome(win);

    if (app.mount) {
      win.cleanup = app.mount({
        win,
        el: elWin,
        content: $('.win-content', elWin),
        toolbar: $('.win-toolbar', elWin),
        args: win.args,
        setTitle(t) { $('.win-title', elWin).textContent = t; },
        close() { close(win); },
      }) || null;
    }

    focus(win);
    if (typeof Spaces !== 'undefined') win.el.classList.toggle('off-space', win.space !== Spaces.active);
    if (!opts.silent) Sound.play('open');
    emit('open', win);
    emit('geometry');
    return win;
  }

  /* ---------- chrome wiring ---------- */
  function wireChrome(win) {
    const { el: e } = win;

    e.addEventListener('pointerdown', () => focus(win), { capture: true });

    $$('.tl', e).forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'close') close(win);
        else if (act === 'min') minimize(win);
        else if (act === 'fs') fullscreen(win);
      });
    });

    const tb = $('.titlebar', e);
    tb.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.tl')) return;
      focus(win);
      if (ev.detail === 2) { zoom(win); return; }
      if (win.maximized || win.fullscreen) return;
      const sx = ev.clientX - win.x, sy = ev.clientY - win.y;
      e.classList.add('dragging');
      drag(ev, (cx, cy) => {
        win.x = clamp(cx - sx, -win.w + 140, innerWidth - 140);
        win.y = clamp(cy - sy, 0, innerHeight - 80);
        e.style.left = win.x + 'px';
        e.style.top = win.y + 'px';
        Snap.preview(win, cx, cy);
        emit('geometry');
      }, (cx, cy) => {
        e.classList.remove('dragging');
        Snap.commit(win, cx, cy);
        emit('geometry');
      });
    });

    $$('.resize', e).forEach(h => {
      h.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        if (win.fullscreen) return;
        focus(win);
        const dir = [...h.classList].find(c => c !== 'resize');
        const r0 = { x: win.x, y: win.y, w: win.w, h: win.h };
        const sx = ev.clientX, sy = ev.clientY;
        e.classList.add('resizing');
        drag(ev, (cx, cy) => {
          const dx = cx - sx, dy = cy - sy;
          let { x, y, w: w, h: h } = r0;
          if (dir.includes('e')) w = r0.w + dx;
          if (dir.includes('s')) h = r0.h + dy;
          if (dir.includes('w')) { w = r0.w - dx; x = r0.x + dx; }
          if (dir.includes('n')) { h = r0.h - dy; y = r0.y + dy; }
          w = clamp(w, win.app.minW, innerWidth - 20);
          h = clamp(h, win.app.minH, innerHeight - 40);
          if (dir.includes('w') && w === win.app.minW) x = r0.x + r0.w - w;
          if (dir.includes('n') && h === win.app.minH) y = r0.y + r0.h - h;
          Object.assign(win, { x, y, w, h });
          e.style.left = x + 'px'; e.style.top = y + 'px';
          e.style.width = w + 'px'; e.style.height = h + 'px';
          emit('geometry');
        }, () => {
          e.classList.remove('resizing');
          emit('geometry');
        });
      });
    });
  }

  /* ---------- lifecycle ---------- */
  function focus(win) {
    if (!win || win.minimized || win.closing) return;
    if (typeof Spaces !== 'undefined' && win.space != null && Spaces.active !== win.space) Spaces.set(win.space);
    win.el.style.zIndex = ++z;
    windows.forEach(w => w.el.classList.toggle('focused', w === win));
    if (activeId !== win.id) {
      activeId = win.id;
      emit('focus', win);
    }
  }

  function topmost() {
    let best = null;
    for (const w of windows.values()) {
      if (w.minimized || w.closing) continue;
      if (typeof Spaces !== 'undefined' && (w.space ?? 0) !== Spaces.active) continue;
      if (!best || +w.el.style.zIndex > +best.el.style.zIndex) best = w;
    }
    return best;
  }

  function close(win) {
    if (!win || win.closing) return;
    if (win.app.onClose && win.app.onClose(win) === false) return;
    win.closing = true;
    win.el.classList.add('closing');
    Sound.play('close');
    setTimeout(() => {
      try { win.cleanup && win.cleanup(); } catch (err) { console.warn(err); }
      win.el.remove();
      windows.delete(win.id);
      if (activeId === win.id) {
        activeId = null;
        const t = topmost();
        if (t) focus(t);
      }
      emit('close', win);
      emit('geometry');
    }, 160);
  }

  function minimize(win) {
    if (!win || win.minimized) return;
    if (win.fullscreen) exitFullscreen(win);
    if (win.maximized) zoom(win);
    const target = Dock.iconRect(win.app.id);
    const r = win.el.getBoundingClientRect();
    const dx = target ? target.cx - (r.left + r.width / 2) : 0;
    const dy = target ? target.cy - (r.top + r.height / 2) : innerHeight;
    Sound.play('minimize');
    win.el.style.transition = 'transform .32s cubic-bezier(.5,0,.8,.4), opacity .32s ease';
    win.el.style.transform = `translate(${dx}px, ${dy}px) scale(.05)`;
    win.el.style.opacity = '0';
    win.minimized = true;
    setTimeout(() => {
      win.el.classList.add('hidden');
      win.el.style.transition = '';
      emit('geometry');
      const t = topmost();
      if (t) focus(t);
    }, 330);
    emit('minimize', win);
  }

  function restore(win) {
    if (!win || !win.minimized) return;
    win.el.classList.remove('hidden');
    const { el: e } = win;
    e.style.opacity = '0';
    e.style.transform = 'scale(.6) translateY(120px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      e.style.transition = 'transform .3s cubic-bezier(.2,1,.4,1), opacity .3s ease';
      e.style.opacity = '';
      e.style.transform = '';
      setTimeout(() => { e.style.transition = ''; }, 320);
    }));
    win.minimized = false;
    Sound.play('open');
    focus(win);
    emit('restore', win);
    emit('geometry');
  }

  function zoom(win) {
    if (!win || !win.app.resizable) return;
    if (win.fullscreen) { exitFullscreen(win); return; }
    if (!win.maximized) {
      win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
      win.maximized = true;
      const nx = 8, ny = 34, nw = innerWidth - 16, nh = innerHeight - 34 - 16;
      Object.assign(win, { x: nx, y: ny, w: nw, h: nh });
    } else {
      win.maximized = false;
      const p = win.prevRect || { x: 120, y: 80, w: win.app.width, h: win.app.height };
      Object.assign(win, { x: p.x, y: p.y, w: p.w, h: p.h });
    }
    const { el: e } = win;
    e.classList.toggle('maximized', win.maximized);
    e.style.left = win.x + 'px'; e.style.top = win.y + 'px';
    e.style.width = win.w + 'px'; e.style.height = win.h + 'px';
    emit('geometry');
  }

  /* ---------- full screen ---------- */
  function fullscreen(win) {
    if (!win || !win.app.resizable) return;
    if (win.fullscreen) exitFullscreen(win);
    else {
      win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h, maximized: win.maximized };
      win.fullscreen = true;
      win.maximized = false;
      Object.assign(win, { x: 0, y: 0, w: innerWidth, h: innerHeight });
      const e = win.el;
      e.classList.remove('maximized');
      e.classList.add('fullscreen');
      e.style.left = '0px'; e.style.top = '0px';
      e.style.width = '100%'; e.style.height = '100%';
      document.body.classList.add('fullscreen');
      Sound.play('pop');
    }
    emit('geometry');
  }

  function exitFullscreen(win) {
    if (!win || !win.fullscreen) return;
    win.fullscreen = false;
    const p = win.prevRect || { x: 120, y: 80, w: win.app.width, h: win.app.height, maximized: false };
    Object.assign(win, { x: p.x, y: p.y, w: p.w, h: p.h });
    win.maximized = !!p.maximized;
    const e = win.el;
    e.classList.remove('fullscreen');
    e.classList.toggle('maximized', win.maximized);
    e.style.left = win.x + 'px'; e.style.top = win.y + 'px';
    e.style.width = win.w + 'px'; e.style.height = win.h + 'px';
    if (![...windows.values()].some(w => w.fullscreen)) document.body.classList.remove('fullscreen');
    Sound.play('pop');
    emit('geometry');
  }

  function toggleFullscreen(win) { fullscreen(win || active()); }

  /* ---------- hide / restore app (⌘H) ---------- */
  function hideApp(appId) {
    let hidden = false;
    for (const w of windows.values()) {
      if (w.app.id === appId && !w.minimized && !w.closing) { minimize(w); hidden = true; }
    }
    return hidden;
  }
  function restoreApp(appId) {
    let last = null;
    for (const w of windows.values()) {
      if (w.app.id === appId && !w.closing) { if (w.minimized) restore(w); last = w; }
    }
    if (last) focus(last);
    return last;
  }
  function hideOthers(appId) {
    for (const w of windows.values()) {
      if (w.app.id !== appId && !w.minimized && !w.closing) minimize(w);
    }
  }

  /* ---------- window layout persistence ---------- */
  const persistLayout = debounce(() => {
    const data = [];
    for (const w of windows.values()) {
      if (w.closing || w.minimized) continue;
      if (w.app.id === 'welcome' || w.app.id === 'about') continue;
      data.push({ appId: w.app.id, x: w.x, y: w.y, w: w.w, h: w.h, maximized: w.maximized, fullscreen: w.fullscreen });
    }
    try { localStorage.setItem('macos27.windows', JSON.stringify(data)); } catch { /* quota */ }
  }, 300);
  on('geometry', persistLayout);
  on('open', persistLayout);
  on('close', persistLayout);
  on('minimize', persistLayout);
  on('restore', persistLayout);

  /* ---------- queries ---------- */
  const find = (appId) => [...windows.values()].find(w => w.app.id === appId && !w.closing) || null;
  const byId = (id) => windows.get(id) || null;
  const list = () => [...windows.values()].filter(w => !w.closing);
  const active = () => byId(activeId);

  function visibleRects() {
    const out = [];
    for (const w of windows.values()) {
      if (w.minimized || w.closing) continue;
      const r = w.el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push(r);
    }
    return out;
  }

  function refreshTints() {
    for (const w of windows.values()) {
      if (w.minimized || w.closing) continue;
      Glass.tintWindow(w.el, w.el.getBoundingClientRect());
    }
  }

  function clampAll() {
    for (const w of windows.values()) {
      if (w.maximized) continue;
      w.x = clamp(w.x, -w.w + 140, Math.max(-w.w + 140, innerWidth - 140));
      w.y = clamp(w.y, 0, Math.max(0, innerHeight - 80));
      w.el.style.left = w.x + 'px';
      w.el.style.top = w.y + 'px';
    }
    emit('geometry');
  }

  /* ---------- window snapping ---------- */
  const Snap = {
    el: $('#snap-preview'),
    target: null,
    preview(win, cx, cy) {
      const zone = 14;
      let r = null;
      if (cx < zone) r = { x: 0, y: 32, w: innerWidth / 2, h: innerHeight - 32 };
      else if (cx > innerWidth - zone) r = { x: innerWidth / 2, y: 32, w: innerWidth / 2, h: innerHeight - 32 };
      else if (cy < 2) r = { x: 0, y: 32, w: innerWidth, h: innerHeight - 32 };
      if (r && !this.target) {
        this.target = r;
        Object.assign(this.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        this.el.classList.remove('hidden');
      } else if (!r && this.target) {
        this.target = null;
        this.el.classList.add('hidden');
      }
    },
    commit(win, cx, cy) {
      if (!this.target) return;
      const r = this.target;
      this.target = null;
      this.el.classList.add('hidden');
      win.maximized = false;
      win.el.classList.remove('maximized');
      Object.assign(win, { x: r.x, y: r.y, w: r.w, h: r.h });
      win.el.style.left = r.x + 'px'; win.el.style.top = r.y + 'px';
      win.el.style.width = r.w + 'px'; win.el.style.height = r.h + 'px';
    },
  };

  return {
    open, close, minimize, restore, zoom, focus,
    fullscreen, exitFullscreen, toggleFullscreen,
    hideApp, restoreApp, hideOthers,
    find, byId, list, active, visibleRects, refreshTints, clampAll, topmost,
    persistLayout,
  };
})();
