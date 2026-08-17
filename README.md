# macOS 27 — “Mammoth” · Liquid Glass in your browser

> 🌐 **Language / 语言：** [English](README.md) · [中文](README.zh-CN.md)

A complete macOS desktop recreation that runs entirely in the browser — no frameworks,
no assets, no build step. Every pixel of glass is computed live, and the built-in
**Intelligence** assistant runs on **DeepSeek V4 Pro**.

## ✨ What's inside

**Real Liquid Glass** — this is the centerpiece:
- **Live refraction** — an animated SVG displacement field warps the wallpaper *through*
  every window, like a real lens (not just blur).
- **Adaptive tinting** — each window samples the wallpaper behind it 5×/second and
  re-tints its surface, so glass over the sunset glows warm.
- **Backdrop blur + saturation + brightness** composited per surface.
- **Specular hairline rims** and a sweeping sheen that follows focus.
- Every material parameter is a live CSS custom property — the System Settings sliders
  re-render the whole OS in real time.

**The shell**
- Boot screen → Lock screen → Desktop (with a first-run Welcome tour)
- Menu bar with Apple menu, per-app menus, live clock, Control Center
- Dock with magnification, running indicators, launch bounce, Trash
- Window manager: drag, resize, snap (left/right/top), zoom, minimize-to-dock
- Spotlight (⌘Space) — apps, files, calculator, system commands, web search
- Launchpad, Mission Control (live-scaled windows), Cmd+Tab switcher
- Widgets (clock, calendar, weather), toasts, context menus, dialogs
- Procedural UI sounds (WebAudio) — boot chime, whooshes, dings
- 5 live-generated wallpapers (Tahoe, Mammoth, Aurora, Sequoia, Mono)

**Native apps**
- **Finder** — real virtual file system (persisted), grid/list views, rename, new folder,
  trash, drag & drop, Get Info, search
- **Intelligence** — DeepSeek V4 Pro chat with SSE streaming + offline demo brain
- **System Settings** — appearance, wallpaper, Liquid Glass studio, DeepSeek config, sound
- **Terminal** — `neofetch`, `ls`, `cat`, `open`, `deepseek <prompt>`, tab completion…
- **Safari** — tabs, favorites, embedded browsing (with an "open externally" escape hatch)
- **Notes, Mail, Messages, Calendar, Photos, Music** (generative Liquid Radio with WebAudio
  synth engine), **Calculator, TextEdit, Preview, About This Mac**

## 🚀 Run it

Any static server works, or just open `index.html` directly:

```bash
# option 1 — double-click index.html (works, no server needed)

# option 2 — tiny built-in server (Node only, zero dependencies)
node serve.js            # → http://localhost:8080

# option 3 — anything you already have
python -m http.server 8080
npx serve .
```

Modern Chrome / Edge / Safari required (needs `backdrop-filter` and SVG filters).
Firefox works but without per-surface backdrop tinting in some paths.

## 🧠 Connect DeepSeek V4 Pro

The assistant ships with a witty offline brain so the demo works anywhere.
To unlock the real model:

1. Open **System Settings → Intelligence**
2. Set the endpoint (default `https://api.deepseek.com`), pick a model
   (`deepseek-chat` is the public flagship; select `deepseek-v4-pro` if your endpoint
   exposes it), and paste your API key
3. Press **Test connection** — you'll get a latency readout, then chat away

The key never leaves your browser (stored in localStorage, sent only to the endpoint
you configure). Without a key, Messages' “Intelligence” contact and Terminal's
`deepseek` command fall back to the offline brain automatically.

## ⌨️ Shortcuts

| Keys | Action |
| --- | --- |
| `⌘Space` (Ctrl+Space) | Spotlight（含单位换算 / 全文搜索 / 快捷操作 / 历史） |
| `⌘Tab` / `⌘⇧Tab` | App switcher |
| `⌘W` `⌘M` `⌘N` `⌘,` | Close / minimize / new window / settings |
| `⌘H` / `⌥⌘H` | Hide app / hide others |
| `⌘⇧3` | Screenshot → saved to Desktop (yes, really) |
| `F11` (mac: `⌃⌘F`) | Enter/exit full screen |
| `Ctrl+←/→`, `Ctrl+1..9` | Switch desktop Spaces |
| `Esc` | Exit full screen / close overlays |

## 🗺️ Architecture

```
macos27/
  index.html            single entry, classic scripts, no build
  css/                  base (tokens) · glass (material) · shell · apps
  js/
    util.js             DOM builder, bus, drag plumbing
    store.js            persistent settings + theme
    fs.js               virtual file system (localStorage-backed)
    wallpaper.js        live procedural wallpapers
    glass.js            ★ the Liquid Glass engine (refraction, tint, tokens)
    wm.js               window manager (drag/resize/snap/minimize/fullscreen/spaces)
    dock.js menubar.js overlays.js ui.js notifications.js sound.js shell.js
    assistant.js        DeepSeek V4 Pro client + Intelligence app
    apps/               finder, safari, notes, mail, messages, calendar,
                        photos, music, calculator, terminal, settings, about…
```

The glass pipeline: `wallpaper.js` renders the scene each frame → `glass.js` copies it
into a full-screen canvas clipped to the union of window rects with an animated
`feDisplacementMap` filter → windows stack `backdrop-filter` + a per-window tint sampled
from the wallpaper → grain overlay + specular rim on top. Disable any stage in
System Settings → Liquid Glass, or switch **Reduce Transparency** for the flat fallback.

## 📝 Notes

- All data lives in your browser's localStorage (`macos27.*` keys). Apple menu →
  **Reset Demo Data…** wipes everything and reboots.
- Fonts: system UI stack (SF Pro on Apple devices, Segoe UI elsewhere).
- Apple logo path from Font Awesome (CC BY 4.0). Everything else is original code.

Built with ❤️ and too much blur, by DeepSeek V4 Pro.
