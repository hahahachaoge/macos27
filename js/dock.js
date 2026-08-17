/* ============================================================
   macOS 27 — Mammoth · dock.js
   Glass dock: pinned apps (reorderable), running non-pinned
   apps, recently used, Trash. Magnification, bounce, dots.
   ============================================================ */
'use strict';

const Dock = (() => {
  const bar = $('#dock');
  const items = new Map(); // appId -> element
  let order = [];          // pinned app ids (order matters)
  let recents = [];        // recently opened app ids
  let recentsSep = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('macos27.dock') || '{}');
      order = Array.isArray(s.order) && s.order.length ? s.order.filter(id => M27.apps[id]) : null;
      recents = Array.isArray(s.recents) ? s.recents.filter(id => M27.apps[id]) : [];
    } catch { order = null; recents = []; }
    if (!order) order = Object.values(M27.apps).filter(a => !a.hidden).map(a => a.id);
  }
  function save() {
    try { localStorage.setItem('macos27.dock', JSON.stringify({ order, recents })); } catch { /* quota */ }
  }

  function iconFor(app) {
    const holder = el('span', { class: 'd-icon' });
    holder.innerHTML = app.icon || Icons.genericApp();
    return holder;
  }

  function makeItem(app, { pinned, ephemeral } = {}) {
    const item = el('button', { class: 'dock-item', 'data-app': app.id, 'aria-label': app.name }, [
      el('span', { class: 'd-dot' }),
      iconFor(app),
      el('span', { class: 'dock-label' }, app.name),
    ]);
    if (pinned) item.dataset.pinned = '1';
    if (ephemeral) item.classList.add('ephemeral');
    item.addEventListener('click', () => {
      if (item._dragMoved) { item._dragMoved = false; return; }
      Sound.play('click');
      Glass.ripple(27, 27, item);
      launch(app.id);
    });
    item.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      const pinned = order.includes(app.id);
      ContextMenu.show(ev.clientX, ev.clientY, [
        { label: 'Open', icon: 'play', action: () => launch(app.id) },
        { label: 'New Window', icon: 'plus', action: () => WM.open(app.id) },
        { sep: true },
        pinned
          ? { label: 'Remove from Dock', action: () => { order = order.filter(id => id !== app.id); save(); rebuild(); } }
          : { label: 'Keep in Dock', action: () => { if (!order.includes(app.id)) order.push(app.id); save(); rebuild(); } },
        { sep: true },
        { label: 'Show in Finder', icon: 'folder', action: () => WM.open('finder', { args: { path: '/Applications' } }) },
        { sep: true },
        { label: 'Quit', danger: true, action: () => WM.list().filter(w => w.app.id === app.id).forEach(w => WM.close(w)) },
      ]);
    });
    items.set(app.id, item);
    return item;
  }

  /* drag to reorder pinned icons */
  function makeDraggable(item) {
    item.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !item.dataset.pinned) return;
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const onMove = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
          moved = true;
          item._dragMoved = true;
          item.classList.add('dragging');
        }
        if (moved) {
          const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.dock-item[data-pinned]');
          if (t && t !== item) {
            const r = t.getBoundingClientRect();
            bar.insertBefore(item, ev.clientX < r.left + r.width / 2 ? t : t.nextSibling);
          }
        }
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (moved) {
          item.classList.remove('dragging');
          order = [...bar.querySelectorAll('.dock-item[data-pinned]')].map(n => n.dataset.app);
          save();
        }
        setTimeout(() => { item._dragMoved = false; }, 60);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function addRecents() {
    recentsSep = el('span', { class: 'dock-sep' });
    bar.append(recentsSep);
    const running = new Set(WM.list().map(w => w.app.id));
    for (const id of recents) {
      const app = M27.apps[id];
      if (!app || app.hidden || order.includes(id) || running.has(id)) continue;
      bar.append(makeItem(app, {}));
    }
  }

  function addTrash() {
    bar.append(el('span', { class: 'dock-sep' }));
    const item = el('button', { class: 'dock-item dock-trash', 'aria-label': 'Trash' }, [
      el('span', { class: 'd-icon', html: Icons.trash() }),
      el('span', { class: 'dock-label' }, 'Trash'),
    ]);
    item.addEventListener('click', () => {
      Sound.play('click');
      WM.open('finder', { args: { path: HOME + '/.Trash' } });
    });
    bar.append(item);
  }

  function rebuild() {
    bar.innerHTML = '';
    items.clear();
    for (const id of order) {
      const app = M27.apps[id];
      if (!app || app.hidden) continue;
      const it = makeItem(app, { pinned: true });
      makeDraggable(it);
      bar.append(it);
    }
    addRecents();
    addTrash();
    updateRunning();
  }

  function updateRunning() {
    const running = {};
    WM.list().forEach(w => { running[w.app.id] = (running[w.app.id] || 0) + 1; });
    /* pinned dots */
    for (const [id, item] of items) {
      if (item.dataset.pinned) item.classList.toggle('running', !!running[id]);
    }
    /* running non-pinned → ephemeral items before recents separator */
    for (const id of Object.keys(running)) {
      const app = M27.apps[id];
      if (!app || app.hidden || order.includes(id)) continue;
      if (!items.has(id)) {
        const it = makeItem(app, { ephemeral: true });
        bar.insertBefore(it, recentsSep);
        items.set(id, it);
      }
      items.get(id).classList.add('running');
    }
    /* remove ephemeral apps that are no longer running */
    for (const [id, item] of items) {
      if (item.classList.contains('ephemeral') && !running[id]) { item.remove(); items.delete(id); }
    }
  }

  function launch(id) {
    const existing = WM.find(id);
    if (existing) {
      if (existing.minimized) WM.restore(existing);
      WM.focus(existing);
      return;
    }
    const item = items.get(id);
    if (item) {
      item.classList.remove('bouncing');
      void item.offsetWidth;
      item.classList.add('bouncing');
      setTimeout(() => item.classList.remove('bouncing'), 950);
    }
    WM.open(id);
  }

  /* ---------- magnification ---------- */
  bar.addEventListener('pointermove', ev => {
    for (const [id, item] of items) {
      const r = item.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = clamp(Math.abs(ev.clientX - cx) / 90, 0, 1);
      const scale = 1 + Math.pow(1 - d, 2) * 0.42;
      const icon = $('.d-icon', item);
      if (icon) icon.style.transform = `scale(${scale}) translateY(${-(scale - 1) * 34}px)`;
    }
  });
  bar.addEventListener('pointerleave', () => {
    items.forEach(item => { const i = $('.d-icon', item); if (i) i.style.transform = ''; });
  });

  on('open', updateRunning);
  on('close', updateRunning);
  on('minimize', updateRunning);
  on('restore', updateRunning);

  /* track recents (live) */
  on('open', (win) => {
    if (!win || win.app.hidden || order.includes(win.app.id)) return;
    recents = [win.app.id, ...recents.filter(x => x !== win.app.id)].slice(0, 6);
    save();
  });

  function build() { load(); rebuild(); }

  /* icon center for minimize animation */
  function iconRect(id) {
    const item = items.get(id);
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top };
  }

  return { build, launch, iconRect };
})();
