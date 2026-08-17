/* ============================================================
   macOS 27 — Mammoth · apps/notes.js
   Notes: search, pin, trash, autosave editor, rich-text
   toolbar, user folders, export, lock.
   ============================================================ */
'use strict';

M27.register({
  id: 'notes',
  name: 'Notes',
  icon: Icons.notes(),
  width: 900, height: 600, minW: 620, minH: 380,

  mount({ content, toolbar, win }) {
    const KEY = 'macos27.notes';
    const FOLDERS_KEY = 'macos27.notes.folders';

    /* ---------- style (app-prefixed, appended once) ---------- */
    if (!document.getElementById('m27-notes-style')) {
      const st = document.createElement('style');
      st.id = 'm27-notes-style';
      st.textContent = `
        .notes-tb { display:flex; align-items:center; gap:2px; padding:4px 14px; border-bottom:1px solid var(--sep); flex:none; }
        .notes-tb-btn { min-width:27px; height:27px; padding:0 8px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; color:var(--text-2); font-size:13px; }
        .notes-tb-btn:hover { background:var(--hover); color:var(--text-1); }
        .notes-tb-btn.b { font-weight:700; }
        .notes-tb-btn.i { font-style:italic; font-family:Georgia, serif; }
        .notes-tb-btn.u { text-decoration:underline; }
        .notes-tb-sep { width:1px; height:16px; background:var(--sep); margin:0 4px; flex:none; }
        .notes-body h2, .notes-body h3 { margin:.4em 0 .2em; }
        .notes-body h2 { font-size:20px; font-weight:700; }
        .notes-locked { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; color:var(--text-2); }
        .notes-locked:hover { color:var(--text-1); }
        .notes-side-input { flex:1; min-width:0; padding:2px 6px; font-size:12px; }
      `;
      document.head.appendChild(st);
    }

    /* ---------- helpers ---------- */
    function stripHtml(html) {
      const d = document.createElement('div');
      d.innerHTML = html || '';
      return (d.textContent || '').replace(/\u00a0/g, ' ');
    }
    function htmlToPlain(html) {
      const d = document.createElement('div');
      d.innerHTML = html || '';
      d.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
      d.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,tr').forEach(b => b.append('\n'));
      return (d.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    /* ---------- state ---------- */
    let notes = [];
    try { notes = JSON.parse(localStorage.getItem(KEY) || 'null') || []; } catch { notes = []; }
    if (!notes.length) {
      const now = Date.now();
      notes = [
        { id: uid(), title: 'Welcome to macOS 27', body: '<p>This Mac is made of Liquid Glass. Drag windows around and watch them drink the wallpaper\u2019s colors.</p><p>Open System Settings \u2192 Liquid Glass to tune the material live.</p>', date: now, pinned: true, trashed: false, folder: null, locked: false },
        { id: uid(), title: 'Liquid Glass', body: '<p>Blur. Refraction. Adaptive tint. Specular rim.</p><p>That\u2019s the recipe. Reduce Transparency turns it all off.</p>', date: now - 3600e3, pinned: false, trashed: false, folder: null, locked: false },
        { id: uid(), title: 'Keyboard shortcuts', body: '<p>\u2318Space \u2014 Spotlight<br>\u2318Tab \u2014 App switcher<br>\u2318W \u2014 Close window<br>\u2318M \u2014 Minimize<br>\u2318N \u2014 New note</p>', date: now - 7200e3, pinned: false, trashed: false, folder: null, locked: false },
      ];
    }
    /* migrate legacy plain-text bodies + fill new fields */
    notes.forEach(n => {
      if (typeof n.body === 'string' && n.body.includes('\n') && !/<[a-z][\s\S]*>/i.test(n.body)) {
        n.body = esc(n.body).replace(/\n/g, '<br>');
      }
      if (n.folder === undefined) n.folder = null;
      if (n.locked === undefined) n.locked = false;
    });

    let folders = [];
    try {
      const raw = localStorage.getItem(FOLDERS_KEY);
      if (raw == null) { folders = ['个人', '工作']; }
      else { folders = JSON.parse(raw) || []; }
    } catch { folders = ['个人', '工作']; }

    let view = 'all';            // all | pinned | trash | folder
    let folderSel = null;        // selected user folder name
    let selId = notes.find(n => !n.trashed)?.id || null;
    let query = '';
    let addingFolder = false;
    let renamingFolder = null;

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* full */ }
    }
    function saveFolders() {
      try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); } catch { /* full */ }
    }

    /* ---------- layout ---------- */
    const root = el('div', { class: 'app-root' });
    const side = el('div', { class: 'app-sidebar' });
    const listPane = el('div', { class: 'app-sidebar', style: { width: '230px', borderRight: '1px solid var(--sep)' } });
    const editor = el('div', { class: 'notes-editor' });
    root.append(side, listPane, editor);
    content.append(root);

    const search = el('input', { class: 'field', placeholder: 'Search', spellcheck: false, style: { marginBottom: '8px' } });
    side.append(search);
    const specialEl = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
    const folderSection = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
    side.append(specialEl, folderSection);

    const SPECIAL = [
      { id: 'all', name: 'All Notes', icon: Icons.glyph('doc') },
      { id: 'pinned', name: 'Pinned', icon: Icons.glyph('pin') },
      { id: 'trash', name: 'Recently Deleted', icon: Icons.glyph('trash') },
    ];

    function visible() {
      return notes.filter(n => {
        if (view === 'trash') return n.trashed;
        if (n.trashed) return false;
        if (view === 'pinned' && !n.pinned) return false;
        if (view === 'folder' && (n.folder || null) !== folderSel) return false;
        if (query) return (n.title + ' ' + stripHtml(n.body)).toLowerCase().includes(query.toLowerCase());
        return true;
      }).sort((a, b) => (b.pinned - a.pinned) || (b.date - a.date));
    }

    function countFor(id) {
      if (id === 'all') return notes.filter(n => !n.trashed).length;
      if (id === 'pinned') return notes.filter(n => !n.trashed && n.pinned).length;
      if (id === 'trash') return notes.filter(n => n.trashed).length;
      return 0;
    }

    function renderSpecial() {
      specialEl.innerHTML = '';
      for (const f of SPECIAL) {
        const row = el('button', { class: 'sb-item' + (view === f.id ? ' sel' : '') }, [
          el('span', { html: f.icon }),
          el('span', {}, f.name),
          el('span', { class: 'sb-count' }, countFor(f.id)),
        ]);
        row.addEventListener('click', () => {
          view = f.id; folderSel = null;
          if (selId) { const s = notes.find(n => n.id === selId); if (!s || s.trashed !== (view === 'trash')) selId = visible()[0]?.id || null; }
          renderSide(); renderList(); renderEditor();
        });
        specialEl.append(row);
      }
    }

    function renderFolders() {
      folderSection.innerHTML = '';
      folderSection.append(el('div', { class: 'sb-title' }, 'Folders'));

      for (const f of folders) {
        if (renamingFolder === f) {
          const input = el('input', { class: 'field notes-side-input', value: f, spellcheck: false });
          const commit = () => {
            const name = input.value.trim();
            if (name && name !== f && !folders.includes(name)) {
              const idx = folders.indexOf(f);
              folders[idx] = name;
              notes.forEach(n => { if (n.folder === f) n.folder = name; });
              if (folderSel === f) folderSel = name;
              saveFolders(); save();
            }
            renamingFolder = null;
            renderSide(); renderList();
          };
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { renamingFolder = null; renderSide(); }
          });
          input.addEventListener('blur', commit);
          const row = el('div', { class: 'sb-item' }, input);
          folderSection.append(row);
          setTimeout(() => { input.focus(); input.select(); });
          continue;
        }

        const row = el('button', {
          class: 'sb-item' + (view === 'folder' && folderSel === f ? ' sel' : ''),
        }, [
          el('span', { html: Icons.glyph('folder') }),
          el('span', {}, f),
          el('span', { class: 'sb-count' }, notes.filter(n => !n.trashed && n.folder === f).length),
        ]);
        row.addEventListener('click', () => {
          view = 'folder'; folderSel = f;
          selId = visible()[0]?.id || null;
          renderSide(); renderList(); renderEditor();
        });
        row.addEventListener('contextmenu', e => {
          e.preventDefault();
          ContextMenu.show(e.clientX, e.clientY, [
            { label: 'Rename', icon: 'pencil', action: () => { renamingFolder = f; renderSide(); } },
            { sep: true },
            {
              label: 'Delete Folder', icon: 'trash', danger: true,
              action: () => {
                folders = folders.filter(x => x !== f);
                notes.forEach(n => { if (n.folder === f) n.folder = null; });
                if (folderSel === f) { view = 'all'; folderSel = null; }
                saveFolders(); save();
                renderSide(); renderList(); renderEditor();
                Sound.play('trash');
                Toast.show('Folder deleted', { icon: 'trash' });
              },
            },
          ]);
        });
        folderSection.append(row);
      }

      if (addingFolder) {
        const input = el('input', { class: 'field notes-side-input', placeholder: 'Folder name', spellcheck: false });
        const commit = () => {
          const name = input.value.trim();
          if (name && !folders.includes(name)) { folders.push(name); saveFolders(); }
          addingFolder = false;
          renderSide();
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { addingFolder = false; renderSide(); }
        });
        input.addEventListener('blur', commit);
        folderSection.append(el('div', { class: 'sb-item' }, input));
        setTimeout(() => input.focus());
      } else {
        const btn = el('button', { class: 'sb-item', onclick: () => { addingFolder = true; renderSide(); } }, [
          el('span', { html: Icons.glyph('plus') }),
          el('span', {}, 'New Folder'),
        ]);
        folderSection.append(btn);
      }
    }

    function renderSide() { renderSpecial(); renderFolders(); }

    function renderList() {
      listPane.innerHTML = '';
      const list = visible();
      if (!list.length) {
        listPane.append(el('div', { class: 'empty-state', style: { padding: '24px 10px' } },
          el('span', { class: 'dimmer' }, query ? 'No notes match' : 'No notes')));
        return;
      }
      for (const n of list) {
        const item = el('button', { class: 'notes-item' + (n.id === selId ? ' sel' : '') }, [
          el('span', { class: 'nt-title' }, n.title || 'New Note'),
          el('span', { class: 'nt-meta' }, [
            el('span', {}, fmtDate(n.date)),
            n.folder ? el('span', {}, n.folder) : null,
            n.locked ? el('span', {}, '\uD83D\uDD12') : null,
            n.pinned && !n.trashed ? el('span', { html: Icons.glyph('pin'), style: { width: '10px', height: '10px', display: 'inline-block' } }) : null,
          ]),
          el('span', { class: 'nt-snippet' }, htmlToPlain(n.body).split('\n')[0] || 'No additional text'),
        ]);
        item.addEventListener('click', () => { selId = n.id; renderList(); renderEditor(); });
        listPane.append(item);
      }
    }

    function metaText(n) {
      const words = (stripHtml(n.body).match(/\S+/g) || []).length;
      return `Edited ${fmtDate(n.date, true)} · ${words} words`;
    }

    function unlock(n) {
      Dialog.alert({
        title: '解锁笔记',
        message: '此笔记已锁定。确定要解锁并查看内容吗？',
        buttons: [
          { label: '取消' },
          { label: '解锁', primary: true, action: () => { n.locked = false; save(); renderEditor(); renderList(); Toast.show('Note unlocked', { icon: 'check' }); } },
        ],
      });
    }

    function renderEditor() {
      editor.innerHTML = '';
      const n = notes.find(x => x.id === selId);
      if (!n) {
        editor.append(el('div', { class: 'empty-state' }, el('span', { class: 'dimmer' }, 'Select a note, or press ⌘N')));
        return;
      }
      if (n.trashed) {
        editor.append(el('div', { class: 'empty-state' }, [
          el('span', { class: 'dimmer' }, 'This note is in Recently Deleted.'),
          el('button', { class: 'btn', onclick: () => { n.trashed = false; n.date = Date.now(); save(); renderSide(); renderList(); renderEditor(); } }, 'Recover'),
        ]));
        return;
      }

      const title = el('input', { class: 'notes-title', placeholder: 'Title', value: n.title, spellcheck: false });
      const meta = el('div', { class: 'dimmer', style: { padding: '0 20px 8px', fontSize: '11px' } }, metaText(n));

      const saveTitle = debounce(() => {
        n.title = title.value.trim() || 'New Note';
        n.date = Date.now();
        meta.textContent = metaText(n);
        save();
        renderList();
        renderSide();
      }, 500);
      title.addEventListener('input', saveTitle);

      if (n.locked) {
        const lockPanel = el('div', { class: 'notes-locked', onclick: () => unlock(n) }, [
          el('span', { style: { fontSize: '40px' } }, '\uD83D\uDD12'),
          el('span', { style: { fontWeight: '600', fontSize: '15px' } }, '已锁定'),
          el('span', { class: 'dimmer' }, '点击解锁查看内容'),
        ]);
        editor.append(title, lockPanel, meta);
        return;
      }

      const body = el('div', { class: 'notes-body', contenteditable: 'true', html: n.body || '' });
      const saveBody = debounce(() => {
        n.body = body.innerHTML;
        n.date = Date.now();
        meta.textContent = metaText(n);
        save();
        renderList();
        renderSide();
      }, 500);
      body.addEventListener('input', saveBody);
      const tbBtn = (label, ttl, cmd, arg, cls) => el('button', {
        class: 'notes-tb-btn' + (cls ? ' ' + cls : ''),
        title: ttl,
        onmousedown: e => e.preventDefault(),
        onclick: () => { body.focus(); try { document.execCommand(cmd, false, arg || null); } catch { /* noop */ } saveBody(); },
      }, label);
      const tb = el('div', { class: 'notes-tb' }, [
        tbBtn('B', 'Bold', 'bold', null, 'b'),
        tbBtn('I', 'Italic', 'italic', null, 'i'),
        tbBtn('U', 'Underline', 'underline', null, 'u'),
        el('span', { class: 'notes-tb-sep' }),
        tbBtn('• List', 'Bullet list', 'insertUnorderedList', null),
        tbBtn('H', 'Heading', 'formatBlock', 'h2'),
        el('span', { class: 'spacer' }),
        el('button', {
          class: 'notes-tb-btn', title: 'Lock note',
          onclick: () => { n.locked = true; save(); renderEditor(); renderList(); Toast.show('Note locked', { icon: 'pin' }); },
        }, '\uD83D\uDD12'),
      ]);

      editor.append(title, tb, body, meta);
    }

    search.addEventListener('input', () => { query = search.value; renderList(); });

    /* ---------- export ---------- */
    function exportNote() {
      const n = notes.find(x => x.id === selId);
      if (!n) { Toast.show('Select a note first', { icon: 'info' }); return; }
      const title = (n.title || 'Untitled').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
      const path = '/Users/you/Downloads/' + title + '.txt';
      try {
        VFS.mkdir('/Users/you/Downloads');
        VFS.write(path, htmlToPlain(n.body), 'text/plain');
        Toast.show('Exported to ' + path, { icon: 'doc' });
      } catch (e) {
        Toast.show('Export failed', { icon: 'error' });
      }
    }

    /* ---------- toolbar ---------- */
    toolbar.append(
      el('button', { class: 'btn ghost', onclick: () => {
        const n = { id: uid(), title: '', body: '', date: Date.now(), pinned: false, trashed: false, folder: view === 'folder' ? folderSel : null, locked: false };
        notes.unshift(n);
        selId = n.id; save();
        renderSide(); renderList(); renderEditor();
        $('.notes-title', editor)?.focus();
      } }, '⌘N New'),
      el('button', { class: 'icon-btn', title: 'Pin / unpin', onclick: () => {
        const n = notes.find(x => x.id === selId);
        if (n && !n.trashed) { n.pinned = !n.pinned; save(); renderSide(); renderList(); }
      } }, el('span', { html: Icons.glyph('pin') })),
      el('button', { class: 'icon-btn', title: 'Delete', onclick: () => {
        const n = notes.find(x => x.id === selId);
        if (n) {
          if (n.trashed) { notes = notes.filter(x => x.id !== n.id); }
          else { n.trashed = true; }
          selId = visible()[0]?.id || null;
          save(); renderSide(); renderList(); renderEditor();
          Sound.play('trash');
        }
      } }, el('span', { html: Icons.glyph('trash') })),
      el('button', { class: 'btn ghost', title: 'Export current note as .txt', onclick: exportNote },
        el('span', { html: Icons.glyph('doc') }), ' Export'),
      el('span', { class: 'spacer' }),
      el('button', { class: 'icon-btn', title: 'Share', onclick: () => Toast.show('Note copied to clipboard', { icon: 'share' }) },
        el('span', { html: Icons.glyph('share') })),
    );

    renderSide();
    renderList();
    renderEditor();

    return () => {};
  },
});
