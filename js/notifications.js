/* ============================================================
   macOS 27 — Mammoth · notifications.js
   Notification Center: queue, panel (Today + notifications),
   Do Not Disturb, persistence.
   ============================================================ */
'use strict';

const Notifications = (() => {
  const KEY = 'macos27.notifications';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch { items = []; }

  let panel = null;

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 40))); } catch { /* quota */ } }

  function todayEvents() {
    const pad2 = n => String(n).padStart(2, '0');
    const d = new Date();
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    let ev = [];
    try { ev = (JSON.parse(localStorage.getItem('macos27.calendar') || '[]') || []).filter(e => e.date === key); } catch { ev = []; }
    return ev.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  function fmtTime(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return t || '';
    let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${m[2]} ${ap}`;
  }

  function push(item) {
    if (!Settings.get('notificationsEnabled', true)) return;
    items.unshift({ id: uid(), time: Date.now(), title: item.title || '', body: item.body || '', icon: item.icon || 'info', read: false });
    items = items.slice(0, 40);
    persist();
    updateBadge();
    if (panel && !panel.classList.contains('hidden')) renderPanel();
  }

  function dismiss(id) { items = items.filter(i => i.id !== id); persist(); renderPanel(); updateBadge(); }
  function clearAll() { items = []; persist(); renderPanel(); updateBadge(); }

  function updateBadge() {
    const clock = $('#mb-clock');
    if (!clock) return;
    const unread = items.filter(i => !i.read).length;
    clock.dataset.badge = unread || '';
  }

  function buildPanel() {
    if (panel) return panel;
    panel = el('div', { id: 'notification-center', class: 'glass hidden' });
    document.body.append(panel);
    return panel;
  }

  function renderPanel() {
    const p = buildPanel();
    p.innerHTML = '';

    /* header */
    p.append(el('div', { class: 'nc-header' }, [
      el('span', { class: 'nc-title' }, '通知中心'),
      el('span', { class: 'spacer' }),
      el('button', { class: 'icon-btn', title: '清除全部通知', onclick: clearAll }, el('span', { html: Icons.glyph('trash') })),
    ]));

    /* Do Not Disturb */
    p.append(el('div', { class: 'nc-dnd' }, [
      el('span', { class: 'nc-dnd-icon', html: Icons.glyph('moon') }),
      el('span', { style: { flex: '1' } }, '勿扰模式'),
      el('button', {
        class: 'switch' + (Settings.get('focus') ? ' on' : ''),
        onclick(e) { Settings.set('focus', !Settings.get('focus')); e.currentTarget.classList.toggle('on', Settings.get('focus')); },
      }),
    ]));

    /* Today */
    p.append(el('div', { class: 'nc-section' }, '今日'));
    p.append(el('div', { class: 'nc-date' },
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })));
    const evs = todayEvents();
    if (evs.length) {
      const ul = el('div', { class: 'nc-events' });
      for (const e of evs) ul.append(el('div', { class: 'nc-event' }, [
        el('span', { class: 'nc-event-time' }, fmtTime(e.time)),
        el('span', { class: 'nc-event-title' }, e.title),
      ]));
      p.append(ul);
    } else {
      p.append(el('div', { class: 'nc-empty' }, '今天没有日程'));
    }

    /* Notifications */
    p.append(el('div', { class: 'nc-section' }, '通知'));
    if (!items.length) {
      p.append(el('div', { class: 'nc-empty' }, '暂无通知'));
    } else {
      for (const it of items) {
        const row = el('div', { class: 'nc-item' + (it.read ? '' : ' unread') }, [
          el('span', { class: 'nc-icon', html: Icons.glyph(it.icon || 'info') }),
          el('div', { class: 'nc-body' }, [
            el('div', { class: 'nc-item-title' }, it.title),
            it.body ? el('div', { class: 'nc-item-body' }, it.body) : null,
            el('div', { class: 'nc-item-time' }, fmtDate(it.time, true)),
          ]),
          el('button', { class: 'nc-close', title: '关闭', onclick: () => dismiss(it.id) }, '×'),
        ]);
        p.append(row);
      }
    }
  }

  function open() {
    const p = buildPanel();
    renderPanel();
    p.classList.remove('hidden');
    items.forEach(i => i.read = true);
    persist();
    updateBadge();
    Sound.play('click');
  }
  function close() { panel && panel.classList.add('hidden'); }
  function toggle() { (panel && !panel.classList.contains('hidden')) ? close() : open(); }

  window.addEventListener('pointerdown', e => {
    if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target)) close();
  }, true);

  on('focus', updateBadge); // refresh clock badge on window focus changes (menubar re-render)

  return { push, dismiss, clearAll, open, close, toggle, count: () => items.length, updateBadge };
})();
