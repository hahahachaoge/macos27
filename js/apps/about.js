/* ============================================================
   macOS 27 — Mammoth · apps/about.js
   About This Mac — with a live Liquid Glass demo card.
   ============================================================ */
'use strict';

M27.register({
  id: 'about',
  name: 'About This Mac',
  icon: Icons.about(),
  width: 480, height: 560, minW: 420, minH: 480, resizable: false, single: true,

  mount({ content }) {
    const root = el('div', { class: 'about' });
    content.append(root);

    /* live glass demo */
    const demo = el('div', { class: 'glass-preview', style: { width: '100%' } });
    const c = document.createElement('canvas');
    c.width = 480; c.height = 150;
    const snap = Wallpaper.snapshot();
    c.getContext('2d').drawImage(snap, 0, 0, 480, 150);
    demo.append(c);
    const card = el('div', { class: 'gp-card glass', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' } },
      [el('span', { style: { fontSize: '22px' } }, '27'),
       el('span', { class: 'dimmer', style: { fontSize: '11px' } }, 'Liquid Glass — click me')]);
    demo.append(card);
    demo.addEventListener('pointerdown', e => {
      const r = demo.getBoundingClientRect();
      Glass.ripple(e.clientX - r.left, e.clientY - r.top, demo);
    });

    root.append(
      el('span', { class: 'a-logo', html: '<svg viewBox="0 0 384 512" width="100%" height="100%"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>' }),
      el('div', { class: 'a-name' }, 'macOS 27'),
      el('div', { class: 'a-ver' }, 'Version 27.0 (Build 27A520) · “Mammoth”'),
      el('span', { class: 'badge a-chip', style: { fontWeight: '600' } },
        el('span', { html: Icons.assistant(), style: { width: '16px', height: '16px', display: 'inline-block' } }),
        'Powered by DeepSeek V4 Pro'),
      demo,
      el('div', { class: 'a-specs' }, [
        ['Chip', 'DeepSeek V4 Pro'],
        ['Neural Engine', 'Intelligence (built-in)'],
        ['Memory', '128 GB unified'],
        ['Startup disk', 'Macintosh HD'],
        ['Graphics', 'Browser compositor · live refraction'],
        ['Serial number', 'M27WEB2025'],
      ].map(([k, v]) => el('div', { class: 'spec-row' }, [el('span', {}, k), el('span', {}, v)]))),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } }, [
        el('button', { class: 'btn', onclick: () => Toast.show('Your Mac is up to date — it was born today.', { icon: 'check' }) }, 'Software Update…'),
        el('button', { class: 'btn', onclick: () => WM.open('settings', { args: { pane: 'about' } }) }, 'More Info…'),
      ]),
    );

    return () => {};
  },
});
