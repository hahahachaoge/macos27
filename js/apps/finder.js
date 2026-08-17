/* ============================================================
   macOS 27 — Mammoth · apps/finder.js
   Finder: sidebar (favorites, recents, tags), grid/list/column
   views, navigation, rename, new folder, trash, drag & drop,
   Get Info, recursive search, Quick Look, multi-select,
   clipboard copy/cut/paste, tags.
   ============================================================ */
'use strict';

M27.register({
  id: 'finder',
  name: 'Finder',
  icon: Icons.finder(),
  width: 1000, height: 640, minW: 620, minH: 400,

  mount({ content, toolbar, args, win }) {
    const TAG_COLORS = { red: '#ff453a', orange: '#ff9f0a', yellow: '#ffd60a', green: '#30d158', blue: '#0a84ff', purple: '#bf5af2' };

    const state = {
      path: args?.path || HOME,
      hist: [], hi: -1,
      view: 'grid',            // grid | list | column
      sort: 'name',
      sel: null,               // primary selected fullPath
      selected: new Set(),     // multi-select fullPaths
      mode: 'browse',          // browse | recents | tag
      tag: null,
    };

    /* tags */
    let tags = {};
    try { tags = JSON.parse(localStorage.getItem('macos27.finder.tags') || '{}') || {}; } catch { tags = {}; }
    const saveTags = () => { try { localStorage.setItem('macos27.finder.tags', JSON.stringify(tags)); } catch { } };

    /* clipboard */
    let clip = null;
    try { clip = JSON.parse(localStorage.getItem('macos27.finder.clipboard') || 'null'); } catch { clip = null; }
    const saveClip = () => { try { localStorage.setItem('macos27.finder.clipboard', JSON.stringify(clip)); } catch { } };

    const root = el('div', { class: 'app-root' });
    const sidebar = el('div', { class: 'app-sidebar' });
    const main = el('div', { class: 'app-main' });
    const viewArea = el('div', { class: 'finder-view', tabindex: '0' });
    const status = el('div', { class: 'finder-status' });
    main.append(viewArea, status);
    root.append(sidebar, main);
    content.append(root);

    /* ---------------- toolbar ---------------- */
    const pathLabel = el('span', { class: 'finder-path' });
    const search = el('input', { class: 'field', placeholder: '搜索整个 Mac', spellcheck: false, style: { width: '170px' } });
    const seg = el('div', { class: 'segmented' }, [
      el('button', { class: 'on', title: '图标', onclick: () => setView('grid') }, el('span', { html: Icons.glyph('grid') })),
      el('button', { title: '列表', onclick: () => setView('list') }, el('span', { html: Icons.glyph('list') })),
      el('button', { title: '分栏', onclick: () => setView('column') }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="5" height="16" rx="1"/><rect x="12" y="4" width="8" height="16" rx="1"/></svg>' })),
    ]);
    const setView = (v) => {
      state.view = v;
      [...seg.children].forEach((b, i) => b.classList.toggle('on', ['grid', 'list', 'column'][i] === v));
      render();
    };

    toolbar.append(
      el('div', { class: 'finder-nav' }, [
        el('button', { class: 'icon-btn', title: '后退', onclick: () => back() }, el('span', { html: Icons.glyph('back') })),
        el('button', { class: 'icon-btn', title: '前进', onclick: () => fwd() }, el('span', { html: Icons.glyph('fwd') })),
      ]),
      pathLabel,
      el('span', { class: 'spacer' }),
      seg,
      el('button', { class: 'icon-btn', title: '排序', onclick(e) {
        const r = e.currentTarget.getBoundingClientRect();
        ContextMenu.show(r.left, r.bottom + 4, ['name', 'kind', 'size', 'date'].map(k => ({
          label: '按' + { name: '名称', kind: '类型', size: '大小', date: '日期' }[k] + '排序',
          checked: state.sort === k, action: () => { state.sort = k; render(); },
        })));
      } }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M4 12h16M4 18h7"/></svg>' })),
      search,
    );
    search.addEventListener('input', debounce(() => { state.mode = 'browse'; render(); }, 160));
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; render(); } });

    /* ---------------- sidebar ---------------- */
    const SIDE = [
      { title: '收藏', items: [
        { id: 'recents', name: '最近使用', icon: Icons.glyph('clock'), mode: 'recents' },
        { id: 'apps', name: '应用程序', icon: Icons.glyph('grid'), path: '/Applications' },
        { id: 'desktop', name: '桌面', icon: Icons.glyph('doc'), path: HOME + '/Desktop' },
        { id: 'docs', name: '文稿', icon: Icons.glyph('doc'), path: HOME + '/Documents' },
        { id: 'downloads', name: '下载', icon: Icons.glyph('folder'), path: HOME + '/Downloads' },
        { id: 'pictures', name: '图片', icon: Icons.glyph('image'), path: HOME + '/Pictures' },
        { id: 'music', name: '音乐', icon: Icons.glyph('music'), path: HOME + '/Music' },
        { id: 'movies', name: '影片', icon: Icons.glyph('folder'), path: HOME + '/Movies' },
      ] },
      { title: '位置', items: [
        { id: 'root', name: 'Macintosh HD', icon: Icons.drive(), path: '/' },
        { id: 'trash', name: '废纸篓', icon: Icons.glyph('trash'), path: HOME + '/.Trash' },
      ] },
      { title: '标签', items: Object.entries(TAG_COLORS).map(([id, color]) => ({ id: 'tag-' + id, name: id[0].toUpperCase() + id.slice(1), color, tag: id })) },
    ];

    function renderSidebar() {
      sidebar.innerHTML = '';
      for (const sec of SIDE) {
        sidebar.append(el('div', { class: 'sb-title' }, sec.title));
        for (const it of sec.items) {
          const active = (it.path && state.mode === 'browse' && state.path === it.path) || (it.mode && state.mode === it.mode) || (it.tag && state.mode === 'tag' && state.tag === it.tag);
          const row = el('button', { class: 'sb-item' + (active ? ' sel' : '') }, [
            it.color ? el('span', { class: 'swatch', style: { background: it.color } }) : el('span', { html: it.icon }),
            el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.name),
          ]);
          row.addEventListener('click', () => {
            search.value = '';
            if (it.path) { state.mode = 'browse'; navigate(it.path); }
            else if (it.mode) { state.mode = it.mode; state.selected = new Set(); state.sel = null; render(); }
            else if (it.tag) { state.mode = 'tag'; state.tag = it.tag; state.selected = new Set(); state.sel = null; render(); }
          });
          sidebar.append(row);
        }
      }
    }

    /* ---------------- content ---------------- */
    function entries() {
      const q = search.value.trim().toLowerCase();
      if (q) {
        return VFS.walk()
          .filter(f => f.node.type === 'file' && (
            f.node.name.toLowerCase().includes(q) ||
            (f.node.mime && f.node.mime.startsWith('text/') && (f.node.content || '').toLowerCase().includes(q))
          ))
          .sort((a, b) => (b.node.mtime || 0) - (a.node.mtime || 0))
          .slice(0, 80)
          .map(f => ({ kind: 'file', node: f.node, name: f.node.name, fullPath: f.path, icon: iconFor(f.node) }));
      }
      if (state.mode === 'recents') {
        return VFS.walk()
          .filter(f => f.node.type === 'file')
          .sort((a, b) => (b.node.mtime || 0) - (a.node.mtime || 0))
          .slice(0, 40)
          .map(f => ({ kind: 'file', node: f.node, name: f.node.name, fullPath: f.path, icon: iconFor(f.node) }));
      }
      if (state.mode === 'tag') {
        return Object.entries(tags)
          .filter(([, c]) => c === state.tag)
          .map(([p]) => ({ p, n: VFS.get(p) }))
          .filter(x => x.n)
          .map(x => ({ kind: x.n.type === 'dir' ? 'dir' : 'file', node: x.n, name: x.n.name, fullPath: x.p, icon: iconFor(x.n) }));
      }
      if (state.path === '/Applications') {
        return VFS.apps().map(a => ({ kind: 'app', name: a.name, appId: a.appId, icon: a.icon, fullPath: 'app:' + a.appId }));
      }
      let list = VFS.ls(state.path);
      if (state.sort === 'name') { /* default */ }
      else if (state.sort === 'size') list.sort((a, b) => (b.size || 0) - (a.size || 0));
      else if (state.sort === 'date') list.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      else if (state.sort === 'kind') list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
      return list.map(n => ({ kind: n.type, node: n, name: n.name, fullPath: VFS.join(state.path, n.name), icon: iconFor(n) }));
    }

    function iconFor(node) {
      if (node.type === 'dir') return Icons.folder('#6ab7ff', '#2f8fe8');
      if (node.mime && node.mime.startsWith('image/')) return Icons.image();
      if (node.name.endsWith('.md') || node.name.endsWith('.txt')) return Icons.doc();
      if (node.name.endsWith('.dmg') || node.name.endsWith('.zip')) return Icons.drive();
      return Icons.doc();
    }

    function tagDot(p) { return tags[p] ? el('span', { class: 'tag-dot', style: { background: TAG_COLORS[tags[p]] || '#888' } }) : null; }

    function render() {
      renderSidebar();
      if (state.mode === 'recents') pathLabel.textContent = '最近使用';
      else if (state.mode === 'tag') pathLabel.textContent = '标签 · ' + (state.tag || '');
      else if (search.value) pathLabel.textContent = `搜索 “${search.value}”`;
      else pathLabel.textContent = state.path === HOME ? 'Home' : (state.path === '/' ? 'Macintosh HD' : VFS.basename(state.path));

      const list = entries();
      viewArea.innerHTML = '';

      if (!list.length) {
        viewArea.append(el('div', { class: 'empty-state' }, [
          el('span', { html: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>' }),
          el('div', {}, search.value ? `没有 “${search.value}” 的搜索结果` : '此文件夹为空'),
        ]));
      } else if (state.view === 'column') {
        renderColumn();
      } else if (state.view === 'list' || search.value || state.mode !== 'browse') {
        const head = el('div', { class: 'flist-head' }, [
          el('span'), el('span', {}, '名称'), el('span', {}, '种类'), el('span', {}, '修改日期'),
        ]);
        const body = el('div', { class: 'finder-list' });
        list.forEach(it => body.append(listItem(it)));
        viewArea.append(head, body);
      } else {
        const grid = el('div', { class: 'finder-grid' });
        list.forEach(it => grid.append(gridItem(it)));
        viewArea.append(grid);
      }

      const n = list.length;
      status.innerHTML = '';
      status.append(
        el('span', {}, state.selected.size > 1 ? `已选 ${state.selected.size} 项 · 共 ${n} 项` : `${n} 项`),
        el('span', { class: 'spacer' }),
        el('span', {}, 'Macintosh HD 可用空间 512 GB'));
    }

    function renderColumn() {
      const wrap = el('div', { class: 'finder-columns' });
      const segs = state.path.split('/').filter(Boolean);
      let acc = '';
      const cols = [{ path: '/', name: 'Macintosh HD', items: VFS.ls('/') }];
      for (const s of segs) { acc += '/' + s; cols.push({ path: acc, name: s, items: VFS.ls(acc) }); }
      for (const col of cols) {
        const c = el('div', { class: 'finder-col' }, [
          el('div', { class: 'finder-col-head' }, col.name),
        ]);
        for (const n of col.items) {
          const p = VFS.join(col.path, n.name);
          const row = el('button', { class: 'finder-col-item' + (state.selected.has(p) ? ' sel' : '') }, [
            el('span', { class: 'finder-col-icon', html: iconFor(n) }),
            el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, n.name),
            tagDot(p),
          ]);
          row.addEventListener('click', () => { n.type === 'dir' ? navigate(p) : setSel(p); });
          c.append(row);
        }
        wrap.append(c);
      }
      viewArea.append(wrap);
    }

    /* ---------------- open / actions ---------------- */
    function openEntry(it) {
      if (it.kind === 'app') { WM.open(it.appId); return; }
      const n = it.node;
      if (n.type === 'dir') { navigate(it.fullPath); return; }
      if (n.mime && n.mime.startsWith('image/')) { WM.open('preview', { args: { path: it.fullPath } }); return; }
      if (n.name.endsWith('.md') || n.name.endsWith('.txt') || n.mime === 'text/plain' || n.mime === 'text/markdown') {
        WM.open('textedit', { args: { path: it.fullPath } }); return;
      }
      Dialog.alert({ title: `没有可用于打开 “${n.name}” 的应用。`, message: '（演示 Mac：假装它已经打开了。）', buttons: [{ label: '取消' }, { label: '好', primary: true }] });
    }

    function setSel(p) { state.selected = new Set([p]); state.sel = p; render(); }
    function toggleSel(p) {
      if (state.selected.has(p)) { state.selected.delete(p); if (state.sel === p) state.sel = null; }
      else { state.selected.add(p); state.sel = p; }
      render();
    }
    function rangeSelect(p) {
      const idxs = entries().map(x => x.fullPath);
      const a = idxs.indexOf(state.sel), b = idxs.indexOf(p);
      if (a < 0) return setSel(p);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      state.selected = new Set(idxs.slice(lo, hi + 1));
      state.sel = p;
      render();
    }
    const selPaths = () => state.selected.size ? [...state.selected] : (state.sel ? [state.sel] : []);

    function gridItem(it) {
      const f = el('button', {
        class: 'fitem' + (state.selected.has(it.fullPath) ? ' sel' : ''),
        'data-path': it.fullPath,
      }, [
        el('span', { class: 'fi-icon', html: it.icon }),
        el('span', { class: 'fi-name' }, it.name),
        tagDot(it.fullPath),
      ]);
      f.addEventListener('click', e => {
        if (e.target.closest('.rename')) return;
        if (cmd(e)) toggleSel(it.fullPath);
        else if (e.shiftKey) rangeSelect(it.fullPath);
        else setSel(it.fullPath);
        Sound.play('click');
      });
      f.addEventListener('dblclick', () => openEntry(it));
      f.addEventListener('contextmenu', e => { e.preventDefault(); itemMenu(e.clientX, e.clientY, it); });
      f.addEventListener('pointerdown', e => {
        if (e.button !== 0 || state.selected.has(it.fullPath)) return;
        const sx = e.clientX, sy = e.clientY;
        let dragging = false;
        const move = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7 && !dragging) { dragging = true; f.style.opacity = '.4'; } };
        const up = ev => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (dragging) {
            f.style.opacity = '';
            const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.fitem');
            const tp = t?.dataset.path;
            if (tp && tp !== it.fullPath) {
              const target = entries().find(x => x.fullPath === tp);
              if (target && target.kind === 'dir') {
                if (VFS.move(it.fullPath, target.fullPath)) { Toast.show(`已移动 ${it.name}`, { icon: 'check' }); render(); }
              }
            }
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
      return f;
    }

    function listItem(it) {
      const kind = it.kind === 'app' ? '应用程序' : it.node.type === 'dir' ? '文件夹' : (it.node.mime || '文稿');
      const sub = search.value || state.mode !== 'browse' ? VFS.parent(it.fullPath) : kind;
      const row = el('div', {
        class: 'flist-row' + (state.selected.has(it.fullPath) ? ' sel' : ''),
        'data-path': it.fullPath,
      }, [
        el('span', { html: it.icon }),
        el('span', { class: 'fl-name' }, [it.name, tagDot(it.fullPath)]),
        el('span', { class: 'fl-cell' }, sub),
        el('span', { class: 'fl-cell' }, it.node ? fmtDate(it.node.mtime || Date.now()) : '—'),
      ]);
      row.addEventListener('click', e => {
        if (cmd(e)) toggleSel(it.fullPath);
        else if (e.shiftKey) rangeSelect(it.fullPath);
        else setSel(it.fullPath);
      });
      row.addEventListener('dblclick', () => openEntry(it));
      row.addEventListener('contextmenu', e => { e.preventDefault(); itemMenu(e.clientX, e.clientY, it); });
      return row;
    }

    /* ---------------- context menus ---------------- */
    function itemMenu(x, y, it) {
      if (!state.selected.has(it.fullPath)) setSel(it.fullPath);
      const tagItems = [ { title: '标签' },
        ...Object.entries(TAG_COLORS).map(([id, color]) => ({
          label: id[0].toUpperCase() + id.slice(1),
          checked: tags[it.fullPath] === id,
          action: () => { if (tags[it.fullPath] === id) delete tags[it.fullPath]; else tags[it.fullPath] = id; saveTags(); render(); },
        })),
      ];
      ContextMenu.show(x, y, [
        { label: '打开', shortcut: '⌘O', action: () => openEntry(it) },
        { label: '快速查看', shortcut: 'Space', action: () => quickLook(it) },
        { label: '显示简介', shortcut: '⌘I', action: () => getInfo(it) },
        { sep: true },
        { label: '拷贝', shortcut: '⌘C', action: () => copySel() },
        { label: '剪切', shortcut: '⌘X', action: () => cutSel() },
        { label: '复制', action: () => duplicate(it) },
        { sep: true },
        { label: '重命名', action: () => renameItem(it) },
        ...tagItems,
        { sep: true },
        { label: '移到废纸篓', shortcut: '⌘⌫', danger: true, action: () => trashSel() },
      ]);
    }

    function blankMenu(x, y) {
      ContextMenu.show(x, y, [
        { label: '新建文件夹', shortcut: '⇧⌘N', action: () => newFolder() },
        clip && clip.paths.length ? { label: '粘贴', shortcut: '⌘V', action: () => paste() } : { label: '粘贴', disabled: true },
        { sep: true },
        { label: '整理', action: () => Toast.show('桌面已整理（想象中）', { icon: 'check' }) },
        { sep: true },
        { label: '更换壁纸…', action: () => WM.open('settings', { args: { pane: 'wallpaper' } }) },
      ]);
    }

    viewArea.addEventListener('contextmenu', e => {
      if (e.target.closest('.fitem') || e.target.closest('.flist-row') || e.target.closest('.finder-col-item')) return;
      e.preventDefault();
      blankMenu(e.clientX, e.clientY);
    });

    /* ---------------- clipboard ---------------- */
    function copySel() { const paths = selPaths().filter(p => !p.startsWith('app:')); if (paths.length) { clip = { op: 'copy', paths }; saveClip(); Toast.show(`已拷贝 ${paths.length} 项`, { icon: 'check' }); } }
    function cutSel() { const paths = selPaths().filter(p => !p.startsWith('app:')); if (paths.length) { clip = { op: 'cut', paths }; saveClip(); Toast.show(`已剪切 ${paths.length} 项`, { icon: 'check' }); } }
    function paste() {
      if (!clip || !clip.paths.length) return;
      let done = 0;
      for (const src of clip.paths) {
        const node = VFS.get(src);
        if (!node) continue;
        const dst = VFS.join(state.path, node.name);
        if (clip.op === 'cut') {
          if (src === dst) continue;
          if (VFS.move(src, state.path)) done++;
        } else {
          if (src === dst) continue;
          if (node.type === 'file') { VFS.write(dst, node.content, node.mime); done++; }
          else { /* skip dir copy for simplicity */ }
        }
      }
      if (clip.op === 'cut') clip = null, saveClip();
      Toast.show(`已粘贴 ${done} 项`, { icon: 'check' });
      render();
    }

    /* ---------------- navigation / info / rename / etc ---------------- */
    function navigate(path) {
      if (!VFS.get(path)) return;
      state.hist = state.hist.slice(0, state.hi + 1);
      state.hist.push(path);
      state.hi = state.hist.length - 1;
      state.path = path;
      state.mode = 'browse';
      state.selected = new Set(); state.sel = null;
      render();
    }
    function back() { if (state.hi > 0) { state.hi--; state.path = state.hist[state.hi]; state.mode = 'browse'; render(); } }
    function fwd() { if (state.hi < state.hist.length - 1) { state.hi++; state.path = state.hist[state.hi]; state.mode = 'browse'; render(); } }

    function getInfo(it) {
      const n = it.node;
      const rows = n ? [
        ['种类', it.kind === 'app' ? '应用程序' : n.type === 'dir' ? '文件夹' : n.mime || '文稿'],
        ['大小', n.size ? fmtBytes(n.size) : '—'],
        ['位置', VFS.parent(it.fullPath || state.path)],
        ['标签', tags[it.fullPath] || '无'],
        ['修改', fmtDate(n.mtime || Date.now(), true)],
      ] : [['种类', '应用程序'], ['位置', '/Applications']];
      Dialog.sheet(win.el, () => el('div', { class: 'sheet-panel glass' }, [
        el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' } }, [
          el('span', { style: { width: '48px', height: '48px', flex: 'none' }, html: it.icon }),
          el('div', {}, [
            el('div', { style: { fontWeight: '600', fontSize: '15px' } }, it.name),
            el('div', { class: 'dim', style: { fontSize: '12px' } }, rows.length + ' 项属性'),
          ]),
        ]),
        ...rows.map(([k, v]) => el('div', { class: 'set-row', style: { padding: '7px 0' } }, [
          el('span', { class: 'sr-label dim' }, k), el('span', {}, v),
        ])),
      ]));
    }

    function renameItem(it) {
      const item = $(`.fitem[data-path="${CSS.escape(it.fullPath)}"], .flist-row[data-path="${CSS.escape(it.fullPath)}"]`, viewArea);
      if (!item) return;
      const label = $('.fi-name', item) || $('.fl-name', item);
      label.classList.add('hidden');
      const input = el('input', { class: 'rename', value: it.name, spellcheck: false });
      item.append(input); input.focus(); input.select();
      let done = false;
      const commit = () => {
        if (done) return; done = true;
        const nn = input.value.trim(); input.remove(); label.classList.remove('hidden');
        if (nn && nn !== it.name) {
          if (VFS.rename(it.fullPath, nn)) Toast.show(`已重命名为 “${nn}”`, { icon: 'check' });
          else Toast.show('已存在同名项目', { icon: 'info' });
        }
        render();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { input.value = it.name; commit(); } });
    }

    function newFolder() {
      const base = '未命名文件夹'; let name = base, i = 1;
      while (VFS.get(VFS.join(state.path, name))) name = base + ' ' + (i++);
      VFS.mkdir(VFS.join(state.path, name));
      const p = VFS.join(state.path, name);
      state.selected = new Set([p]); state.sel = p;
      render();
      setTimeout(() => renameItem({ name, fullPath: p, node: VFS.get(p) }), 40);
    }

    function duplicate(it) {
      const n = it.node;
      if (!n) return;
      if (n.type === 'dir') { Toast.show('复制文件夹需要更大的硬盘', { icon: 'info' }); return; }
      const ext = (n.name.match(/\.[^.]+$/) || [''])[0];
      const base = n.name.replace(/\.[^.]+$/, '') + ' 副本';
      let name = base + ext, i = 2;
      while (VFS.get(VFS.join(VFS.parent(it.fullPath), name))) name = `${base} ${i++}${ext}`;
      VFS.write(VFS.join(VFS.parent(it.fullPath), name), n.content, n.mime);
      render();
    }

    function trashSel() {
      const paths = selPaths().filter(p => !p.startsWith('app:'));
      let n = 0;
      for (const p of paths) if (VFS.trash(p)) n++;
      if (n) { Sound.play('trash'); Toast.show(`已移到废纸篓 ${n} 项`, { icon: 'trash' }); render(); }
      else Toast.show('系统应用无法删除', { icon: 'info' });
    }

    /* ---------------- Quick Look ---------------- */
    function quickLook(it) {
      const node = it.node;
      let body;
      if (node && node.mime && node.mime.startsWith('image/')) {
        body = el('img', { src: node.content, style: { maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px' } });
      } else if (node && (node.mime || '').startsWith('text/')) {
        body = el('pre', { style: { whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)' } }, node.content || '');
      } else {
        body = el('div', { class: 'empty-state', style: { padding: '30px' } }, [el('span', { class: 'dimmer' }, '没有可用的快速查看预览')]);
      }
      const panel = el('div', { class: 'glass', style: { padding: '18px', borderRadius: '14px', maxWidth: 'min(720px, 90vw)' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } }, [
          el('span', { style: { fontWeight: '700', fontSize: '15px' } }, it.name),
          el('button', { class: 'icon-btn', onclick: () => sheet.dismiss() }, el('span', { html: Icons.glyph('x') })),
        ]),
        body,
      ]);
      const sheet = Dialog.sheet(win.el, () => panel);
      const esc = e => { if (e.key === 'Escape' || e.key === ' ') { sheet.dismiss(); window.removeEventListener('keydown', esc); } };
      window.addEventListener('keydown', esc);
    }

    /* ---------------- keyboard ---------------- */
    viewArea.addEventListener('keydown', e => {
      if ((cmd(e) && e.key.toLowerCase() === 'n')) { e.preventDefault(); newFolder(); return; }
      if (cmd(e) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); return; }
      if (cmd(e) && e.key.toLowerCase() === 'x') { e.preventDefault(); cutSel(); return; }
      if (cmd(e) && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
      if (e.key === 'Backspace') { navigate(VFS.parent(state.path)); return; }
      if (e.key === ' ' || e.key === 'Space') {
        const it = entries().find(x => x.fullPath === state.sel);
        if (it) { e.preventDefault(); quickLook(it); }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace' && cmd(e)) { trashSel(); return; }
      if (e.key === 'Enter') {
        const it = entries().find(x => x.fullPath === state.sel);
        if (it) { e.shiftKey ? renameItem(it) : openEntry(it); }
        return;
      }
      if (cmd(e) && e.key.toLowerCase() === 'o') { e.preventDefault(); const it = entries().find(x => x.fullPath === state.sel); if (it) openEntry(it); return; }
      const dirs = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in dirs) {
        e.preventDefault();
        const list = entries(); if (!list.length) return;
        const idx = list.findIndex(x => x.fullPath === state.sel);
        const next = list[clamp(idx + dirs[e.key], 0, list.length - 1)];
        setSel(next.fullPath);
        $('.fitem.sel, .flist-row.sel', viewArea)?.scrollIntoView({ block: 'nearest' });
      }
    });

    viewArea.addEventListener('pointerdown', () => viewArea.focus());

    render();
    navigate(state.path);
    return () => {};
  },
});
