/* ============================================================
   macOS 27 — Mammoth · apps/mail.js
   Mail: three-pane client (folders · list · reader), compose,
   reply, forward, draft autosave, VIP, search, star,
   archive→trash, delete. Persists to macos27.mail.
   ============================================================ */
'use strict';

M27.register({
  id: 'mail',
  name: 'Mail',
  icon: Icons.mail(),
  width: 1080, height: 680, minW: 760, minH: 460,

  mount({ content, toolbar, win }) {
    const KEY = 'macos27.mail';
    const VIP_KEY = 'macos27.mail.vip';

    /* ---------- style ---------- */
    if (!document.getElementById('m27-mail-style')) {
      const st = document.createElement('style');
      st.id = 'm27-mail-style';
      st.textContent = `
        .mail-vip-badge { display:inline-block; background: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent); border-radius:4px; font-size:9px; font-weight:700; padding:0 5px; margin-right:5px; line-height:14px; }
        .mail-head-row { display:flex; align-items:flex-start; gap:10px; }
        .mail-head-row h2 { flex:1; margin:0 0 2px; }
        .mail-vip-toggle { color: var(--text-3); }
        .mail-vip-toggle.on { color: var(--accent); }
      `;
      document.head.appendChild(st);
    }

    const FOLDERS = [
      { id: 'inbox',   name: 'Inbox',   icon: Icons.glyph('list') },
      { id: 'starred', name: 'Starred', icon: Icons.glyph('star') },
      { id: 'sent',    name: 'Sent',    icon: Icons.glyph('send') },
      { id: 'drafts',  name: 'Drafts',  icon: Icons.glyph('doc') },
      { id: 'trash',   name: 'Trash',   icon: Icons.glyph('trash') },
    ];

    function stripHtml(html) {
      const d = document.createElement('div');
      d.innerHTML = html || '';
      return (d.textContent || '').replace(/\u00a0/g, ' ');
    }

    /* ---------- seed content ---------- */
    function seed() {
      const now = Date.now();
      return [
        {
          id: uid(), folder: 'inbox', from: 'The macOS Team', fromEmail: 'welcome@macos27.app', to: 'You',
          subject: 'Welcome to macOS 27', date: now - 2 * 3600e3, unread: true, starred: false,
          body: '<p>Welcome to your new Mac.</p>' +
            '<p>Everything you see here is made of <strong>Liquid Glass</strong> — windows drink the wallpaper\u2019s colors and refract whatever sits behind them, live.</p>' +
            '<p>A few things to try first:</p>' +
            '<ul><li>Drag a window over the wallpaper and watch it tint.</li>' +
            '<li>Press \u2318Space for Spotlight, \u2318Tab for the app switcher.</li>' +
            '<li>Open System Settings \u2192 Liquid Glass and drag the blur slider.</li></ul>' +
            '<p>Enjoy the ride.</p>',
        },
        {
          id: uid(), folder: 'inbox', from: 'DeepSeek', fromEmail: 'intelligence@deepseek.ai', to: 'You',
          subject: 'Your Intelligence is ready', date: now - 5 * 3600e3, unread: true, starred: false,
          body: '<p>Hi — it\u2019s Intelligence.</p>' +
            '<p>I\u2019m now running on <strong>DeepSeek V4 Pro</strong> and living in your menu bar, your Messages app, and anywhere else you need me.</p>' +
            '<p>To unlock the full model, open <strong>System Settings \u2192 Intelligence</strong> and paste a DeepSeek API key. Until then I\u2019ll keep up from a small offline brain so the demo works anywhere.</p>' +
            '<p>Ask me about Liquid Glass, or just say hi.</p>',
        },
        {
          id: uid(), folder: 'inbox', from: 'Maya Chen', fromEmail: 'maya@design.studio', to: 'You',
          subject: 'Liquid Glass design session', date: now - 26 * 3600e3, unread: false, starred: true,
          body: '<p>Quick heads-up: our weekly glass review moved to Thursday, 2:00&nbsp;PM.</p>' +
            '<p>Bring the latest build — I want to see the new adaptive tint on the window rims, and whether the refraction field feels right at 26px blur.</p>' +
            '<p>Bring coffee. \u2615</p>',
        },
        {
          id: uid(), folder: 'inbox', from: 'Apple Events', fromEmail: 'events@apple.com', to: 'You',
          subject: 'WWDC keynote replay is live', date: now - 2 * 86400e3, unread: true, starred: false,
          body: '<p>The WWDC keynote replay is now available to stream.</p>' +
            '<p>Watch the full reveal of macOS 27 \u201cMammoth\u201d — including the Liquid Glass material system, the new Intelligence features, and everything shipping this fall.</p>' +
            '<p><strong>Replay \u2192</strong> apple.com/apple-events</p>',
        },
        {
          id: uid(), folder: 'inbox', from: 'iCloud', fromEmail: 'no-reply@icloud.com', to: 'You',
          subject: 'iCloud storage — action needed', date: now - 3 * 86400e3, unread: false, starred: false,
          body: '<p>You\u2019re almost out of iCloud storage.</p>' +
            '<p>You\u2019ve used <strong>4.8&nbsp;GB of 5&nbsp;GB</strong>. Photos and device backups will pause once you reach your limit.</p>' +
            '<p>Upgrade your plan or free up space in <strong>System Settings \u2192 Apple Account \u2192 iCloud</strong>.</p>',
        },
        {
          id: uid(), folder: 'inbox', from: 'Alex Rivera', fromEmail: 'alex@friend.me', to: 'You',
          subject: 'A friendly note from Alex', date: now - 5 * 86400e3, unread: false, starred: true,
          body: '<p>yo! saw the new desktop you\u2019re building.</p>' +
            '<p>the glass effect on that window is <em>unreal</em> \uD83E\uDD2F how does the blur know the wallpaper colors??</p>' +
            '<p>anyway — coffee this week? I\u2019ll drive.</p>',
        },
      ];
    }

    /* ---------- state ---------- */
    let mails = [];
    try { mails = JSON.parse(localStorage.getItem(KEY) || 'null') || []; } catch { mails = []; }
    if (!Array.isArray(mails) || !mails.length) { mails = seed(); save(); }

    let vip = [];
    try { vip = JSON.parse(localStorage.getItem(VIP_KEY) || 'null') || []; } catch { vip = []; }

    let folder = 'inbox';
    let selId = null;
    let query = '';
    let vipFilter = false;

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(mails)); } catch { /* full */ }
    }
    function saveVip() {
      try { localStorage.setItem(VIP_KEY, JSON.stringify(vip)); } catch { /* full */ }
    }
    function cur() { return mails.find(m => m.id === selId) || null; }
    function isVip(m) { return !!(m.fromEmail && vip.includes(m.fromEmail)); }
    function list() {
      return mails.filter(m => {
        if (folder === 'trash') { if (m.folder !== 'trash') return false; }
        else if (folder === 'starred') { if (!(m.starred && m.folder !== 'trash')) return false; }
        else if (m.folder !== folder) return false;
        if (vipFilter && !isVip(m)) return false;
        if (query) {
          const hay = (m.subject + ' ' + m.from + ' ' + (m.fromEmail || '') + ' ' + stripHtml(m.body)).toLowerCase();
          if (!hay.includes(query.toLowerCase())) return false;
        }
        return true;
      }).sort((a, b) => b.date - a.date);
    }
    function count(id) {
      if (id === 'inbox') return mails.filter(m => m.folder === 'inbox').length;
      if (id === 'starred') return mails.filter(m => m.starred && m.folder !== 'trash').length;
      if (id === 'sent') return mails.filter(m => m.folder === 'sent').length;
      if (id === 'drafts') return mails.filter(m => m.folder === 'drafts').length;
      if (id === 'trash') return mails.filter(m => m.folder === 'trash').length;
      return 0;
    }
    function when(ts) {
      const d = new Date(ts), n = new Date();
      if (d.toDateString() === n.toDateString())
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (d.getFullYear() === n.getFullYear())
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /* ---------- layout ---------- */
    const root = el('div', { class: 'app-root' });
    const side = el('div', { class: 'app-sidebar' });
    const listPane = el('div', {
      style: { width: '300px', flex: 'none', borderRight: '1px solid var(--sep)', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    });
    const reader = el('div', { class: 'mail-reader' });
    root.append(side, listPane, reader);
    content.append(root);

    /* ---------- render ---------- */
    function renderSide() {
      side.innerHTML = '';
      for (const f of FOLDERS) {
        const row = el('button', { class: 'sb-item' + (folder === f.id ? ' sel' : '') }, [
          el('span', { html: f.icon }),
          el('span', {}, f.name),
          el('span', { class: 'sb-count' }, count(f.id)),
        ]);
        row.addEventListener('click', () => {
          folder = f.id;
          selId = list()[0]?.id || null;
          Sound.play('click');
          renderAll();
        });
        side.append(row);
      }
    }

    function renderList() {
      listPane.innerHTML = '';
      const items = list();
      if (!items.length) {
        listPane.append(el('div', { class: 'empty-state', style: { padding: '40px 10px' } },
          el('span', { class: 'dimmer' },
            query ? 'No messages match your search' :
            vipFilter ? 'No VIP messages here' :
            folder === 'inbox' ? 'No messages' :
            folder === 'starred' ? 'No starred messages' :
            folder === 'sent' ? 'No sent messages' :
            folder === 'drafts' ? 'No drafts' : 'Trash is empty')));
        return;
      }
      for (const m of items) {
        const star = el('button', {
          class: 'icon-btn', title: m.starred ? 'Unstar' : 'Star',
          style: { width: '18px', height: '18px', color: m.starred ? 'var(--accent)' : 'var(--text-3)' },
          onclick: (e) => {
            e.stopPropagation();
            m.starred = !m.starred;
            save();
            Sound.play('click');
            if (folder === 'starred' && !m.starred) selId = list()[0]?.id || null;
            renderSide(); renderList(); renderReader();
          },
        }, el('span', { html: Icons.glyph('star') }));

        const subj = el('span', { class: 'ml-subj' }, m.subject);
        if (isVip(m)) subj.prepend(el('span', { class: 'mail-vip-badge' }, 'VIP'));

        const mid = el('span', { style: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '0' } }, [
          el('span', { class: 'ml-from' }, m.from),
          subj,
        ]);

        const row = el('div', {
          class: 'mail-row' + (m.unread ? ' unread' : '') + (m.id === selId ? ' sel' : ''),
          style: { position: 'relative' },
        }, [
          star,
          mid,
          el('span', { class: 'ml-time' }, when(m.date)),
        ]);
        row.addEventListener('click', () => {
          if (m.folder === 'drafts') { openDraft(m); return; }
          selId = m.id;
          if (m.unread) { m.unread = false; save(); }
          Sound.play('click');
          renderAll();
        });
        listPane.append(row);
      }
    }

    function renderReader() {
      reader.innerHTML = '';
      const m = cur();
      if (!m) {
        reader.append(el('div', { class: 'empty-state' }, el('span', { class: 'dimmer' }, 'Select a message')));
        return;
      }
      if (m.folder === 'drafts') {
        reader.append(el('div', { class: 'empty-state' }, [
          el('span', { class: 'dimmer' }, 'Draft — click to continue editing'),
          el('button', { class: 'btn', onclick: () => openDraft(m) }, 'Continue Editing'),
        ]));
        return;
      }

      const headRow = el('div', { class: 'mail-head-row' }, [
        el('h2', {}, m.subject),
        m.fromEmail ? el('button', {
          class: 'icon-btn mail-vip-toggle' + (isVip(m) ? ' on' : ''),
          title: isVip(m) ? 'Remove VIP' : 'Mark sender as VIP',
          onclick: toggleVip,
        }, el('span', { html: Icons.glyph('star') })) : null,
      ]);

      const meta = el('div', { class: 'mr-meta' });
      const metaTxt = (m.folder === 'sent'
        ? 'From: You \u00b7 To: ' + m.to
        : 'From: ' + m.from + (m.fromEmail ? ' <' + m.fromEmail + '>' : '') + ' \u00b7 To: You')
        + ' \u00b7 ' + fmtDate(m.date, true);
      meta.textContent = metaTxt;
      if (isVip(m)) meta.append(el('span', { class: 'mail-vip-badge', style: { marginLeft: '6px' } }, 'VIP'));

      const body = el('div', { class: 'mr-body' });
      body.innerHTML = m.body || '<p></p>';
      reader.append(headRow, meta, body);
    }

    function renderAll() { renderSide(); renderList(); renderReader(); }

    /* ---------- compose / reply / forward ---------- */
    function compose(prefill = {}) {
      let draftId = prefill.draftId || null;
      const to = el('input', { class: 'field', placeholder: 'To', spellcheck: false, value: prefill.to || '', style: { marginBottom: '8px' } });
      const subj = el('input', { class: 'field', placeholder: 'Subject', spellcheck: false, value: prefill.subject || '', style: { marginBottom: '8px' } });
      const body = el('textarea', { class: 'field', placeholder: 'Message', spellcheck: false, value: prefill.body || '', style: { minHeight: '180px', resize: 'vertical' } });

      let sheet = null;
      let closed = false;

      const flushDraft = () => {
        const toV = to.value.trim();
        const subjV = subj.value.trim();
        const bodyV = body.value;
        if (!toV && !subjV && !bodyV) {
          if (draftId) {
            mails = mails.filter(m => m.id !== draftId);
            draftId = null;
            save();
            renderSide(); renderList();
          }
          return;
        }
        let d = draftId ? mails.find(m => m.id === draftId) : null;
        if (!d) {
          d = { id: uid(), folder: 'drafts', from: 'You', fromEmail: 'you@macos27.app', to: '', subject: '', date: Date.now(), unread: false, starred: false, body: '' };
          draftId = d.id;
          mails.unshift(d);
        }
        d.to = toV;
        d.subject = subjV || '(No Subject)';
        d.body = bodyV;
        d.date = Date.now();
        save();
        renderSide(); renderList();
      };
      const saveDraft = debounce(() => { if (!closed) flushDraft(); }, 2000);
      to.addEventListener('input', saveDraft);
      subj.addEventListener('input', saveDraft);
      body.addEventListener('input', saveDraft);

      const send = () => {
        const toV = to.value.trim();
        const subjV = subj.value.trim() || '(No Subject)';
        const bodyV = body.value.trim();
        if (!toV) { Toast.show('Add a recipient', { icon: 'info' }); to.focus(); return; }
        closed = true;
        if (draftId) { mails = mails.filter(m => m.id !== draftId); }
        mails.unshift({
          id: uid(), folder: 'sent', from: 'You', fromEmail: 'you@macos27.app', to: toV,
          subject: subjV, date: Date.now(), unread: false, starred: false,
          body: esc(bodyV).replace(/\n/g, '<br>') || '<p></p>',
        });
        save();
        folder = 'sent';
        selId = mails[0].id;
        renderAll();
        Sound.play('sent');
        Toast.show('Message sent', { icon: 'send' });
        Notifications.push({ title: '邮件已发送', body: `致 ${toV} · ${subjV}`, icon: 'send' });
        sheet.dismiss();
      };

      const cancel = () => {
        closed = true;
        flushDraft();
        sheet.dismiss();
      };

      const panel = el('div', { class: 'sheet-panel glass mail-compose' }, [
        el('div', { style: { fontWeight: '600', fontSize: '15px', marginBottom: '12px' } }, prefill.title || 'New Message'),
        to, subj, body,
        el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } }, [
          el('button', { class: 'btn', onclick: cancel }, 'Cancel'),
          el('button', { class: 'btn primary', onclick: send }, 'Send'),
        ]),
      ]);
      sheet = Dialog.sheet(win.el, () => panel);
      to.focus();
    }

    function openDraft(m) {
      compose({ to: m.to, subject: m.subject, body: m.body, title: 'Draft', draftId: m.id });
    }

    /* ---------- actions ---------- */
    function reply() {
      const m = cur();
      if (!m) return;
      compose({ to: m.folder === 'sent' ? m.to : m.from, subject: 'Re: ' + m.subject, title: 'Reply' });
    }
    function forward() {
      const m = cur();
      if (!m) { Toast.show('Select a message first', { icon: 'info' }); return; }
      const quoted = stripHtml(m.body).split('\n').map(l => '> ' + l).join('\n');
      const body = '\n\n---------- Forwarded message ----------\n'
        + 'From: ' + (m.fromEmail || m.from) + '\n'
        + 'Date: ' + fmtDate(m.date, true) + '\n'
        + 'Subject: ' + m.subject + '\n\n'
        + quoted;
      compose({ subject: 'Fwd: ' + m.subject, body, title: 'Forward' });
    }
    function archive() {
      const m = cur();
      if (!m || m.folder === 'trash') return;
      m.folder = 'trash';
      m.unread = false;
      save();
      Sound.play('trash');
      Toast.show('Moved to Trash', { icon: 'trash' });
      selId = list()[0]?.id || null;
      renderAll();
    }
    function remove() {
      const m = cur();
      if (!m) return;
      mails = mails.filter(x => x.id !== m.id);
      save();
      Sound.play('trash');
      Toast.show('Deleted', { icon: 'trash' });
      selId = list()[0]?.id || null;
      renderAll();
    }
    function toggleStar() {
      const m = cur();
      if (!m) return;
      m.starred = !m.starred;
      save();
      Sound.play('click');
      if (folder === 'starred' && !m.starred) selId = list()[0]?.id || null;
      renderAll();
    }
    function toggleVip() {
      const m = cur();
      if (!m || !m.fromEmail) return;
      if (vip.includes(m.fromEmail)) vip = vip.filter(e => e !== m.fromEmail);
      else vip.push(m.fromEmail);
      saveVip();
      Sound.play('click');
      renderAll();
    }

    /* ---------- toolbar ---------- */
    toolbar.append(
      el('button', { class: 'btn ghost', onclick: () => compose() }, '\u2318N New Message'),
      el('button', { class: 'icon-btn', title: 'Reply', onclick: reply }, el('span', { html: Icons.glyph('reply') })),
      el('button', { class: 'icon-btn', title: 'Forward', onclick: forward }, el('span', { html: Icons.glyph('forward') })),
      el('button', { class: 'icon-btn', title: 'Archive (move to Trash)', onclick: archive }, el('span', { html: Icons.glyph('folder') })),
      el('button', { class: 'icon-btn', title: 'Delete', onclick: remove }, el('span', { html: Icons.glyph('trash') })),
      el('button', { class: 'icon-btn', title: 'Star', onclick: toggleStar }, el('span', { html: Icons.glyph('star') })),
      el('button', { class: 'btn ghost' + (vipFilter ? ' primary' : ''), title: 'Show VIP messages only', onclick: () => { vipFilter = !vipFilter; renderAll(); } }, 'VIP'),
      el('span', { class: 'spacer' }),
      el('input', {
        class: 'field', placeholder: 'Search', spellcheck: false,
        style: { width: '180px' },
        oninput: (e) => { query = e.target.value; renderList(); },
      }),
    );

    /* ---------- boot ---------- */
    selId = list()[0]?.id || null;
    renderAll();

    return () => {};
  },
});
