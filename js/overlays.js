/* ============================================================
   macOS 27 — Mammoth · overlays.js
   Spotlight, Control Center, Launchpad, Mission Control,
   Cmd+Tab switcher.
   ============================================================ */
'use strict';

const Overlays = (() => {

  /* ================= Spotlight ================= */
  const spotlight = (() => {
    const host = $('#spotlight');
    const panel = el('div', { class: 'sp-panel glass' });
    const input = el('input', {
      class: 'sp-input', placeholder: 'Spotlight Search', spellcheck: false,
      'aria-label': 'Spotlight Search',
    });
    const results = el('div', { class: 'sp-results' });
    let sel = 0, rows = [];

    panel.append(
      el('div', { class: 'sp-input-row' }, [
        el('span', { html: Icons.glyph('search') }),
        input,
      ]),
      results,
    );
    host.append(panel);

    function rowFor(item) {
      return el('button', { class: 'sp-row' }, [
        el('span', { class: 'sp-icon', html: item.icon }),
        el('div', { class: 'sp-main' }, [
          el('div', {}, item.title),
          el('div', { class: 'sp-sub' }, item.sub),
        ]),
      ]);
    }

    let history = [];
    try { history = JSON.parse(localStorage.getItem('macos27.spotlight.history') || '[]') || []; } catch { history = []; }
    const pushHistory = (q) => {
      const s = String(q || '').trim();
      if (!s) return;
      history = [s, ...history.filter(x => x !== s)].slice(0, 8);
      try { localStorage.setItem('macos27.spotlight.history', JSON.stringify(history)); } catch { }
    };

    function convertUnits(q) {
      const UNIT = '(km|kilometers?|miles?|mi|meters?|m|ft|feets?|foot|cm|centimeters?|inches?|inch|in|kg|kilograms?|lb|lbs|pounds?|pound|c|f|°c|°f)';
      const re = new RegExp(`^\\s*(-?\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*(?:to|in|=|是|等于|→)?\\s*${UNIT}\\s*$`, 'i');
      const m = q.match(re);
      if (!m) return null;
      const v = parseFloat(m[1]);
      const norm = s => String(s).toLowerCase()
        .replace(/°c/, 'c').replace(/°f/, 'f')
        .replace(/centimeters?/, 'cm').replace(/kilometers?/, 'km')
        .replace(/miles?/, 'mi').replace(/meters?/, 'm')
        .replace(/feets?|foot/, 'ft').replace(/inches?/, 'in')
        .replace(/kilograms?/, 'kg').replace(/pounds?|lbs/, 'lb');
      const a = norm(m[2]), b = norm(m[3]);
      const L = { km: 1000, m: 1, cm: 0.01, mi: 1609.344, ft: 0.3048, in: 0.0254 };
      const M = { kg: 1, lb: 0.45359237 };
      const isLength = (a in L) && (b in L);
      const isMass = (a in M) && (b in M);
      const isTemp = (a === 'c' || a === 'f') && (b === 'c' || b === 'f');
      if (isLength) return { v, res: v * L[a] / L[b], from: a, to: b };
      if (isMass) return { v, res: v * M[a] / M[b], from: a, to: b };
      if (isTemp) {
        const res = a === b ? v : (a === 'c' ? v * 9 / 5 + 32 : (v - 32) * 5 / 9);
        return { v, res, from: a, to: b };
      }
      return null;
    }

    function build(q) {
      rows = [];
      results.innerHTML = '';
      const ql = q.trim().toLowerCase();
      if (!ql) { showHint(); return; }

      const groups = [];
      const apps = Object.values(M27.apps).filter(a => !a.hidden && a.name.toLowerCase().includes(ql));
      if (apps.length) groups.push({ title: 'Applications', items: apps.map(a => ({
        icon: a.icon, title: a.name, sub: 'Application',
        action: () => WM.open(a.id),
      })) });

      /* file search: name match + content match for text files (recursive) */
      const files = VFS.walk().filter(f => f.node.type === 'file' && (
        f.node.name.toLowerCase().includes(ql) ||
        (f.node.mime && f.node.mime.startsWith('text/') && (f.node.content || '').toLowerCase().includes(ql))
      )).slice(0, 8);
      if (files.length) groups.push({ title: 'Documents', items: files.map(f => ({
        icon: iconForMime(f.node.mime), title: f.node.name, sub: f.path,
        action: () => openFile(f.path, f.node),
      })) });

      /* calculator */
      if (typeof Calc !== 'undefined' && /^[\d+\-*/×÷%().\s]+$/.test(q) && /\d/.test(q)) {
        const v = Calc.calc(q.replace(/×/g, '*').replace(/÷/g, '/'));
        if (typeof v === 'number' && isFinite(v)) groups.push({ title: 'Calculation', items: [{
          icon: (M27.apps.calculator && M27.apps.calculator.icon) || '', title: '= ' + Calc.format(v), sub: q, action: () => {},
        }] });
      }

      /* unit conversion */
      const conv = convertUnits(q);
      if (conv) groups.push({ title: 'Conversion', items: [{
        icon: Icons.glyph('check'), title: `${conv.v} ${conv.from} = ${+conv.res.toPrecision(8)} ${conv.to}`, sub: 'Unit conversion', action: () => {},
      }] });

      /* quick actions */
      const quick = [
        { k: ['notes', 'note', '备忘录', '笔记'], label: '新建备忘录', icon: 'pencil', action: () => { WM.open('notes'); setTimeout(() => { const n = $('.notes-title'); if (n) { n.value = ''; n.focus(); } }, 350); } },
        { k: ['trash', '废纸篓', '回收站'], label: '清空废纸篓', icon: 'trash', action: () => { const d = VFS.get(HOME + '/.Trash'); if (d) { d.children = {}; emit('fs:change'); Toast.show('废纸篓已清空', { icon: 'trash' }); } } },
        { k: ['wallpaper', '壁纸'], label: '随机切换壁纸', icon: 'image', action: () => { const l = Wallpaper.list(); Wallpaper.set(l[Math.floor(Math.random() * l.length)]); } },
        { k: ['lock', '锁', '锁定'], label: '锁定屏幕', icon: 'info', action: () => Shell.lock() },
        { k: ['terminal', '终端'], label: '打开终端', icon: 'gear', action: () => WM.open('terminal') },
        { k: ['screenshot', '截图'], label: '截图保存到桌面', icon: 'image', action: () => Shell.screenshot() },
      ];
      const matchedQuick = quick.filter(a => a.k.some(k => ql.includes(k)));
      if (matchedQuick.length) groups.push({ title: 'Quick Actions', items: matchedQuick.map(a => ({
        icon: Icons.glyph(a.icon), title: a.label, sub: 'macOS 27', action: a.action,
      })) });

      /* system commands */
      const cmds = [
        { q: 'dark mode', label: '切换深色模式', action: () => Settings.set('theme', resolvedTheme() === 'dark' ? 'light' : 'dark') },
        { q: 'glass', label: 'Liquid Glass 设置…', action: () => WM.open('settings', { args: { pane: 'glass' } }) },
        { q: 'intelligence', label: '打开 Intelligence', action: () => WM.open('assistant') },
        { q: 'sleep', label: '睡眠', action: () => Shell.sleep() },
        { q: 'restart', label: '重新启动…', action: () => Shell.restart() },
        { q: 'shutdown', label: '关机…', action: () => Shell.shutdown() },
      ].filter(c => c.label.toLowerCase().includes(ql) || c.q.includes(ql));
      if (cmds.length) groups.push({ title: 'System', items: cmds.map(c => ({
        icon: Icons.glyph('gear'), title: c.label, sub: 'macOS 27', action: c.action,
      })) });

      const web = [{ title: `在网页中搜索“${q}”`, sub: 'DuckDuckGo', icon: Icons.glyph('search'),
        action: () => window.open('https://duckduckgo.com/?q=' + encodeURIComponent(q), '_blank') }];
      groups.push({ title: 'Web', items: web });

      let flat = [];
      for (const g of groups) {
        if (!g.items.length) continue;
        results.append(el('div', { class: 'sp-section' }, g.title));
        for (const it of g.items) {
          const row = rowFor(it);
          row.addEventListener('click', () => { hide(); pushHistory(q); it.action(); });
          row.addEventListener('pointerenter', () => select(flat.length));
          results.append(row);
          rows.push(row);
          flat.push(it);
        }
      }
      select(0);
    }

    function showHint() {
      results.innerHTML = '';
      if (history.length) {
        results.append(el('div', { class: 'sp-section' }, 'Recent'));
        for (const h of history.slice(0, 5)) {
          const row = rowFor({ icon: Icons.glyph('clock'), title: h, sub: 'Search again' });
          row.addEventListener('click', () => { input.value = h; build(h); input.focus(); });
          results.append(row);
        }
      }
      results.append(el('div', { class: 'sp-section' }, 'Suggestions'));
      for (const s of ['Calculator', 'Notes', 'Terminal', 'DeepSeek V4 Pro']) {
        const row = rowFor({ icon: Icons.glyph('search'), title: s, sub: 'Try searching for this' });
        row.addEventListener('click', () => { input.value = s; build(s); input.focus(); });
        results.append(row);
      }
    }

    function select(i) {
      sel = clamp(i, 0, Math.max(0, rows.length - 1));
      rows.forEach((r, j) => r.classList.toggle('sel', j === sel));
      rows[sel] && rows[sel].scrollIntoView({ block: 'nearest' });
    }

    function iconForMime(m) {
      if (m && m.startsWith('image/')) return Icons.glyph('image');
      if (m && (m.includes('markdown') || m === 'text/plain')) return Icons.glyph('doc');
      return Icons.glyph('doc');
    }

    function openFile(path, node) {
      if (node.mime && node.mime.startsWith('image/')) WM.open('preview', { args: { path } });
      else WM.open('textedit', { args: { path } });
    }

    input.addEventListener('input', () => build(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const activeRow = rows[sel];
        if (activeRow) activeRow.click();
        else if (input.value.trim()) window.open('https://duckduckgo.com/?q=' + encodeURIComponent(input.value.trim()), '_blank');
      } else if (e.key === 'Escape') hide();
    });

    function show() {
      host.classList.remove('hidden');
      input.value = '';
      build('');
      setTimeout(() => input.focus(), 30);
    }
    function hide() { host.classList.add('hidden'); }
    function toggle() { host.classList.contains('hidden') ? show() : hide(); }
    return { host, show, hide, toggle, isOpen: () => !host.classList.contains('hidden') };
  })();

  /* ================= Control Center ================= */
  const cc = (() => {
    const host = $('#control');
    let showFocusPanel = false;
    let npTimer = null, npRefs = null;

    const FOCUS_MODES = [['doNotDisturb', '勿扰'], ['sleep', '睡眠'], ['work', '工作']];

    function toggleCard(cls, getter, setter, iconOn) {
      const card = el('button', { class: 'cc-card' }, [
        el('span', { class: 'cc-icon' + (getter() ? ' on' : ''), html: Icons.glyph(iconOn) }),
        el('span', { class: 'cc-label' }, cls),
        el('span', { class: 'cc-value' }, getter() ? 'On' : 'Off'),
      ]);
      card.addEventListener('click', () => { setter(!getter()); render(); });
      return card;
    }

    function focusCard() {
      const mode = Settings.get('focusMode') || 'doNotDisturb';
      const label = FOCUS_MODES.find(m => m[0] === mode)?.[1] || '勿扰';
      const on = Settings.get('focus');
      const card = el('button', { class: 'cc-card' }, [
        el('span', { class: 'cc-icon' + (on ? ' on' : ''), html: Icons.glyph('focus') }),
        el('span', { class: 'cc-label' }, 'Focus'),
        el('span', { class: 'cc-value' }, on ? label : 'Off'),
      ]);
      card.addEventListener('click', () => { showFocusPanel = !showFocusPanel; render(); });
      return card;
    }

    function focusModePicker() {
      const wrap = el('div', { class: 'cc-focus-modes' });
      for (const [id, name] of FOCUS_MODES) {
        const chip = el('button', {
          class: 'chip' + (Settings.get('focus') && Settings.get('focusMode') === id ? ' accent' : ''),
        }, name);
        chip.addEventListener('click', () => {
          if (Settings.get('focus') && Settings.get('focusMode') === id) Settings.set('focus', false);
          else { Settings.set('focusMode', id); Settings.set('focus', true); }
          showFocusPanel = false;
          render();
        });
        wrap.append(chip);
      }
      return wrap;
    }

    function musicRow() {
      const title = el('span', { class: 'dim', style: { flex: '1', textAlign: 'right', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' } });
      const fill = el('div', { class: 'cc-progress-fill' });
      const bar = el('div', { class: 'cc-progress' }, fill);
      const row = el('div', { class: 'cc-card wide', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } }, [
        el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [
          el('span', { html: Icons.glyph('music') }),
          el('button', { class: 'icon-btn', html: Icons.glyph('prev'), onclick: () => typeof MusicPlayer !== 'undefined' && MusicPlayer.prev() }),
          el('button', { class: 'icon-btn', html: Icons.glyph('play'), onclick: () => typeof MusicPlayer !== 'undefined' && MusicPlayer.toggle() }),
          el('button', { class: 'icon-btn', html: Icons.glyph('next'), onclick: () => typeof MusicPlayer !== 'undefined' && MusicPlayer.next() }),
          title,
        ]),
        bar,
      ]);
      npRefs = { title, fill };
      return row;
    }

    function updateNowPlaying() {
      if (!npRefs || typeof MusicPlayer === 'undefined') return;
      const st = MusicPlayer.getState();
      npRefs.title.textContent = st.name + ' — ' + st.artist;
      npRefs.fill.style.width = clamp((st.played / (st.dur || 1)) * 100, 0, 100) + '%';
    }

    function render() {
      host.innerHTML = '';
      const grid1 = el('div', { class: 'cc-module' }, [
        toggleCard('Wi-Fi', () => Settings.get('wifi'), v => { Settings.set('wifi', v); Toast.show(v ? 'Wi-Fi turned on' : 'Wi-Fi turned off'); }, 'wifi'),
        toggleCard('Bluetooth', () => Settings.get('bluetooth'), v => Settings.set('bluetooth', v), 'bt'),
        toggleCard('AirDrop', () => Settings.get('airdrop'), v => Settings.set('airdrop', v), 'airdrop'),
        focusCard(),
      ]);

      const darkCard = el('button', { class: 'cc-card' }, [
        el('span', { class: 'cc-icon' + (resolvedTheme() === 'dark' ? ' on' : ''), html: Icons.glyph('moon') }),
        el('span', { class: 'cc-label' }, 'Dark Mode'),
        el('span', { class: 'cc-value' }, resolvedTheme() === 'dark' ? 'On' : 'Off'),
      ]);
      darkCard.addEventListener('click', () => {
        Settings.set('theme', resolvedTheme() === 'dark' ? 'light' : 'dark');
        render();
      });

      const glassCard = el('button', { class: 'cc-card' }, [
        el('span', { class: 'cc-icon' + (Settings.get('glass') ? ' on' : ''), html: Icons.glyph('eye') }),
        el('span', { class: 'cc-label' }, 'Liquid Glass'),
        el('span', { class: 'cc-value' }, Settings.get('glass') ? 'Refracting' : 'Flat'),
      ]);
      glassCard.addEventListener('click', () => {
        Settings.set('glass', !Settings.get('glass'));
        Toast.show(Settings.get('glass') ? 'Liquid Glass enabled' : 'Liquid Glass disabled');
        render();
      });

      const widgetCard = el('button', { class: 'cc-card' }, [
        el('span', { class: 'cc-icon' + (Settings.get('widgets') ? ' on' : ''), html: Icons.glyph('grid') }),
        el('span', { class: 'cc-label' }, 'Widgets'),
        el('span', { class: 'cc-value' }, Settings.get('widgets') ? 'Shown' : 'Hidden'),
      ]);
      widgetCard.addEventListener('click', () => { Settings.set('widgets', !Settings.get('widgets')); render(); });

      const grid2 = el('div', { class: 'cc-module' }, [darkCard, glassCard, widgetCard,
        el('button', { class: 'cc-card', onclick: () => { hide(); WM.open('assistant'); } }, [
          el('span', { class: 'cc-icon on', html: Icons.glyph('gear') }),
          el('span', { class: 'cc-label' }, 'Intelligence'),
          el('span', { class: 'cc-value' }, 'DeepSeek V4 Pro'),
        ])]);

      const bright = el('input', {
        class: 'slider', type: 'range', min: 0, max: 80, value: Settings.get('brightness'),
        oninput: e => { Settings.set('brightness', +e.target.value); $('#brightness').style.opacity = (+e.target.value / 100).toFixed(2); },
      });
      const vol = el('input', {
        class: 'slider', type: 'range', min: 0, max: 100, value: Math.round(Settings.get('uiVolume') * 100),
        oninput: e => { Settings.set('uiVolume', +e.target.value / 100); },
      });

      host.append(grid1,
        showFocusPanel ? focusModePicker() : null,
        grid2,
        el('div', { class: 'cc-module' }, [
          el('div', { class: 'cc-card wide' }, [el('span', { html: Icons.glyph('sun') }), el('div', { class: 'cc-sliders' }, [el('div', { class: 'cc-label' }, 'Brightness'), bright])]),
          el('div', { class: 'cc-card wide' }, [el('span', { html: Icons.glyph('volume') }), el('div', { class: 'cc-sliders' }, [el('div', { class: 'cc-label' }, 'Sound'), vol])]),
        ]),
        el('div', { class: 'cc-module' }, [musicRow()]));

      updateNowPlaying();
    }

    function show() {
      render();
      host.classList.remove('hidden');
      npTimer = setInterval(updateNowPlaying, 1000);
    }
    function hide() { host.classList.add('hidden'); clearInterval(npTimer); }
    function toggle() { host.classList.contains('hidden') ? show() : hide(); }
    return { host, show, hide, toggle, isOpen: () => !host.classList.contains('hidden') };
  })();

  /* ================= Launchpad ================= */
  const launchpad = (() => {
    const host = $('#launchpad');
    const search = el('input', { class: 'field lp-search', placeholder: 'Search', spellcheck: false });
    const grid = el('div', { class: 'lp-grid' });

    function render(q = '') {
      grid.innerHTML = '';
      const ql = q.toLowerCase();
      const apps = Object.values(M27.apps).filter(a => !a.hidden && a.name.toLowerCase().includes(ql));
      apps.forEach((a, i) => {
        const appEl = el('button', { class: 'lp-app', style: { animationDelay: (i * 18) + 'ms' } }, [
          el('span', { class: 'lp-icon', html: a.icon || Icons.genericApp() }),
          el('span', { class: 'lp-name' }, a.name),
        ]);
        appEl.addEventListener('click', () => { hide(); WM.open(a.id); });
        grid.append(appEl);
      });
    }

    search.addEventListener('input', () => render(search.value));
    host.append(search, grid);

    function show() { search.value = ''; render(); host.classList.remove('hidden'); }
    function hide() { host.classList.add('hidden'); }
    function toggle() { host.classList.contains('hidden') ? show() : hide(); }
    return { host, show, hide, toggle, isOpen: () => !host.classList.contains('hidden') };
  })();

  /* ================= Mission Control ================= */
  const mission = (() => {
    const host = $('#mission');
    let prevTransforms = [];
    let exiting = false;

    function build() {
      host.innerHTML = '';
      /* desktop spaces strip */
      const desktops = el('div', { class: 'mission-desktops' });
      const snap = Wallpaper.snapshot();
      Spaces.list.forEach((name, i) => {
        const space = el('div', { class: 'mission-space' + (i === Spaces.active ? ' active' : '') }, [
          el('span', { class: 'ms-name' }, name),
        ]);
        const sc = document.createElement('canvas');
        sc.width = 300; sc.height = 170;
        sc.getContext('2d').drawImage(snap, 0, 0, 300, 170);
        space.append(sc);
        space.addEventListener('click', () => { Spaces.set(i); hide(); });
        desktops.append(space);
      });
      const addSpace = el('div', { class: 'mission-space add', title: 'Add Desktop' }, [
        el('span', { class: 'ms-name' }, '+'),
      ]);
      addSpace.addEventListener('click', () => Spaces.add());
      desktops.append(addSpace);
      host.append(desktops, el('div', { class: 'mission-windows', id: 'mission-windows' }));

      /* live-scale the real windows (current space) into a grid */
      const wins = WM.list().filter(w => !w.minimized && (w.space ?? 0) === Spaces.active);
      const area = $('#mission-windows');
      const availW = Math.max(400, innerWidth - 140);
      const availH = Math.max(260, innerHeight - 320);
      const cols = Math.min(3, Math.max(1, wins.length));
      const rows = Math.max(1, Math.ceil(wins.length / cols));
      const cellW = (availW - (cols - 1) * 26) / cols;
      const cellH = (availH - (rows - 1) * 26) / rows;
      const totalW = cols * cellW + (cols - 1) * 26;
      const totalH = rows * cellH + (rows - 1) * 26;
      area.style.width = totalW + 'px';
      area.style.height = totalH + 'px';
      area.style.margin = '0 auto';

      prevTransforms = [];
      wins.forEach((w, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const s = Math.min((cellW - 24) / w.w, (cellH - 24) / w.h);
        const tw = w.w * s, th = w.h * s;
        const lx = col * (cellW + 26) + (cellW - tw) / 2;
        const ty = row * (cellH + 26) + (cellH - th) / 2;
        prevTransforms.push({ win: w, el: w.el, t: w.el.style.transform, pe: w.el.style.pointerEvents });
        w.el.style.transition = 'transform .35s cubic-bezier(.2,1,.4,1)';
        w.el.style.transform = `translate(${lx - w.x}px, ${ty - w.y}px) scale(${s})`;
        w.el.style.transformOrigin = '0 0';
        w.el.style.pointerEvents = 'none';
        w.el.addEventListener('click', () => { hide(); WM.focus(w); }, { once: true });
      });
    }

    function cleanup() {
      prevTransforms.forEach(({ win, el, t, pe }) => {
        el.style.transition = 'transform .3s cubic-bezier(.2,1,.4,1)';
        el.style.transform = t;
        el.style.transformOrigin = '';
        el.style.pointerEvents = pe;
        setTimeout(() => { el.style.transition = ''; }, 320);
      });
      prevTransforms = [];
    }

    function show() { if (exiting) return; build(); host.classList.remove('hidden'); }
    function hide() {
      if (exiting) return;
      exiting = true;
      host.classList.add('hidden');
      cleanup();
      setTimeout(() => { exiting = false; }, 350);
    }
    function toggle() { host.classList.contains('hidden') ? show() : hide(); }
    return { host, show, hide, toggle, isOpen: () => !host.classList.contains('hidden') };
  })();

  /* ================= Cmd+Tab switcher ================= */
  const switcher = (() => {
    const host = $('#switcher');
    const strip = el('div', { class: 'switcher-strip' });
    host.append(strip);
    let apps = [], sel = 0;

    function render() {
      strip.innerHTML = '';
      apps = [];
      const seen = new Set();
      for (const w of WM.list()) {
        if (seen.has(w.app.id)) continue;
        seen.add(w.app.id);
        apps.push(w.app);
      }
      if (!apps.length) { hide(); return; }
      apps.forEach((a, i) => {
        const appEl = el('div', { class: 'switcher-app' + (i === sel ? ' sel' : '') }, [
          el('span', { class: 'sw-icon', html: a.icon || Icons.genericApp() }),
          el('span', { class: 'sw-name' }, a.name),
        ]);
        strip.append(appEl);
      });
    }

    function show() { render(); host.classList.remove('hidden'); }
    function hide() { host.classList.add('hidden'); }
    function next(dir = 1) {
      if (!apps.length) return;
      sel = (sel + dir + apps.length) % apps.length;
      render();
    }
    function activate() {
      const app = apps[sel];
      hide();
      if (app) {
        const w = WM.restoreApp(app.id);
        if (!w) WM.open(app.id);
      }
    }
    return { show, hide, next, activate, isOpen: () => !host.classList.contains('hidden') };
  })();

  /* ================= global ================= */
  function closeAll() {
    if (spotlight.isOpen()) spotlight.hide();
    if (cc.isOpen()) cc.hide();
    if (launchpad.isOpen()) launchpad.hide();
    if (mission.isOpen()) mission.hide();
    if (switcher.isOpen()) switcher.hide();
    ContextMenu.close();
  }

  /* click outside control center closes it */
  window.addEventListener('pointerdown', e => {
    if (cc.isOpen() && !hostContains(cc, e.target)) cc.hide();
    if (spotlight.isOpen() && !hostContains(spotlight, e.target)) spotlight.hide();
    if (launchpad.isOpen() && e.target === $('#launchpad')) launchpad.hide();
    if (mission.isOpen() && e.target === $('#mission')) mission.hide();
  }, true);

  function hostContains(mod, target) {
    return target instanceof Node && (mod.host ? mod.host.contains(target) : true);
  }

  return { spotlight, cc, launchpad, mission, switcher, closeAll };
})();
