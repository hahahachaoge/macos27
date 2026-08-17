/* ============================================================
   macOS 27 — Mammoth · assistant.js
   DeepSeek V4 Pro client (OpenAI-compatible API, SSE streaming)
   + the built-in "Intelligence" app + offline demo brain.
   ============================================================ */
'use strict';

/* ================= DeepSeek API client ================= */
const DeepSeek = (() => {

  function config() {
    const c = Settings.get('deepseek');
    return {
      base: (c.base || 'https://api.deepseek.com').replace(/\/+$/, ''),
      model: c.model || 'deepseek-v4-pro',
      key: (c.key || '').trim(),
      temperature: c.temperature ?? 0.7,
    };
  }
  const configured = () => !!config().key;
  const endpoint = () => {
    const b = config().base;
    return /\/chat\/completions$/.test(b) ? b : b + '/chat/completions';
  };

  async function chat(messages, { stream = true, onToken = null, signal = null } = {}) {
    const cfg = config();
    if (!cfg.key) throw new Error('NO_KEY');
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages, stream, temperature: cfg.temperature }),
      signal,
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* no body */ }
      throw new Error(msg);
    }
    if (!stream) {
      const j = await res.json();
      return j.choices?.[0]?.message?.content ?? '';
    }
    /* SSE stream */
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content ?? '';
          if (delta) { full += delta; onToken && onToken(delta, full); }
        } catch { /* partial line */ }
      }
    }
    return full;
  }

  async function quick(prompt, system) {
    try {
      return await chat([
        { role: 'system', content: system || 'You are Intelligence, the concise built-in assistant of macOS 27.' },
        { role: 'user', content: prompt },
      ], { stream: false });
    } catch (err) {
      return null; // caller falls back
    }
  }

  async function test() {
    const t0 = performance.now();
    try {
      const reply = await chat([
        { role: 'user', content: 'Reply with exactly: Liquid Glass online.' },
      ], { stream: false });
      return { ok: true, ms: Math.round(performance.now() - t0), reply };
    } catch (err) {
      return { ok: false, ms: Math.round(performance.now() - t0), error: err.message };
    }
  }

  return { chat, quick, test, config, configured, endpoint };
})();

/* ================= tiny markdown renderer ================= */
const md = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function render(src) {
    const blocks = [];
    let text = esc(src);
    /* extract fenced code */
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push(`<pre><code>${code.replace(/\n$/, '')}</code></pre>`);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    const lines = text.split('\n');
    const out = [];
    let list = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

    for (const line of lines) {
      const ph = line.match(/^\u0000B(\d+)\u0000$/);
      if (ph) { closeList(); out.push(blocks[+ph[1]]); continue; }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
      if (/^\s*([-*])\s+/.test(line)) {
        if (list !== 'ul') { closeList(); list = 'ul'; out.push('<ul>'); }
        out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        if (list !== 'ol') { closeList(); list = 'ol'; out.push('<ol>'); }
        out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        continue;
      }
      if (/^\s*&gt;\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^\s*&gt;\s?/, ''))}</blockquote>`); continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { closeList(); out.push('<hr>'); continue; }
      closeList();
      if (line.trim() === '') continue;
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return out.join('');
  }
  return { render };
})();

/* ================= offline demo brain ================= */
const OfflineBrain = (() => {
  const rules = [
    [/liquid glass|glass/, `Liquid Glass is the star of macOS 27. Every surface here refracts the live wallpaper through an animated displacement field, blurs what's behind it, and tints itself with the colors around it. Open **System Settings → Liquid Glass** and drag the blur slider — you'll see it change everywhere, live.`],
    [/deepseek|model|v4|who are you|what are you/, `I'm **Intelligence**, the built-in assistant of this Mac — and I run on **DeepSeek V4 Pro**. Right now I'm in *offline demo mode*: my replies come from a tiny local brain so the demo works anywhere.\n\nTo unlock the full model: open **System Settings → Intelligence**, paste a DeepSeek API key, and pick a model (e.g. \`deepseek-chat\` or \`deepseek-v4-pro\` if your endpoint exposes it).`],
    [/wallpaper|background/, `The wallpaper is generated live in a canvas — drifting light fields, no images. Try the **Aurora** or **Mammoth** presets in System Settings → Wallpaper.`],
    [/terminal|command/, `Open **Terminal** from the Dock and try \`neofetch\`, \`ls -la\`, or \`open -a Settings\`. There's even a \`sudo\` easter egg.`],
    [/joke|funny/, `Why did the window bring a jacket to the dock? Because the wallpaper said it looked *transparent*.`],
    [/time|date|day/, `It's ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} on ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — somewhere between Tahoe and Mammoth.`],
    [/hi|hello|hey/, `Hey! I'm Intelligence, living in the menu bar of this little glass Mac. Ask me about Liquid Glass, or open Settings to connect DeepSeek V4 Pro.`],
    [/help/, `Things I can show you around:\n- **Liquid Glass** — the material system\n- **Terminal** — a full shell with a virtual file system\n- **Music** — generative Liquid Radio\n- **System Settings → Intelligence** — connect DeepSeek V4 Pro\n\nOr press ⌘Space and search for anything.`],
  ];
  function reply(text) {
    const t = text.toLowerCase();
    for (const [re, ans] of rules) if (re.test(t)) return ans;
    return `Here's the honest truth: I'm running in **offline demo mode**, so I improvise from a small local brain. Connect **DeepSeek V4 Pro** (System Settings → Intelligence → paste an API key) and I'll answer anything for real.\n\nMeanwhile — I can chat about Liquid Glass, the Terminal, wallpapers, or tell a joke. What are you building today?`;
  }
  return { reply };
})();

/* ================= the Intelligence app ================= */
M27.register({
  id: 'assistant',
  name: 'Intelligence',
  icon: Icons.assistant(),
  width: 430, height: 660, minW: 360, minH: 480,
  resizable: true, single: true,
  mount({ content, win, setTitle }) {
    const KEY = 'macos27.assistant';
    let history = [];
    try { history = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { history = []; }

    const root = el('div', { class: 'assistant' });
    content.append(root);

    /* header */
    const orb = el('div', { class: 'ai-orb' });
    const modelBadge = el('div', { class: 'ai-model' });
    const newBtn = el('button', { class: 'icon-btn', title: '新建会话', onclick: newConversation }, el('span', { html: Icons.glyph('plus') }));
    const histBtn = el('button', { class: 'icon-btn', title: '会话历史', onclick: openHistory }, el('span', { html: Icons.glyph('clock') }));
    const gearBtn = el('button', { class: 'icon-btn', title: '模型设置', onclick: openModelSettings }, el('span', { html: Icons.glyph('gear') }));
    const stopBtn = el('button', { class: 'icon-btn', title: '停止生成', style: { display: 'none' }, onclick: stop }, el('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>' }));
    const header = el('div', { class: 'ai-header' }, [
      el('div', { class: 'ai-actions' }, [newBtn, histBtn, gearBtn, stopBtn]),
      orb,
      el('div', { class: 'ai-title' }, 'Intelligence'),
      modelBadge,
    ]);

    const chatEl = el('div', { class: 'ai-chat' });

    const chips = el('div', { class: 'ai-chips' });
    const input = el('input', { class: 'field', placeholder: 'Ask me anything…', spellcheck: false });
    const sendBtn = el('button', { class: 'btn primary', onclick: send }, el('span', { html: Icons.glyph('send') }));
    const inputRow = el('div', { class: 'ai-input' }, [input, sendBtn]);

    root.append(header, chatEl, chips, inputRow);

    function refreshBadge() {
      modelBadge.textContent = DeepSeek.configured()
        ? `DeepSeek V4 Pro · ${DeepSeek.config().model}`
        : 'Offline demo brain · connect a key in Settings';
    }

    /* suggestions */
    const SUGGESTIONS = [
      'Explain Liquid Glass',
      'Write a haiku about macOS 27',
      'What can the Terminal do?',
      'Tell me a joke',
    ];
    function renderChips() {
      chips.innerHTML = '';
      if (history.length > 2) return;
      for (const s of SUGGESTIONS) {
        chips.append(el('button', { class: 'chip', onclick: () => { input.value = s; send(); } }, s));
      }
    }

    /* messages */
    function addMsg(role, text) {
      const bubble = el('div', { class: 'ai-msg ' + role });
      bubble.innerHTML = role === 'bot' ? md.render(text) : esc(text).replace(/\n/g, '<br>');
      if (role === 'bot') decorateCode(bubble);
      chatEl.append(bubble);
      chatEl.scrollTop = chatEl.scrollHeight;
      return bubble;
    }

    /* add "copy" buttons to code blocks */
    function decorateCode(bubble) {
      $$('pre', bubble).forEach(pre => {
        if (pre.querySelector('.code-copy')) return;
        pre.style.position = 'relative';
        pre.append(el('button', {
          class: 'code-copy', title: '复制代码',
          onclick: () => navigator.clipboard?.writeText(pre.textContent).then(() => Toast.show('已复制代码', { icon: 'check' })),
        }, '复制'));
      });
    }

    function persist() {
      try { localStorage.setItem(KEY, JSON.stringify(history.slice(-40))); } catch { /* full */ }
    }

    function renderHistory() {
      chatEl.innerHTML = '';
      for (const m of history) addMsg(m.role, m.content);
      renderChips();
    }

    /* send */
    let busy = false;
    let abort = null;
    let convos = [];
    try { convos = JSON.parse(localStorage.getItem('macos27.assistant.conversations') || '[]') || []; } catch { convos = []; }
    const saveConvos = () => { try { localStorage.setItem('macos27.assistant.conversations', JSON.stringify(convos.slice(0, 20))); } catch { } };

    async function send() {
      const text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      addMsg('user', text);
      history.push({ role: 'user', content: text });
      const bot = addMsg('bot', '');
      orb.classList.add('thinking');
      busy = true;
      stopBtn.style.display = '';
      abort = new AbortController();
      const t0 = performance.now();

      const sys = 'You are Intelligence, the built-in assistant of "macOS 27 Mammoth", a browser-based macOS recreation with a Liquid Glass design system. You run on DeepSeek V4 Pro. Be warm, concise, and genuinely helpful. Use markdown lightly (headers, bold, lists, code). You live in a desktop OS, so you can reference its features: Liquid Glass material (live refraction, adaptive tinting, backdrop blur), Terminal, Finder, System Settings → Intelligence (API key config), Spotlight (⌘Space), Mission Control, Control Center.';

      const messages = [{ role: 'system', content: sys }, ...history.slice(-12)];
      let full = '';

      if (DeepSeek.configured()) {
        try {
          full = await DeepSeek.chat(messages, {
            stream: true,
            signal: abort.signal,
            onToken(delta, acc) { full = acc; bot.innerHTML = md.render(full) + '<span class="ai-caret"></span>'; chatEl.scrollTop = chatEl.scrollHeight; },
          });
          bot.innerHTML = md.render(full);
          decorateCode(bot);
          history.push({ role: 'assistant', content: full });
          modelBadge.textContent = `DeepSeek V4 Pro · ${(performance.now() - t0).toFixed(0)} ms`;
        } catch (err) {
          if (err && (err.name === 'AbortError' || abort.signal.aborted)) {
            bot.innerHTML = md.render(full ? full + '\n\n*（已停止）*' : '*已停止生成。*');
            if (full) history.push({ role: 'assistant', content: full });
          } else {
            bot.innerHTML = md.render(`**连接失败**（${esc(err.message)}），已切换离线大脑：\n\n${OfflineBrain.reply(text)}`);
            history.push({ role: 'assistant', content: bot.textContent });
          }
        }
      } else {
        await new Promise(r => setTimeout(r, 420 + Math.random() * 500));
        const reply = OfflineBrain.reply(text);
        bot.innerHTML = md.render(reply);
        decorateCode(bot);
        history.push({ role: 'assistant', content: reply });
      }

      orb.classList.remove('thinking');
      busy = false;
      abort = null;
      stopBtn.style.display = 'none';
      persist();
      renderChips();
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    function stop() { if (abort) abort.abort(); }

    function conversationTitle(h) {
      const u = h.find(m => m.role === 'user');
      return u ? u.content.slice(0, 36) : '新会话';
    }

    function newConversation() {
      if (history.length) {
        convos.unshift({ id: uid(), title: conversationTitle(history), messages: history.slice(), time: Date.now() });
        saveConvos();
      }
      history = [];
      persist();
      renderHistory();
      addMsg('bot', '新会话 — 想聊点什么？');
    }

    function openHistory() {
      const rows = convos.map(c => el('button', { class: 'list-item', style: { width: '100%' }, onclick: () => { history = c.messages.slice(); persist(); renderHistory(); sheet.dismiss(); } }, [
        el('span', { style: { flex: '1', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.title),
        el('span', { class: 'dimmer', style: { fontSize: '11px' } }, fmtDate(c.time)),
        el('button', { class: 'icon-btn', onclick: (e) => { e.stopPropagation(); convos = convos.filter(x => x.id !== c.id); saveConvos(); openHistory(); } }, el('span', { html: Icons.glyph('trash') })),
      ]));
      const panel = el('div', { class: 'sheet-panel glass' }, [
        el('div', { style: { fontWeight: '700', marginBottom: '10px' } }, '会话历史'),
        ...(convos.length ? rows : [el('div', { class: 'empty-state', style: { padding: '16px' } }, el('span', { class: 'dimmer' }, '暂无历史会话'))]),
      ]);
      const sheet = Dialog.sheet(win.el, () => panel);
    }

    function openModelSettings() {
      const cfg = Settings.get('deepseek');
      const model = el('select', { class: 'field', style: { width: '100%', marginBottom: '8px' } }, ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'].map(m => el('option', { value: m, selected: cfg.model === m }, m)));
      const temp = el('input', { class: 'slider', type: 'range', min: 0, max: 100, value: (cfg.temperature ?? 0.7) * 100, style: { width: '100%' } });
      const panel = el('div', { class: 'sheet-panel glass' }, [
        el('div', { style: { fontWeight: '700', marginBottom: '10px' } }, '模型设置'),
        el('div', { class: 'sr-label', style: { marginBottom: '4px' } }, '模型'),
        model,
        el('div', { class: 'sr-label', style: { margin: '10px 0 4px' } }, '温度'),
        temp,
        el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' } }, [
          el('button', { class: 'btn', onclick: () => sheet.dismiss() }, '取消'),
          el('button', { class: 'btn primary', onclick: () => { Settings.set('deepseek', { ...cfg, model: model.value, temperature: +temp.value / 100 }); refreshBadge(); sheet.dismiss(); Toast.show('模型设置已更新', { icon: 'check' }); } }, '保存'),
        ]),
      ]);
      const sheet = Dialog.sheet(win.el, () => panel);
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    refreshBadge();
    renderHistory();
    if (!history.length) {
      addMsg('bot', "Hi — I'm **Intelligence**, powered by DeepSeek V4 Pro. This window is Liquid Glass; everything behind it is being refracted in real time. What shall we figure out?");
    }
    on('settings:deepseek', refreshBadge);
    renderChips();

    return () => {};
  },
});
