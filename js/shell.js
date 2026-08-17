/* ============================================================
   macOS 27 — Mammoth · shell.js
   Boot sequence, lock screen, desktop icons, widgets,
   welcome flow, power, global shortcuts, screenshot.
   ============================================================ */
'use strict';

/* ============================================================
   Spaces — lightweight virtual desktops (persisted)
   ============================================================ */
const Spaces = (() => {
  let list = ['Desktop 1'];
  let active = 0;
  try {
    const s = JSON.parse(localStorage.getItem('macos27.spaces') || '{}');
    if (Array.isArray(s.list) && s.list.length) list = s.list;
    active = Math.min(Math.max(0, s.active || 0), list.length - 1);
  } catch { /* defaults */ }
  function persist() { try { localStorage.setItem('macos27.spaces', JSON.stringify({ list, active })); } catch {} }
  function apply() {
    for (const w of WM.list()) w.el.classList.toggle('off-space', (w.space ?? 0) !== active);
    const top = WM.topmost();
    if (top) WM.focus(top);
    persist();
    emit('spaces:change', { active });
  }
  function set(i) { if (i >= 0 && i < list.length) { active = i; apply(); } }
  function add() { list.push('Desktop ' + (list.length + 1)); persist(); apply(); }
  function rename(i, name) { if (list[i]) { list[i] = name; persist(); } }
  return { get list() { return list; }, get active() { return active; }, set, add, rename, apply };
})();

const Shell = (() => {
  const bootEl = $('#boot');
  const lockEl = $('#lockscreen');
  const desktop = $('#desktop');
  const widgetsHost = $('#widgets');
  let unlocked = false;
  let desktopPos = {};
  try { desktopPos = JSON.parse(localStorage.getItem('macos27.desktop') || '{}'); } catch { desktopPos = {}; }

  /* ================= boot ================= */
  function boot() {
    document.body.classList.add('booting');
    Wallpaper.start();
    Glass.apply();

    bootEl.classList.remove('hidden');
    const fill = $('.boot-fill');
    let p = 0;
    const iv = setInterval(() => {
      p += 3 + Math.random() * 9;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => {
          bootEl.classList.add('fade');
          setTimeout(() => {
            bootEl.classList.add('hidden');
            bootEl.classList.remove('fade');
            showLock();
          }, 650);
        }, 350);
      }
      fill.style.width = p + '%';
    }, 90);
  }

  /* ================= lock screen ================= */
  function tickLock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    $('#lock-time').textContent = time;
    $('#lock-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const name = Settings.get('accountName', 'You');
    const ln = $('.lock-name'), la = $('.lock-avatar');
    if (ln) ln.textContent = name;
    if (la) la.textContent = (name || 'Y')[0];
  }

  function showLock() {
    tickLock();
    setInterval(tickLock, 1000);
    lockEl.classList.remove('hidden');
    /* make the lock screen focusable so Enter/Space work immediately,
       even before the user clicks anywhere */
    lockEl.tabIndex = 0;
    lockEl.focus({ preventScroll: true });
    setTimeout(() => lockEl.focus({ preventScroll: true }), 60);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { Sound.play('unlock'); } catch { /* audio must never block unlocking */ }
    lockEl.classList.add('fade');
    setTimeout(() => {
      lockEl.classList.add('hidden');
      document.body.classList.remove('booting');
      enterDesktop();
    }, 520);
  }

  lockEl.addEventListener('click', unlock);
  lockEl.addEventListener('pointerdown', () => lockEl.focus({ preventScroll: true }));

  window.addEventListener('keydown', function unlockKey(e) {
    if (unlocked || !bootEl.classList.contains('hidden')) return;
    const k = e.key;
    if (k === 'Enter' || k === ' ' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      unlock();
    }
  });

  /* if the tab regains focus while still locked, refocus the lock screen */
  window.addEventListener('focus', () => {
    if (!unlocked && bootEl.classList.contains('hidden')) lockEl.focus({ preventScroll: true });
  });

  /* ================= desktop ================= */
  const ICONS = [
    { id: 'hd', name: 'Macintosh HD', icon: Icons.drive(), action: () => WM.open('finder', { args: { path: '/' } }) },
    { id: 'docs', name: 'Documents', icon: Icons.folder('#6ab7ff', '#2f8fe8'), action: () => WM.open('finder', { args: { path: HOME + '/Documents' } }) },
    { id: 'welcome', name: 'Welcome to macOS 27.md', icon: Icons.doc(), action: () => WM.open('textedit', { args: { path: HOME + '/Desktop/Welcome to macOS 27.md' } }) },
    { id: 'trash', name: 'Trash', icon: Icons.trash(), action: () => WM.open('finder', { args: { path: HOME + '/.Trash' } }) },
  ];

  let selIcon = null;
  const iconEls = {};

  function select(id) {
    selIcon = id;
    for (const [iid, eln] of Object.entries(iconEls)) eln.classList.toggle('sel', iid === id);
  }

  function renderDesktop() {
    desktop.innerHTML = '';
    ICONS.forEach((ic, i) => {
      const pos = desktopPos[ic.id] || { x: 18, y: 24 + i * 96 };
      const d = el('div', { class: 'ditem', 'data-icon': ic.id, style: { left: pos.x + 'px', top: pos.y + 'px' } }, [
        el('span', { class: 'di-icon', html: ic.icon }),
        el('span', { class: 'di-name' }, ic.name),
      ]);
      iconEls[ic.id] = d;
      d.addEventListener('click', e => {
        e.stopPropagation();
        select(ic.id);
      });
      d.addEventListener('dblclick', () => ic.action());

      /* drag to reposition */
      d.addEventListener('pointerdown', e => {
        e.stopPropagation();
        select(ic.id);
        const sx = e.clientX, sy = e.clientY;
        const ox = parseFloat(d.style.left), oy = parseFloat(d.style.top);
        let moved = false;
        drag(e, (cx, cy) => {
          if (Math.hypot(cx - sx, cy - sy) > 6) moved = true;
          if (moved) {
            d.style.left = clamp(ox + cx - sx, 0, innerWidth - 90) + 'px';
            d.style.top = clamp(oy + cy - sy, 0, innerHeight - 160) + 'px';
          }
        }, () => {
          if (moved) {
            desktopPos[ic.id] = { x: parseFloat(d.style.left), y: parseFloat(d.style.top) };
            try { localStorage.setItem('macos27.desktop', JSON.stringify(desktopPos)); } catch { }
          }
        });
      });

      d.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenu.show(e.clientX, e.clientY, [
          { label: 'Open', action: () => ic.action() },
          { sep: true },
          { label: 'Get Info', action: () => Toast.show(`${ic.name} — lives on the Desktop`, { icon: 'info' }) },
          { label: 'Clean Up', action: () => { delete desktopPos[ic.id]; renderDesktop(); } },
        ]);
      });

      desktop.append(d);
    });
  }

  desktop.addEventListener('pointerdown', () => {
    if (selIcon) select(null);
  });
  desktop.addEventListener('contextmenu', e => {
    if (e.target !== desktop) return;
    e.preventDefault();
    ContextMenu.show(e.clientX, e.clientY, [
      { label: 'New Folder', action: () => { VFS.mkdir(HOME + '/Desktop/New Folder'); WM.open('finder', { args: { path: HOME + '/Desktop' } }); } },
      { sep: true },
      { label: 'Random Wallpaper', action: () => { const l = Wallpaper.list(); Wallpaper.set(l[Math.floor(Math.random() * l.length)]); } },
      { label: 'Change Wallpaper…', action: () => WM.open('settings', { args: { pane: 'wallpaper' } }) },
      { label: 'Edit Widgets…', action: () => Widgets.toggleEdit() },
      { sep: true },
      { label: 'Toggle Dark Mode', action: () => Settings.set('theme', resolvedTheme() === 'dark' ? 'light' : 'dark') },
      { sep: true },
      { label: 'About This Mac', action: () => WM.open('about') },
    ]);
  });

  /* ================= widgets ================= */
  const Widgets = (() => {
    let editing = false;
    let visible = [];
    try { visible = JSON.parse(localStorage.getItem('macos27.widgets') || '["clock","calendar","weather"]'); } catch { visible = ['clock', 'calendar', 'weather']; }

    const persist = () => { try { localStorage.setItem('macos27.widgets', JSON.stringify(visible)); } catch { } };

    function frame(kind, title, inner) {
      const w = el('div', { class: 'widget glass', 'data-widget': kind }, [
        el('div', { class: 'w-title' }, [el('span', {}, title), el('button', { class: 'w-remove', onclick: () => remove(kind) }, '×')]),
        inner,
      ]);
      w.addEventListener('contextmenu', e => {
        e.preventDefault();
        ContextMenu.show(e.clientX, e.clientY, [
          { label: editing ? 'Done Editing' : 'Edit Widgets', action: () => toggleEdit() },
          { label: 'Remove Widget', danger: true, action: () => remove(kind) },
        ]);
      });
      return w;
    }

    function remove(kind) {
      visible = visible.filter(k => k !== kind);
      persist();
      render();
    }

    function toggleEdit() {
      editing = !editing;
      $$('.widget', widgetsHost).forEach(w => w.classList.toggle('wiggling', editing));
      if (!editing) Sound.play('click');
    }

    function clockWidget() {
      const canvas = el('canvas', { width: 110, height: 110 });
      const dig = el('div', { class: 'wc-digital' });
      const date = el('div', { class: 'wc-date' });
      const box = el('div', { class: 'widget-clock' }, [
        canvas,
        el('div', {}, [dig, date]),
      ]);
      function draw() {
        const c = canvas.getContext('2d');
        const cx = 55, cy = 55, r = 50;
        c.clearRect(0, 0, 110, 110);
        c.lineCap = 'round';
        /* face */
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.stroke();
        /* ticks */
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          c.beginPath();
          c.moveTo(cx + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7));
          c.lineTo(cx + Math.sin(a) * (r - 12), cy - Math.cos(a) * (r - 12));
          c.strokeStyle = 'rgba(255,255,255,.5)';
          c.lineWidth = i % 3 ? 1.5 : 3;
          c.stroke();
        }
        const now = new Date();
        const h = (now.getHours() % 12) + now.getMinutes() / 60;
        const m = now.getMinutes() + now.getSeconds() / 60;
        const s = now.getSeconds();
        const hand = (a, len, w, col) => {
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len);
          c.strokeStyle = col; c.lineWidth = w; c.stroke();
        };
        hand(h * Math.PI / 6, r * 0.55, 5, 'rgba(255,255,255,.92)');
        hand(m * Math.PI / 30, r * 0.78, 3.5, 'rgba(255,255,255,.85)');
        hand(s * Math.PI / 30, r * 0.85, 1.5, Settings.get('accent', '#0A84FF'));
        c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
        /* digital */
        dig.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        date.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      }
      draw();
      setInterval(draw, 1000);
      return box;
    }

    function calendarWidget() {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', textAlign: 'center' } });
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => grid.append(el('span', { class: 'dimmer', style: { fontSize: '10px', fontWeight: '600' } }, d)));
      for (let i = 0; i < first; i++) grid.append(el('span'));
      for (let d = 1; d <= days; d++) {
        const cell = el('span', {
          style: {
            fontSize: '11px', padding: '2px 0', borderRadius: '50%', width: '22px', height: '22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto',
            background: d === now.getDate() ? 'var(--accent)' : '', color: d === now.getDate() ? '#fff' : 'var(--text-1)',
          },
        }, String(d));
        grid.append(cell);
      }
      const title = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return el('div', {}, [
        el('div', { style: { fontSize: '13px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' } }, title),
        grid,
      ]);
    }

    function weatherWidget() {
      const presets = {
        tahoe: ['24°', 'Tahoe skies — crystal glass', 'sun'],
        mammoth: ['19°', 'Golden hour all day', 'sun'],
        aurora: ['9°', 'Night aurora, green sky', 'moon'],
        sequoia: ['27°', 'Canyon heat', 'sun'],
        mono: ['16°', 'Overcast, very serious', 'moon'],
      };
      const [temp, desc, icon] = presets[Wallpaper.get()] || presets.tahoe;
      const iconBox = el('span', { style: { width: '54px', height: '54px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ffd76a, #ff9f0a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a4b00', animation: 'pulse-glow 3s ease-in-out infinite', flex: 'none' } },
        el('span', { html: Icons.glyph(icon), style: { width: '26px', height: '26px' } }));
      return el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, [
        iconBox,
        el('div', {}, [
          el('div', { style: { fontSize: '26px', fontWeight: '300' } }, temp),
          el('div', { class: 'dimmer', style: { fontSize: '11px' } }, desc),
          el('div', { class: 'dimmer', style: { fontSize: '11px' } }, 'Cupertino, CA'),
        ]),
      ]);
    }

    function render() {
      widgetsHost.innerHTML = '';
      for (const kind of visible) {
        let node = null, title = '';
        if (kind === 'clock') { node = clockWidget(); title = 'CLOCK'; }
        else if (kind === 'calendar') { node = calendarWidget(); title = 'CALENDAR'; }
        else if (kind === 'weather') { node = weatherWidget(); title = 'WEATHER'; }
        if (node) widgetsHost.append(frame(kind, title, node));
      }
      widgetsHost.classList.toggle('hidden-widgets', !Settings.get('widgets'));
    }

    on('settings:widgets', render);
    on('settings:wallpaper', () => { if (visible.includes('weather')) render(); });

    return { render, toggleEdit, remove };
  })();

  /* ================= welcome (first run) ================= */
  M27.register({
    id: 'welcome',
    name: 'Welcome to macOS 27',
    icon: Icons.genericApp(),
    width: 660, height: 500, minW: 560, minH: 420, resizable: false, single: true, hidden: true,
    mount({ content }) {
      const root = el('div', { class: 'welcome' }, [
        el('h1', {}, 'Welcome to macOS 27'),
        el('div', { class: 'w-sub' }, 'Mammoth · built entirely in your browser · powered by DeepSeek V4 Pro'),
        el('div', { class: 'w-cards' }, [
          el('div', { class: 'w-card' }, [
            el('h3', {}, el('span', { html: Icons.glyph('eye'), style: { width: '16px', height: '16px', display: 'inline-block' } }), 'Liquid Glass'),
            el('p', {}, 'Every window refracts the live wallpaper, samples its color, and catches light on a specular rim. Drag a window around and watch the glass drink the scene behind it.'),
            el('div', { style: { marginTop: '10px' } }, el('button', { class: 'btn primary', onclick: () => WM.open('settings', { args: { pane: 'glass' } }) }, 'Tune the glass')),
          ]),
          el('div', { class: 'w-card' }, [
            el('h3', {}, el('span', { html: Icons.assistant(), style: { width: '16px', height: '16px', display: 'inline-block' } }), 'Intelligence'),
            el('p', {}, 'Ask the built-in assistant anything. It runs on a local demo brain out of the box — connect DeepSeek V4 Pro in System Settings for the full model.'),
            el('div', { style: { marginTop: '10px' } }, el('button', { class: 'btn primary', onclick: () => WM.open('assistant') }, 'Meet Intelligence')),
          ]),
          el('div', { class: 'w-card' }, [
            el('h3', {}, el('span', { html: Icons.glyph('gear'), style: { width: '16px', height: '16px', display: 'inline-block' } }), 'Make it yours'),
            el('p', {}, 'Swap the wallpaper, switch to light mode, crank the blur, dim the lights — System Settings changes apply live to the whole OS.'),
            el('div', { style: { marginTop: '10px' } }, el('button', { class: 'btn', onclick: () => WM.open('settings') }, 'System Settings')),
          ]),
        ]),
        el('div', { class: 'w-actions' }, [
          el('button', { class: 'btn ghost', onclick: () => { WM.close(WM.find('welcome')); } }, 'Skip tour'),
          el('button', { class: 'btn', onclick: () => { WM.close(WM.find('welcome')); WM.open('terminal'); } }, 'Open Terminal'),
        ]),
      ]);
      content.append(root);
    },
  });

  /* ================= enter desktop ================= */
  function restoreSession() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('macos27.windows') || '[]'); } catch { saved = []; }
    if (!Array.isArray(saved) || !saved.length) return;
    for (const s of saved) {
      if (!s || !s.appId || !M27.apps[s.appId]) continue;
      if (s.appId === 'welcome' || s.appId === 'about') continue;
      const win = WM.open(s.appId, { x: s.x, y: s.y, width: s.w, height: s.h, silent: true });
      if (win && s.maximized && !win.maximized) WM.zoom(win);
      if (win && s.fullscreen) WM.fullscreen(win);
    }
  }

  function enterDesktop() {
    Dock.build();
    Menubar.render();
    renderDesktop();
    Widgets.render();
    Glass.refreshRefraction();

    if (Settings.get('firstRun')) {
      Settings.set('firstRun', false);
      setTimeout(() => {
        WM.open('welcome');
        setTimeout(() => WM.open('finder', { args: { path: HOME + '/Desktop' } }), 350);
        Toast.show('Tip: press ⌘Space to search, ⌘Tab to switch apps', { icon: 'search', ms: 5200 });
        Notifications.push({ title: '欢迎使用 macOS 27', body: '液态玻璃 · 由 DeepSeek V4 Pro 驱动', icon: 'info' });
      }, 450);
    } else {
      setTimeout(restoreSession, 80);
    }
  }

  /* ================= power ================= */
  function lock() {
    Overlays.closeAll();
    unlocked = false;
    document.body.classList.add('booting');
    tickLock();
    lockEl.classList.remove('fade', 'hidden');
  }

  function sleep() {
    Overlays.closeAll();
    const veil = el('div', {
      style: {
        position: 'fixed', inset: '0', background: '#000', zIndex: '6000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px',
        animation: 'fade-in .4s ease', cursor: 'pointer',
      },
    }, [
      el('span', { style: { fontSize: '26px', fontWeight: '300', color: '#ddd' } }, '😴'),
      el('span', { style: { fontSize: '13px', color: '#888' } }, 'Click anywhere to wake'),
    ]);
    document.body.append(veil);
    veil.addEventListener('click', () => {
      veil.style.opacity = '0';
      setTimeout(() => veil.remove(), 400);
      Sound.play('unlock');
    });
  }

  function restart() {
    Dialog.alert({
      title: 'Restart this Mac?',
      message: 'The demo will reboot into the macOS 27 boot screen. Everything you saved stays.',
      buttons: [
        { label: 'Cancel' },
        { label: 'Restart', primary: true, action: () => location.reload() },
      ],
    });
  }

  function shutdown() {
    Dialog.alert({
      title: 'Shut down this Mac?',
      message: 'A short power nap. Click to boot again.',
      buttons: [
        { label: 'Cancel' },
        { label: 'Shut Down', primary: true, danger: true, action: () => {
          Overlays.closeAll();
          WM.list().forEach(w => WM.close(w));
          document.body.classList.add('booting');
          unlocked = false;
          bootEl.classList.remove('hidden', 'fade');
          $('.boot-fill').style.width = '0%';
          lockEl.classList.add('hidden');
          const veil = el('div', {
            style: { position: 'fixed', inset: '0', background: '#000', zIndex: '5999', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
          }, [el('span', { style: { color: '#666', fontSize: '13px' } }, 'Click to power on')]);
          document.body.append(veil);
          veil.addEventListener('click', () => {
            veil.remove();
            boot();
          });
        } },
      ],
    });
  }

  /* ================= screenshot ================= */
  function screenshot() {
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    Wallpaper.renderTo(c, 1280, 720);
    const name = `Screenshot ${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.png`;
    VFS.write(HOME + '/Desktop/' + name, c.toDataURL('image/png'), 'image/png');
    Sound.play('ding');
    Toast.show(`Saved ${name} to Desktop`, { icon: 'image' });
    Notifications.push({ title: '截图已保存', body: name, icon: 'image' });
  }

  /* ================= global keyboard ================= */
  window.addEventListener('keydown', e => {
    const mod = cmd(e);

    /* ⌘Tab app switcher */
    if (mod && e.key === 'Tab' && unlocked) {
      e.preventDefault();
      if (!Overlays.switcher.isOpen()) Overlays.switcher.show();
      Overlays.switcher.next(e.shiftKey ? -1 : 1);
      return;
    }
    /* ⌘Space spotlight */
    if (mod && (e.code === 'Space') && unlocked) {
      e.preventDefault();
      Overlays.spotlight.toggle();
      return;
    }
    /* ⌘, settings */
    if (mod && e.key === ',') {
      e.preventDefault();
      WM.open('settings');
      return;
    }
    /* ⌘H hide app / ⌥⌘H hide others */
    if (mod && e.key.toLowerCase() === 'h' && unlocked) {
      e.preventDefault();
      const win = WM.active();
      if (win) { e.altKey ? WM.hideOthers(win.app.id) : WM.hideApp(win.app.id); }
      return;
    }
    /* fullscreen: F11 everywhere, ⌃⌘F on macOS */
    if (unlocked && (e.key === 'F11' || (isMac && mod && e.ctrlKey && e.key.toLowerCase() === 'f'))) {
      e.preventDefault();
      const win = WM.active();
      if (win) WM.toggleFullscreen(win);
      return;
    }
    /* prevent browser shortcuts */
    if (mod && ['s', 'p', 'f', 'l', 'n', 'w', 'm', 'q'].includes(e.key.toLowerCase())) {
      const win = WM.active();
      if (e.key.toLowerCase() === 'w') { if (win) { e.preventDefault(); WM.close(win); } }
      else if (e.key.toLowerCase() === 'm') { if (win) { e.preventDefault(); WM.minimize(win); } }
      else if (e.key.toLowerCase() === 'n') { if (win) { e.preventDefault(); WM.open(win.app.id); } }
      else e.preventDefault();
      return;
    }
    /* ⌘⇧3 screenshot */
    if (mod && e.shiftKey && e.code === 'Digit3' && unlocked) {
      e.preventDefault();
      screenshot();
      return;
    }
    /* Esc: exit fullscreen first, then close overlays */
    if (e.key === 'Escape') {
      const fsw = WM.list().find(w => w.fullscreen);
      if (fsw) { WM.exitFullscreen(fsw); return; }
      Overlays.closeAll();
      Menubar.closeMenu();
      if (selIcon) { selIcon = null; renderDesktop(); }
      return;
    }
    /* Spaces: Ctrl+←/→ or Ctrl+1..9 (not while editing text) */
    if (unlocked && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const ed = document.activeElement;
      const inEditable = ed && (ed.tagName === 'INPUT' || ed.tagName === 'TEXTAREA' || ed.isContentEditable);
      if (!inEditable) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); Spaces.set(Spaces.active - 1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); Spaces.set(Spaces.active + 1); return; }
        if (/^[1-9]$/.test(e.key)) { const n = +e.key - 1; if (n < Spaces.list.length) { e.preventDefault(); Spaces.set(n); return; } }
      }
    }
  });

  /* fullscreen menu bar / dock auto-reveal on edge hover */
  window.addEventListener('mousemove', e => {
    if (!document.body.classList.contains('fullscreen')) return;
    document.body.classList.toggle('reveal-menubar', e.clientY < 6);
    document.body.classList.toggle('reveal-dock', e.clientY > innerHeight - 6);
  });

  /* wallpaper auto-rotation */
  let rotateTimer = null;
  function startRotation() {
    clearInterval(rotateTimer);
    if (!Settings.get('wallpaperRotate')) return;
    rotateTimer = setInterval(() => {
      const l = Wallpaper.list();
      Wallpaper.set(l[(l.indexOf(Wallpaper.get()) + 1) % l.length]);
    }, (Settings.get('wallpaperInterval') || 5) * 60000);
  }
  on('settings:wallpaperRotate', startRotation);
  on('settings:wallpaperInterval', startRotation);
  startRotation();

  window.addEventListener('keyup', e => {
    if ((e.key === 'Meta' || e.key === 'Control') && Overlays.switcher.isOpen()) {
      Overlays.switcher.activate();
    }
  });

  return { boot, lock, sleep, restart, shutdown, unlock, screenshot };
})();

/* first user gesture unlocks audio everywhere */
window.addEventListener('pointerdown', () => { /* Sound context is lazily resumed on play */ }, { once: false });

/* global error reporting (capped, non-fatal) */
let errCount = 0;
const reportErr = (msg) => { if (errCount++ < 5) Toast.show(msg, { icon: 'error', ms: 4500 }); };
window.addEventListener('error', (e) => { if (e.error) reportErr('运行错误：' + (e.error.message || '未知')); });
window.addEventListener('unhandledrejection', (e) => reportErr('异步错误：' + ((e.reason && e.reason.message) || '未知')));

Shell.boot();
