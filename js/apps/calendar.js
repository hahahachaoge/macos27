/* ============================================================
   macOS 27 — Mammoth · apps/calendar.js
   Calendar: month/week/day views, event editing, all-day events,
   search, repeat placeholder.
   ============================================================ */
'use strict';

M27.register({
  id: 'calendar',
  name: 'Calendar',
  icon: Icons.calendar(),
  width: 980, height: 660, minW: 640, minH: 420,

  mount({ content, toolbar }) {
    const KEY = 'macos27.calendar';
    const pad2 = (n) => String(n).padStart(2, '0');
    const dkey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const parseKey = (ds) => { const [y, m, d] = String(ds || '').split('-').map(Number); return new Date(y, m - 1, d); };
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_MS = 86400e3;

    let events = [];
    try { events = JSON.parse(localStorage.getItem(KEY) || 'null') || []; } catch { events = []; }
    if (!events.length) {
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const at = (offset) => { const d = new Date(base); d.setDate(d.getDate() + offset); return dkey(d); };
      events = [
        { id: uid(), title: 'Coffee with Maya', time: '08:00', date: at(0) },
        { id: uid(), title: 'Standup', time: '09:15', date: at(0) },
        { id: uid(), title: 'Liquid Glass design review', time: '10:00', date: at(0) },
        { id: uid(), title: 'Design crit', time: '15:30', date: at(0) },
        { id: uid(), title: 'Ship macOS 27', time: '18:00', date: at(0) },
        { id: uid(), title: 'Mammoth launch day', time: '', date: at(1), allDay: true },
        { id: uid(), title: 'Dinner with Alex', time: '19:00', date: at(1) },
        { id: uid(), title: 'DeepSeek V4 Pro sync', time: '09:00', date: at(-1) },
        { id: uid(), title: 'Gym', time: '07:30', date: at(2) },
        { id: uid(), title: 'Mammoth keynote prep', time: '11:00', date: at(3) },
        { id: uid(), title: 'Weekly review', time: '16:00', date: at(-2) },
      ];
    }

    function save() { try { localStorage.setItem(KEY, JSON.stringify(events)); } catch { /* quota */ } }
    function fmtTime(t) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
      if (!m) return t || '';
      let h = +m[1]; const mm = m[2];
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${mm} ${ap}`;
    }
    const hourOf = (t) => { const m = /^(\d{1,2}):/.exec(String(t || '')); return m ? (+m[1]) % 24 : -1; };
    const byDate = (ds) => events.filter(e => e.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const isToday = (d) => dkey(d) === dkey(new Date());
    const chipLabel = (ev) => ev.allDay ? ev.title : `${fmtTime(ev.time)} ${ev.title}`;
    const weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; };

    let viewMode = 'month';   // month | week | day
    let view = new Date();    // anchor (month 1st / week Sunday / day)
    let sel = new Date();     // selected day
    let highlightId = null;
    let searchQuery = '';
    let editingId = null;     // event id being edited, or null for a new event

    /* ---- app-scoped styles ---- */
    content.append(el('style', {}, `
      .cal27-week { flex: 1; min-height: 0; overflow: auto; }
      .cal27-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); min-height: 100%; }
      .cal27-wcol { border-right: 1px solid var(--sep); border-bottom: 1px solid var(--sep); display: flex; flex-direction: column; min-width: 0; cursor: pointer; }
      .cal27-wcol:last-child { border-right: 0; }
      .cal27-wcol.cal27-today { background: color-mix(in srgb, var(--accent) 6%, transparent); }
      .cal27-wcol.cal27-sel { background: color-mix(in srgb, var(--accent) 16%, transparent); }
      .cal27-whead { display: flex; flex-direction: column; align-items: center; padding: 8px 4px; border-bottom: 1px solid var(--sep); gap: 2px; }
      .cal27-wday { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .4px; }
      .cal27-wdate { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 15px; font-weight: 600; }
      .cal27-wcol.cal27-today .cal27-wdate { background: var(--accent); color: #fff; }
      .cal27-wbody { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 3px; min-height: 0; }
      .cal27-dayview { flex: 1; min-height: 0; overflow: auto; }
      .cal27-dayhead { padding: 10px 14px; font-size: 15px; font-weight: 700; border-bottom: 1px solid var(--sep); }
      .cal27-allday { padding: 8px 12px; border-bottom: 1px solid var(--sep); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .cal27-allday-label { font-size: 11px; font-weight: 600; color: var(--text-3); margin-right: 4px; }
      .cal27-hour { display: flex; border-bottom: 1px solid var(--sep); min-height: 56px; }
      .cal27-hlabel { flex: none; width: 64px; padding: 8px 10px 0 0; text-align: right; font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }
      .cal27-hbody { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; padding: 6px 8px; min-width: 0; }
      .cal27-form { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
      .cal27-form-row { display: flex; gap: 6px; }
      .cal27-check { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--text-1); cursor: pointer; }
      .cal27-check input { accent-color: var(--accent); }
      .cal27-search { width: 150px; flex: none; }
    `));

    const root = el('div', { class: 'app-root' });
    const main = el('div', { class: 'app-main' });
    const side = el('div', { class: 'cal-side' });
    root.append(main, side);
    content.append(root);

    /* ---- event chip (reused in every view) ---- */
    function eventChip(ev) {
      const chip = el('div', {
        class: 'cd-ev',
        title: ev.allDay ? ev.title : `${fmtTime(ev.time)} — ${ev.title}`,
        style: { textAlign: 'left', cursor: 'pointer' },
      }, chipLabel(ev));
      chip.addEventListener('click', (e) => { e.stopPropagation(); openEdit(ev); });
      return chip;
    }

    /* ---- month view ---- */
    function renderMonth() {
      const headRow = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 'none', borderLeft: '1px solid var(--sep)', borderRight: '1px solid var(--sep)' } },
        DAYS.map(d => el('div', { class: 'cal-head' }, d)));
      const grid = el('div', { class: 'cal-grid', style: { flex: '1', gridAutoRows: 'minmax(64px, 1fr)', overflow: 'auto', borderTop: '1px solid var(--sep)', borderLeft: '1px solid var(--sep)' } });
      const y = view.getFullYear(), m = view.getMonth();
      const start = new Date(y, m, 1);
      start.setDate(1 - start.getDay());
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const inMonth = d.getMonth() === m;
        const evs = byDate(dkey(d));
        const cell = el('div', {
          class: 'cal-day' + (inMonth ? '' : ' other') + (isToday(d) ? ' today' : ''),
        }, el('span', { class: 'cd-num' }, d.getDate()));
        if (dkey(d) === dkey(sel)) cell.style.background = 'color-mix(in srgb, var(--accent) 16%, transparent)';
        for (const ev of evs.slice(0, 3)) cell.append(eventChip(ev));
        if (evs.length > 3) {
          cell.append(el('div', { class: 'cd-ev', style: { background: 'transparent', color: 'var(--text-3)' } }, `+${evs.length - 3} more`));
        }
        cell.addEventListener('click', () => { sel = d; highlightId = null; render(); Sound.play('click'); });
        grid.append(cell);
      }
      main.append(headRow, grid);
    }

    /* ---- week view ---- */
    function renderWeek() {
      const ws = weekStart(view);
      const wrap = el('div', { class: 'cal27-week' });
      const gridEl = el('div', { class: 'cal27-week-grid' });
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws.getTime() + i * DAY_MS);
        const evs = byDate(dkey(d));
        const col = el('div', { class: 'cal27-wcol' + (isToday(d) ? ' cal27-today' : '') + (dkey(d) === dkey(sel) ? ' cal27-sel' : '') });
        const head = el('div', { class: 'cal27-whead' }, [
          el('div', { class: 'cal27-wday' }, DAYS[d.getDay()]),
          el('div', { class: 'cal27-wdate' }, d.getDate()),
        ]);
        const body = el('div', { class: 'cal27-wbody' });
        evs.forEach(ev => body.append(eventChip(ev)));
        col.append(head, body);
        col.addEventListener('click', () => { sel = d; highlightId = null; render(); Sound.play('click'); });
        gridEl.append(col);
      }
      wrap.append(gridEl);
      main.append(wrap);
    }

    /* ---- day view ---- */
    function renderDay() {
      const d = view;
      const wrap = el('div', { class: 'cal27-dayview' });
      wrap.append(el('div', { class: 'cal27-dayhead' }, d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })));
      const evs = byDate(dkey(d));
      const allDayEvs = evs.filter(e => e.allDay);
      if (allDayEvs.length) {
        wrap.append(el('div', { class: 'cal27-allday' }, [
          el('span', { class: 'cal27-allday-label' }, 'All-day'),
          ...allDayEvs.map(e => eventChip(e)),
        ]));
      }
      const hourLabel = (h) => h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
      for (let h = 8; h <= 20; h++) {
        const hourEvs = evs.filter(e => !e.allDay && hourOf(e.time) === h);
        wrap.append(el('div', { class: 'cal27-hour' }, [
          el('div', { class: 'cal27-hlabel' }, hourLabel(h)),
          el('div', { class: 'cal27-hbody' }, hourEvs.map(e => eventChip(e))),
        ]));
      }
      main.append(wrap);
    }

    function renderMain() {
      main.innerHTML = '';
      if (viewMode === 'month') renderMonth();
      else if (viewMode === 'week') renderWeek();
      else renderDay();
    }

    /* ---- side panel ---- */
    const heading = el('h3', { style: { margin: '0 0 2px', fontSize: '15px', fontWeight: '700' } });
    const sub = el('div', { class: 'dimmer', style: { fontSize: '11px', marginBottom: '12px' } });
    const newBtn = el('button', { class: 'btn', style: { width: '100%', justifyContent: 'center', marginBottom: '8px' } }, 'New Event');
    const form = el('div', { class: 'hidden cal27-form' });
    const list = el('div', {});

    const titleInput = el('input', { class: 'field', placeholder: 'Event title', spellcheck: false });
    const dateInput = el('input', { class: 'field', type: 'date' });
    const timeInput = el('input', { class: 'field', type: 'time', value: '09:00' });
    const allDayCheck = el('input', { type: 'checkbox' });
    const allDayLabel = el('label', { class: 'cal27-check' }, [allDayCheck, el('span', {}, 'All-day')]);
    const repeatSel = el('select', { class: 'field' }, [
      el('option', { value: 'none' }, 'Does not repeat'),
      el('option', { value: 'daily' }, 'Daily'),
      el('option', { value: 'weekly' }, 'Weekly'),
    ]);
    const saveBtn = el('button', { class: 'btn primary', onclick: submitForm }, 'Save');
    const delBtn = el('button', { class: 'btn danger', onclick: onDeleteFromForm }, 'Delete');
    const cancelBtn = el('button', { class: 'btn', onclick: hideForm }, 'Cancel');

    allDayCheck.addEventListener('change', () => {
      timeInput.disabled = allDayCheck.checked;
      timeInput.style.opacity = allDayCheck.checked ? '.45' : '1';
    });
    titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitForm(); });

    form.append(titleInput, dateInput, timeInput, allDayLabel, repeatSel,
      el('div', { class: 'cal27-form-row' }, [saveBtn, delBtn, cancelBtn]));
    side.append(heading, sub, newBtn, form, list);

    function fillForm(ev) {
      titleInput.value = ev.title || '';
      dateInput.value = ev.date || dkey(sel);
      timeInput.value = ev.allDay ? '09:00' : (ev.time || '09:00');
      allDayCheck.checked = !!ev.allDay;
      repeatSel.value = ev.repeat || 'none';
      timeInput.disabled = !!ev.allDay;
      timeInput.style.opacity = ev.allDay ? '.45' : '1';
    }
    function showForm() {
      newBtn.classList.add('hidden');
      form.classList.remove('hidden');
      delBtn.classList.toggle('hidden', editingId == null);
      titleInput.focus();
    }
    function hideForm() {
      form.classList.add('hidden');
      newBtn.classList.remove('hidden');
      editingId = null;
      titleInput.value = '';
    }
    function openNewForm() {
      editingId = null;
      highlightId = null;
      clearSearch();
      fillForm({ title: '', date: dkey(sel), time: '09:00', allDay: false, repeat: 'none' });
      showForm();
    }
    function openEdit(ev) {
      editingId = ev.id;
      highlightId = ev.id;
      sel = parseKey(ev.date);
      clearSearch();
      fillForm(ev);
      showForm();
      render();
    }

    function submitForm() {
      const wasEdit = editingId != null;
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      const date = dateInput.value || dkey(sel);
      const allDay = allDayCheck.checked;
      const time = allDay ? '' : (timeInput.value || '09:00');
      const repeat = repeatSel.value;

      if (wasEdit) {
        const ev = events.find(x => x.id === editingId);
        if (ev) { ev.title = title; ev.date = date; ev.time = time; ev.allDay = allDay; ev.repeat = repeat; }
      } else {
        const spawn = (offsetDays) => {
          const d = parseKey(date);
          d.setDate(d.getDate() + offsetDays);
          events.push({ id: uid(), title, time, allDay, repeat, date: dkey(d) });
        };
        if (repeat === 'daily') { for (let i = 0; i < 7; i++) spawn(i); }
        else if (repeat === 'weekly') { for (let i = 0; i < 7; i++) spawn(i * 7); }
        else spawn(0);
      }

      save();
      hideForm();
      render();
      Sound.play('click');
      Toast.show(wasEdit ? 'Event updated' : 'Event added', { icon: 'check' });
      Notifications.push({ title: wasEdit ? '日程已更新' : '日程已添加', body: `${title} · ${allDay ? 'all day' : time}`, icon: 'clock' });
    }
    function onDeleteFromForm() {
      if (!editingId) return;
      deleteEvent(editingId);
    }
    function deleteEvent(id) {
      events = events.filter(x => x.id !== id);
      if (highlightId === id) highlightId = null;
      if (editingId === id) hideForm();
      save(); render();
      Sound.play('trash');
    }

    newBtn.addEventListener('click', openNewForm);

    function renderSearchResults() {
      heading.textContent = 'Search results';
      const q = searchQuery;
      const matches = events.filter(e => (e.title || '').toLowerCase().includes(q))
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
      sub.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
      list.innerHTML = '';
      if (!matches.length) {
        list.append(el('div', { class: 'empty-state', style: { padding: '24px 8px' } },
          el('span', { class: 'dimmer' }, 'No matching events')));
        return;
      }
      for (const ev of matches) {
        const row = el('div', { class: 'list-item' + (ev.id === highlightId ? ' sel' : '') }, [
          el('span', { style: { flex: '1', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' } }, [
            el('span', { class: 'dimmer', style: { flex: 'none', width: '84px', fontSize: '11px' } }, fmtDate(parseKey(ev.date).getTime())),
            el('span', { style: { fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ev.title),
          ]),
        ]);
        row.addEventListener('click', () => jumpTo(ev));
        list.append(row);
      }
    }

    function renderSide() {
      if (searchQuery) { renderSearchResults(); return; }
      heading.textContent = sel.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const evs = byDate(dkey(sel));
      sub.textContent = `${sel.getFullYear()} · ${evs.length} event${evs.length === 1 ? '' : 's'}`;
      list.innerHTML = '';
      if (!evs.length) {
        list.append(el('div', { class: 'empty-state', style: { padding: '24px 8px' } },
          el('span', { class: 'dimmer' }, 'No events')));
        return;
      }
      for (const ev of evs) {
        const row = el('div', { class: 'list-item' + (ev.id === highlightId ? ' sel' : '') }, [
          el('span', { style: { flex: '1', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' } }, [
            el('span', { class: 'dimmer', style: { flex: 'none', width: '64px', fontSize: '11px' } }, ev.allDay ? 'All-day' : fmtTime(ev.time)),
            el('span', { style: { fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ev.title),
          ]),
          el('button', {
            class: 'icon-btn', title: 'Delete event', html: Icons.glyph('trash'),
            onclick: (e) => { e.stopPropagation(); deleteEvent(ev.id); },
          }),
        ]);
        row.addEventListener('click', () => openEdit(ev));
        list.append(row);
      }
    }

    /* ---- navigation + toolbar ---- */
    function clearSearch() { searchQuery = ''; searchInput.value = ''; }

    function jumpTo(ev) {
      sel = parseKey(ev.date);
      view = new Date(sel.getFullYear(), sel.getMonth(), 1);
      viewMode = 'month';
      highlightId = ev.id;
      clearSearch();
      updateSeg();
      render();
      Sound.play('click');
    }

    function nav(delta) {
      if (viewMode === 'month') view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
      else if (viewMode === 'week') view = weekStart(new Date(view.getTime() + delta * 7 * DAY_MS));
      else { view = new Date(view.getTime() + delta * DAY_MS); sel = new Date(view); }
      clearSearch();
      render();
      Sound.play('click');
    }
    function goToday() {
      view = new Date(); sel = new Date(); highlightId = null;
      if (viewMode === 'week') view = weekStart(sel);
      else if (viewMode === 'day') view = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
      clearSearch();
      render();
      Sound.play('click');
    }
    function setMode(m) {
      viewMode = m;
      if (m === 'week') view = weekStart(sel);
      else if (m === 'day') view = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
      else view = new Date(sel.getFullYear(), sel.getMonth(), 1);
      clearSearch();
      updateSeg();
      render();
      Sound.play('click');
    }

    function titleText() {
      if (viewMode === 'month') return view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (viewMode === 'week') {
        const ws = weekStart(view);
        const we = new Date(ws.getTime() + 6 * DAY_MS);
        if (ws.getMonth() === we.getMonth()) {
          return `${ws.toLocaleDateString('en-US', { month: 'long' })} ${ws.getDate()} – ${we.getDate()}, ${we.getFullYear()}`;
        }
        return `${ws.toLocaleDateString('en-US', { month: 'short' })} ${ws.getDate()} – ${we.toLocaleDateString('en-US', { month: 'short' })} ${we.getDate()}, ${we.getFullYear()}`;
      }
      return view.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    const titleEl = el('span', { class: 'toolbar-title' });
    const searchInput = el('input', { class: 'field cal27-search', placeholder: 'Search events', spellcheck: false });
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderSide();
    });

    const segBtns = [];
    const seg = el('div', { class: 'segmented' });
    ['Month', 'Week', 'Day'].forEach((label, i) => {
      const b = el('button', { class: i === 0 ? 'on' : '' }, label);
      b.addEventListener('click', () => setMode(['month', 'week', 'day'][i]));
      segBtns.push(b);
      seg.append(b);
    });
    function updateSeg() {
      const modes = ['month', 'week', 'day'];
      segBtns.forEach((b, i) => b.classList.toggle('on', modes[i] === viewMode));
    }

    toolbar.append(
      el('button', { class: 'icon-btn', title: 'Previous', html: Icons.glyph('back'), onclick: () => nav(-1) }),
      el('button', { class: 'icon-btn', title: 'Next', html: Icons.glyph('fwd'), onclick: () => nav(1) }),
      el('button', { class: 'btn ghost', onclick: goToday }, 'Today'),
      titleEl,
      el('span', { class: 'spacer' }),
      searchInput,
      seg,
    );

    function render() {
      titleEl.textContent = titleText();
      renderMain();
      renderSide();
    }

    render();
    save();
    return () => {};
  },
});
