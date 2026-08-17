/* ============================================================
   macOS 27 — Mammoth · store.js
   Persistent system settings with live events
   ============================================================ */
'use strict';

const SETTINGS_DEFAULTS = {
  theme: 'auto',                  // 'auto' | 'light' | 'dark'
  accent: '#0A84FF',
  wallpaper: 'tahoe',
  glass: true,
  glassBlur: 26,
  glassSat: 190,
  glassBright: 112,
  glassAlpha: 0.16,
  refraction: true,
  glassRim: true,
  reduceMotion: false,
  wallpaperRotate: false,
  wallpaperInterval: 5,             // minutes
  focusMode: 'doNotDisturb',
  accountName: 'You',
  notificationsEnabled: true,
  scrollNatural: true,
  tapToClick: true,
  lowPowerMode: false,
  uiVolume: 0.6,
  sounds: true,
  brightness: 0,                  // 0..100 → dim overlay percent
  widgets: true,
  booted: false,
  firstRun: true,
  wifi: true,
  bluetooth: true,
  airdrop: false,
  focus: false,
  darkModeUi: false,
  deepseek: {
    base: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro',
    key: '',
    temperature: 0.7,
  },
};

const Settings = (() => {
  let data = {};
  try { data = JSON.parse(localStorage.getItem('macos27.settings') || '{}'); } catch { data = {}; }
  for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) {
    if (deepGet(data, k, null) === null) deepSet(data, k, v);
  }

  function persist() {
    try { localStorage.setItem('macos27.settings', JSON.stringify(data)); } catch { /* full */ }
  }

  return {
    get(key, def) { return deepGet(data, key, def ?? deepGet(SETTINGS_DEFAULTS, key)); },
    set(key, val) {
      deepSet(data, key, val);
      persist();
      emit('settings', { key, val });
      emit(`settings:${key}`, val);
      return val;
    },
    raw: () => data,
    reset() {
      data = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
      persist();
      emit('settings:reset');
    },
  };
})();

/* resolve theme ('auto' → matchMedia) */
function resolvedTheme() {
  const t = Settings.get('theme');
  if (t === 'auto') return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return t;
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolvedTheme());
}
applyTheme();
on('settings:theme', applyTheme);
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (Settings.get('theme') === 'auto') applyTheme();
});
