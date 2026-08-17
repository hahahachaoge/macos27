/* ============================================================
   macOS 27 — Mammoth · apps/settings.js
   System Settings: Appearance, Wallpaper, Liquid Glass,
   Intelligence (DeepSeek config), Sound, About.
   ============================================================ */
'use strict';

M27.register({
  id: 'settings',
  name: 'System Settings',
  icon: Icons.settings(),
  width: 780, height: 580, minW: 620, minH: 420, single: true,

  mount({ content, args, setTitle }) {
    setTitle('System Settings');
    const root = el('div', { class: 'app-root' });
    const side = el('div', { class: 'app-sidebar settings-side' });
    const main = el('div', { class: 'settings-main' });
    root.append(side, main);
    content.append(root);

    const PANES = [
      { id: 'appearance', name: 'Appearance', icon: Icons.glyph('sun') },
      { id: 'wallpaper', name: 'Wallpaper', icon: Icons.glyph('image') },
      { id: 'glass', name: 'Liquid Glass', icon: Icons.glyph('eye') },
      { id: 'intelligence', name: 'Intelligence', icon: Icons.assistant() },
      { id: 'wifi', name: 'Wi-Fi', icon: Icons.glyph('wifi') },
      { id: 'bluetooth', name: 'Bluetooth', icon: Icons.glyph('bt') },
      { id: 'display', name: 'Displays', icon: Icons.glyph('sun') },
      { id: 'notifications', name: 'Notifications', icon: Icons.glyph('cc') },
      { id: 'keyboard', name: 'Keyboard', icon: Icons.glyph('gear') },
      { id: 'trackpad', name: 'Trackpad', icon: Icons.glyph('info') },
      { id: 'battery', name: 'Battery', icon: Icons.glyph('battery') },
      { id: 'account', name: 'Apple Account', icon: Icons.glyph('info') },
      { id: 'sound', name: 'Sound', icon: Icons.glyph('volume') },
      { id: 'about', name: 'About', icon: Icons.glyph('info') },
    ];
    let pane = args?.pane || 'glass';

    function renderSide() {
      side.innerHTML = '';
      for (const p of PANES) {
        const row = el('button', { class: 'sb-item' + (pane === p.id ? ' sel' : '') }, [
          el('span', { html: p.icon, style: { width: '18px', height: '18px' } }),
          el('span', {}, p.name),
        ]);
        row.addEventListener('click', () => { pane = p.id; renderSide(); renderMain(); });
        side.append(row);
      }
    }

    function row(label, desc, control) {
      return el('div', { class: 'set-row' }, [
        el('div', {}, [
          el('div', { class: 'sr-label' }, label),
          desc ? el('div', { class: 'sr-desc' }, desc) : null,
        ]),
        el('div', { class: 'sr-control' }, control),
      ]);
    }

    function sliderRow(label, desc, get, set, min, max, fmt) {
      const val = el('span', { class: 'dim', style: { width: '52px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' } });
      const input = el('input', { class: 'slider', type: 'range', min, max, value: get(), style: { width: '160px' } });
      const update = v => { set(v); val.textContent = fmt ? fmt(v) : v; };
      input.addEventListener('input', () => update(+input.value));
      val.textContent = fmt ? fmt(get()) : get();
      return row(label, desc, el('span', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [input, val]));
    }

    function switchRow(label, desc, get, set) {
      const sw = el('button', { class: 'switch' + (get() ? ' on' : '') });
      sw.addEventListener('click', () => { set(!get()); sw.classList.toggle('on', get()); Sound.play('click'); });
      return row(label, desc, sw);
    }

    /* ---------- panes ---------- */
    function paneAppearance() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Appearance'));
      main.append(el('div', { class: 'set-sub' }, 'Make this glass Mac look the way you like.'));

      const g1 = el('div', { class: 'set-group' });
      g1.append(el('h3', {}, 'Appearance'));
      const seg = el('div', { class: 'segmented' }, ['Light', 'Dark', 'Auto'].map(m => {
        const b = el('button', { class: Settings.get('theme') === m.toLowerCase() ? 'on' : '' }, m);
        b.addEventListener('click', () => {
          Settings.set('theme', m.toLowerCase());
          $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
        });
        return b;
      }));
      g1.append(row('Theme', 'Liquid Glass reads differently in each mode', seg));
      main.append(g1);

      const g2 = el('div', { class: 'set-group' });
      g2.append(el('h3', {}, 'Accent color'));
      const dots = el('div', { style: { display: 'flex', gap: '10px' } },
        ['#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A', '#30D158', '#64D2FF', '#5E5CE6', '#AC8E68'].map(c => {
          const d = el('button', { class: 'accent-dot' + (Settings.get('accent') === c ? ' sel' : ''), style: { background: c }, 'aria-label': c });
          d.addEventListener('click', () => {
            Settings.set('accent', c);
            $$('.accent-dot', g2).forEach(x => x.classList.toggle('sel', x === d));
          });
          return d;
        }));
      g2.append(row('Choose', 'Used for buttons, selections and highlights', dots));
      main.append(g2);

      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'Motion & transparency'),
        switchRow('Reduce Transparency', 'Disables the glass material system-wide', () => !Settings.get('glass'), v => Settings.set('glass', !v)),
        switchRow('Reduce Motion', 'Stops the live wallpaper animation', () => Settings.get('reduceMotion'), v => { Settings.set('reduceMotion', v); Wallpaper.start(); }),
      ]));
    }

    function paneWallpaper() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Wallpaper'));
      main.append(el('div', { class: 'set-sub' }, 'Generated live — every preset is a little light show.'));

      const grid = el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });
      for (const name of Wallpaper.list()) {
        const thumb = el('button', { class: 'wall-thumb' + (Wallpaper.get() === name ? ' sel' : '') });
        const c = document.createElement('canvas');
        c.width = 172; c.height = 108;
        const snap = Wallpaper.snapshot();
        c.getContext('2d').drawImage(snap, 0, 0, 172, 108);
        thumb.append(c);
        thumb.title = name[0].toUpperCase() + name.slice(1);
        thumb.addEventListener('click', () => {
          Wallpaper.set(name);
          $$('.wall-thumb', grid).forEach(t => t.classList.toggle('sel', t === thumb));
          Toast.show('Wallpaper set to ' + name[0].toUpperCase() + name.slice(1), { icon: 'image' });
        });
        grid.append(thumb);
      }
      main.append(grid);
      main.append(el('div', { class: 'set-group', style: { marginTop: '18px' } }, [
        switchRow('自动轮换壁纸', '定时切换预设壁纸', () => Settings.get('wallpaperRotate'), v => Settings.set('wallpaperRotate', v)),
        sliderRow('轮换间隔', '分钟', () => Settings.get('wallpaperInterval'), v => Settings.set('wallpaperInterval', v), 1, 60, v => v + ' 分钟'),
      ]));
      main.append(el('p', { class: 'dim', style: { marginTop: '14px', fontSize: '12px' } },
        'The thumbnails show a live frame of the current animation. Set “Reduce Motion” in Appearance to freeze the light.'));
    }

    function paneGlass() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Liquid Glass'));
      main.append(el('div', { class: 'set-sub' }, 'Tune the material. Every surface updates live — this very window is made of it.'));

      const preview = el('div', { class: 'glass-preview' });
      const pc = document.createElement('canvas');
      pc.width = 700; pc.height = 160;
      const snap = Wallpaper.snapshot();
      pc.getContext('2d').drawImage(snap, 0, 0, 700, 160);
      preview.append(pc);
      const card = el('div', { class: 'gp-card glass' });
      preview.append(card);
      preview.addEventListener('pointerdown', e => {
        const r = preview.getBoundingClientRect();
        Glass.ripple(e.clientX - r.left, e.clientY - r.top, preview);
      });
      main.append(preview);

      main.append(el('div', { class: 'set-group' }, [
        switchRow('Enable Liquid Glass', 'Blur, tint and refraction for every window', () => Settings.get('glass'), v => Settings.set('glass', v)),
        switchRow('Refraction', 'Warp the wallpaper through a live lens beneath windows', () => Settings.get('refraction'), v => Settings.set('refraction', v)),
        switchRow('Specular rim', 'Hairline light around every glass edge', () => Settings.get('glassRim', true), v => Settings.set('glassRim', v)),
      ]));

      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'Material'),
        sliderRow('Blur radius', 'How much the backdrop melts', () => Settings.get('glassBlur'), v => Settings.set('glassBlur', v), 0, 60, v => v + ' px'),
        sliderRow('Saturation', 'Color boost through the glass', () => Settings.get('glassSat'), v => Settings.set('glassSat', v), 100, 300, v => Math.round(v) + '%'),
        sliderRow('Brightness', 'Lift applied to the backdrop', () => Settings.get('glassBright'), v => Settings.set('glassBright', v), 80, 140, v => Math.round(v) + '%'),
        sliderRow('Tint strength', 'How strongly glass absorbs wallpaper color', () => Math.round(Settings.get('glassAlpha') * 100), v => Settings.set('glassAlpha', v / 100), 0, 60, v => v + '%'),
      ]));

      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'Presets'),
        el('div', { style: { display: 'flex', gap: '8px' } }, [
          el('button', { class: 'btn', onclick: () => { Settings.set('glassBlur', 26); Settings.set('glassSat', 190); Settings.set('glassBright', 112); Settings.set('glassAlpha', 0.16); Settings.set('glass', true); Settings.set('refraction', true); paneGlass(); Toast.show('Default Liquid Glass restored', { icon: 'check' }); } }, 'Default'),
          el('button', { class: 'btn', onclick: () => { Settings.set('glassBlur', 44); Settings.set('glassSat', 240); Settings.set('glassBright', 116); Settings.set('glassAlpha', 0.22); paneGlass(); } }, 'Heavy'),
          el('button', { class: 'btn', onclick: () => { Settings.set('glassBlur', 14); Settings.set('glassSat', 150); Settings.set('glassBright', 108); Settings.set('glassAlpha', 0.1); paneGlass(); } }, 'Crisp'),
          el('button', { class: 'btn', onclick: () => { Settings.set('glass', false); paneGlass(); } }, 'Flat (no glass)'),
        ]),
      ]));
    }

    function paneIntelligence() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Intelligence'));
      main.append(el('div', { class: 'set-sub' }, 'Connect the built-in assistant to DeepSeek V4 Pro.'));

      const cfg = Settings.get('deepseek');
      const baseInput = el('input', { class: 'field', value: cfg.base, spellcheck: false, style: { width: '280px' } });
      const modelSel = el('select', { class: 'field' }, ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'].map(m =>
        el('option', { value: m, selected: cfg.model === m }, m)));
      const keyInput = el('input', { class: 'field', type: 'password', value: cfg.key, placeholder: 'sk-…', spellcheck: false, style: { width: '240px' } });
      const tempSlider = el('input', { class: 'slider', type: 'range', min: 0, max: 100, value: (cfg.temperature ?? 0.7) * 100, style: { width: '120px' } });
      const status = el('span', { class: 'badge' }, DeepSeek.configured() ? 'Connected' : 'Offline demo');

      const save = () => {
        Settings.set('deepseek', {
          base: baseInput.value.trim() || 'https://api.deepseek.com',
          model: modelSel.value,
          key: keyInput.value.trim(),
          temperature: +tempSlider.value / 100,
        });
        status.textContent = DeepSeek.configured() ? 'Connected' : 'Offline demo';
      };

      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'DeepSeek API'),
        row('Endpoint', 'Any OpenAI-compatible base URL works', baseInput),
        row('Model', 'deepseek-chat is the public flagship; v4-pro if exposed by your endpoint', modelSel),
        row('API key', 'Stored only in this browser (localStorage)', keyInput),
        row('Temperature', 'Creativity of replies', tempSlider),
      ]));

      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'Status'),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          el('button', { class: 'btn primary', onclick: async () => {
            save();
            const res = await DeepSeek.test();
            if (res.ok) { status.textContent = 'Connected'; Toast.show(`DeepSeek V4 Pro replied in ${res.ms} ms`, { icon: 'check' }); }
            else Toast.show('Connection failed: ' + res.error, { icon: 'info' });
          } }, 'Test connection'),
          status,
          el('button', { class: 'btn ghost', onclick: () => { WM.open('assistant'); } }, 'Open Intelligence'),
        ]),
      ]));

      main.append(el('p', { class: 'dim', style: { fontSize: '12px', marginTop: '16px' } },
        'Without a key, Intelligence runs on a small offline brain so the demo works anywhere. ' +
        'Your key never leaves this browser — requests go straight to the endpoint you choose.'));
    }

    function paneSound() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Sound'));
      main.append(el('div', { class: 'set-sub' }, 'All UI sounds are synthesized with WebAudio — zero audio files.'));

      main.append(el('div', { class: 'set-group' }, [
        switchRow('Play UI sounds', 'Clicks, whooshes and dings', () => Settings.get('sounds'), v => Settings.set('sounds', v)),
        sliderRow('Alert volume', null, () => Math.round(Settings.get('uiVolume') * 100), v => Settings.set('uiVolume', v / 100), 0, 100, v => v + '%'),
      ]));
      main.append(el('div', { class: 'set-group' }, [
        el('h3', {}, 'Preview'),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
          el('button', { class: 'btn', onclick: () => Sound.play('ding') }, 'Ding'),
          el('button', { class: 'btn', onclick: () => Sound.play('open') }, 'Open'),
          el('button', { class: 'btn', onclick: () => Sound.play('close') }, 'Close'),
          el('button', { class: 'btn', onclick: () => Sound.play('trash') }, 'Trash'),
          el('button', { class: 'btn', onclick: () => Sound.play('boot') }, 'Boot chime'),
        ]),
      ]));
    }

    function paneAbout() {
      main.innerHTML = '';
      main.append(el('div', { class: 'about', style: { padding: '8px 0' } }, [
        el('span', { class: 'a-logo', html: '<svg viewBox="0 0 384 512" width="100%" height="100%"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>' }),
        el('div', { class: 'a-name' }, 'macOS 27'),
        el('div', { class: 'a-ver' }, 'Version 27.0 (Build 27A520) · “Mammoth”'),
        el('span', { class: 'badge a-chip' }, 'Powered by DeepSeek V4 Pro'),
        el('div', { class: 'a-specs' }, [
          ['Chip', 'DeepSeek V4 Pro'],
          ['Neural Engine', 'Intelligence (built-in)'],
          ['Memory', '128 GB unified'],
          ['Startup disk', 'Macintosh HD'],
          ['Display', 'Your browser tab — Liquid Glass capable'],
          ['Serial number', 'M27WEB2025'],
        ].map(([k, v]) => el('div', { class: 'spec-row' }, [el('span', {}, k), el('span', {}, v)]))),
        el('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } }, [
          el('button', { class: 'btn', onclick: () => Toast.show('macOS 27 is up to date.', { icon: 'check' }) }, 'Software Update…'),
          el('button', { class: 'btn', onclick: () => WM.open('about') }, 'More Info…'),
        ]),
      ]));
    }

    /* ---- connectivity / device / account panes ---- */
    function deviceList(rows) {
      const g = el('div', { class: 'set-group' });
      for (const [name, status, connected] of rows) {
        g.append(row(name, status, el('span', { class: 'badge', style: connected ? 'border-color: var(--ok); color: var(--ok);' : '' }, connected ? '已连接' : '未连接')));
      }
      return g;
    }

    function paneWifi() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Wi-Fi'));
      main.append(el('div', { class: 'set-sub' }, '连接到无线网络。'));
      main.append(el('div', { class: 'set-group' }, [
        switchRow('Wi-Fi', '打开以搜索网络', () => Settings.get('wifi'), v => Settings.set('wifi', v)),
      ]));
      main.append(deviceList([
        ['LiquidNet 5G', 'WPA2 个人', Settings.get('wifi')],
        ['Mammoth Guest', '开放网络', false],
        ['NeighborsWifi', '需要密码', false],
        ['Cafe Free Wi-Fi', '开放网络', false],
      ]));
    }

    function paneBluetooth() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Bluetooth'));
      main.append(el('div', { class: 'set-sub' }, '附近的设备。'));
      main.append(el('div', { class: 'set-group' }, [
        switchRow('Bluetooth', '打开以发现设备', () => Settings.get('bluetooth'), v => Settings.set('bluetooth', v)),
      ]));
      main.append(deviceList([
        ['Magic Keyboard', '输入设备', Settings.get('bluetooth')],
        ['AirPods Pro', '音频设备', false],
        ['Mouse', '输入设备', false],
      ]));
    }

    function paneDisplay() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Displays'));
      main.append(el('div', { class: 'set-sub' }, '内置显示器。'));
      const res = el('select', { class: 'field', onchange: (e) => Toast.show('分辨率：' + e.target.value + '（占位）', { icon: 'info' }) }, [
        el('option', {}, '默认（您的浏览器窗口）'),
        el('option', {}, '1920 × 1080'),
        el('option', {}, '2560 × 1440'),
      ]);
      main.append(el('div', { class: 'set-group' }, [
        row('分辨率', '缩放显示', res),
        sliderRow('亮度', null, () => Settings.get('brightness'), v => { Settings.set('brightness', v); $('#brightness').style.opacity = (v / 100).toFixed(2); }, 0, 80, v => v + '%'),
        switchRow('自动深色模式', '随系统外观自动切换', () => Settings.get('theme') === 'auto', v => Settings.set('theme', v ? 'auto' : resolvedTheme())),
      ]));
    }

    function paneNotifications() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Notifications'));
      main.append(el('div', { class: 'set-sub' }, '通知与专注。'));
      main.append(el('div', { class: 'set-group' }, [
        switchRow('允许通知', '应用可以发送通知', () => Settings.get('notificationsEnabled', true), v => Settings.set('notificationsEnabled', v)),
        switchRow('勿扰模式', '静音所有通知', () => Settings.get('focus'), v => Settings.set('focus', v)),
      ]));
      main.append(el('div', { class: 'set-group' }, [
        row('通知中心', '当前有 ' + Notifications.count() + ' 条通知', el('button', { class: 'btn', onclick: () => { Notifications.clearAll(); paneNotifications(); Toast.show('通知已清空', { icon: 'check' }); } }, '清空')),
      ]));
    }

    function paneKeyboard() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Keyboard'));
      main.append(el('div', { class: 'set-sub' }, '键盘快捷键。'));
      const shortcuts = [
        ['⌘Space', 'Spotlight 搜索'], ['⌘Tab', '切换应用'], ['⌘W / ⌘M', '关闭 / 最小化窗口'],
        ['⌘H', '隐藏应用'], ['⌘,', '系统设置'], ['⌘⇧3', '截图保存到桌面'],
        ['Ctrl+←/→', '切换桌面空间'], ['F11 / ⌃⌘F', '进入全屏'], ['Esc', '退出全屏 / 关闭浮层'],
      ];
      const g = el('div', { class: 'set-group' });
      for (const [k, d] of shortcuts) {
        g.append(el('div', { class: 'set-row' }, [
          el('span', { class: 'sr-label mono' }, k),
          el('span', { class: 'dim' }, d),
        ]));
      }
      main.append(g);
    }

    function paneTrackpad() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Trackpad'));
      main.append(el('div', { class: 'set-sub' }, '滚动与点按。'));
      main.append(el('div', { class: 'set-group' }, [
        switchRow('自然滚动', '内容随手指方向移动', () => Settings.get('scrollNatural', true), v => Settings.set('scrollNatural', v)),
        switchRow('轻点点按', '轻触即点按', () => Settings.get('tapToClick', true), v => Settings.set('tapToClick', v)),
      ]));
    }

    function paneBattery() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Battery'));
      main.append(el('div', { class: 'set-sub' }, '由想象力供电。'));
      const pct = el('div', { class: 'dim' }, '87%');
      main.append(el('div', { class: 'set-group' }, [
        row('电量', '当前电量', pct),
        row('电池健康', '正常', el('span', {}, '100%')),
        row('循环计数', null, el('span', {}, '42')),
        switchRow('低电量模式', '减少玻璃折射以省电', () => Settings.get('lowPowerMode'), v => Settings.set('lowPowerMode', v)),
      ]));
    }

    function paneAccount() {
      main.innerHTML = '';
      main.append(el('h1', {}, 'Apple Account'));
      main.append(el('div', { class: 'set-sub' }, '你的账户。'));
      const name = el('input', { class: 'field', value: Settings.get('accountName', 'You'), style: { width: '200px' } });
      const avatar = el('div', { class: 'lock-avatar', style: { width: '60px', height: '60px', fontSize: '26px' } }, Settings.get('accountName', 'You')[0]);
      main.append(el('div', { class: 'set-group' }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '6px 0' } }, [avatar, el('div', {}, [el('div', { class: 'sr-label' }, '头像与姓名'), el('div', { class: 'sr-desc' }, '锁屏显示此姓名')])]),
        row('姓名', '同步到锁屏与账户', name),
        el('div', { class: 'set-row' }, [
          el('span', { class: 'sr-label dim' }, 'Apple ID'),
          el('span', { class: 'mono dim' }, 'you@macos27.app'),
        ]),
      ]));
      name.addEventListener('input', () => {
        Settings.set('accountName', name.value.trim() || 'You');
        avatar.textContent = (name.value.trim() || 'You')[0];
      });
    }

    function renderMain() {
      const fns = {
        appearance: paneAppearance, wallpaper: paneWallpaper, glass: paneGlass, intelligence: paneIntelligence,
        wifi: paneWifi, bluetooth: paneBluetooth, display: paneDisplay, notifications: paneNotifications,
        keyboard: paneKeyboard, trackpad: paneTrackpad, battery: paneBattery, account: paneAccount,
        sound: paneSound, about: paneAbout,
      };
      (fns[pane] || paneGlass)();
    }

    renderSide();
    renderMain();
    return () => {};
  },
});
