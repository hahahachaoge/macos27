/* ============================================================
   macOS 27 — Mammoth · apps/preview.js
   Image preview with zoom, fit, rotate, and prev/next sibling
   navigation when opened from a folder.
   ============================================================ */
'use strict';

M27.register({
  id: 'preview',
  name: 'Preview',
  icon: Icons.preview(),
  width: 640, height: 500, minW: 380, minH: 300,
  mount({ content, toolbar, args, setTitle }) {
    let currentPath = args?.path || null;
    const initialSrc = args?.src || (currentPath ? VFS.read(currentPath) : null);
    let name = currentPath ? VFS.basename(currentPath) : 'Image';

    setTitle(name);

    let zoom = 1, angle = 0;

    /* ---- sibling image navigation ---- */
    let siblings = [];
    let index = -1;
    if (currentPath) {
      try {
        const dir = VFS.parent(currentPath);
        siblings = VFS.ls(dir)
          .filter(n => n.type === 'file' && (/^image\//.test(n.mime || '') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(n.name || '')))
          .map(n => VFS.join(dir, n.name));
        index = siblings.indexOf(currentPath);
      } catch { siblings = []; }
    }

    const stage = el('div', { class: 'preview-stage' });
    const img = el('img', { src: initialSrc, alt: name, draggable: false });
    stage.append(img);
    content.append(stage);

    const zoomLabel = el('span', { class: 'dim', style: { fontSize: '12px', width: '44px', textAlign: 'center' } }, '100%');
    const titleEl = el('span', { class: 'toolbar-title', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name);

    const applyTransform = () => {
      img.style.transform = `scale(${zoom}) rotate(${angle}deg)`;
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
    };
    const fit = () => {
      const r = stage.getBoundingClientRect();
      const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
      zoom = clamp(Math.min((r.width - 40) / nw, (r.height - 40) / nh), 0.05, 8);
      applyTransform();
    };
    img.addEventListener('load', fit);

    const rotate = (d) => { angle = (angle + d + 360) % 360; applyTransform(); };

    function nav(d) {
      if (siblings.length < 2) return;
      index = (index + d + siblings.length) % siblings.length;
      const p = siblings[index];
      const c = VFS.read(p);
      if (c == null) return;
      currentPath = p;
      name = VFS.basename(p);
      img.src = c;
      img.alt = name;
      setTitle(name);
      titleEl.textContent = name;
      zoom = 1; angle = 0;
      applyTransform();
      updateNavButtons();
    }

    const prevBtn = el('button', { class: 'icon-btn', title: 'Previous image', onclick: () => { Sound.play('click'); nav(-1); } },
      el('span', { html: Icons.glyph('prev') }));
    const nextBtn = el('button', { class: 'icon-btn', title: 'Next image', onclick: () => { Sound.play('click'); nav(1); } },
      el('span', { html: Icons.glyph('next') }));

    function updateNavButtons() {
      const off = siblings.length < 2;
      prevBtn.disabled = off; nextBtn.disabled = off;
      prevBtn.style.opacity = off ? '0.35' : '';
      nextBtn.style.opacity = off ? '0.35' : '';
    }

    const ROT_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8a8.5 8.5 0 0 1 14.6-3L20 7"/><path d="M20 3.5V7h-3.5"/></svg>';
    const ROT_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 8a8.5 8.5 0 0 0-14.6-3L4 7"/><path d="M4 3.5V7h3.5"/></svg>';

    toolbar.append(
      titleEl,
      el('span', { class: 'spacer' }),
      prevBtn,
      nextBtn,
      el('button', { class: 'icon-btn', title: 'Rotate left', onclick: () => { Sound.play('click'); rotate(-90); } },
        el('span', { html: ROT_L })),
      el('button', { class: 'icon-btn', title: 'Rotate right', onclick: () => { Sound.play('click'); rotate(90); } },
        el('span', { html: ROT_R })),
      el('button', { class: 'icon-btn', title: 'Zoom out', onclick: () => { zoom = clamp(zoom / 1.25, .05, 8); applyTransform(); } },
        el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14"/></svg>' })),
      zoomLabel,
      el('button', { class: 'icon-btn', title: 'Zoom in', onclick: () => { zoom = clamp(zoom * 1.25, .05, 8); applyTransform(); } },
        el('span', { html: Icons.glyph('plus') })),
      el('button', { class: 'icon-btn', title: 'Fit', onclick: fit },
        el('span', { html: Icons.glyph('refresh') })),
    );

    updateNavButtons();
  },
});
