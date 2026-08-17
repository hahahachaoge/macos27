/* ============================================================
   macOS 27 — Mammoth · apps/messages.js
   Messages: contact list + iMessage-style threads. Scripted
   contacts (Mom, Alex, Apple) reply after a typing indicator;
   "Intelligence" answers via DeepSeek V4 Pro (OfflineBrain
   fallback). Adds search, delete/copy, tapback reactions,
   image attachments. Persists to macos27.messages.
   ============================================================ */
'use strict';

M27.register({
  id: 'messages',
  name: 'Messages',
  icon: Icons.messages(),
  width: 960, height: 640, minW: 660, minH: 420,

  mount({ content, toolbar, win }) {
    const KEY = 'macos27.messages';

    const SYS = "You are 'Intelligence', a contact in Messages on macOS 27. Reply like a clever, warm friend — short texts, occasional emoji, no markdown.";

    const REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22'];

    /* ---------- style ---------- */
    if (!document.getElementById('m27-messages-style')) {
      const st = document.createElement('style');
      st.id = 'm27-messages-style';
      st.textContent = `
        .msgs-more { position:absolute; top:50%; transform:translateY(-50%); right:-26px; width:22px; height:22px; border-radius:50%; background:var(--fill-1); border:1px solid var(--sep); color:var(--text-3); font-size:13px; line-height:1; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .12s; }
        .bubble:hover .msgs-more { opacity:1; }
        .msgs-react { display:inline-block; font-size:15px; background:var(--fill-1); border:1px solid var(--sep); border-radius:10px; padding:1px 7px; margin-top:3px; }
        .msgs-img { display:block; max-width:220px; width:100%; border-radius:12px; margin-bottom:4px; }
        .msgs-react-pop { position:absolute; top:calc(100% + 6px); left:0; z-index:6; display:flex; gap:2px; padding:4px 6px; background:var(--fill-1); border:1px solid var(--sep); border-radius:16px; box-shadow:var(--shadow-menu); }
        .msgs-react-opt { width:28px; height:28px; border-radius:50%; font-size:16px; display:flex; align-items:center; justify-content:center; }
        .msgs-react-opt:hover { background:var(--hover); transform:scale(1.15); }
        .msgs-thread mark { background: color-mix(in srgb, var(--warn) 55%, transparent); color: var(--text-1); border-radius:3px; padding:0 1px; }
        .msgs-side-search { margin-bottom:8px; }
      `;
      document.head.appendChild(st);
    }

    const REPLIES = {
      mom: [
        'Did you eat lunch yet? \uD83E\uDD6A',
        'Call me when you get a chance \uD83D\uDC95',
        'Your dad says hi! He fixed the fence today.',
        'Don\u2019t forget your dentist appointment on Thursday.',
        'Love you! Drive safe \u2764\uFE0F',
      ],
      alex: [
        'yo the glass effect on that window is unreal \uD83E\uDD2F',
        'haha nice, ship it \uD83D\uDE80',
        'wait how does the blur know the wallpaper colors??',
        'we should demo this at the meetup',
        'ok that\u2019s actually clean, I\u2019m jealous',
      ],
      apple: [
        'Thanks for reaching out. Is there anything else we can help with?',
        'Your request has been received. A specialist will follow up shortly.',
        'We\u2019d love your feedback \u2014 tap here to rate your support experience.',
        'You can also find help at support.apple.com.',
        'For account questions, open Settings \u2192 Apple Account.',
      ],
    };

    /* ---------- seed ---------- */
    function seedState() {
      const now = Date.now();
      return {
        active: 'mom',
        contacts: [
          { id: 'mom', name: 'Mom', initials: 'M', grad: ['#ff9a62', '#ff4d6d'], kind: 'scripted',
            msgs: [
              { who: 'them', text: 'Did you eat breakfast yet? \uD83E\uDD5E', t: now - 50 * 60e3 },
              { who: 'me', text: 'Yes! Toast and coffee \u2615', t: now - 48 * 60e3 },
              { who: 'them', text: 'Good. Call me later? \uD83D\uDC95', t: now - 45 * 60e3 },
            ] },
          { id: 'alex', name: 'Alex', initials: 'A', grad: ['#4facfe', '#6f5bff'], kind: 'scripted',
            msgs: [
              { who: 'them', text: 'yo the glass effect on that window is unreal \uD83E\uDD2F', t: now - 2 * 3600e3 },
            ] },
          { id: 'apple', name: 'Apple', initials: 'A', grad: ['#8e8e96', '#3a3a3e'], kind: 'scripted',
            msgs: [
              { who: 'them', text: 'Your order has shipped. Track it in your account.', t: now - 26 * 3600e3 },
            ] },
          { id: 'intelligence', name: 'Intelligence', initials: 'AI', grad: ['#a78bff', '#2b1fd6'], kind: 'ai',
            msgs: [
              { who: 'them', text: 'Hey \u2014 I\u2019m Intelligence, running on DeepSeek V4 Pro. Ask me anything. \u2726', t: now - 3 * 3600e3 },
            ] },
        ],
      };
    }

    /* ---------- state ---------- */
    let state = null;
    try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
    if (!state || !Array.isArray(state.contacts) || !state.contacts.length) {
      state = seedState();
      save();
    }
    for (const c of state.contacts) if (!Array.isArray(c.msgs)) c.msgs = [];

    let activeId = state.active;
    let contactQuery = '';
    let threadQuery = '';
    const pending = {};
    const lastReply = {};

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ }
    }
    function active() {
      return state.contacts.find(c => c.id === activeId) || state.contacts[0];
    }
    const tstr = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const textToHtml = s => esc(String(s)).replace(/\n/g, '<br>');
    const escRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    function highlightHtml(text, q) {
      const safe = esc(String(text));
      if (!q) return safe.replace(/\n/g, '<br>');
      const highlighted = safe.replace(new RegExp('(' + escRegex(q) + ')', 'gi'), '<mark>$1</mark>');
      return highlighted.replace(/\n/g, '<br>');
    }

    /* ---------- layout ---------- */
    const root = el('div', { class: 'app-root' });
    const side = el('div', { class: 'app-sidebar' });
    const main = el('div', { class: 'app-main' });
    root.append(side, main);
    content.append(root);

    const sideSearch = el('input', { class: 'field msgs-side-search', placeholder: '搜索联系人', spellcheck: false });
    side.append(sideSearch);
    const contactList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } });
    side.append(contactList);
    sideSearch.addEventListener('input', () => { contactQuery = sideSearch.value; renderSide(); });

    const header = el('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--sep)' } });
    const headerLeft = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
    const threadSearch = el('input', { class: 'field', placeholder: '搜索消息', spellcheck: false, style: { width: '150px', marginLeft: 'auto' } });
    header.append(headerLeft, threadSearch);
    threadSearch.addEventListener('input', () => { threadQuery = threadSearch.value; renderThread(); });

    const thread = el('div', { class: 'msgs-thread' });
    const input = el('input', { class: 'field', placeholder: 'iMessage', spellcheck: false });
    const sendBtn = el('button', {
      class: 'icon-btn', title: 'Send', onclick: send,
      style: { background: 'var(--accent)', color: '#fff', borderRadius: '18px', width: '30px', height: '30px', flex: 'none' },
    }, el('span', { html: Icons.glyph('send') }));
    const inputRow = el('div', { class: 'msgs-input' }, [input, sendBtn]);
    main.append(header, thread, inputRow);

    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    /* ---------- pieces ---------- */
    function avatar(c, size) {
      const s = size || 36;
      return el('div', {
        style: {
          width: s + 'px', height: s + 'px', flex: 'none', borderRadius: '50%',
          background: 'linear-gradient(135deg,' + c.grad[0] + ',' + c.grad[1] + ')',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: Math.round(s * 0.36) + 'px', fontWeight: '700',
        },
      }, c.initials);
    }

    function genPhoto() {
      const hue = Math.floor(Math.random() * 360);
      const h2 = (hue + 60) % 360;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${h2},75%,40%)"/></linearGradient></defs>
        <rect width="280" height="180" fill="url(#g)"/>
        <circle cx="220" cy="45" r="26" fill="rgba(255,255,255,.5)"/>
        <path d="M0 180 L60 100 L110 150 L160 80 L280 180 Z" fill="rgba(0,0,0,.25)"/>
      </svg>`;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function reactionPopover(bubbleEl, m) {
      const existing = bubbleEl.querySelector('.msgs-react-pop');
      if (existing) { existing.remove(); return; }
      const pop = el('div', { class: 'msgs-react-pop' }, REACTIONS.map(r => el('button', {
        class: 'msgs-react-opt', title: r,
        onclick: (e) => {
          e.stopPropagation();
          m.reaction = (m.reaction === r) ? null : r;
          save();
          renderThread();
        },
      }, r)));
      bubbleEl.append(pop);
      setTimeout(() => {
        const close = ev => {
          if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', close, true); }
        };
        document.addEventListener('pointerdown', close, true);
      }, 0);
    }

    function bubble(m, idx) {
      const c = active();
      const b = el('div', { class: 'bubble ' + (m.who === 'me' ? 'me' : 'them') }, [
        m.img ? el('img', { class: 'msgs-img', src: m.img, alt: '' }) : null,
        el('span', { html: highlightHtml(m.text, threadQuery) }),
        m.reaction ? el('span', { class: 'msgs-react' }, m.reaction) : null,
        el('span', { class: 'b-time' }, tstr(m.t)),
      ]);

      if (m.who === 'them') {
        b.append(el('button', {
          class: 'msgs-more', title: 'React',
          onclick: e => { e.stopPropagation(); reactionPopover(b, m); },
        }, '\u2026'));
      }

      b.addEventListener('contextmenu', e => {
        e.preventDefault();
        const items = [];
        if (m.who === 'them') {
          for (const r of REACTIONS) {
            items.push({ label: r, checked: m.reaction === r, action: () => { m.reaction = (m.reaction === r) ? null : r; save(); renderThread(); } });
          }
          items.push({ sep: true });
        }
        items.push(
          { label: '复制', icon: 'doc', action: () => copyText(m.text) },
          { sep: true },
          { label: '删除', icon: 'trash', danger: true, action: () => deleteMsg(c, idx) },
        );
        ContextMenu.show(e.clientX, e.clientY, items);
      });

      return b;
    }

    function copyText(text) {
      const done = () => Toast.show('已复制', { icon: 'check' });
      const legacy = (cb) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.append(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* noop */ }
        ta.remove();
        cb && cb();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => legacy(done));
      } else legacy(done);
    }

    function deleteMsg(c, idx) {
      c.msgs.splice(idx, 1);
      save();
      Sound.play('trash');
      renderThread();
      renderSide();
    }

    function showTyping() {
      const dots = el('div', { class: 'bubble them typing-dots' }, [el('span'), el('span'), el('span')]);
      thread.append(dots);
      thread.scrollTop = thread.scrollHeight;
      return dots;
    }

    function pushMsg(c, who, text) {
      c.msgs.push({ who, text, t: Date.now() });
      save();
    }

    /* ---------- render ---------- */
    function renderSide() {
      contactList.innerHTML = '';
      for (const c of state.contacts) {
        if (contactQuery && !c.name.toLowerCase().includes(contactQuery.toLowerCase())) continue;
        const last = c.msgs[c.msgs.length - 1];
        const preview = last ? (last.who === 'me' ? 'You: ' + last.text : last.text) : 'No messages yet';
        const row = el('button', {
          class: 'notes-item' + (c.id === activeId ? ' sel' : ''),
          onclick: () => {
            activeId = c.id; state.active = c.id; save();
            threadQuery = ''; threadSearch.value = '';
            Sound.play('click');
            renderSide(); renderThread();
          },
        }, [
          el('span', { style: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minWidth: '0' } }, [
            avatar(c),
            el('span', { style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '1px' } }, [
              el('span', { class: 'nt-title' }, c.name),
              el('span', { class: 'nt-snippet' }, preview),
            ]),
            el('span', { class: 'nt-meta' }, last ? tstr(last.t) : ''),
          ]),
        ]);
        contactList.append(row);
      }
    }

    function renderThread() {
      const c = active();
      headerLeft.innerHTML = '';
      headerLeft.append(
        el('span', { style: { fontWeight: '600', fontSize: '15px' } }, c.name),
        c.kind === 'ai' ? el('span', { class: 'badge', style: { fontSize: '10px' } }, 'DeepSeek V4 Pro') : null,
      );

      thread.innerHTML = '';
      const q = threadQuery.trim().toLowerCase();
      if (!c.msgs.length) {
        thread.append(el('div', { class: 'empty-state' },
          el('span', { class: 'dimmer' }, c.kind === 'ai' ? 'Say hi to Intelligence \u2726' : 'Say hi \uD83D\uDC4B')));
        return;
      }

      let shown = 0;
      c.msgs.forEach((m, idx) => {
        if (q && !m.text.toLowerCase().includes(q)) return;
        thread.append(bubble(m, idx));
        shown++;
      });

      if (!shown) {
        thread.append(el('div', { class: 'empty-state' },
          el('span', { class: 'dimmer' }, 'No messages match your search')));
        return;
      }

      const first = thread.querySelector('.bubble');
      if (first && q) first.scrollIntoView({ block: 'center' });
      else thread.scrollTop = thread.scrollHeight;
    }

    /* ---------- replies ---------- */
    function scriptedReply(c) {
      const dots = showTyping();
      const delay = 900 + Math.random() * 900;
      setTimeout(() => {
        const pool = REPLIES[c.id] || [];
        let r = pool[Math.floor(Math.random() * pool.length)] || '';
        if (pool.length > 1 && r === lastReply[c.id]) {
          let r2 = pool[Math.floor(Math.random() * pool.length)];
          let guard = 0;
          while (r2 === lastReply[c.id] && guard++ < 8) r2 = pool[Math.floor(Math.random() * pool.length)];
          r = r2;
        }
        lastReply[c.id] = r;
        dots.remove();
        pushMsg(c, 'them', r);
        Notifications.push({ title: c.name, body: r, icon: 'info' });
        pending[c.id] = false;
        renderThread();
        renderSide();
      }, delay);
    }

    async function aiReply(c, text) {
      const dots = showTyping();
      let reply = null;
      try {
        if (typeof DeepSeek !== 'undefined' && DeepSeek.configured()) {
          reply = await DeepSeek.quick(text, SYS);
        }
      } catch { reply = null; }
      if (reply == null) {
        reply = typeof OfflineBrain !== 'undefined'
          ? OfflineBrain.reply(text)
          : 'I\u2019m offline right now \u2014 connect DeepSeek V4 Pro in Settings and I\u2019ll be back to full speed \u2726';
      }
      reply = String(reply).replace(/[*`#>]/g, '');
      dots.remove();
      pushMsg(c, 'them', reply);
      Notifications.push({ title: c.name, body: reply, icon: 'info' });
      pending[c.id] = false;
      renderThread();
      renderSide();
    }

    /* ---------- send ---------- */
    function send() {
      const text = input.value.trim();
      if (!text) return;
      const c = active();
      input.value = '';
      pushMsg(c, 'me', text);
      Sound.play('sent');
      renderThread();
      if (pending[c.id]) return;
      pending[c.id] = true;
      if (c.kind === 'ai') aiReply(c, text);
      else scriptedReply(c);
    }

    function sendPhoto() {
      const c = active();
      c.msgs.push({ who: 'me', text: '', img: genPhoto(), t: Date.now() });
      save();
      Sound.play('sent');
      renderThread();
    }

    /* ---------- new chat sheet ---------- */
    function newChat() {
      let sheet = null;
      const items = state.contacts.map(c => el('button', {
        class: 'list-item', style: { width: '100%' },
        onclick: () => {
          activeId = c.id; state.active = c.id; save();
          threadQuery = ''; threadSearch.value = '';
          sheet.dismiss();
          Sound.play('click');
          renderSide(); renderThread();
          input.focus();
        },
      }, [
        avatar(c, 30),
        el('span', { style: { flex: '1', textAlign: 'left' } }, c.name),
        c.kind === 'ai' ? el('span', { class: 'badge', style: { fontSize: '9px' } }, 'DeepSeek V4 Pro') : null,
      ]));
      const panel = el('div', { class: 'sheet-panel glass' }, [
        el('div', { style: { fontWeight: '600', fontSize: '15px', marginBottom: '10px' } }, 'New Chat'),
        ...items,
      ]);
      sheet = Dialog.sheet(win.el, () => panel);
    }

    /* ---------- toolbar ---------- */
    toolbar.append(
      el('button', { class: 'btn ghost', onclick: newChat }, '\u2318N New Chat'),
      el('button', { class: 'btn ghost', title: 'Send a generated photo', onclick: sendPhoto },
        el('span', { html: Icons.glyph('image') }), ' 照片'),
      el('span', { class: 'spacer' }),
    );

    /* ---------- boot ---------- */
    renderSide();
    renderThread();

    return () => {};
  },
});
