# macOS 27 App Spec — for app builders

You are building apps for **macOS 27 "Mammoth"**, a browser-based macOS recreation with a
Liquid Glass design system. The desktop shell (window manager, dock, menu bar, wallpaper,
glass engine) is already complete. Your job: write **only the files assigned to you**,
following the conventions below exactly.

## Project layout (already exists — read before writing)

```
macos27/
  index.html          (already includes <script src="js/apps/<your files>"> — DO NOT edit)
  css/base.css        (design tokens, .btn/.field/.switch/.slider/.segmented/.list-item/.chip/.badge)
  css/apps.css        (all app styles, incl. YOUR app's classes — use them, don't redefine)
  css/glass.css css/shell.css
  js/util.js          (el, $, $$, uid, clamp, esc, debounce, cmd(e), emit/on, M27.register)
  js/store.js         (Settings.get/set — persistent, fires 'settings:*' events)
  js/fs.js            (VFS virtual filesystem)
  js/icons.js         (Icons.glyph(name), app icons)
  js/sound.js         (Sound.play('click'|'open'|'close'|'ding'|'sent'|'trash'|'error'|'pop'))
  js/ui.js            (Toast.show(msg,{icon,ms}), ContextMenu.show(x,y,items), Dialog.alert/sheet)
  js/wm.js            (WM.open/close/focus/find — windows)
  js/assistant.js     (DeepSeek.chat/quick/test/configured, OfflineBrain.reply, md.render)
  js/apps/notes.js    (READ THIS FIRST — it is the canonical app template)
```

**IMPORTANT — read these files first**: `js/util.js`, `js/apps/notes.js`, `css/apps.css`,
`css/base.css`, `js/icons.js`. Everything you need is in them.

## Hard rules

1. Create ONLY your assigned files under `js/apps/`. Never edit shared files (index.html, css, js/*).
2. Classic scripts, no ES modules, no imports, no build step, **no external libraries or CDNs**.
   No fetch to external APIs except `DeepSeek.quick()` (already provided). Everything
   (images, icons, audio) must be generated procedurally.
3. `'use strict';` at top is fine. Globals are shared across scripts: `el`, `$`, `$$`, `uid`,
   `clamp`, `esc`, `debounce`, `emit`, `on`, `Settings`, `VFS`, `WM`, `Glass`, `Wallpaper`,
   `Icons`, `Sound`, `Toast`, `ContextMenu`, `Dialog`, `DeepSeek`, `OfflineBrain`, `md`, `M27`.
4. Persist user data via localStorage keys prefixed `macos27.` (e.g. `macos27.mail`), with
   try/catch, and seed nice demo content on first run.
5. All UI text must survive light & dark themes: use `var(--text-1/2/3)`, `var(--fill-1)`,
   `var(--hover)`, `var(--sep)`, `var(--accent)` — never hardcode colors for text.
6. No inline `style` attributes for layout/colors unless unavoidable; prefer the classes in
   css/apps.css.
7. Register with `M27.register({...})` at file top level. The window mount signature is:

```js
M27.register({
  id: 'myapp', name: 'My App', icon: Icons.xxx(),        // icon MUST be an SVG string
  width: 800, height: 560, minW: 320, minH: 220,
  resizable: true, single: false,                         // single=true: one window max
  menus: () => [ { label:'File', items:[ {label:'…', shortcut:'⌘N', action(win){…}}, {sep:true} ] } ],
  mount({ win, el, content, toolbar, args, setTitle }) {
    // content: .win-content div (flex column). toolbar: .win-toolbar (hidden if left empty).
    // Build your UI with el(). Return an optional cleanup function.
    return () => { /* cleanup */ };
  },
});
```

`content` already has `overflow:hidden; display:flex; flex-direction:column`.
Build your app as: `const root = el('div', { class: 'app-root' }); content.append(root);`
Put sidebar in `el('div', { class:'app-sidebar' })`, main area in `el('div', { class:'app-main' })`.

## Shared building blocks

- `el(tag, {class, style, onclick, oninput, value, type, placeholder, html}, ...children)`
  — children can be strings, nodes, arrays, or null.
- `Icons.glyph(name)` returns an SVG string sized by CSS (15px default). Available names:
  `search wifi battery cc sun moon bt airdrop focus play pause next prev volume gear info
  back fwd refresh plus trash star share x send grid list folder doc image music pin pencil
  clock check mic eye`.
- App icons already exist: `Icons.mail() Icons.messages() Icons.calendar() Icons.photos()
  Icons.music() Icons.safari()`.
- `Toast.show('message', { icon: 'check' })` for feedback.
- `Sound.play('sent')` on send, `Sound.play('click')` on nav, `Sound.play('trash')` on delete.
- `Dialog.sheet(win.el, () => panelEl)` for compose/new-item sheets (see finder.js Get Info).
- `ContextMenu.show(x, y, items)` — items: `{label, shortcut, icon, danger, disabled, checked, sep:true, action()}`.
- `fmtDate(ts)` formats dates; `fmtBytes(n)` sizes; `cmd(e)` is true when Cmd/Ctrl held.
- `Settings.get('accent')` is the accent color; text via CSS vars only.
- `DeepSeek.quick(prompt, system)` → returns reply string or `null` (caller falls back to
  `OfflineBrain.reply(text)` or its own canned pool). `DeepSeek.configured()` → bool.

## Design language checklist (quality bar)

- Apple-clean: generous padding, 13px base font, rounded corners (8–14px), subtle separators
  (`border: 1px solid var(--sep)`), nothing shouting.
- Empty states with `.empty-state`; counts in sidebars; hover states via `.sb-item:hover` etc.
- Subtle entrance: elements with `animation: pop-in .18s` are already applied by CSS classes
  (`.bubble`, `.lp-app`); don't hand-roll animation libraries.
- Everything must work when the window is resized; flex layouts, `overflow-y: auto` on lists.
- Test mentally for: no key, double-clicks, delete then re-seed, empty lists, light mode.

## Your assignment

### Files: (assigned per agent below)

---

### AGENT A — `js/apps/mail.js` + `js/apps/messages.js`

**Mail** (`Icons.mail()`, 1080×680). Three-pane: sidebar (Inbox / Starred / Sent / Drafts /
Trash with counts, class `.app-sidebar` + `.sb-item`), message list (`.mail-row`, classes
`unread`, `sel` — grid `20px 1fr auto`; columns: star icon, from+subject stacked, time;
use `.ml-from .ml-subj .ml-time`), reading pane (`.mail-reader`, h2 + `.mr-meta` + `.mr-body`
with basic HTML). Toolbar: New Message (sheet compose: To/Subject/body via `Dialog.sheet`,
Send → adds to Sent folder + `Sound.play('sent')` + toast), Reply (opens compose prefilled),
Archive→Trash, Delete, Star toggle. Seed 6 polished emails in `macos27.mail`
(Welcome to macOS 27 / from DeepSeek — "Your Intelligence is ready" / Liquid Glass design
session / WWDC keynote / iCloud storage / a friendly note from Alex). Unread dot. Persist all
folder moves. `menus()` optional.

**Messages** (`Icons.messages()`, 960×640). Left contact list (avatar circle with initials,
gradient backgrounds; name + last message preview + time; `.app-sidebar` + `.notes-item`-like
rows — reuse `.notes-item`). Right: thread (`.msgs-thread`, bubbles `.bubble.me` (accent
gradient, right) / `.bubble.them` (glass, left), time via `.b-time`), input row (`.msgs-input`
with rounded `.field` + send icon-btn), typing indicator (`.typing-dots` with 3 spans).
Contacts (seed + persistence in `macos27.messages`):
- Mom, Alex, Apple (scripted replies: pick from 3–5 varied per-contact canned responses after
  a 900–1800ms typing indicator; make them feel alive, e.g. Alex: "yo the glass effect on
  that window is unreal 🤯").
- **Intelligence** (DeepSeek V4 Pro): reply via `DeepSeek.quick(text, system)` with system
  prompt "You are 'Intelligence', a contact in Messages on macOS 27. Reply like a clever,
  warm friend — short texts, occasional emoji, no markdown." Fallback: `OfflineBrain.reply`
  when unconfigured. Show a tiny "DeepSeek V4 Pro" badge on that contact.
New chat button → sheet to pick contact. Send → `Sound.play('sent')`.

---

### AGENT B — `js/apps/calendar.js` + `js/apps/photos.js`

**Calendar** (`Icons.calendar()`, 980×660). Left: month grid (`.cal-grid` 7 cols; `.cal-head`
weekday labels; `.cal-day` cells min-height 64px with `.cd-num` day number; `.today` gets
accent circle; `.other` dims days outside month; events as `.cd-ev` chips — max 3 + "+n").
Right: `.cal-side` panel — selected day heading, events list, "New Event" button → inline
form (title + time) adds to `macos27.calendar` (persist, seed several events around today,
e.g. "Liquid Glass design review", "Ship macOS 27", "Dinner with Alex"). Toolbar: ‹ › month
nav + "Today" + month-year title. Click day selects it. Event chip click → highlight in side
panel. Deleting events supported (trash icon on side-panel rows).

**Photos** (`Icons.photos()`, 1020×660). Header tabs (Library / For You / Albums — Library
only functional, others toast "coming in a point release"). Grid `.photos-grid` of `.photo-card`
(3:2, generated SVG data-URI "photos" — write a small deterministic generator: gradient sky +
mountain/wave/sun/stars scenes, 12 unique titles like "Aurora Lake", "Tahoe Sunrise" with
dates spread over recent months; reuse the style of `VFS`'s seeded images). Hover shows
`.pc-title` overlay. Click → `.lightbox` (absolute inset 0 within window content) with big
image, ‹ › nav, title + date footer, close ✕ (Esc too). Heart button toggles a small "♥
Liked" badge (persist `macos27.photos.likes`). Memory header card at top of Library with a
gradient + "Memories · Liquid Summer".

---

### AGENT C — `js/apps/music.js` + `js/apps/safari.js`

**Music** (`Icons.music()`, 1040×680). MUST export a global:
`MusicPlayer = { play(), pause(), toggle(), next(), prev(), nowPlaying() /*string*/, isPlaying() /*bool*/, volume(v) }`
— the Control Center already calls these. Sidebar (Listen Now / Radio / Songs — all scroll
the same view). "Listen Now": hero card "Liquid Radio" (generative station) + track list
(`.music-track`, `.playing` highlights current; art canvas, title, artist, duration).
Bottom player bar (`.music-player`): artwork canvas (`.music-art` — draw gradient per track),
title/artist (`.music-meta` → `.mm-title`/`.mm-artist`), prev/play/next buttons (`.icon-btn` +
`Icons.glyph('prev'|'play'|'pause'|'next')`), progress (simple `<input type=range>` styled
`.slider`, shows elapsed), volume slider, and a live visualizer canvas (`.music-vis`, 120×34
— bars from an `AnalyserNode`, accent-colored).

**Audio engine (no assets!)**: WebAudio, lookahead scheduler (setInterval ~25ms scheduling
ahead by 0.12s), 5 tracks each defined by: name, artist, bpm, scale (frequencies array),
chord progression (arrays of scale indices), arpeggio pattern, pad layer (soft sine/triangle
chords with slow attack), plus a feedback delay (`DelayNode` 0.28s, feedback 0.35) and a
convolver reverb from a generated noise impulse (2s exponential decay) for a lush feel.
Track names: "Glass Sky", "Tahoe Dawn", "Neon Orchard", "Midnight Haze", "Silicon Bloom"
(artist: "Liquid Radio" or fun AI-ish names). Each track ~96s loop. next()/prev() cycle.
Autoplay is blocked until a user gesture — create/resume the AudioContext on first play;
handle suspended state. Pause = suspend or stop scheduler + gain ramp. Show state on the
play button (swap play/pause glyphs).

**Safari** (`Icons.safari()`, 1100×700). Tab strip (`.safari-tabs`: `.safari-tab` with
`.st-title` + `.st-close` ✕, `.on` = active, "+" new tab). Toolbar row: back/fwd
(`Icons.glyph('back'|'fwd')`), refresh, address `.field` (flex 1; Enter navigates; normalize
input: add `https://` if missing; show hostname in tab title), "open in real browser" button
(`window.open(url)`). Content (`.safari-page`): if the tab has a URL → `<iframe
class="safari-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups">`
— remember many sites refuse embedding (X-Frame-Options), so always show a slim note bar
above the frame: "Some sites refuse to be embedded — ↗ open in a new tab" with the
open-external button. No URL → start page (`.safari-start`): "Favorites" grid (`.safari-favs`
→ `.safari-fav` with colored `.sf-dot` initial circles): Wikipedia, MDN, OpenStreetMap,
Example.com, Archive.org, W3C. Plus a `.safari-note` paragraph about the embedded-frame
limitation and that this is a demo browser. Per-tab history arrays for back/forward.
Tab close with `.st-close` click. New tab opens start page.

---

## Definition of done (for every file)

- `node --check` clean (no syntax errors) — run it if node is available.
- Registers exactly once at top level; icon is a string; mount returns cleanup or nothing.
- No references to undefined globals other than the ones listed above (check spellings:
  `Wallpaper` not `wallpaper`, `DeepSeek`, `OfflineBrain`, `ContextMenu`, `Toast`, `Dialog`).
- Report: what you built, exported globals, localStorage keys, and any deviations.
