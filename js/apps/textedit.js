/* ============================================================
   macOS 27 — Mammoth · apps/textedit.js
   Plain + Rich text editor with formatting, word count, print.
   ============================================================ */
'use strict';

const TextEditApp = (() => {
  let current = null;

  function save() {
    if (!current) return;
    const { path, win, mode, ta, rich } = current;
    const p = path || '/Users/you/Documents/Untitled.txt';
    const content = mode === 'rich' ? rich.innerHTML : ta.value;
    const mime = mode === 'rich' ? 'text/html' : 'text/plain';
    VFS.write(p, content, mime);
    if (!current.path) current.path = p;
    $('.win-title', win.el).textContent = VFS.basename(p);
    $('.te-path', win.el).textContent = p;
    Toast.show('Saved ' + VFS.basename(p), { icon: 'check' });
  }

  return {
    save,
    register() {
      M27.register({
        id: 'textedit',
        name: 'TextEdit',
        icon: Icons.textedit(),
        width: 700, height: 500, minW: 380, minH: 260, single: true,
        menus: () => [
          { label: 'File', items: [
            { label: 'New', shortcut: '⌘N', action: () => WM.open('textedit') },
            { label: 'Save', shortcut: '⌘S', action: () => TextEditApp.save() },
            { label: 'Print', shortcut: '⌘P', action: () => window.print() },
          ] },
          { label: 'Edit', items: [
            { label: 'Undo', shortcut: '⌘Z', action: () => document.execCommand('undo') },
            { label: 'Redo', shortcut: '⇧⌘Z', action: () => document.execCommand('redo') },
          ] },
        ],
        mount({ content, toolbar, args, win, setTitle }) {
          const styleEl = el('style', { html: `
            .app-textedit-rich {
              flex: 1; background: transparent; border: 0; outline: none;
              color: var(--text-1); font: 400 14px/1.65 var(--font);
              padding: 14px 20px; overflow-y: auto;
            }
            .app-textedit-rich:empty::before { content: "Start typing…"; color: var(--text-3); }
            .app-textedit-rich h1, .app-textedit-rich h2, .app-textedit-rich h3 { margin: .5em 0 .25em; }
            .app-textedit-rich ul, .app-textedit-rich ol { padding-left: 22px; }
            .app-textedit-format { display: flex; align-items: center; gap: 2px; }
            .app-textedit-format .btn { font-size: 12px; padding: 2px 8px; min-width: 26px; justify-content: center; }
          ` });
          content.append(styleEl);

          const path = args?.path || null;
          const text = path ? (VFS.read(path) ?? '') : '';

          let mode = 'plain'; // 'plain' | 'rich'

          const ta = el('textarea', { class: 'te-area', spellcheck: false, value: text });
          const rich = el('div', { class: 'app-textedit-rich', contenteditable: 'true', spellcheck: false });
          rich.style.display = 'none';
          content.append(ta, rich);

          const title = path ? VFS.basename(path) : 'Untitled';
          setTitle(title);
          const pathLabel = el('span', { class: 'te-path toolbar-title dim' }, path || 'Untitled');
          const wordCount = el('span', { class: 'dim', style: { fontSize: '12px', flex: 'none' } }, '0 words');

          current = { ta, rich, mode, path, win };
          let dirty = false;

          function markDirty() {
            if (!dirty) {
              dirty = true;
              setTitle('• ' + (current.path ? VFS.basename(current.path) : 'Untitled'));
            }
          }
          function countWords() {
            const txt = mode === 'rich' ? (rich.innerText || '') : (ta.value || '');
            const n = (txt.match(/\S+/g) || []).length;
            wordCount.textContent = n + (n === 1 ? ' word' : ' words');
          }
          function onSaveKey(e) {
            if (cmd(e) && e.key.toLowerCase() === 's') {
              e.preventDefault(); save(); dirty = false; setTitle(VFS.basename(current.path));
            }
          }

          ta.addEventListener('input', () => { markDirty(); countWords(); });
          rich.addEventListener('input', () => { markDirty(); countWords(); });
          ta.addEventListener('keydown', onSaveKey);
          rich.addEventListener('keydown', onSaveKey);

          /* ---- mode switch ---- */
          const plainBtn = el('button', { class: 'on' }, 'Plain');
          const richBtn = el('button', {}, 'Rich');
          const fmtBar = el('div', { class: 'app-textedit-format', style: { display: 'none' } });
          function setMode(m) {
            mode = m; current.mode = m;
            if (m === 'rich') {
              rich.innerHTML = esc(ta.value).replace(/\n/g, '<br>');
              ta.style.display = 'none';
              rich.style.display = '';
            } else {
              ta.value = rich.innerText.replace(/\u00a0/g, ' ');
              rich.style.display = 'none';
              ta.style.display = '';
            }
            plainBtn.classList.toggle('on', m === 'plain');
            richBtn.classList.toggle('on', m === 'rich');
            fmtBar.style.display = m === 'rich' ? '' : 'none';
            countWords();
          }
          plainBtn.addEventListener('click', () => { if (mode !== 'plain') { Sound.play('click'); setMode('plain'); } });
          richBtn.addEventListener('click', () => { if (mode !== 'rich') { Sound.play('click'); setMode('rich'); } });
          const modeSeg = el('div', { class: 'segmented' }, [plainBtn, richBtn]);

          const fmtBtn = (label, command, arg, title) => el('button', {
            class: 'btn ghost', title,
            onmousedown: (e) => e.preventDefault(),
            onclick: () => { rich.focus(); document.execCommand(command, false, arg); },
          }, label);
          fmtBar.append(
            fmtBtn('B', 'bold', null, 'Bold'),
            fmtBtn('I', 'italic', null, 'Italic'),
            fmtBtn('U', 'underline', null, 'Underline'),
            fmtBtn('H', 'formatBlock', 'h2', 'Heading'),
            fmtBtn('•', 'insertUnorderedList', null, 'List'),
          );

          const printBtn = el('button', {
            class: 'icon-btn', title: 'Print', onclick: () => window.print(),
          }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V4.5h10V8"/><rect x="3.5" y="8" width="17" height="8" rx="2"/><path d="M7 13.5h10v6H7Z"/></svg>' }));

          toolbar.append(pathLabel, modeSeg, fmtBar, el('span', { class: 'spacer' }), wordCount, printBtn);

          countWords();

          return () => {
            if (dirty && current && current.ta === ta) save();
            if (current && current.ta === ta) current = null;
          };
        },
        onClose(win) { return true; },
      });
    },
  };
})();
TextEditApp.register();
