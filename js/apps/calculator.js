/* ============================================================
   macOS 27 — Mammoth · apps/calculator.js
   Calculator with a real expression parser + scientific mode,
   history and copy-result. Exposes Calc.calc / Calc.format
   for Spotlight.
   ============================================================ */
'use strict';

/* ---------- parser ---------- */
const Calc = (() => {
  const FUNCS = { sin: 1, cos: 1, tan: 1, log: 1, ln: 1, sqrt: 1 };

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[\d.]/.test(c)) {
        let num = '';
        while (i < src.length && /[\d.]/.test(src[i])) { num += src[i]; i++; }
        tokens.push({ t: 'num', v: parseFloat(num) });
        continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let w = '';
        while (i < src.length && /[a-zA-Z]/.test(src[i])) { w += src[i]; i++; }
        const lw = w.toLowerCase();
        if (FUNCS[lw]) { tokens.push({ t: 'fn', v: lw }); continue; }
        if (lw === 'pi') { tokens.push({ t: 'num', v: Math.PI }); continue; }
        if (lw === 'e') { tokens.push({ t: 'num', v: Math.E }); continue; }
        throw new Error('Unknown name: ' + w);
      }
      if ('+-*/×÷%^'.includes(c)) { tokens.push({ t: 'op', v: c === '×' ? '*' : c === '÷' ? '/' : c }); i++; continue; }
      if (c === '(') { tokens.push({ t: 'lp' }); i++; continue; }
      if (c === ')') { tokens.push({ t: 'rp' }); i++; continue; }
      if (c === '−') { tokens.push({ t: 'op', v: '-' }); i++; continue; }
      throw new Error('Bad character: ' + c);
    }
    return tokens;
  }

  function apply(fn, v) {
    switch (fn) {
      case 'sin': return Math.sin(v * Math.PI / 180);   // degrees
      case 'cos': return Math.cos(v * Math.PI / 180);
      case 'tan': return Math.tan(v * Math.PI / 180);
      case 'sqrt': return Math.sqrt(v);
      case 'log': return Math.log10(v);
      case 'ln': return Math.log(v);
    }
    throw new Error('Unknown function');
  }

  function parse(src) {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];

    function expr() {
      let v = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = next().v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = power();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        const op = next().v;
        const r = power();
        if (op === '/' && r === 0) throw new Error('Division by zero');
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function power() {
      let v = factor();
      if (peek() && peek().t === 'op' && peek().v === '^') { next(); v = Math.pow(v, power()); }
      return v;
    }
    function factor() {
      if (peek() && peek().t === 'fn') {
        const fn = next().v;
        if (!peek() || peek().t !== 'lp') throw new Error('Expected (');
        next();
        const v = expr();
        if (!peek() || peek().t !== 'rp') throw new Error('Missing )');
        next();
        return post(apply(fn, v));
      }
      if (peek() && peek().t === 'lp') {
        next();
        const v = expr();
        if (!peek() || peek().t !== 'rp') throw new Error('Missing )');
        next();
        return post(v);
      }
      if (peek() && peek().t === 'op' && peek().v === '-') { next(); return -power(); }
      if (peek() && peek().t === 'op' && peek().v === '+') { next(); return factor(); }
      const n = next();
      if (!n || n.t !== 'num') throw new Error('Expected number');
      return post(n.v);
    }
    function post(v) {
      while (peek() && peek().t === 'op' && peek().v === '%') { next(); v = v / 100; }
      return v;
    }

    const v = expr();
    if (pos < toks.length) throw new Error('Unexpected token');
    return v;
  }

  function calc(src) {
    try { return parse(String(src)); } catch { return NaN; }
  }

  function format(v) {
    if (!isFinite(v)) return 'Error';
    let s = Math.abs(v) >= 1e12 || (Math.abs(v) < 1e-9 && v !== 0)
      ? v.toExponential(6).replace(/\.?0+e/, 'e')
      : String(+v.toPrecision(12));
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s.includes('e')) return s;
    const [int, frac] = s.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return frac ? grouped + '.' + frac : grouped;
  }

  return { calc, format };
})();

/* ---------- app ---------- */
M27.register({
  id: 'calculator',
  name: 'Calculator',
  icon: Icons.calculator(),
  width: 320, height: 470, minW: 260, minH: 380, resizable: true, single: true,

  mount({ content }) {
    const HKEY = 'macos27.calculator';
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HKEY) || 'null') || []; } catch { history = []; }
    function saveHistory() { try { localStorage.setItem(HKEY, JSON.stringify(history)); } catch { /* quota */ } }

    const styleEl = el('style', { html: `
      .app-calculator-bar { flex: none; display: flex; align-items: center; gap: 6px; padding: 6px 8px 2px; }
      .app-calculator-bar .icon-btn.on { background: var(--fill-1); color: var(--accent); }
      .app-calculator-fx { font-size: 12px; font-weight: 700; padding: 2px 10px; }
      .app-calculator-fx.on { background: var(--accent); color: #fff; border-color: transparent; }
      .app-calculator-history { flex: none; max-height: 140px; overflow-y: auto; border-top: 1px solid var(--sep); border-bottom: 1px solid var(--sep); background: var(--fill-2); }
      .app-calculator-history.hidden { display: none; }
      .app-calculator-history-head { display: flex; align-items: center; gap: 8px; padding: 6px 12px 2px; font-size: 11px; font-weight: 600; color: var(--text-3); position: sticky; top: 0; background: var(--fill-2); }
      .app-calculator-history-head .btn { font-size: 11px; padding: 1px 8px; }
      .app-calculator-hist { padding: 2px 4px 6px; }
      .app-calculator-hist-item { display: block; width: 100%; text-align: right; padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 12px; color: var(--text-2); }
      .app-calculator-hist-item:hover { background: var(--hover); color: var(--text-1); }
      .app-calculator-hist-item .ch-expr { color: var(--text-3); font-size: 11px; }
      .app-calculator-pad { grid-auto-rows: 1fr; }
      .app-calculator-pad .calc-btn.sci { font-size: 15px; }
    ` });
    content.append(styleEl);

    const root = el('div', { class: 'calc' });
    content.append(root);

    const bar = el('div', { class: 'app-calculator-bar' });
    const historyEl = el('div', { class: 'app-calculator-history hidden' });
    const histList = el('div', { class: 'app-calculator-hist' });
    const clearHistBtn = el('button', {
      class: 'btn ghost', onclick: () => {
        history = []; saveHistory(); renderHistory(); Sound.play('trash');
      },
    }, 'Clear');
    historyEl.append(
      el('div', { class: 'app-calculator-history-head' }, [
        el('span', {}, 'History'),
        el('span', { class: 'spacer' }),
        clearHistBtn,
      ]),
      histList,
    );

    const exprEl = el('div', { class: 'calc-expr' });
    const resultEl = el('div', { class: 'calc-result' }, '0');
    root.append(bar, historyEl, el('div', { class: 'calc-display' }, [exprEl, resultEl]));

    let expr = '', result = null, justEq = false;
    let sci = false, histOpen = false;

    function update() {
      exprEl.textContent = expr || '\u00a0';
      resultEl.textContent = Calc.format(result ?? 0);
    }

    function balance(s) {
      let open = 0;
      for (const c of s) { if (c === '(') open++; else if (c === ')') open--; }
      return s + ')'.repeat(Math.max(0, open));
    }

    function pushHistory(e, r) {
      history.unshift({ expr: e, result: r });
      if (history.length > 30) history.length = 30;
      saveHistory();
      renderHistory();
    }

    function renderHistory() {
      histList.innerHTML = '';
      if (!history.length) {
        histList.append(el('div', { class: 'dimmer', style: { padding: '4px 12px 8px', fontSize: '11px', textAlign: 'right' } }, 'No history yet'));
        return;
      }
      for (const h of history) {
        const row = el('button', { class: 'app-calculator-hist-item' }, [
          el('div', { class: 'ch-expr' }, h.expr),
          el('div', {}, '= ' + h.result),
        ]);
        row.addEventListener('click', () => { Sound.play('click'); useHistory(h); });
        histList.append(row);
      }
    }

    function useHistory(h) {
      expr = h.expr;
      justEq = false;
      const v = Calc.calc(balance(expr));
      result = isNaN(v) ? null : v;
      update();
    }

    function evaluate() {
      if (!expr) return;
      const v = Calc.calc(balance(expr));
      result = v;
      justEq = true;
      update();
      if (isNaN(v)) Sound.play('error');
      else { Sound.play('click'); pushHistory(expr, Calc.format(v)); }
    }

    const INSERTS = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', '(', ')', '^2', '^', 'pi', 'e'];

    function press(key) {
      if (key === 'AC') { expr = ''; result = null; justEq = false; }
      else if (key === '⌫') { expr = expr.slice(0, -1); justEq = false; }
      else if (key === '=' || key === 'Enter') { evaluate(); return; }
      else if (key === '±') {
        if (justEq) { expr = String(result ?? ''); justEq = false; }
        const m = expr.match(/-?[\d.]+$/);
        if (m) expr = expr.slice(0, m.index) + (m[0].startsWith('-') ? m[0].slice(1) : '-' + m[0]);
      }
      else if (INSERTS.includes(key)) {
        if (justEq) { expr = ''; result = null; justEq = false; }
        if (key === '(' || key === 'pi' || key === 'e') { if (/[\d.)]$/.test(expr)) expr += '*'; }
        expr += key;
      }
      else if ('+-*/'.includes(key)) {
        if (justEq) { expr = String(result ?? ''); justEq = false; }
        if (/[+*/]$/.test(expr) && key !== '-') expr = expr.slice(0, -1) + key;
        else if (expr === '' && key === '-') expr = '-';
        else expr += key;
      }
      else {
        if (justEq && /\d/.test(key)) { expr = ''; result = null; justEq = false; }
        else justEq = false;
        expr += key;
      }
      if (expr.length > 60) expr = expr.slice(-60);
      if (!justEq) {
        const v = Calc.calc(balance(expr));
        result = isNaN(v) ? null : v;
      }
      update();
    }

    const KEYS = [
      ['AC', 'fn', 'AC'], ['±', 'fn', '±'], ['%', 'fn', '%'], ['÷', 'op', '/'],
      ['7', '', '7'], ['8', '', '8'], ['9', '', '9'], ['×', 'op', '*'],
      ['4', '', '4'], ['5', '', '5'], ['6', '', '6'], ['−', 'op', '-'],
      ['1', '', '1'], ['2', '', '2'], ['3', '', '3'], ['+', 'op', '+'],
      ['0', 'zero', '0'], ['.', '', '.'], ['=', 'op', '='],
    ];
    const SCI = [
      ['sin', 'fn sci', 'sin('], ['cos', 'fn sci', 'cos('], ['tan', 'fn sci', 'tan('], ['(', 'fn sci', '('],
      ['log', 'fn sci', 'log('], ['ln', 'fn sci', 'ln('], ['√', 'fn sci', 'sqrt('], [')', 'fn sci', ')'],
      ['x²', 'fn sci', '^2'], ['xʸ', 'fn sci', '^'], ['π', 'fn sci', 'pi'], ['e', 'fn sci', 'e'],
    ];

    const pad = el('div', { class: 'calc-pad app-calculator-pad' });
    function renderPad() {
      pad.innerHTML = '';
      const keys = sci ? SCI.concat(KEYS) : KEYS;
      for (const [label, cls, key] of keys) {
        const b = el('button', { class: 'calc-btn ' + (cls || '') }, label);
        b.addEventListener('click', () => press(key !== undefined ? key : label));
        pad.append(b);
      }
    }
    root.append(pad);

    /* ---- top bar controls ---- */
    const sciBtn = el('button', {
      class: 'btn app-calculator-fx' + (sci ? ' on' : ''), title: 'Scientific mode',
      onclick: () => { Sound.play('click'); sci = !sci; sciBtn.classList.toggle('on', sci); renderPad(); },
    }, 'fx');
    const histBtn = el('button', {
      class: 'icon-btn', title: 'History',
      onclick: () => {
        Sound.play('click'); histOpen = !histOpen;
        historyEl.classList.toggle('hidden', !histOpen);
        histBtn.classList.toggle('on', histOpen);
        if (histOpen) renderHistory();
      },
    }, el('span', { html: Icons.glyph('clock') }));
    const copyBtn = el('button', {
      class: 'icon-btn', title: 'Copy result', onclick: copyResult,
    }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' }));
    bar.append(sciBtn, el('span', { class: 'spacer' }), histBtn, copyBtn);

    function copyResult() {
      const text = resultEl.textContent;
      if (!text || text === 'Error') { Toast.show('Nothing to copy', { icon: 'info' }); return; }
      navigator.clipboard.writeText(text)
        .then(() => Toast.show('Copied ' + text, { icon: 'check' }))
        .catch(() => Toast.show('Copy failed', { icon: 'error' }));
    }

    window.addEventListener('keydown', function calcKey(e) {
      const win = WM.find('calculator');
      if (!win || win !== WM.active()) return;
      const k = e.key;
      if (/^[0-9.+\-*/%]$/.test(k)) { e.preventDefault(); press(k); }
      else if (k === 'Enter' || k === '=') { e.preventDefault(); press('='); }
      else if (k === 'Escape') { e.preventDefault(); press('AC'); }
      else if (k === 'Backspace') { e.preventDefault(); press('⌫'); }
    });

    renderPad();
    update();
    return () => {};
  },
});
