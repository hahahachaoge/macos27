/* ============================================================
   macOS 27 — Mammoth · apps/photos.js
   Photos: Library / For You / Albums tabs, search, lightbox,
   likes, memories, visual edit placeholder.
   ============================================================ */
'use strict';

M27.register({
  id: 'photos',
  name: 'Photos',
  icon: Icons.photos(),
  width: 1020, height: 660, minW: 620, minH: 420,

  mount({ content }) {
    const LIKES_KEY = 'macos27.photos.likes';
    const DAY = 86400e3;

    /* ---- deterministic scene generator (no assets) ---- */
    const FG = {
      mt: `<path d="M0 800 L180 300 L360 500 L560 200 L780 520 L980 260 L1200 560 L1200 800 Z" fill="#1c2a4d" opacity=".5"/>
        <path d="M0 800 L300 420 L480 560 L680 300 L900 540 L1200 380 L1200 800 Z" fill="#101a38" opacity=".75"/>`,
      wave: `<path d="M0 460 q100 -50 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 v340 H0 Z" fill="#0e2a4a" opacity=".55"/>
        <path d="M0 560 q100 -50 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 v240 H0 Z" fill="#081a33" opacity=".85"/>`,
      dune: `<path d="M0 800 q200 -180 400 -40 t400 -140 t400 0 v180 H0 Z" fill="#2a1c3a" opacity=".5"/>
        <path d="M0 800 q260 -140 520 0 t420 -100 t260 0 v100 H0 Z" fill="#1c1230" opacity=".7"/>`,
    };
    const SKY = {
      sun: `<circle cx="820" cy="250" r="110" fill="#ffe9b0" opacity=".9"/>
        <circle cx="820" cy="250" r="170" fill="#ffe9b0" opacity=".22"/>`,
      moon: `<circle cx="820" cy="230" r="88" fill="#f2f6ff" opacity=".92"/>
        <circle cx="792" cy="210" r="16" fill="#d9e4f2" opacity=".6"/>
        <circle cx="848" cy="252" r="12" fill="#d9e4f2" opacity=".5"/>
        <circle cx="812" cy="262" r="9" fill="#d9e4f2" opacity=".5"/>`,
      stars: `<circle cx="140" cy="120" r="3" fill="#fff" opacity=".9"/>
        <circle cx="480" cy="90" r="2.4" fill="#fff" opacity=".7"/>
        <circle cx="760" cy="150" r="3" fill="#fff" opacity=".8"/>
        <circle cx="1020" cy="90" r="2" fill="#fff" opacity=".7"/>
        <circle cx="300" cy="200" r="2" fill="#fff" opacity=".6"/>
        <circle cx="620" cy="70" r="2.2" fill="#fff" opacity=".75"/>
        <circle cx="900" cy="210" r="1.8" fill="#fff" opacity=".6"/>`,
    };
    const SCENES = [
      { t: 'Aurora Lake',    c1: '#0a1230', c2: '#2a1a5e', c3: '#0b3a5c', fg: 'mt',    sky: 'stars' },
      { t: 'Tahoe Sunrise',  c1: '#2a0f3d', c2: '#b3476e', c3: '#f7a35c', fg: 'mt',    sky: 'sun' },
      { t: 'Golden Mammoth', c1: '#3d1a0f', c2: '#c96a2e', c3: '#f2b26b', fg: 'wave',  sky: 'sun' },
      { t: 'Neon Tide',      c1: '#081c3a', c2: '#0e4d6b', c3: '#19b5a0', fg: 'wave',  sky: 'moon' },
      { t: 'Liquid Summer',  c1: '#0d3a5c', c2: '#1f8f8a', c3: '#ffd27a', fg: 'wave',  sky: 'sun' },
      { t: 'Mammoth Peak',   c1: '#1a2240', c2: '#4a3f8f', c3: '#d98cb0', fg: 'mt',    sky: 'moon' },
      { t: 'Crystal Dunes',  c1: '#2b1a3a', c2: '#7a3f7f', c3: '#e0a458', fg: 'dune',  sky: 'sun' },
      { t: 'Sapphire Cove',  c1: '#041e30', c2: '#0a5c78', c3: '#2ac3c0', fg: 'wave',  sky: 'sun' },
      { t: 'Ember Horizon',  c1: '#1a0f1f', c2: '#7a2e3f', c3: '#f08a3c', fg: 'mt',    sky: 'sun' },
      { t: 'Moonlit Sierra', c1: '#0a0f24', c2: '#1f2c5e', c3: '#7a86c8', fg: 'mt',    sky: 'moon' },
      { t: 'Jade Falls',     c1: '#07261f', c2: '#0f6b4f', c3: '#9fe0a8', fg: 'wave',  sky: 'sun' },
      { t: 'Sunset Orchard', c1: '#2a1026', c2: '#7a2a56', c3: '#ffb35c', fg: 'mt',    sky: 'sun' },
    ];
    function genPhoto(s) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${s.c1}"/><stop offset=".55" stop-color="${s.c2}"/><stop offset="1" stop-color="${s.c3}"/>` +
        `</linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/>` +
        SKY[s.sky] + FG[s.fg] + `</svg>`;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    const photos = SCENES.map((s, i) => ({
      id: uid(),
      title: s.t,
      date: Date.now() - Math.round(i * 16.5 * DAY),
      img: genPhoto(s),
    }));

    /* ---- likes (persisted by title) ---- */
    let likes = [];
    try { likes = JSON.parse(localStorage.getItem(LIKES_KEY) || '[]') || []; } catch { likes = []; }
    function saveLikes() { try { localStorage.setItem(LIKES_KEY, JSON.stringify(likes)); } catch { /* quota */ } }
    function isLiked(t) { return likes.includes(t); }
    function toggleLike(t) {
      const i = likes.indexOf(t);
      if (i >= 0) likes.splice(i, 1); else likes.push(t);
      saveLikes();
    }

    /* ---- tab / search / album state ---- */
    let tab = 'library';      // library | foryou | albums
    let albumOpen = null;     // album key when browsing an album's grid
    let query = '';

    /* ---- app-scoped styles ---- */
    content.append(el('style', {}, `
      .photos27-view { flex: 1; min-height: 0; overflow-y: auto; }
      .photos27-foryou { padding: 14px; }
      .photos27-h2 { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
      .photos27-section { margin-bottom: 20px; }
      .photos27-mems { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; }
      .photos27-mem { flex: none; width: 240px; border-radius: 14px; padding: 16px; color: #fff; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
      .photos27-mem-sub { font-size: 11px; opacity: .85; letter-spacing: .5px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
      .photos27-mem-title { font-size: 16px; font-weight: 700; }
      .photos27-mem-thumbs { display: flex; gap: 6px; margin-top: 12px; }
      .photos27-mem-thumbs img { width: 56px; height: 40px; border-radius: 6px; object-fit: cover; }
      .photos27-albums { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 14px; }
      .photos27-album { border-radius: 12px; overflow: hidden; background: var(--fill-2); border: 1px solid var(--sep); cursor: pointer; }
      .photos27-album:hover { background: var(--fill-1); }
      .photos27-album-cover { aspect-ratio: 3/2; overflow: hidden; }
      .photos27-album-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .photos27-album-meta { padding: 8px 12px 10px; }
      .photos27-album-title { font-size: 13px; font-weight: 600; }
      .photos27-album-count { font-size: 11px; color: var(--text-3); }
      .photos27-backbar { display: flex; align-items: center; gap: 10px; padding: 10px 14px 0; }
      .photos27-fav { display: flex; flex-wrap: wrap; gap: 10px; }
      .photos27-fav img { width: 96px; height: 64px; border-radius: 8px; object-fit: cover; cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,.25); }
      .photos27-edit { display: flex; flex-direction: column; gap: 14px; }
      .photos27-edit-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      .photos27-edit-row label { font-size: 13px; }
      .photos27-edit-row .slider { flex: 1; }
    `));

    /* ---- layout ---- */
    const root = el('div', { class: 'app-root col' });
    const main = el('div', { class: 'app-main' });
    root.append(main);
    content.append(root);

    /* header tabs + search */
    const segBtns = [];
    const seg = el('div', { class: 'segmented' });
    ['Library', 'For You', 'Albums'].forEach((label, i) => {
      const b = el('button', { class: i === 0 ? 'on' : '' }, label);
      b.addEventListener('click', () => {
        tab = ['library', 'foryou', 'albums'][i];
        albumOpen = null;
        updateSeg();
        render();
        Sound.play('click');
      });
      segBtns.push(b);
      seg.append(b);
    });
    function updateSeg() {
      const ids = ['library', 'foryou', 'albums'];
      segBtns.forEach((b, i) => b.classList.toggle('on', ids[i] === tab));
    }

    const search = el('input', { class: 'field', placeholder: 'Search', spellcheck: false, style: { width: '150px', flex: 'none' } });
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });

    const header = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', flex: 'none', borderBottom: '1px solid var(--sep)' } }, [
      el('span', { class: 'toolbar-title' }, 'Photos'),
      el('span', { class: 'spacer' }),
      search,
      seg,
    ]);

    const view = el('div', { class: 'photos27-view' });

    /* ---- card helpers ---- */
    function photoCard(p) {
      const liked = isLiked(p.title);
      const heart = el('button', {
        title: liked ? 'Unlike' : 'Like',
        style: {
          position: 'absolute', top: '8px', right: '8px', width: '26px', height: '26px',
          borderRadius: '50%', background: 'rgba(0,0,0,.45)', color: liked ? 'var(--danger)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          opacity: liked ? '1' : '0', transition: 'opacity .15s',
        },
        onclick: (e) => { e.stopPropagation(); toggleLike(p.title); render(); Sound.play('pop'); },
      }, liked ? '♥' : '♡');
      const card = el('div', { class: 'photo-card', onclick: () => openLightboxPhoto(p) }, [
        el('img', { src: p.img, alt: p.title, loading: 'lazy' }),
        liked ? el('div', {
          style: {
            position: 'absolute', top: '8px', left: '8px', padding: '2px 9px', borderRadius: '999px',
            background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '11px', fontWeight: '600',
          },
        }, '♥ Liked') : null,
        heart,
        el('div', { class: 'pc-title' }, p.title),
      ]);
      card.addEventListener('mouseenter', () => { heart.style.opacity = '1'; });
      card.addEventListener('mouseleave', () => { if (!isLiked(p.title)) heart.style.opacity = '0'; });
      return card;
    }

    function memoriesHero() {
      return el('div', {
        style: {
          gridColumn: '1 / -1', borderRadius: '12px', padding: '20px 22px',
          color: '#fff', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          background: 'linear-gradient(120deg, #0a5bc4, #6f5bff 55%, #ff5b9e)',
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        },
      }, [
        el('div', { style: { fontSize: '11px', opacity: '.85', letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: '600' } }, 'Memories'),
        el('div', { style: { fontSize: '20px', fontWeight: '700', marginTop: '2px' } }, 'Liquid Summer'),
      ]);
    }

    /* ---- Library ---- */
    function renderLibrary() {
      const grid = el('div', { class: 'photos-grid' });
      const filtered = photos.filter(p => !query || p.title.toLowerCase().includes(query));
      if (!query) grid.append(memoriesHero());
      if (!filtered.length) {
        view.append(el('div', { class: 'empty-state' }, el('span', { class: 'dimmer' }, 'No photos match your search')));
        return;
      }
      filtered.forEach(p => grid.append(photoCard(p)));
      view.append(grid);
    }

    /* ---- For You ---- */
    const MEMORIES = [
      { title: 'Liquid Summer', sub: 'Memories', c: 'linear-gradient(120deg, #0a5bc4, #6f5bff 55%, #ff5b9e)', idx: [4, 2, 0] },
      { title: 'Golden Hour', sub: 'Memories', c: 'linear-gradient(120deg, #3d1a0f, #c96a2e 55%, #f2b26b)', idx: [2, 4, 8] },
      { title: 'Midnight Waves', sub: 'Memories', c: 'linear-gradient(120deg, #081c3a, #0e4d6b 55%, #19b5a0)', idx: [3, 1, 9] },
    ];

    function renderForYou() {
      const wrap = el('div', { class: 'photos27-foryou' });
      wrap.append(el('h2', { class: 'photos27-h2' }, 'For You'));

      const mems = el('div', { class: 'photos27-mems' });
      MEMORIES.forEach(m => {
        const card = el('div', { class: 'photos27-mem', style: { background: m.c } }, [
          el('div', { class: 'photos27-mem-sub' }, m.sub),
          el('div', { class: 'photos27-mem-title' }, m.title),
          el('div', { class: 'photos27-mem-thumbs' },
            m.idx.map(i => el('img', {
              src: photos[i].img, alt: photos[i].title,
              onclick: (e) => { e.stopPropagation(); openLightboxPhoto(photos[i]); },
            }))),
        ]);
        card.addEventListener('click', () => openLightboxPhoto(photos[m.idx[0]]));
        mems.append(card);
      });
      wrap.append(el('div', { class: 'photos27-section' }, [el('h3', { style: { margin: '0 0 10px', fontSize: '15px', fontWeight: '600' } }, 'Memories'), mems]));

      /* Favorites album */
      const favs = photos.filter(p => isLiked(p.title) && (!query || p.title.toLowerCase().includes(query)));
      const favWrap = el('div', { class: 'photos27-fav' });
      if (favs.length) {
        favs.forEach(p => favWrap.append(el('img', {
          src: p.img, alt: p.title,
          onclick: () => openLightboxPhoto(p),
        })));
      } else {
        favWrap.append(el('span', { class: 'dimmer', style: { fontSize: '13px' } }, 'No favorites yet — tap the ♡ on any photo.'));
      }
      wrap.append(el('div', { class: 'photos27-section' }, [
        el('h3', { style: { margin: '0 0 10px', fontSize: '15px', fontWeight: '600' } }, `Favorites · ${likes.length}`),
        favWrap,
      ]));
      view.append(wrap);
    }

    /* ---- Albums ---- */
    function groupPhotos() {
      const groups = new Map();
      for (const p of photos) {
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!groups.has(key)) groups.set(key, { key, title: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), date: p.date, photos: [] });
        groups.get(key).photos.push(p);
      }
      return Array.from(groups.values()).sort((a, b) => b.date - a.date);
    }

    function renderAlbums() {
      if (albumOpen) { renderAlbumGrid(); return; }
      const grid = el('div', { class: 'photos27-albums' });
      const groups = groupPhotos().filter(g => !query || g.title.toLowerCase().includes(query));
      if (!groups.length) {
        view.append(el('div', { class: 'empty-state' }, el('span', { class: 'dimmer' }, 'No albums match your search')));
        return;
      }
      for (const g of groups) {
        const album = el('div', { class: 'photos27-album', onclick: () => { albumOpen = g.key; render(); Sound.play('click'); } }, [
          el('div', { class: 'photos27-album-cover' }, el('img', { src: g.photos[0].img, alt: g.title })),
          el('div', { class: 'photos27-album-meta' }, [
            el('div', { class: 'photos27-album-title' }, g.title),
            el('div', { class: 'photos27-album-count' }, `${g.photos.length} photo${g.photos.length === 1 ? '' : 's'}`),
          ]),
        ]);
        grid.append(album);
      }
      view.append(grid);
    }

    function renderAlbumGrid() {
      const group = groupPhotos().find(g => g.key === albumOpen);
      if (!group) { albumOpen = null; renderAlbums(); return; }
      const filtered = group.photos.filter(p => !query || p.title.toLowerCase().includes(query));
      view.append(
        el('div', { class: 'photos27-backbar' }, [
          el('button', { class: 'btn ghost', onclick: () => { albumOpen = null; render(); Sound.play('click'); } }, '‹ All Albums'),
          el('span', { class: 'toolbar-title' }, group.title),
          el('span', { class: 'dimmer', style: { fontSize: '11px' } }, `${group.photos.length} photos`),
        ]),
        el('div', { class: 'photos-grid', style: { flex: 'none' } },
          filtered.length ? filtered.map(p => photoCard(p))
            : [el('div', { class: 'empty-state' }, el('span', { class: 'dimmer' }, 'No photos match your search'))]),
      );
    }

    function render() {
      view.innerHTML = '';
      if (tab === 'library') renderLibrary();
      else if (tab === 'foryou') renderForYou();
      else renderAlbums();
    }

    /* ---- lightbox ---- */
    let cur = 0;
    const lbImg = el('img', { alt: '' });
    const lbTitle = el('span', { style: { fontSize: '15px', fontWeight: '600', color: '#fff' } });
    const lbDate = el('span', { style: { fontSize: '12px', color: 'rgba(255,255,255,.7)' } });
    const likeBtn = el('button', { class: 'btn', style: { color: '#fff' } });
    const editBtn = el('button', { class: 'btn', style: { color: '#fff' }, onclick: openEditor }, 'Edit');

    const lightbox = el('div', { class: 'lightbox hidden' }, [
      el('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '10px 12px' } }, [
        el('button', { class: 'icon-btn', title: 'Close', style: { color: '#fff' }, html: Icons.glyph('x'), onclick: closeLightbox }),
      ]),
      el('div', { style: { flex: '1', display: 'flex', alignItems: 'center', minHeight: '0', padding: '0 6px' } }, [
        el('button', { class: 'icon-btn', title: 'Previous', style: { color: '#fff' }, html: Icons.glyph('back'), onclick: () => nav(-1) }),
        lbImg,
        el('button', { class: 'icon-btn', title: 'Next', style: { color: '#fff' }, html: Icons.glyph('fwd'), onclick: () => nav(1) }),
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' } }, [
        el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minWidth: '0' } }, [lbTitle, lbDate]),
        editBtn,
        likeBtn,
      ]),
    ]);

    likeBtn.addEventListener('click', () => {
      toggleLike(photos[cur].title);
      renderLikeBtn(); render();
      Sound.play('pop');
    });

    function renderLikeBtn() {
      const liked = isLiked(photos[cur].title);
      likeBtn.textContent = '';
      likeBtn.append(liked ? '♥ Liked' : '♡ Like');
      likeBtn.className = 'btn' + (liked ? ' primary' : '');
      likeBtn.style.color = '#fff';
    }

    /* ---- visual edit placeholder ---- */
    let editBright = 1;
    let editCrop = false;
    function applyEdit() {
      lbImg.style.filter = `brightness(${editBright})`;
      lbImg.style.objectFit = editCrop ? 'cover' : 'contain';
      lbImg.style.transform = editCrop ? 'scale(1.15)' : 'none';
    }
    function openEditor() {
      let handle = null;
      handle = Dialog.sheet(lightbox, () => {
        const bright = el('input', { class: 'slider', type: 'range', min: '50', max: '200', value: String(Math.round(editBright * 100)) });
        bright.addEventListener('input', () => { editBright = bright.value / 100; applyEdit(); });
        const cropSwitch = el('div', { class: 'switch' + (editCrop ? ' on' : '') });
        cropSwitch.addEventListener('click', () => { cropSwitch.classList.toggle('on'); editCrop = cropSwitch.classList.contains('on'); applyEdit(); });
        const panel = el('div', { class: 'sheet-panel glass photos27-edit' }, [
          el('h3', { style: { margin: '0', fontSize: '15px', fontWeight: '600' } }, 'Edit'),
          el('div', { class: 'photos27-edit-row' }, [el('label', {}, 'Brightness'), bright]),
          el('div', { class: 'photos27-edit-row' }, [el('label', {}, 'Crop / zoom'), cropSwitch]),
          el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, [
            el('button', { class: 'btn', onclick: () => handle.dismiss() }, 'Cancel'),
            el('button', { class: 'btn primary', onclick: () => { handle.dismiss(); Sound.play('pop'); } }, 'Done'),
          ]),
        ]);
        return panel;
      });
    }

    function openLightboxPhoto(p) {
      const i = photos.indexOf(p);
      if (i >= 0) openLightbox(i);
    }
    function openLightbox(i) {
      cur = i;
      editBright = 1; editCrop = false;
      updateLightbox();
      lightbox.classList.remove('hidden');
      Sound.play('click');
    }
    function closeLightbox() {
      lightbox.classList.add('hidden');
      Sound.play('close');
    }
    function updateLightbox() {
      const p = photos[cur];
      lbImg.src = p.img;
      lbTitle.textContent = p.title;
      lbDate.textContent = fmtDate(p.date);
      applyEdit();
      renderLikeBtn();
    }
    function nav(d) {
      cur = (cur + d + photos.length) % photos.length;
      updateLightbox();
      Sound.play('click');
    }

    function onKey(e) {
      if (lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') nav(-1);
      else if (e.key === 'ArrowRight') nav(1);
    }
    window.addEventListener('keydown', onKey);

    main.append(header, view, lightbox);
    render();

    return () => window.removeEventListener('keydown', onKey);
  },
});
