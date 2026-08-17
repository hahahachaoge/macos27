# macOS 27 “Mammoth” · User Guide (English)

> 🌐 **Language / 语言：** [中文](使用说明.md) · [English](使用说明_EN.md)

A complete macOS 27 desktop system that runs entirely in your browser — a real **Liquid Glass**
material system, 14 “native” apps, and a built-in **Intelligence** assistant powered by
**DeepSeek V4 Pro**. Nothing to install: no frameworks, no external assets, no build step.

## ✨ New in this edition — feature overview

- **Windows**: real full screen (green button / `F11`; menu bar & Dock auto-hide and slide back in
  on hover); `⌘H` hides the active app; drag-to-edge split snapping; **window layout is restored
  after reload**; multiple desktops (**Spaces**, `Ctrl+←/→`, or “+” in Mission Control).
- **Menu bar**: arrow-key navigation in menus; a real Edit menu (Undo/Cut/Copy/Paste).
- **Notification Center**: click the menu-bar clock — today’s schedule, notifications, Do Not
  Disturb, clear-all; the clock shows an unread badge.
- **Dock**: drag icons to reorder, right-click Keep in Dock / Remove, a Recently Used section.
- **Spotlight**: unit conversion (`10 km to miles`), full-text search, quick actions, search history.
- **Finder**: column view, Space for Quick Look, whole-Mac search, color tags, Recents,
  copy/cut/paste, multi-select.
- **Safari**: bookmarks / history / reading-list sidebar, private browsing. **Notes**: rich text,
  folders, export, lock. **Mail**: draft autosave, search, forward, VIP. **Messages**: search,
  delete, Tapback reactions, image attachments.
- **Calendar**: month / week / day views, inline event editing, all-day & repeating events, search.
  **Photos**: Albums / For You / search / edit placeholder.
- **Music**: shuffle / repeat, favorites, 3-band equalizer. **Calculator**: scientific mode,
  history. **Terminal**: multi-session tabs, pipes & redirects, `grep/find/wc`, and more.
- **System Settings**: new Wi-Fi / Bluetooth / Displays / Notifications / Keyboard / Trackpad /
  Battery / Apple Account panes.
- **Intelligence**: conversation history, stop generation, copy-code buttons, in-app model &
  temperature switching, reply latency readout.

---

## 1. Getting started

**Option 1 (simplest):** double-click `index.html` — no server needed.

**Option 2 (recommended):** use the built-in zero-dependency server:

```bash
cd macos27
node serve.js
```

Then open **http://localhost:8080** in your browser.

**Option 3:** any static server you already have:

```bash
python -m http.server 8080
# or
npx serve .
```

> Browser requirements: latest **Chrome / Edge / Safari** (needs `backdrop-filter` and SVG filters).
> Firefox works for most things, but some glass paths lose their backdrop tint.

---

## 2. Boot flow

1. **Boot screen** — Apple logo + progress bar (~3 s).
2. **Lock screen** — large clock and date. Click anywhere (or press Enter / Space) to unlock; a
   chime plays.
3. **First run** — the “Welcome to macOS 27” window and Finder open automatically, plus a
   shortcut tip. You can hit “Skip tour”.

---

## 3. Liquid Glass — the heart of this project

This is not ordinary frosted glass; it’s a live material system:

- **Real refraction** — an animated SVG displacement field warps the wallpaper *through* every
  window, like a real lens;
- **Adaptive tinting** — windows sample the wallpaper color behind them several times per second,
  so glass over a sunset glows warm and glass over the sea runs cool;
- **Backdrop blur + saturation + brightness** composited per surface;
- **Specular hairline rims** and a sheen that follows focus.

**Try it:**

1. Open **System Settings → Liquid Glass**;
2. Drag the **Blur radius / Saturation / Brightness / Tint strength** sliders — the *entire OS*
   updates live;
3. Try the presets: Default / Heavy / Crisp / Flat (no glass);
4. Toggle **Refraction** off to compare with a non-lens blur;
5. Turn on **Reduce Transparency** for a flat, energy-friendly look.

Other entrances: the Apple menu → Liquid Glass group; the Liquid Glass switch in Control Center;
or `glass off` / `glass on` in Terminal.

---

## 4. Desktop & system components

| Component | What it does |
| --- | --- |
| **Menu bar** | Apple menu (About This Mac, System Settings, Sleep, Restart, Shut Down, Reset Demo Data); current app’s menus in the middle; Wi-Fi, battery, Spotlight, Control Center and the clock on the right |
| **Dock** | Icons magnify as the cursor passes; running apps show a dot; click Trash to open the bin; right-click icons for a menu |
| **Windows** | Drag the title bar to move (drag to screen edges to **snap**: left / right half / top maximize); drag edges or corners to resize; double-click the title bar to zoom; red / yellow / green = close / minimize (flies to Dock) / full screen |
| **Spotlight** | `⌘Space` — search apps, files, **do math**, run system commands, jump to a web search |
| **Control Center** | The double-pill icon top-right: Wi-Fi / Bluetooth / AirDrop / Focus modes / Dark Mode / Liquid Glass / Widgets, plus brightness & volume sliders and music controls |
| **Launchpad** | The rocket in the Dock (or Window → Launchpad): a full-screen grid of every app, with search |
| **Mission Control** | All windows scale into a live grid; click one to focus; add desktops with “+” |
| **App switcher** | Hold `⌘Tab` to cycle apps (`⇧⌘Tab` reverses) |
| **Widgets** | Right side of the desktop: clock (analog + digital), calendar, weather (the weather follows the wallpaper!). Right-click to edit / remove |
| **Desktop icons** | Macintosh HD, Documents, the welcome file, Trash; drag to arrange; right-click for a menu |

---

## 5. The built-in apps

| App | What it does |
| --- | --- |
| **Finder** | A real **virtual file system** (persisted). Sidebar favorites, icon grid / list / column views, back/forward, rename, new folder, drag & drop, Move to Trash, Get Info, Quick Look, tags, Recents, copy/cut/paste, multi-select. Double-click opens documents and images |
| **Safari** | Tabbed browsing with bookmarks, history and a reading list. Pages load in a sandboxed iframe; **many sites refuse to be embedded**, so use the “Open ↗” button to open them in a real tab |
| **Notes** | Search, pin, recently deleted, rich-text editor with autosave (`⌘N` for a new note), folders, export, lock |
| **Mail** | Three panes: folders (Inbox / Starred / Sent / Drafts / Trash), list, reader; compose, reply, forward, star, archive; **draft autosave**; search; VIP (6 seeded emails) |
| **Messages** | iMessage-style chat. Mom / Alex / Apple reply after a typing indicator; the **Intelligence** contact answers with DeepSeek V4 Pro for real |
| **Calendar** | Month / week / day views, today highlighted, event chips, inline add/edit/delete, all-day & repeating events, search |
| **Photos** | 12 procedurally generated “photos”, hover titles, lightbox with prev/next, likes, Albums & For You, search, edit placeholder |
| **Music** | **Liquid Radio** — a generative station: 5 tracks fully synthesized live with WebAudio (zero audio files) — arpeggios, bass, pads, feedback delay + reverb, live spectrum visualizer, shuffle/repeat, favorites, EQ |
| **Calculator** | Arithmetic, parentheses, percents, keyboard input, scientific mode, history, copy result; Spotlight can calculate too |
| **Terminal** | A real shell over the virtual file system. Multi-session tabs, tab-completion, pipes & redirects. See commands below |
| **TextEdit** | Open / edit / save `.txt` and `.md` files (`⌘S` to save); plain & rich modes, word count, print |
| **Preview** | Image viewer with zoom, fit, rotate, prev/next |
| **System Settings** | Appearance, Wallpaper, Liquid Glass studio, Intelligence (DeepSeek config), Wi-Fi, Bluetooth, Displays, Notifications, Keyboard, Trackpad, Battery, Apple Account, Sound, About |
| **About This Mac** | Includes a clickable live Liquid Glass demo card |

### Terminal cheat sheet

```bash
help                  # list commands
ls / cd / pwd / cat   # browse the virtual file system
open -a Finder        # open an app (also: open <filename>)
mkdir / touch / rm    # create / delete files
neofetch              # easter egg: system info (incl. DeepSeek V4 Pro)
wallpaper aurora      # switch wallpaper (tahoe/mammoth/aurora/sequoia/mono)
glass off             # disable Liquid Glass
music play            # control the music
deepseek <question>   # ask DeepSeek V4 Pro directly
say <text>            # speak via the browser’s speech synthesis
sudo rm -rf /         # Tim will be notified 😄
```

---

## 6. Connecting DeepSeek V4 Pro (important)

The built-in **Intelligence** ships with an **offline demo brain**, so you can chat without any
setup (ask it to explain Liquid Glass, tell a joke…). To unlock the full model:

1. Open **System Settings → Intelligence**;
2. Fill in:
   - **Endpoint**: defaults to `https://api.deepseek.com`; any OpenAI-compatible URL works;
   - **Model**: defaults to `deepseek-v4-pro`; pick `deepseek-chat` for the public flagship, or
     `deepseek-reasoner` for reasoning (use v4-pro if your endpoint exposes it);
   - **API key**: paste your key (stored only in this browser’s localStorage — **it never leaves
     your browser**; requests go only to the endpoint you configured);
3. Press **Test connection** — you’ll see latency and connectivity;
4. The real model now powers:
   - the **Intelligence** app (the glowing orb in the Dock / search “intelligence” in `⌘Space`)
     with streaming output;
   - the **Intelligence** contact in **Messages**;
   - the `deepseek <question>` command in **Terminal**.

---

## 7. Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `⌘Space` (`Ctrl+Space` on Windows) | Spotlight |
| `⌘Tab` / `⌘⇧Tab` | App switcher |
| `⌘W` / `⌘M` / `⌘N` | Close window / minimize / new window |
| `⌘H` / `⌥⌘H` | Hide app / hide others |
| `⌘,` | System Settings |
| `⌘⇧3` | **Screenshot saved to the Desktop** (a real `Screenshot xx.png` file) |
| `F11` (`⌃⌘F` on macOS) | Enter / exit full screen |
| `Ctrl+←/→`, `Ctrl+1..9` | Switch desktop Spaces |
| `Esc` | Exit full screen / close overlays & menus |

> The project follows macOS conventions, but on Windows `⌘` maps automatically to `Ctrl`.

---

## 8. Data storage & reset

- All data lives in the browser’s **localStorage** under keys prefixed `macos27.`
  (settings, virtual file system, notes, mail, messages, calendar, photo likes, chat history…);
- Wallpapers, music, photos and icons are all **generated live in code** — zero external files;
- Factory reset: **Apple menu → Reset Demo Data…**, confirm, and everything is wiped and rebooted;
- Data does not persist across sessions in incognito / private mode.

---

## 9. FAQ

**Q: The page is black?**
A: Wait ~3 s for the boot bar, then click the lock screen to unlock. If it stays black, use Chrome / Edge.

**Q: The glass looks flat / solid?**
A: The browser doesn’t support `backdrop-filter`, or “Enable Liquid Glass” is off in
System Settings → Liquid Glass.

**Q: Safari shows a blank page?**
A: That’s normal — many sites block embedding via `X-Frame-Options`/CSP. Use the “Open ↗” button
to open the page in a real browser tab.

**Q: Intelligence can’t answer complex questions?**
A: You’re in offline demo mode. Configure a DeepSeek API key as in section 6.

**Q: Music has no sound?**
A: Browsers block autoplay — click the play button once (a user gesture) and it plays from then on.

**Q: Want to calm things down / save energy?**
A: System Settings → Appearance → enable **Reduce Motion** (freezes the wallpaper), and combine
with **Reduce Transparency** for a lightweight mode.

---

Have fun — and remember: it’s not frosted. It’s **liquid**. ✨
