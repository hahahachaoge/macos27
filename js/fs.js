/* ============================================================
   macOS 27 — Mammoth · fs.js
   Virtual file system (localStorage-backed) for Finder,
   Terminal, TextEdit and friends.
   Node: { type:'dir'|'file', name, mtime, children?{}, content?, mime?, size? }
   ============================================================ */
'use strict';

const HOME = '/Users/you';

const VFS = (() => {
  const KEY = 'macos27.vfs';
  let root = null;

  function blankRoot() {
    return { type: 'dir', name: 'Macintosh HD', mtime: Date.now(), children: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { root = JSON.parse(raw); return true; }
    } catch { /* fall through to seed */ }
    return false;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(root)); } catch { /* quota */ }
  }

  /* ---- path utils ---- */
  function parts(p) { return String(p || '/').split('/').filter(Boolean); }
  function parent(p) {
    const ps = parts(p);
    ps.pop();
    return '/' + ps.join('/');
  }
  function basename(p) {
    const ps = parts(p);
    return ps[ps.length - 1] || 'Macintosh HD';
  }
  function join(...segs) {
    const all = segs.flatMap(s => parts(s));
    return '/' + all.join('/');
  }
  function norm(p) { return '/' + parts(p).join('/'); }

  function nodeAt(p) {
    if (norm(p) === '/') return root;
    let cur = root;
    for (const seg of parts(p)) {
      if (!cur || cur.type !== 'dir' || !cur.children || !cur.children[seg]) return null;
      cur = cur.children[seg];
    }
    return cur;
  }

  function get(p) { return nodeAt(p); }
  function exists(p) { return nodeAt(p) != null; }

  function ls(p) {
    const n = nodeAt(p);
    if (!n || n.type !== 'dir') return [];
    return Object.values(n.children || {}).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
  }

  function mkdir(p) {
    const dir = nodeAt(parent(p));
    if (!dir) return null;
    const name = basename(p);
    if (dir.children[name]) return dir.children[name];
    dir.children[name] = { type: 'dir', name, mtime: Date.now(), children: {} };
    dir.mtime = Date.now();
    persist();
    emit('fs:change');
    return dir.children[name];
  }

  function write(p, content, mime) {
    const dir = nodeAt(parent(p));
    if (!dir) return null;
    const name = basename(p);
    const node = dir.children[name] || { type: 'file', name };
    node.type = 'file';
    node.content = String(content ?? '');
    node.mime = mime || node.mime || 'text/plain';
    node.size = new Blob([node.content]).size;
    node.mtime = Date.now();
    dir.children[name] = node;
    dir.mtime = Date.now();
    persist();
    emit('fs:change');
    return node;
  }

  function read(p) {
    const n = nodeAt(p);
    return n && n.type === 'file' ? n.content : null;
  }

  function rm(p) {
    const dir = nodeAt(parent(p));
    if (!dir || !dir.children[basename(p)]) return false;
    delete dir.children[basename(p)];
    dir.mtime = Date.now();
    persist();
    emit('fs:change');
    return true;
  }

  function trash(p) {
    const n = nodeAt(p);
    if (!n) return false;
    const trashDir = mkdir(HOME + '/.Trash');
    const name = basename(p);
    if (trashDir.children[name]) { /* collision — unique-ify */ }
    rm(p);
    trashDir.children[name] = Object.assign(n, { trashedFrom: p, mtime: Date.now() });
    persist();
    emit('fs:change');
    return true;
  }

  function rename(p, newName) {
    const dir = nodeAt(parent(p));
    if (!dir || !dir.children[basename(p)]) return false;
    if (dir.children[newName]) return false;
    const node = dir.children[basename(p)];
    delete dir.children[basename(p)];
    node.name = newName;
    node.mtime = Date.now();
    dir.children[newName] = node;
    persist();
    emit('fs:change');
    return true;
  }

  function move(from, toDir) {
    const n = nodeAt(from);
    const dir = nodeAt(toDir);
    if (!n || !dir || dir.type !== 'dir' || dir === n) return false;
    if (dir.children[n.name]) return false;
    rm(from);
    dir.children[n.name] = n;
    dir.mtime = Date.now();
    persist();
    emit('fs:change');
    return true;
  }

  /* walk entire tree (for Spotlight) */
  function walk(dir = root, acc = [], path = '') {
    for (const [name, node] of Object.entries(dir.children || {})) {
      const p = path + '/' + name;
      acc.push({ node, path: p });
      if (node.type === 'dir') walk(node, acc, p);
    }
    return acc;
  }

  /* ---- seed content ---- */
  const svgImg = (c1, c2, c3, scene) => `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
      <rect width="900" height="600" fill="url(#g)"/>${scene}</svg>`)}`;

  const MOUNTAINS = `<circle cx="700" cy="120" r="46" fill="#ffe9b0" opacity=".9"/>
    <path d="M0 600 L180 220 L330 420 L520 160 L900 600 Z" fill="#1c2a4d" opacity=".55"/>
    <path d="M0 600 L260 300 L420 470 L640 240 L900 600 Z" fill="#101a38" opacity=".75"/>`;
  const WAVES = `<path d="M0 380 q60 -40 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 v220 H0 Z" fill="#0e2a4a" opacity=".6"/>
    <path d="M0 430 q60 -40 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 v170 H0 Z" fill="#081a33" opacity=".8"/>`;
  const SUN = `<circle cx="450" cy="260" r="120" fill="#ffd9a0" opacity=".85"/>`;
  const STARS = `<circle cx="120" cy="90" r="2.5" fill="#fff" opacity=".9"/><circle cx="420" cy="60" r="2" fill="#fff" opacity=".7"/><circle cx="680" cy="140" r="2.5" fill="#fff" opacity=".8"/><circle cx="820" cy="80" r="1.8" fill="#fff" opacity=".7"/><circle cx="240" cy="180" r="2" fill="#fff" opacity=".6"/>`;

  function seed() {
    root = blankRoot();
    const t = Date.now();
    const mk = (p) => mkdir(p);
    ['/Users', '/Users/you', '/Users/you/Desktop', '/Users/you/Documents', '/Users/you/Downloads',
     '/Users/you/Pictures', '/Users/you/Music', '/Users/you/Movies', '/Users/you/.Trash',
     '/Applications', '/System'].forEach(mk);

    write(HOME + '/Desktop/Welcome to macOS 27.md',
`# Welcome to macOS 27

Hello, and welcome to **macOS 27 "Mammoth"** — the most liquid version of the Mac yet.

## Liquid Glass
Every window, menu and panel on this desktop is made of *Liquid Glass*: a real,
GPU-computed material. It blurs what is behind it, refracts the wallpaper through
a live displacement field, samples the wallpaper's color to tint its surface, and
catches light along a specular hairline rim. Drag a window across the wallpaper
and watch the glass drink in the colors around it.

## DeepSeek V4 Pro
This Mac ships with **Intelligence** — an assistant powered by DeepSeek V4 Pro.
Open it from the Dock (the glowing orb) or press ⌘Space and type a question.
To connect the full model, add your DeepSeek API key in
System Settings → Intelligence.

## Things to try
- Drag windows over the wallpaper and watch the tint change.
- Open **System Settings → Liquid Glass** and play with the material.
- Press **⌘Space** for Spotlight, **⌘Tab** to switch apps.
- Open the **Terminal** and type \`neofetch\`.
- Turn on **Liquid Radio** in Music for generative audio.

Have fun — and remember: it's not frosted. It's *liquid*.`, 'text/markdown');

    write(HOME + '/Documents/Liquid Glass Design.txt',
`Liquid Glass — design notes
===========================

1. Transparency is not the feature. Depth is. A surface should tell you
   what is behind it, not hide it.
2. Light is a material. The hairline rim, the specular sweep, the
   edge glow — together they read as "glass", not "blur".
3. The glass adapts. Sample the scene behind each surface and tint it.
   A window over the sunset should glow warm; over the sea, cool.
4. Refraction, when possible, is the soul. This recreation warps the
   wallpaper through an animated SVG displacement field beneath every
   window. It's subtle — and that's the point.
5. Respect the user. Reduce Transparency, Reduce Motion and Dark Mode
   must always be one toggle away.

— DeepSeek V4 Pro, design lead for the day`, 'text/plain');

    write(HOME + '/Pictures/Aurora Lake.svg', svgImg('#0a1230', '#2a1a5e', '#0b3a5c', STARS + MOUNTAINS), 'image/svg+xml');
    write(HOME + '/Pictures/Tahoe Sunrise.svg', svgImg('#2a0f3d', '#b3476e', '#f7a35c', SUN + MOUNTAINS), 'image/svg+xml');
    write(HOME + '/Pictures/Neon Tide.svg', svgImg('#081c3a', '#0e4d6b', '#19b5a0', WAVES), 'image/svg+xml');
    write(HOME + '/Pictures/Golden Mammoth.svg', svgImg('#3d1a0f', '#c96a2e', '#f2b26b', SUN + WAVES), 'image/svg+xml');

    write(HOME + '/Downloads/LiquidGlass-DesignKit.dmg', 'BZh91AY&SY… (binary blob, no really)', 'application/x-apple-diskimage');

    write('/System/About This Mac.txt',
`macOS 27 "Mammoth" — Version 27.0 (Build 27A520)
Kernel: Liquid Glass 27.0.1
Chip: DeepSeek V4 Pro (Neural Engine: built-in Intelligence)
Memory: 128 GB unified
Startup disk: Macintosh HD
This machine runs entirely inside your browser tab.`, 'text/plain');

    persist();
    Settings.set('booted', true);
  }

  if (!load() || !root) seed();

  /* expose app listings as virtual filesystem entries */
  function appEntries() {
    return Object.values(M27.apps).filter(a => !a.hidden)
      .map(a => ({ type: 'app', appId: a.id, name: a.name, icon: a.icon, mtime: Date.now() }));
  }

  return {
    get, exists, ls, mkdir, write, read, rm, trash, rename, move, walk,
    join, parent, basename, norm, rootNode: () => root,
    apps: appEntries, reset() { localStorage.removeItem(KEY); seed(); },
  };
})();

/* notify when apps register → finder /Applications stays fresh */
on('app:registered', () => emit('fs:change'));
