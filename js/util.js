/* ============================================================
   macOS 27 — Mammoth · util.js
   Core helpers, event bus, DOM builder, drag plumbing
   ============================================================ */
'use strict';

window.M27 = window.M27 || {};

/* ---------- DOM helpers ---------- */
const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const throttle = (fn, ms) => { let last = 0; return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } }; };

function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in n) { try { n[k] = v; } catch { n.setAttribute(k, v); } }
      else n.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/* ---------- event bus ---------- */
const bus = new EventTarget();
const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
const on = (name, fn) => { const h = e => fn(e.detail, e); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h); };
M27.bus = bus; M27.emit = emit; M27.on = on;

/* ---------- pointer drag helper ---------- */
function drag(e, move, up) {
  e.preventDefault();
  const onMove = ev => move(ev.clientX, ev.clientY, ev);
  const onUp = ev => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    up && up(ev);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

/* ---------- misc ---------- */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '10, 132, 255';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

const fmtBytes = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB'
  : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB'
  : b >= 1024 ? (b / 1024).toFixed(0) + ' KB'
  : b + ' bytes';

const fmtDate = (ts, withTime) => {
  const d = new Date(ts);
  const opts = withTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                        : { month: 'short', day: 'numeric', year: 'numeric' };
  return (withTime ? d.toLocaleString : d.toLocaleDateString).call(d, 'en-US', opts);
};

const fmtClock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function deepGet(obj, path, def) {
  let cur = obj;
  for (const p of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object') return def;
    cur = cur[p];
  }
  return cur === undefined ? def : cur;
}
function deepSet(obj, path, val) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
const cmd = (e) => (isMac ? e.metaKey : e.ctrlKey);

/* ---------- app registry ---------- */
M27.apps = {};
M27.register = (def) => {
  M27.apps[def.id] = Object.assign({
    resizable: true, single: false, hidden: false,
    width: 800, height: 560, minW: 320, minH: 220,
    menus: null, mount: null, onClose: null, onActivate: null,
  }, def);
  emit('app:registered', def.id);
};
