/* ============================================================
   macOS 27 — Mammoth · ui.js
   Shared UI: toasts, context menus, dialogs
   ============================================================ */
'use strict';

/* ---------- toasts ---------- */
const Toast = (() => {
  const host = $('#toasts');
  function show(msg, opts = {}) {
    const { icon = 'info', ms = 3400 } = opts;
    const t = el('div', { class: 'toast glass' }, [
      el('span', { class: 't-icon', html: Icons.glyph(icon) }),
      el('span', {}, msg),
    ]);
    host.append(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, ms);
  }
  return { show };
})();

/* ---------- context menus ---------- */
const ContextMenu = (() => {
  const host = $('#contextmenu');
  let openEl = null;

  function close() {
    if (openEl) openEl.remove();
    openEl = null;
    host.classList.add('hidden');
  }

  function show(x, y, items) {
    close();
    const menu = el('div', { class: 'menu-dropdown', role: 'menu', tabindex: '-1' });
    const rows = [];
    for (const it of items) {
      if (it.sep) { menu.append(el('div', { class: 'menu-sep' })); continue; }
      if (it.title) { menu.append(el('div', { class: 'menu-title' }, it.title)); continue; }
      const row = el('button', {
        class: 'menu-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : ''),
        role: 'menuitem',
      }, [
        el('span', { class: 'mm-label' }, it.label),
        it.shortcut ? el('span', { class: 'shortcut' }, it.shortcut) : null,
      ]);
      row.addEventListener('click', () => {
        close();
        if (it.action && !it.disabled) it.action();
      });
      menu.append(row);
      rows.push(row);
    }
    host.append(menu);
    host.classList.remove('hidden');
    openEl = menu;
    /* clamp to viewport */
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 4, Math.max(4, innerWidth - r.width - 8)) + 'px';
    menu.style.top = clamp(y, 4, Math.max(4, innerHeight - r.height - 8)) + 'px';

    /* keyboard navigation */
    let sel = rows.findIndex(rr => !rr.classList.contains('disabled'));
    if (sel < 0) sel = 0;
    const setSel = i => { sel = i; rows.forEach((rr, j) => rr.classList.toggle('sel', j === i)); rows[i] && rows[i].scrollIntoView({ block: 'nearest' }); };
    setSel(sel);
    menu.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % rows.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + rows.length) % rows.length); }
      else if (e.key === 'Enter') { e.preventDefault(); const rr = rows[sel]; if (rr) rr.click(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    menu.focus({ preventScroll: true });
  }

  window.addEventListener('pointerdown', e => {
    if (openEl && !openEl.contains(e.target)) close();
  }, true);
  window.addEventListener('blur', close);

  return { show, close };
})();

/* ---------- dialogs ---------- */
const Dialog = (() => {
  const host = $('#dialogs');

  function closeBox(box) {
    const scrim = box.querySelector('.dialog-scrim');
    scrim.style.opacity = '0';
    setTimeout(() => box.remove(), 150);
  }

  function alert({ title = '', message = '', buttons = [{ label: 'OK', primary: true }], danger = false } = {}) {
    const box = el('div', { class: 'dialog-box', style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      el('div', { class: 'dialog-scrim' }),
      el('div', { class: 'dialog glass' }, [
        el('h3', {}, title),
        message ? el('p', {}, message) : null,
        el('div', { class: 'dialog-buttons' },
          buttons.map(b => el('button', {
            class: 'btn ' + (b.primary ? 'primary' : '') + (danger ? ' danger' : ''),
            onclick: () => { closeBox(box); b.action && b.action(); },
          }, b.label))),
      ]),
    ]);
    const scrim = box.querySelector('.dialog-scrim');
    scrim.addEventListener('click', () => {
      const first = buttons.find(b => !b.primary);
      closeBox(box);
      first && first.action && first.action();
    });
    host.append(box);
    return box;
  }

  /* sheet anchored inside a window element */
  function sheet(winEl, build, { onDismiss } = {}) {
    const layer = el('div', { class: 'sheet' }, [
      build(),
    ]);
    layer.addEventListener('pointerdown', e => { if (e.target === layer) dismiss(); });
    function dismiss() {
      layer.style.opacity = '0';
      setTimeout(() => { layer.remove(); onDismiss && onDismiss(); }, 160);
    }
    winEl.append(layer);
    return { el: layer, dismiss };
  }

  return { alert, sheet };
})();
