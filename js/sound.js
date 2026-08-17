/* ============================================================
   macOS 27 — Mammoth · sound.js
   Procedural UI sounds (WebAudio, zero assets)
   ============================================================ */
'use strict';

const Sound = (() => {
  let ctx = null, master = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  const vol = () => (Settings.get('sounds') ? Settings.get('uiVolume', 0.6) : 0);

  function tone(freq, dur, { type = 'sine', v = 1, at = 0, slide = 0 } = {}) {
    const c = ac();
    const level = vol();
    if (!c || level <= 0.001) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * level, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    /* generic dispatcher — Sound.play('click'|'open'|'close'|'ding'|'sent'|'trash'|'error'|'pop'|'boot'|'minimize'|'unlock'|'knock') */
    play(name) { if (name && typeof this[name] === 'function') this[name](); },
    unlock() { tone(659, .4, { v: .5 }); tone(988, .55, { v: .4, at: .1 }); tone(1319, .8, { v: .3, at: .22 }); },
    open()  { tone(520, .1, { type: 'triangle', v: .35 }); tone(784, .16, { type: 'triangle', v: .22, at: .045 }); },
    close() { tone(640, .09, { type: 'triangle', v: .3 }); tone(360, .13, { type: 'triangle', v: .2, at: .03 }); },
    minimize() { tone(700, .1, { type: 'sine', v: .25, slide: 320 }); },
    click() { tone(1250, .04, { v: .22 }); },
    ding()  { tone(1568, .5, { v: .28 }); tone(2093, .65, { v: .18, at: .03 }); },
    error() { tone(233, .2, { type: 'square', v: .1 }); tone(175, .26, { type: 'square', v: .09, at: .05 }); },
    trash() { tone(720, .07, { v: .3 }); tone(300, .14, { v: .28, at: .06 }); },
    boot()  { tone(523, 1.2, { v: .4 }); tone(659, 1.2, { v: .3, at: .03 }); tone(784, 1.6, { v: .26, at: .06 }); },
    sent()  { tone(880, .12, { type: 'triangle', v: .3, slide: 1320 }); },
    pop()   { tone(420, .08, { type: 'sine', v: .35, slide: 620 }); },
    knock() { tone(340, .07, { type: 'triangle', v: .3 }); tone(340, .07, { type: 'triangle', v: .3, at: .16 }); },
    note(freq, dur, v) { tone(freq, dur, { type: 'triangle', v: v ?? .3 }); },
    volume() { return vol(); },
  };
})();
