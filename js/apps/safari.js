/* ============================================================
   macOS 27 — Mammoth · apps/safari.js
   Safari — tabbed demo browser. Loads pages in a sandboxed
   iframe (many sites refuse embedding) and offers an external
   open button. Per-tab history for back/forward. Sidebar with
   Bookmarks / History / Reading List + Private Browsing.
   ============================================================ */
'use strict';

M27.register({
  id: 'safari',
  name: 'Safari',
  icon: Icons.safari(),
  width: 1100, height: 700, minW: 560, minH: 360,

  mount({ content, toolbar, setTitle }) {
    const KEY = 'macos27.safari';

    /* ---------- persisted sidebar data ---------- */
    let data = { bookmarks: [], history: [], reading: [] };
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? (JSON.parse(raw) || { bookmarks: [], history: [], reading: [] }) : {
        bookmarks: [
          { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
          { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
          { title: 'Archive.org', url: 'https://archive.org' },
        ],
        history: [],
        reading: [],
      };
    } catch { data = { bookmarks: [], history: [], reading: [] }; }

    function saveData() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
    }

    const FAVS = [
      { name: 'Wikipedia', url: 'https://www.wikipedia.org', color: '#8e8e93' },
      { name: 'MDN', url: 'https://developer.mozilla.org', color: '#21252b' },
      { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org', color: '#7ebc6f' },
      { name: 'Example.com', url: 'https://example.com', color: '#0a84ff' },
      { name: 'Archive.org', url: 'https://archive.org', color: '#3b3b40' },
      { name: 'W3C', url: 'https://www.w3.org', color: '#1a73e8' },
    ];

    const normalize = (raw) => {
      let s = String(raw || '').trim();
      if (!s) return '';
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = 'https://' + s;
      return s;
    };
    const hostname = (u) => {
      try { return new URL(u).hostname; } catch { return ''; }
    };

    let tabs = [{ id: uid(), url: '', history: [], index: -1 }];
    let active = 0;
    let privateMode = false;
    let sidebarOpen = false;
    const tab = () => tabs[active];

    /* ---------- injected styles ---------- */
    const styleEl = el('style', { html: `
      .app-safari-body { flex: 1; display: flex; min-height: 0; min-width: 0; }
      .app-safari-sidebar {
        width: 224px; flex: none;
        border-right: 1px solid var(--sep);
        background: var(--fill-2);
        padding: 8px 6px;
        overflow-y: auto; overflow-x: hidden;
        display: flex; flex-direction: column; gap: 2px;
      }
      .app-safari-sidebar.hidden { display: none; }
      .app-safari-section-title { font-size: 11px; font-weight: 600; color: var(--text-3); padding: 10px 8px 4px; letter-spacing: .3px; }
      .app-safari-row { display: flex; align-items: center; gap: 2px; border-radius: 6px; padding: 2px 4px; }
      .app-safari-row:hover { background: var(--hover); }
      .app-safari-main {
        flex: 1; min-width: 0; display: flex; flex-direction: column;
        align-items: flex-start; gap: 1px; padding: 4px 4px; border-radius: 6px; text-align: left;
      }
      .app-safari-main .app-safari-title { font-size: 13px; color: var(--text-1); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .app-safari-main .app-safari-sub { font-size: 11px; color: var(--text-3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .app-safari-x {
        flex: none; width: 22px; height: 22px; border-radius: 5px;
        display: flex; align-items: center; justify-content: center; color: var(--text-3); opacity: 0;
      }
      .app-safari-row:hover .app-safari-x { opacity: .85; }
      .app-safari-x:hover { background: var(--hover); color: var(--text-1); }
      .app-safari-x svg { width: 12px; height: 12px; }
      .app-safari-empty { font-size: 11px; color: var(--text-3); padding: 2px 8px 8px; }
      .app-safari-addr.private { border-color: color-mix(in srgb, var(--accent) 70%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
      .app-safari-private-chip { background: var(--accent); color: #fff; border-color: transparent; font-size: 11px; }
      .app-safari-btn.on { background: var(--fill-1); color: var(--accent); }
    ` });
    content.append(styleEl);

    const root = el('div', { class: 'app-root col' });
    content.append(root);

    const tabsEl = el('div', { class: 'safari-tabs' });
    const tools = el('div', { class: 'safari-tools', style: { padding: '6px 10px', gap: '6px', borderBottom: '1px solid var(--sep)' } });
    const body = el('div', { class: 'app-safari-body' });
    const sidebar = el('div', { class: 'app-safari-sidebar hidden' });
    const pageEl = el('div', { class: 'safari-page' });
    body.append(sidebar, pageEl);
    root.append(tabsEl, tools, body);

    /* ---------------- toolbar ---------------- */
    const sidebarBtn = el('button', { class: 'icon-btn app-safari-btn', title: 'Toggle sidebar', onclick: () => { Sound.play('click'); toggleSidebar(); } },
      el('span', { html: Icons.glyph('list') }));
    const backBtn = el('button', { class: 'icon-btn', title: 'Back', onclick: () => { Sound.play('click'); go(-1); } },
      el('span', { html: Icons.glyph('back') }));
    const fwdBtn = el('button', { class: 'icon-btn', title: 'Forward', onclick: () => { Sound.play('click'); go(1); } },
      el('span', { html: Icons.glyph('fwd') }));
    const refreshBtn = el('button', { class: 'icon-btn', title: 'Reload', onclick: () => { Sound.play('click'); reload(); } },
      el('span', { html: Icons.glyph('refresh') }));
    const addr = el('input', {
      class: 'field app-safari-addr', placeholder: 'Search or enter website name', spellcheck: false,
      style: { flex: '1', minWidth: '0' },
    });
    const privateChip = el('span', { class: 'chip app-safari-private-chip hidden' }, 'Private');
    const starBtn = el('button', { class: 'icon-btn', title: 'Add bookmark', onclick: () => { Sound.play('click'); addBookmark(); } },
      el('span', { html: Icons.glyph('star') }));
    const readingBtn = el('button', { class: 'icon-btn', title: 'Add to Reading List', onclick: () => { Sound.play('click'); addReading(); } },
      el('span', { html: Icons.glyph('eye') }));
    const privateBtn = el('button', { class: 'icon-btn app-safari-btn', title: 'Private Browsing', onclick: () => { Sound.play('click'); togglePrivate(); } },
      el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h17l-1.6 12a2 2 0 0 1-2 1.7H7.1a2 2 0 0 1-2-1.7Z"/><path d="M8 8V7a4 4 0 0 1 8 0v1"/></svg>' }));
    const openBtn = el('button', { class: 'icon-btn', title: 'Open in real browser', onclick: () => { Sound.play('click'); openExternal(); } },
      el('span', { html: Icons.glyph('share') }));
    tools.append(sidebarBtn, backBtn, fwdBtn, refreshBtn, addr, privateChip, starBtn, readingBtn, privateBtn, openBtn);

    addr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { Sound.play('click'); navigate(addr.value); }
    });

    /* ---------------- actions ---------------- */
    function go(dir) {
      const t = tab();
      if (dir < 0 && t.index > 0) { t.index--; t.url = t.history[t.index]; }
      else if (dir > 0 && t.index < t.history.length - 1) { t.index++; t.url = t.history[t.index]; }
      renderAll();
    }
    function reload() { renderPage(); }
    function openExternal() {
      const u = tab().url;
      if (u) window.open(u, '_blank');
    }
    function navigate(raw) {
      const u = normalize(raw);
      if (!u) return;
      const t = tab();
      t.url = u;
      if (t.index < 0 || t.history[t.index] !== u) {
        t.history = t.history.slice(0, t.index + 1);
        t.history.push(u);
        t.index = t.history.length - 1;
      }
      recordHistory(u);
      renderAll();
    }
    function newTab() {
      tabs.push({ id: uid(), url: '', history: [], index: -1 });
      active = tabs.length - 1;
      Sound.play('click');
      renderAll();
    }
    function closeTab(id, ev) {
      if (ev) ev.stopPropagation();
      const i = tabs.findIndex(t => t.id === id);
      if (i === -1) return;
      tabs.splice(i, 1);
      if (!tabs.length) tabs.push({ id: uid(), url: '', history: [], index: -1 });
      if (active >= tabs.length) active = tabs.length - 1;
      else if (i < active) active--;
      renderAll();
    }
    function activate(i) { active = i; renderAll(); }

    /* ---------------- sidebar data actions ---------------- */
    function recordHistory(u) {
      if (privateMode) return;
      const title = hostname(u) || u;
      data.history = data.history.filter(h => h.url !== u);
      data.history.unshift({ title, url: u, time: Date.now() });
      if (data.history.length > 50) data.history = data.history.slice(0, 50);
      saveData();
    }
    function addBookmark() {
      const u = tab().url;
      if (!u) { Toast.show('Nothing to bookmark', { icon: 'info' }); return; }
      const title = hostname(u);
      data.bookmarks = data.bookmarks.filter(b => b.url !== u);
      data.bookmarks.unshift({ title, url: u });
      saveData();
      renderSidebar();
      Toast.show('Added bookmark — ' + title, { icon: 'star' });
    }
    function addReading() {
      const u = tab().url;
      if (!u) { Toast.show('Nothing to add', { icon: 'info' }); return; }
      const title = hostname(u);
      data.reading = data.reading.filter(r => r.url !== u);
      data.reading.unshift({ title, url: u });
      saveData();
      renderSidebar();
      Toast.show('Added to Reading List', { icon: 'eye' });
    }
    function removeBookmark(u) { data.bookmarks = data.bookmarks.filter(b => b.url !== u); saveData(); renderSidebar(); }
    function removeHistory(u) { data.history = data.history.filter(h => h.url !== u); saveData(); renderSidebar(); }
    function removeReading(u) { data.reading = data.reading.filter(r => r.url !== u); saveData(); renderSidebar(); }

    function toggleSidebar() {
      sidebarOpen = !sidebarOpen;
      sidebar.classList.toggle('hidden', !sidebarOpen);
      sidebarBtn.classList.toggle('on', sidebarOpen);
      if (sidebarOpen) renderSidebar();
    }
    function togglePrivate() {
      privateMode = !privateMode;
      privateBtn.classList.toggle('on', privateMode);
      privateChip.classList.toggle('hidden', !privateMode);
      addr.classList.toggle('private', privateMode);
      if (privateMode) Toast.show('Private Browsing on', { icon: 'eye' });
    }

    /* ---------------- rendering ---------------- */
    function sideRow(title, sub, onClick, onRemove, removeTitle) {
      const main = el('button', { class: 'app-safari-main', onclick: () => { Sound.play('click'); onClick(); } }, [
        el('span', { class: 'app-safari-title' }, title || 'Untitled'),
        sub ? el('span', { class: 'app-safari-sub' }, sub) : null,
      ]);
      const x = el('button', {
        class: 'app-safari-x', title: removeTitle || 'Remove',
        onclick: (e) => { e.stopPropagation(); Sound.play('trash'); onRemove(); },
      }, el('span', { html: Icons.glyph('x') }));
      return el('div', { class: 'app-safari-row' }, [main, x]);
    }

    function addSection(title, items, subFn, onRemove) {
      sidebar.append(el('div', { class: 'app-safari-section-title' }, title));
      if (!items.length) {
        sidebar.append(el('div', { class: 'app-safari-empty' }, 'None'));
        return;
      }
      for (const it of items) {
        sidebar.append(sideRow(
          it.title || hostname(it.url),
          subFn ? subFn(it) : hostname(it.url),
          () => navigate(it.url),
          () => onRemove(it.url),
        ));
      }
    }

    function renderSidebar() {
      if (!sidebarOpen) return;
      sidebar.innerHTML = '';
      addSection('Bookmarks', data.bookmarks, (it) => hostname(it.url), removeBookmark);
      addSection('History', data.history, (it) => fmtDate(it.time, true), removeHistory);
      addSection('Reading List', data.reading, (it) => hostname(it.url), removeReading);
    }

    function renderAll() {
      renderTabs();
      renderTools();
      renderPage();
      renderSidebar();
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      tabs.forEach((t, i) => {
        const tb = el('button', {
          class: 'safari-tab' + (i === active ? ' on' : ''),
          title: t.url || 'Start Page',
          onclick: () => { Sound.play('click'); activate(i); },
        }, [
          el('span', { class: 'st-title' }, t.url ? hostname(t.url) : 'Start Page'),
          el('span', {
            class: 'st-close', title: 'Close Tab', html: Icons.glyph('x'),
            onclick: (e) => closeTab(t.id, e),
          }),
        ]);
        tabsEl.append(tb);
      });
      const plus = el('button', {
        class: 'safari-tab', style: { flex: 'none', maxWidth: 'none' },
        title: 'New Tab', onclick: newTab,
      }, el('span', { html: Icons.glyph('plus') }));
      tabsEl.append(plus);
    }

    function renderTools() {
      const t = tab();
      backBtn.disabled = t.index <= 0;
      fwdBtn.disabled = t.index >= t.history.length - 1;
      backBtn.style.opacity = backBtn.disabled ? '0.35' : '';
      fwdBtn.style.opacity = fwdBtn.disabled ? '0.35' : '';
      addr.value = t.url || '';
      if (setTitle) setTitle(t.url ? hostname(t.url) : 'Safari');
    }

    function noteBar(t) {
      return el('div', {
        style: {
          flex: 'none', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 12px', fontSize: '11px', borderBottom: '1px solid var(--sep)',
        },
      }, [
        el('span', { class: 'dimmer', style: { flex: '1' } }, 'Some sites refuse to be embedded —'),
        el('button', {
          class: 'btn', style: { fontSize: '11px', padding: '2px 10px' },
          onclick: () => { Sound.play('click'); window.open(t.url, '_blank'); },
        }, 'Open ↗'),
      ]);
    }

    function startPage() {
      const favs = el('div', { class: 'safari-favs' });
      for (const f of FAVS) {
        const fav = el('button', {
          class: 'safari-fav',
          onclick: () => { Sound.play('click'); navigate(f.url); },
        }, [
          el('span', { class: 'sf-dot', style: { background: f.color } }, f.name[0]),
          el('span', { class: 'sf-name' }, f.name),
        ]);
        favs.append(fav);
      }
      return el('div', { class: 'safari-start' }, [
        el('h2', {}, 'Favorites'),
        favs,
        el('p', {
          class: 'safari-note', style: { marginTop: '18px', maxWidth: '560px' },
        }, 'This is a demo browser. Pages load inside a sandboxed frame, so many sites that send '
          + 'X-Frame-Options or CSP frame restrictions will refuse to appear. When a page looks blank, '
          + 'use the Open ↗ button to see it in a real browser tab.'),
      ]);
    }

    function renderPage() {
      pageEl.innerHTML = '';
      const t = tab();
      if (!t.url) {
        pageEl.append(startPage());
        return;
      }
      pageEl.append(
        noteBar(t),
        el('iframe', {
          class: 'safari-frame',
          src: t.url,
          sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
        }),
      );
    }

    renderAll();
    return () => {};
  },
});
