/* ============================================================
   macOS 27 — Mammoth · menubar.js
   Menu bar: Apple menu, active-app menus, status items, clock.
   ============================================================ */
'use strict';

const Menubar = (() => {
  const bar = $('#menubar');
  const menusHost = $('#menus');
  let activeApp = null;
  let openMenuEl = null;

  /* ---------- real edit operations (clipboard / undo) ---------- */
  function focusedEditable() {
    const a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable)) return a;
    return null;
  }
  function execEdit(cmdName) {
    const ed = focusedEditable();
    if (ed) {
      ed.focus();
      try { if (document.execCommand(cmdName)) return true; } catch { /* fall through */ }
    }
    return false;
  }
  const editAction = (cmdName, hint) => () => {
    if (!execEdit(cmdName)) Toast.show(hint, { icon: 'info' });
  };

  /* ---------- default menus ---------- */
  function defaultMenus(app) {
    return [
      { label: 'File', items: [
        { label: 'New Window', shortcut: '⌘N', action: () => WM.open(app.id) },
        { sep: true },
        { label: 'Close Window', shortcut: '⌘W', action: (win) => win && WM.close(win) },
      ] },
      { label: 'Edit', items: [
        { label: 'Undo', shortcut: '⌘Z', action: editAction('undo', 'Nothing to undo') },
        { label: 'Redo', shortcut: '⇧⌘Z', action: editAction('redo', 'Nothing to redo') },
        { sep: true },
        { label: 'Cut', shortcut: '⌘X', action: editAction('cut', 'Nothing selected to cut') },
        { label: 'Copy', shortcut: '⌘C', action: () => {
          if (!execEdit('copy')) {
            const t = window.getSelection().toString();
            if (t) navigator.clipboard?.writeText(t).then(() => Toast.show('Copied to clipboard', { icon: 'check' }));
            else Toast.show('Nothing selected to copy', { icon: 'info' });
          }
        } },
        { label: 'Paste', shortcut: '⌘V', action: editAction('paste', 'Nothing to paste into') },
      ] },
      { label: 'View', items: [
        { label: 'Enter Full Screen', shortcut: '⌃⌘F', checked: !!WM.active()?.fullscreen,
          action: (win) => win && WM.toggleFullscreen(win) },
        { sep: true },
        { label: 'Toggle Liquid Glass', checked: Settings.get('glass'), action: () => Settings.set('glass', !Settings.get('glass')) },
        { label: 'Reduce Transparency', checked: !Settings.get('glass'), action: () => Settings.set('glass', !Settings.get('glass')) },
      ] },
      { label: 'Window', items: [
        { label: 'Minimize', shortcut: '⌘M', action: (win) => win && WM.minimize(win) },
        { label: 'Zoom', action: (win) => win && WM.zoom(win) },
        { label: 'Hide', shortcut: '⌘H', action: (win) => win && WM.hideApp(win.app.id) },
        { label: 'Hide Others', shortcut: '⌥⌘H', action: (win) => win && WM.hideOthers(win.app.id) },
        { sep: true },
        { label: 'Mission Control', shortcut: '⌃↑', action: () => Overlays.mission.toggle() },
        { label: 'Launchpad', action: () => Overlays.launchpad.toggle() },
      ] },
      { label: 'Help', items: [
        { label: 'macOS 27 Help', action: () => WM.open('about') },
        { label: 'Meet Liquid Glass', action: () => WM.open('settings', { args: { pane: 'glass' } }) },
        { label: 'Ask Intelligence', action: () => WM.open('assistant') },
      ] },
    ];
  }

  const appleMenu = () => ({
    label: '', icon: appleIcon(), items: [
      { label: 'About This Mac', action: () => WM.open('about') },
      { sep: true },
      { label: 'System Settings…', action: () => WM.open('settings') },
      { label: 'App Store…', action: () => Toast.show('The App Store is closed today. Everything is already here.', { icon: 'info' }) },
      { sep: true },
      { title: 'Liquid Glass' },
      { label: 'Reduce Transparency', checked: !Settings.get('glass'), action: () => Settings.set('glass', !Settings.get('glass')) },
      { label: 'Disable Refraction', checked: !Settings.get('refraction'), action: () => Settings.set('refraction', !Settings.get('refraction')) },
      { sep: true },
      { label: 'Sleep', action: () => Shell.sleep() },
      { label: 'Restart…', action: () => Shell.restart() },
      { label: 'Shut Down…', action: () => Shell.shutdown() },
      { sep: true },
      { label: 'Lock Screen', shortcut: '⌃⌘Q', action: () => Shell.lock() },
      { label: 'Log Out You…', action: () => Shell.lock() },
      { sep: true },
      { label: 'Reset Demo Data…', danger: true, action: () => {
        Dialog.alert({
          title: 'Reset macOS 27 demo?',
          message: 'This erases all files, notes, messages and settings, then reboots the Mac.',
          buttons: [
            { label: 'Cancel' },
            { label: 'Reset', primary: true, danger: true, action: () => {
              Object.keys(localStorage).filter(k => k.startsWith('macos27.')).forEach(k => localStorage.removeItem(k));
              location.reload();
            } },
          ],
        });
      } },
    ],
  });

  function appleIcon() {
    return '<svg viewBox="0 0 384 512" style="width:13px;height:15px"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
  }

  /* ---------- menu opening ---------- */
  function openMenu(btn, def) {
    closeMenu();
    const rect = btn.getBoundingClientRect();
    const menu = el('div', { class: 'menu-dropdown', role: 'menu', tabindex: '-1' });
    const rows = [];
    for (const it of def.items) {
      if (it.sep) { menu.append(el('div', { class: 'menu-sep' })); continue; }
      if (it.title) { menu.append(el('div', { class: 'menu-title' }, it.title)); continue; }
      const row = el('button', {
        class: 'menu-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : ''),
        role: 'menuitem',
      }, [
        el('span', {}, it.label),
        it.shortcut ? el('span', { class: 'shortcut' }, it.shortcut) : null,
      ]);
      row.addEventListener('click', () => {
        closeMenu();
        if (!it.disabled && it.action) it.action(WM.active(), it);
      });
      menu.append(row);
      rows.push(row);
    }
    menusHost.append(menu);
    openMenuEl = menu;
    btn.classList.add('open');
    menu.style.left = clamp(rect.left, 4, innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = rect.bottom + 3 + 'px';

    /* --- keyboard navigation --- */
    let sel = rows.findIndex(r => !r.classList.contains('disabled'));
    if (sel < 0) sel = 0;
    const setSel = (i) => {
      sel = i;
      rows.forEach((r, j) => r.classList.toggle('sel', j === i));
      rows[i] && rows[i].scrollIntoView({ block: 'nearest' });
    };
    setSel(sel);
    menu.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); setSel((sel + 1) % rows.length); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setSel((sel - 1 + rows.length) % rows.length); }
      else if (ev.key === 'Enter') { ev.preventDefault(); const r = rows[sel]; if (r) r.click(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(); btn.focus(); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const btns = $$('.mb-item[data-menu]', bar);
        const i = btns.indexOf(btn);
        const target = ev.key === 'ArrowRight' ? btns[i + 1] : btns[i - 1];
        if (target) { closeMenu(); target.click(); }
      }
    });
    menu.focus({ preventScroll: true });
  }

  function closeMenu() {
    if (openMenuEl) openMenuEl.remove();
    openMenuEl = null;
    $$('.mb-item.open', bar).forEach(b => b.classList.remove('open'));
  }

  /* ---------- build ---------- */
  function setActiveApp(app) {
    if (activeApp === app) return;
    activeApp = app;
    render();
  }

  function mbBtn(label, opts = {}) {
    const { bold, icon, onclick, cls, id, title, menu } = opts;
    const b = el('button', { class: 'mb-item' + (bold ? ' bold' : '') + (cls ? ' ' + cls : '') }, [
      icon ? el('span', { html: icon }) : null,
      label ? el('span', {}, label) : null,
    ]);
    if (id) b.id = id;
    if (title) b.title = title;
    if (menu) b.dataset.menu = '1';
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }

  function render() {
    bar.innerHTML = '';
    bar.append(mbBtn('', { icon: appleIcon(), menu: true, onclick: e => openMenu(e.currentTarget, appleMenu()) }));

    if (activeApp) {
      const app = activeApp;
      bar.append(mbBtn(app.name, { bold: true, onclick: () => WM.find(app.id) && WM.focus(WM.find(app.id)) }));
      const menus = (typeof app.menus === 'function' ? app.menus() : app.menus) || defaultMenus(app);
      for (const m of menus) {
        bar.append(mbBtn(m.label, { menu: true, onclick: e => openMenu(e.currentTarget, m) }));
      }
    } else {
      bar.append(mbBtn('macOS 27', { bold: true }));
    }

    const spacer = el('span', { id: 'mb-spacer' });
    bar.append(spacer);

    /* right side */
    bar.append(mbBtn('', { icon: Icons.glyph('wifi'), title: 'Wi-Fi: connected', cls: 'mb-status',
      onclick: () => Toast.show(Settings.get('wifi') ? 'Wi-Fi connected to "LiquidNet 5G"' : 'Wi-Fi off', { icon: 'wifi' }) }));
    bar.append(mbBtn('87%', { icon: Icons.glyph('battery'), cls: 'mb-status',
      onclick: () => Toast.show('Battery: 87% — powered by imagination', { icon: 'battery' }) }));
    bar.append(mbBtn('', { icon: Icons.glyph('search'), onclick: () => Overlays.spotlight.toggle(), title: 'Spotlight (⌘Space)' }));
    bar.append(mbBtn('', { icon: Icons.glyph('cc'), onclick: () => Overlays.cc.toggle(), title: 'Control Center' }));
    bar.append(mbBtn('', { id: 'mb-clock', title: 'Notification Center', onclick: () => Notifications.toggle() }));

    updateClock();
    Notifications.updateBadge();
  }

  function updateClock() {
    const c = $('#mb-clock');
    if (!c) return;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    c.textContent = `${date}  ${time}`;
  }

  on('focus', (win) => setActiveApp(win.app));
  on('close', () => { if (!WM.active()) setActiveApp(null); });

  window.addEventListener('pointerdown', e => {
    if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu();
  }, true);

  setInterval(updateClock, 1000);

  return { setActiveApp, render, closeMenu, updateClock };
})();
