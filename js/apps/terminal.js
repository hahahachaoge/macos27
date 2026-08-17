/* ============================================================
   macOS 27 — Mammoth · apps/terminal.js
   Terminal: multi-session tabs, tab-completion, pipes/redirects.
   ============================================================ */
'use strict';

M27.register({
  id: 'terminal',
  name: 'Terminal',
  icon: Icons.terminal(),
  width: 780, height: 500, minW: 460, minH: 300, single: true,

  mount({ content, toolbar, setTitle, win }) {
    setTitle('you — zsh — 80×24');

    const COMMANDS = ['help', 'ls', 'cd', 'pwd', 'cat', 'open', 'mkdir', 'touch', 'rm', 'echo', 'clear',
      'date', 'whoami', 'hostname', 'uname', 'uptime', 'neofetch', 'wallpaper', 'glass', 'music',
      'deepseek', 'say', 'exit', 'grep', 'find', 'head', 'tail', 'wc', 'history'];

    /* ---- app-scoped styles ---- */
    content.append(el('style', {}, `
      .term27-tabs { flex: none; display: flex; align-items: flex-end; gap: 6px; padding: 6px 10px 0; border-bottom: 1px solid var(--sep); }
      .term27-tab { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 10px 10px 0 0; font-size: 12px; background: var(--fill-1); border: 1px solid var(--sep); border-bottom: 0; min-width: 0; max-width: 180px; cursor: pointer; }
      .term27-tab.on { background: var(--fill-2); }
      .term27-tab .term27-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .term27-tab .term27-close { flex: none; opacity: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
      .term27-tab .term27-close:hover { background: var(--hover); }
      .term27-tab:hover .term27-close { opacity: .8; }
      .term27-tab .term27-close svg { width: 11px; height: 11px; }
      .term27-plus { flex: none; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; color: var(--text-2); }
      .term27-plus:hover { background: var(--hover); color: var(--text-1); }
      .term27-plus svg { width: 14px; height: 14px; }
      .term27-body { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    `));

    const root = el('div', { class: 'app-root col' });
    const tabs = el('div', { class: 'term27-tabs' });
    const body = el('div', { class: 'term27-body' });
    root.append(tabs, body);
    content.append(root);

    /* ---------- sessions ---------- */
    let sessions = [];
    let activeId = null;
    const active = () => sessions.find(s => s.id === activeId);

    /* ---------- output ---------- */
    function print(s, text, cls = 't-out', rawHtml = false) {
      for (const line of String(text).split('\n')) {
        s.scroll.append(el('div', { class: 't-line ' + cls, html: line === '' ? '&nbsp;' : (rawHtml ? line : esc(line)) }));
      }
      s.scroll.scrollTop = s.scroll.scrollHeight;
    }
    const promptHtml = (s) => `<span class="t-prompt"><span class="user">you</span>@<span class="host">mac27</span> <span class="cwd">${s.cwd === HOME ? '~' : s.cwd}</span> %&nbsp;</span>`;

    function promptRow(s) {
      const row = el('div', { class: 't-line term-input-row' });
      row.append(el('span', { class: 't-prompt', html: `<span class="user">you</span>@<span class="host">mac27</span> <span class="cwd">${s.cwd === HOME ? '~' : s.cwd}</span> %&nbsp;` }));
      const input = el('input', { class: 'term-input', spellcheck: false, autocomplete: 'off', autocapitalize: 'off' });
      row.append(input);
      s.scroll.append(row);
      s.scroll.scrollTop = s.scroll.scrollHeight;
      s.input = input;
      input.focus();
      return { row, input };
    }

    function resolve(s, path) {
      if (!path) return s.cwd;
      if (path === '~') return HOME;
      if (path.startsWith('/')) return path;
      return VFS.join(s.cwd, path);
    }

    /* ---------- tab completion ---------- */
    function tabComplete(s, input) {
      const value = input.value;
      const caret = input.selectionStart ?? value.length;
      if (caret !== value.length) return null;   // complete at end-of-line only

      /* first token → command names */
      if (!value.includes(' ')) {
        const matches = COMMANDS.filter(c => c.startsWith(value));
        if (matches.length === 1) return matches[0] + ' ';
        if (matches.length > 1) {
          print(s, matches.join('    '));
          const common = matches.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
          if (common.length > value.length) return common;
        }
        return null;
      }

      /* path completion (existing behavior) */
      const [cmd, ...rest] = value.split(/\s+/);
      if (rest.length && !value.endsWith(' ')) {
        const base = rest.join(' ');
        const dir = resolve(s, base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) || '/' : '');
        const prefix = base.includes('/') ? base.slice(base.lastIndexOf('/') + 1) : base;
        const matches = VFS.ls(dir).filter(n => n.name.startsWith(prefix));
        if (matches.length === 1) return cmd + ' ' + (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '') + matches[0].name + (matches[0].type === 'dir' ? '/' : '');
        if (matches.length > 1) {
          print(s, matches.map(m => m.name + (m.type === 'dir' ? '/' : '')).join('    '));
          const common = matches.map(m => m.name).reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
          if (common.length > prefix.length) return cmd + ' ' + (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '') + common;
        }
      }
      return null;
    }

    /* ---------- text command helpers (for pipes/redirects + direct) ---------- */
    function readArgFile(s, fileArg) {
      const p = resolve(s, fileArg);
      const node = VFS.get(p);
      if (!node || node.type !== 'file') return { err: `${fileArg}: No such file or directory` };
      return { content: node.content || '' };
    }
    function grepText(s, args, input) {
      const pattern = args[0];
      if (pattern == null || pattern === '') return { ok: false, error: 'grep: missing pattern' };
      let content = null;
      if (args[1]) { const r = readArgFile(s, args[1]); if (r.err) return { ok: false, error: `grep: ${r.err}` }; content = r.content; }
      else if (input != null) content = input;
      else return { ok: false, error: 'grep: missing file (or pipe input)' };
      let re;
      try { re = new RegExp(pattern); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
      return { ok: true, text: content.split('\n').filter(l => re.test(l)).join('\n') };
    }
    function headText(s, args, input) {
      let n = 10, fileArg = null;
      for (const a of args) { if (/^\d+$/.test(a)) n = parseInt(a, 10); else if (fileArg == null) fileArg = a; }
      let content = null;
      if (fileArg) { const r = readArgFile(s, fileArg); if (r.err) return { ok: false, error: `head: ${r.err}` }; content = r.content; }
      else if (input != null) content = input;
      else return { ok: false, error: 'head: missing file' };
      return { ok: true, text: content.split('\n').slice(0, n).join('\n') };
    }
    function tailText(s, args, input) {
      let n = 10, fileArg = null;
      for (const a of args) { if (/^\d+$/.test(a)) n = parseInt(a, 10); else if (fileArg == null) fileArg = a; }
      let content = null;
      if (fileArg) { const r = readArgFile(s, fileArg); if (r.err) return { ok: false, error: `tail: ${r.err}` }; content = r.content; }
      else if (input != null) content = input;
      else return { ok: false, error: 'tail: missing file' };
      const lines = content.split('\n');
      return { ok: true, text: lines.slice(Math.max(0, lines.length - n)).join('\n') };
    }
    function wcText(s, args, input) {
      let fileArg = null;
      for (const a of args) { if (!/^\d+$/.test(a)) { fileArg = a; break; } }
      let content = null, name = '';
      if (fileArg) { const r = readArgFile(s, fileArg); if (r.err) return { ok: false, error: `wc: ${r.err}` }; content = r.content; name = ' ' + fileArg; }
      else if (input != null) content = input;
      else return { ok: false, error: 'wc: missing file' };
      const lines = content ? content.split('\n').length : 0;
      const words = (content.match(/\S+/g) || []).length;
      const chars = content.length;
      return { ok: true, text: `\t${lines}\t${words}\t${chars}${name}` };
    }
    function findText(s, args) {
      const name = (args[0] || '').toLowerCase();
      if (!name) return { ok: false, error: 'find: missing name' };
      const hits = VFS.walk().filter(w => w.node.name.toLowerCase().includes(name)).map(w => w.path);
      return { ok: true, text: hits.join('\n') };
    }
    function historyText(s) {
      return s.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n');
    }
    function textOf(s, cmdName, args, input) {
      switch (cmdName) {
        case 'ls': {
          const dir = resolve(s, args[0]);
          const node = VFS.get(dir);
          if (!node || node.type !== 'dir') return { ok: false, error: `ls: ${args[0] || ''}: No such directory` };
          const list = VFS.ls(dir);
          return { ok: true, text: list.map(n => n.type === 'dir' ? n.name + '/' : n.name).join('   ') };
        }
        case 'pwd': return { ok: true, text: s.cwd };
        case 'cat': {
          if (!args[0]) return { ok: false, error: 'cat: missing file' };
          const r = readArgFile(s, args[0]);
          if (r.err) return { ok: false, error: `cat: ${r.err}` };
          return { ok: true, text: r.content };
        }
        case 'echo': return { ok: true, text: args.join(' ') };
        case 'date': return { ok: true, text: new Date().toString() };
        case 'whoami': return { ok: true, text: 'you' };
        case 'hostname': return { ok: true, text: 'mac27.local' };
        case 'uname': return { ok: true, text: args.includes('-a') || args.includes('-v')
          ? 'macOS 27 Mammoth 27.0 Darwin Kernel 27.0.1: Liquid Glass RELEASE_ARM64_WEB — powered by DeepSeek V4 Pro'
          : 'macOS 27' };
        case 'uptime': return { ok: true, text: `up ${Math.floor((Date.now() - 1717527600000) / 1000 / 3600) % 24} days (in dog years)` };
        case 'find': return findText(s, args);
        case 'grep': return grepText(s, args, input);
        case 'head': return headText(s, args, input);
        case 'tail': return tailText(s, args, input);
        case 'wc': return wcText(s, args, input);
        case 'history': return { ok: true, text: historyText(s) };
        default: return { ok: false, error: `${cmdName}: unsupported in a pipeline` };
      }
    }
    function emit(s, r) {
      if (r.ok) { if (r.text) print(s, r.text); }
      else print(s, r.error, 't-err');
    }

    /* ---------- pipes & redirects ---------- */
    function runPipeline(s, line) {
      let cmd = line, redirectFile = null;
      const gt = cmd.indexOf('>');
      if (gt >= 0) {
        redirectFile = cmd.slice(gt + 1).trim().split(/\s+/)[0] || null;
        cmd = cmd.slice(0, gt).trim();
      }
      const parts = cmd.split('|').map(p => p.trim()).filter(Boolean);
      if (!parts.length) { print(s, 'syntax error: empty command', 't-err'); return; }

      let text = null;
      for (let i = 0; i < parts.length; i++) {
        const [cn, ...an] = parts[i].split(/\s+/);
        if (i > 0 && !['grep', 'head', 'tail', 'wc'].includes(cn)) {
          print(s, `unsupported: cannot pipe into "${cn}" (only grep/head/tail/wc)`, 't-err');
          return;
        }
        const r = textOf(s, cn, an, i === 0 ? null : text);
        if (!r.ok) { print(s, r.error, 't-err'); return; }
        text = r.text;
      }

      if (redirectFile) {
        const p = resolve(s, redirectFile);
        if (!VFS.get(VFS.parent(p))) { print(s, `redirect: ${redirectFile}: No such directory`, 't-err'); return; }
        VFS.write(p, text == null ? '' : text);
      } else if (text != null && text !== '') {
        print(s, text);
      }
    }

    /* ---------- command execution ---------- */
    async function run(s, raw) {
      const line = raw.trim();
      print(s, promptHtml(s) + esc(line), 't-cmd', true);
      s.history.push(line);
      s.histIdx = s.history.length;
      if (!line) { newPrompt(s); return; }

      if (line.includes('|') || line.includes('>')) {
        runPipeline(s, line);
        newPrompt(s);
        return;
      }

      const [cmdName, ...args] = line.split(/\s+/);
      const flag = a => args.includes(a);

      switch (cmdName) {
        case 'help':
          print(s, `macOS 27 shell — available commands:
  ls [dir]          list directory contents
  cd <dir>          change directory
  pwd               print working directory
  cat <file>        print a file
  open <app|file|url> open a file, app, or https:// URL
  mkdir <name>      create a folder
  touch <name>      create an empty file
  rm <name>         delete a file
  echo <text>       print text
  clear             clear the screen
  date              current date & time
  whoami            who are you
  uname -a          system info
  neofetch          the important one
  grep <pattern> <file>  search a file (supports pipes)
  find <name>       search the whole file system
  head <file> [n]   first n lines (default 10)
  tail <file> [n]   last n lines (default 10)
  wc <file>         lines / words / characters
  history           numbered command history
  wallpaper <name>  tahoe | mammoth | aurora | sequoia | mono
  glass on|off      toggle Liquid Glass
  music play|pause|next
  deepseek <prompt> ask DeepSeek V4 Pro
  say <text>        speak (browser speech)
  exit              close this window

  Pipes & redirects:  ls | grep you   ·   echo hi > file.txt
  Tabs:  Ctrl+T new tab · click a tab to switch · × to close`);
          break;

        case 'ls': {
          const dir = resolve(s, args[0]);
          const node = VFS.get(dir);
          if (!node || node.type !== 'dir') { print(s, `ls: ${args[0] || ''}: No such directory`, 't-err'); break; }
          const list = VFS.ls(dir);
          if (!list.length) { print(s, '(empty)'); break; }
          const out = list.map(n => n.type === 'dir'
            ? `<span style="color:#5aa7ff">${esc(n.name)}/</span>`
            : `<span>${esc(n.name)}</span>`).join('   ');
          s.scroll.append(el('div', { class: 't-line t-out', html: out }));
          s.scroll.scrollTop = s.scroll.scrollHeight;
          break;
        }

        case 'cd': {
          const target = resolve(s, args[0] || '~');
          const node = VFS.get(target);
          if (!node || node.type !== 'dir') { print(s, `cd: ${args[0] || ''}: No such directory`, 't-err'); break; }
          s.cwd = target;
          break;
        }

        case 'pwd': print(s, s.cwd); break;

        case 'cat': {
          if (!args[0]) { print(s, 'cat: missing file', 't-err'); break; }
          const r = readArgFile(s, args[0]);
          if (r.err) { print(s, `cat: ${r.err}`, 't-err'); break; }
          print(s, r.content);
          break;
        }

        case 'open': {
          const target = args[0];
          if (target && /^https?:\/\//i.test(target)) { window.open(target, '_blank'); break; }
          let appId = null;
          let t = target;
          if (flag('-a')) { appId = args[args.indexOf('-a') + 1]; t = args.filter(a => a !== '-a' && a !== appId).pop(); }
          if (appId && M27.apps[appId.toLowerCase()]) { WM.open(appId.toLowerCase()); break; }
          if (!t) { print(s, 'open: missing target', 't-err'); break; }
          const appMatch = Object.values(M27.apps).find(a =>
            a.id === t.toLowerCase() || a.name.toLowerCase() === t.toLowerCase() || a.name.toLowerCase().startsWith(t.toLowerCase()));
          if (appMatch) { WM.open(appMatch.id); break; }
          const p = resolve(s, t);
          const node = VFS.get(p);
          if (!node) { print(s, `open: ${t}: No such file or directory`, 't-err'); break; }
          if (node.type === 'dir') { s.cwd = p; WM.open('finder', { args: { path: p } }); break; }
          if (node.mime && node.mime.startsWith('image/')) WM.open('preview', { args: { path: p } });
          else WM.open('textedit', { args: { path: p } });
          break;
        }

        case 'mkdir': {
          if (!args[0]) { print(s, 'mkdir: missing name', 't-err'); break; }
          VFS.mkdir(resolve(s, args[0]));
          break;
        }
        case 'touch': {
          if (!args[0]) { print(s, 'touch: missing name', 't-err'); break; }
          VFS.write(resolve(s, args[0]), '', 'text/plain');
          break;
        }
        case 'rm': {
          if (!args[0]) { print(s, 'rm: missing name', 't-err'); break; }
          VFS.rm(resolve(s, args[0])) || print(s, `rm: ${args[0]}: No such file`, 't-err');
          break;
        }
        case 'echo': print(s, args.join(' ')); break;
        case 'clear': s.scroll.innerHTML = ''; break;
        case 'date': print(s, new Date().toString()); break;
        case 'whoami': print(s, 'you'); break;
        case 'hostname': print(s, 'mac27.local'); break;
        case 'uname': print(s, flag('-a') || flag('-v')
          ? 'macOS 27 Mammoth 27.0 Darwin Kernel 27.0.1: Liquid Glass RELEASE_ARM64_WEB — powered by DeepSeek V4 Pro'
          : 'macOS 27');
          break;
        case 'uptime': print(s, `up ${Math.floor((Date.now() - 1717527600000) / 1000 / 3600) % 24} days (in dog years)`); break;
        case 'wallpaper': {
          const w = (args[0] || '').toLowerCase();
          if (Wallpaper.list().includes(w)) { Wallpaper.set(w); print(s, 'wallpaper → ' + w); }
          else print(s, 'wallpapers: ' + Wallpaper.list().join(', '));
          break;
        }
        case 'glass': {
          if (args[0] === 'on') { Settings.set('glass', true); print(s, 'Liquid Glass: on'); }
          else if (args[0] === 'off') { Settings.set('glass', false); print(s, 'Liquid Glass: off — the world went flat'); }
          else print(s, 'usage: glass on|off');
          break;
        }
        case 'music': {
          if (typeof MusicPlayer === 'undefined') { print(s, 'Music app is loading…'); break; }
          if (args[0] === 'play') MusicPlayer.play();
          else if (args[0] === 'pause') MusicPlayer.pause();
          else if (args[0] === 'next') MusicPlayer.next();
          else print(s, 'usage: music play|pause|next');
          break;
        }
        case 'deepseek': {
          if (!args.join(' ')) { print(s, 'usage: deepseek <question>'); break; }
          const question = args.join(' ');
          print(s, 'Intelligence is thinking…');
          s.busy = true;
          const reply = await DeepSeek.quick(question) || OfflineBrain.reply(question);
          s.busy = false;
          print(s, '');
          print(s, '— Intelligence (DeepSeek V4 Pro) —', 't-prompt');
          print(s, reply.replace(/[*_`#>]/g, ''));
          break;
        }
        case 'say': {
          const t = args.join(' ');
          if (t && 'speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(t);
            u.rate = 1.02; speechSynthesis.speak(u);
          }
          break;
        }
        case 'neofetch': {
          print(s, `                        .:'                  you@mac27
                    __ :'__                ────────────
                 .'\`__\`-'__\`\`.              OS: macOS 27 "Mammoth" 27.0
            :__________.-'                  Kernel: Liquid Glass 27.0.1
            :_________':                   Shell: zsh (web)
             :_________\`-;                 Resolution: ${innerWidth}x${innerHeight}
             \`.__.-.__.'                  WM: WindowServer (glass compositor)
   You are here →                           Theme: ${resolvedTheme()}, ${Wallpaper.get()}
                                            CPU: DeepSeek V4 Pro
                                            GPU: browser compositor (real refraction)
                                            Memory: 128GB / ${fmtBytes(128e9)} (imaginary)`);
          break;
        }
        case 'sudo':
          print(s, 'you is not in the sudoers file.  This incident will be reported to Tim.', 't-err');
          break;
        case 'vi': case 'vim': case 'emacs': case 'nano':
          print(s, `${cmdName}: command not found. Try "cat" — we're on web zsh.`, 't-err');
          break;
        case 'grep': emit(s, grepText(s, args, null)); break;
        case 'find': emit(s, findText(s, args)); break;
        case 'head': emit(s, headText(s, args, null)); break;
        case 'tail': emit(s, tailText(s, args, null)); break;
        case 'wc': emit(s, wcText(s, args, null)); break;
        case 'history': print(s, historyText(s)); break;
        case 'exit':
          WM.close(WM.find('terminal'));
          return;
        default:
          print(s, `zsh: command not found: ${cmdName}`, 't-err');
      }
      newPrompt(s);
    }

    function newPrompt(s) {
      const { input } = promptRow(s);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const v = input.value;
          input.disabled = true;
          run(s, v);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (s.histIdx > 0) { s.histIdx--; input.value = s.history[s.histIdx] || ''; }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (s.histIdx < s.history.length - 1) { s.histIdx++; input.value = s.history[s.histIdx] || ''; }
          else { s.histIdx = s.history.length; input.value = ''; }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const done = tabComplete(s, input);
          if (done) input.value = done;
        } else if (e.key === 'l' && cmd(e)) {
          e.preventDefault();
          s.scroll.innerHTML = '';
        }
      });
    }

    /* ---------- session lifecycle ---------- */
    function createSession() {
      const s = {
        id: uid(),
        title: 'zsh',
        cwd: HOME,
        history: [],
        histIdx: -1,
        busy: false,
        scroll: el('div', { class: 'term', tabindex: '0' }),
        input: null,
      };
      s.scroll.addEventListener('pointerdown', () => {
        const last = s.scroll.querySelector('.term-input:not([disabled])');
        last && last.focus();
      });
      sessions.push(s);
      activeId = s.id;
      renderTabs();
      switchTo(s.id);
      print(s, `macOS 27 "Mammoth" — Liquid Glass shell`, 't-prompt');
      print(s, `Last login: ${new Date().toDateString()} on ttys00${sessions.length}`);
      print(s, 'Type "help" to see what this machine can do. Try "neofetch".\n');
      newPrompt(s);
      return s;
    }

    function switchTo(id) {
      activeId = id;
      const s = active();
      if (!s) return;
      body.innerHTML = '';
      body.append(s.scroll);
      s.scroll.scrollTop = s.scroll.scrollHeight;
      renderTabs();
      const inp = s.scroll.querySelector('.term-input:not([disabled])');
      if (inp) inp.focus();
    }

    function closeSession(id) {
      sessions = sessions.filter(x => x.id !== id);
      if (!sessions.length) { createSession(); return; }
      if (activeId === id) switchTo(sessions[0].id);
      else renderTabs();
    }

    function renderTabs() {
      tabs.innerHTML = '';
      for (const s of sessions) {
        const tab = el('div', { class: 'term27-tab' + (s.id === activeId ? ' on' : '') }, [
          el('span', { class: 'term27-title' }, s.title || 'zsh'),
          el('button', { class: 'term27-close', title: 'Close tab', html: Icons.glyph('x'), onclick: (e) => { e.stopPropagation(); closeSession(s.id); } }),
        ]);
        tab.addEventListener('click', () => switchTo(s.id));
        tabs.append(tab);
      }
      tabs.append(el('button', { class: 'term27-plus', title: 'New tab (Ctrl+T)', html: Icons.glyph('plus'), onclick: () => createSession() }));
    }

    /* Ctrl+T → new session */
    win.el.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        createSession();
      }
    });

    createSession();
    return () => {};
  },
});
