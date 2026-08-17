/* ============================================================
   macOS 27 — Mammoth · apps/music.js
   Music — generative "Liquid Radio" station. Pure WebAudio
   (no assets): lookahead sequencer, feedback delay, convolver
   reverb. Exposes the global MusicPlayer for the Control Center.
   ============================================================ */
'use strict';

/* ---------------- generative track definitions ----------------
   root  = base frequency (Hz)
   scale = semitone offsets forming the scale
   chords= chord progression, each chord an array of scale indices
   arp   = arpeggio pattern (indices into the current 3-tone chord)
   ------------------------------------------------------------ */
const MUSIC_TRACKS = [
  { name: 'Glass Sky', artist: 'Liquid Radio', bpm: 88, dur: 96,
    root: 220.00, scale: [0, 2, 4, 7, 9], lead: 'triangle',
    chords: [[0, 2, 4], [3, 0, 2], [2, 4, 1], [4, 1, 3]],
    arp: [0, 1, 2, 3, 2, 1], colors: ['#7cc4ff', '#b39dff'] },
  { name: 'Tahoe Dawn', artist: 'Liquid Radio', bpm: 96, dur: 88,
    root: 174.61, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'sine',
    chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [2, 4, 6]],
    arp: [0, 1, 2, 3, 2, 1, 0, 2], colors: ['#5aa7ff', '#7ad7c8'] },
  { name: 'Neon Orchard', artist: 'Liquid Radio', bpm: 118, dur: 104,
    root: 130.81, scale: [0, 3, 5, 7, 10], lead: 'triangle',
    chords: [[0, 2, 4], [3, 0, 2], [2, 4, 1], [1, 3, 0]],
    arp: [0, 2, 1, 3, 2, 0], colors: ['#ff9ad5', '#7c4dff'] },
  { name: 'Midnight Haze', artist: 'Liquid Radio', bpm: 72, dur: 92,
    root: 110.00, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sine',
    chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [2, 4, 6]],
    arp: [0, 1, 2, 3, 2, 1], colors: ['#2b1fd6', '#0a4fd0'] },
  { name: 'Silicon Bloom', artist: 'Liquid Radio', bpm: 104, dur: 96,
    root: 146.83, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle',
    chords: [[0, 4, 6], [2, 5, 0], [4, 0, 2], [3, 6, 1]],
    arp: [0, 1, 2, 3, 2, 1, 0, 2], colors: ['#54e074', '#4ec9b0'] },
];

/* ============================================================
   MusicPlayer — the audio engine. Lives at module scope so the
   Control Center can drive it even with no Music window open.
   ============================================================ */
const MusicPlayer = (() => {
  let ctx = null, master = null, bus = null, analyser = null;
  let dry = null, delay = null, fb = null, delayIn = null, delayOut = null;
  let convolver = null, wet = null;
  let eqLow = null, eqMid = null, eqHigh = null;
  let schedulerId = null;
  let playing = false;
  let trackIndex = 0;
  let currentStep = 0;
  let nextNoteTime = 0;
  let played = 0;           // seconds into the current track loop
  let vol = 0.7;
  let shuffle = false;
  let repeat = 'off';       // off | all | one
  let stepDur = 0;          // seconds per sequencer step
  let trackDur = 0;         // seconds per track loop
  let onChange = null;

  const STEPS_PER_CHORD = 8;
  const LOOKAHEAD = 0.12;
  const TICK_MS = 25;

  const semis = (root, s) => root * Math.pow(2, s / 12);

  /* best-effort persistence (nothing strictly required) */
  try { vol = clamp(parseFloat(localStorage.getItem('macos27.music.vol')), 0, 1) || 0.7; } catch {}
  try { trackIndex = clamp(parseInt(localStorage.getItem('macos27.music.track'), 10) || 0, 0, MUSIC_TRACKS.length - 1); } catch {}

  function savePrefs() {
    try {
      localStorage.setItem('macos27.music.vol', String(vol));
      localStorage.setItem('macos27.music.track', String(trackIndex));
    } catch { /* storage unavailable */ }
  }

  const track = () => MUSIC_TRACKS[trackIndex];

  /* --- 2s exponentially-decaying stereo noise impulse for reverb --- */
  function makeImpulse(c, seconds, decay) {
    const rate = c.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;              // ramped up on play

    /* 3-band EQ between master and output */
    eqLow = ctx.createBiquadFilter(); eqLow.type = 'lowshelf'; eqLow.frequency.value = 200; eqLow.gain.value = 0;
    eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 0.7; eqMid.gain.value = 0;
    eqHigh = ctx.createBiquadFilter(); eqHigh.type = 'highshelf'; eqHigh.frequency.value = 4000; eqHigh.gain.value = 0;
    master.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh); eqHigh.connect(ctx.destination);

    bus = ctx.createGain();
    bus.gain.value = 1;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    dry = ctx.createGain();
    dry.gain.value = 0.9;

    delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.28;
    fb = ctx.createGain();
    fb.gain.value = 0.35;
    delayIn = ctx.createGain();
    delayIn.gain.value = 0.3;
    delayOut = ctx.createGain();
    delayOut.gain.value = 0.5;

    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.0, 2.6);
    wet = ctx.createGain();
    wet.gain.value = 0.32;

    /* dry path through the analyser (visualizer tap, guaranteed pull) */
    bus.connect(analyser);
    analyser.connect(dry);
    dry.connect(master);

    /* feedback delay */
    bus.connect(delayIn); delayIn.connect(delay);
    delay.connect(fb); fb.connect(delay);
    delay.connect(delayOut); delayOut.connect(master);

    /* convolver reverb */
    bus.connect(convolver); convolver.connect(wet); wet.connect(master);

    ctx.onstatechange = () => {
      if (playing && ctx.state === 'suspended') {
        playing = false;
        stopScheduler();
      }
      notify();
    };
  }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      buildGraph();
    }
    return ctx;
  }

  function playVoice(freq, t, o) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t);
    const atk = o.attack || 0.01;
    const dur = o.dur || 0.5;
    const gain = o.gain || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + atk);
    g.gain.setValueAtTime(gain, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  function scheduleStep(step, t) {
    const tr = track();
    const chordIdx = Math.floor(step / STEPS_PER_CHORD) % tr.chords.length;
    const chord = tr.chords[chordIdx];
    const chordStart = (step % STEPS_PER_CHORD) === 0;
    const barLen = STEPS_PER_CHORD * stepDur;

    if (chordStart) {
      /* soft sub bass on the chord root */
      const bassFreq = semis(tr.root, tr.scale[chord[0]]) / 2;
      playVoice(bassFreq, t, { type: 'sine', gain: 0.16, dur: barLen * 0.95, attack: 0.03 });
      /* slow-attack pad layer */
      for (let k = 0; k < chord.length; k++) {
        playVoice(semis(tr.root, tr.scale[chord[k]]), t, {
          type: 'triangle', gain: 0.07, dur: barLen * 1.05, attack: 0.6,
        });
      }
    }

    /* arpeggio lead, one octave up with a light downbeat accent */
    const arpIdx = tr.arp[step % tr.arp.length];
    const deg = chord[arpIdx % chord.length];
    const arpFreq = semis(tr.root, tr.scale[deg]) * 2;
    const accent = (step % 4 === 0) ? 0.05 : 0;
    playVoice(arpFreq, t, { type: tr.lead, gain: 0.15 + accent, dur: stepDur * 1.7, attack: 0.008 });
  }

  function schedule() {
    if (!ctx || !playing) return;
    if (nextNoteTime < ctx.currentTime - 0.1) nextNoteTime = ctx.currentTime + 0.02;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(currentStep, nextNoteTime);
      currentStep++;
      played = (played + stepDur) % trackDur;
      nextNoteTime += stepDur;
    }
  }

  function startScheduler() {
    stopScheduler();
    schedulerId = setInterval(schedule, TICK_MS);
  }
  function stopScheduler() {
    if (schedulerId) { clearInterval(schedulerId); schedulerId = null; }
  }

  function loadTrack(i) {
    trackIndex = ((i % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const tr = track();
    stepDur = 60 / tr.bpm / 2;     // eighth-note steps
    trackDur = tr.dur;
    currentStep = 0;
    played = 0;
    if (ctx) nextNoteTime = ctx.currentTime + 0.05;
    savePrefs();
  }

  function notify() {
    if (typeof onChange === 'function') onChange(getState());
  }

  function play() {
    const c = ensureCtx();
    if (!c) { Toast.show('Web Audio unavailable', { icon: 'error' }); return; }
    if (playing) return;
    const go = () => {
      if (!ctx) return;
      playing = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(vol, ctx.currentTime, 0.06);
      nextNoteTime = ctx.currentTime + 0.05;
      startScheduler();
      notify();
    };
    if (c.state === 'suspended') c.resume().then(go).catch(() => {});
    else go();
  }

  function pause() {
    if (!playing) { notify(); return; }
    playing = false;
    stopScheduler();
    if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.04);
    }
    notify();
  }

  function toggle() { playing ? pause() : play(); }

  function pickNext(dir) {
    const n = MUSIC_TRACKS.length;
    if (repeat === 'one') return trackIndex;
    if (shuffle) {
      if (n <= 1) return 0;
      let i; do { i = Math.floor(Math.random() * n); } while (i === trackIndex);
      return i;
    }
    return ((trackIndex + dir) % n + n) % n;
  }
  function next() { const i = pickNext(1); loadTrack(i); if (playing && ctx) nextNoteTime = ctx.currentTime + 0.05; notify(); }
  function prev() { const i = pickNext(-1); loadTrack(i); if (playing && ctx) nextNoteTime = ctx.currentTime + 0.05; notify(); }

  function setShuffle(b) { shuffle = !!b; notify(); }
  function cycleRepeat() { repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; notify(); }

  function setEQ(band, v) {
    ensureCtx();
    const f = band === 'low' ? eqLow : band === 'mid' ? eqMid : eqHigh;
    if (f) f.gain.setTargetAtTime(clamp(v, -12, 12), ctx.currentTime, 0.05);
  }

  function playTrack(i) {
    loadTrack(i);
    play();
  }

  function seek(seconds) {
    const tr = track();
    played = clamp(seconds, 0, tr.dur);
    currentStep = Math.floor(played / stepDur);
    if (ctx) nextNoteTime = ctx.currentTime + 0.05;
    notify();
  }

  function nowPlaying() {
    const tr = track();
    return tr.name + ' — ' + tr.artist;
  }

  function isPlaying() { return playing; }

  function volume(v) {
    if (v != null) {
      vol = clamp(v, 0, 1);
      if (ctx && master) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
      savePrefs();
      notify();
    }
    return vol;
  }

  function getState() {
    const tr = track();
    return {
      playing, trackIndex, shuffle, repeat,
      name: tr.name, artist: tr.artist, colors: tr.colors,
      played, dur: trackDur, vol, analyser,
    };
  }

  loadTrack(trackIndex);

  return {
    play, pause, toggle, next, prev, playTrack, seek,
    nowPlaying, isPlaying, volume, getState,
    setShuffle, cycleRepeat, setEQ,
    set onChange(f) { onChange = f; },
  };
})();

window.MusicPlayer = MusicPlayer;

/* ============================================================
   Music window
   ============================================================ */
M27.register({
  id: 'music',
  name: 'Music',
  icon: Icons.music(),
  width: 1040, height: 680, minW: 680, minH: 420,
  single: true,

  mount({ content, toolbar, setTitle }) {
    const fmtDur = (s) => {
      s = Math.max(0, Math.round(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };
    const accentColor = () => {
      try { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0A84FF'; }
      catch { return '#0A84FF'; }
    };
    function drawArt(cv, c1, c2, seed) {
      const g = cv.getContext('2d');
      const w = cv.width, h = cv.height;
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.18;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(w * 0.78, h * 0.2, w * (0.16 + (seed % 3) * 0.03), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.14;
      g.beginPath();
      g.arc(w * 0.2, h * 0.85, w * (0.22 + (seed % 2) * 0.05), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.5;
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = Math.max(1, w * 0.03);
      g.beginPath();
      g.moveTo(0, h * 0.72);
      g.quadraticCurveTo(w * 0.5, h * 0.5, w, h * 0.66);
      g.stroke();
      g.globalAlpha = 1;
    }

    const root = el('div', { class: 'app-root' });
    content.append(root);

    const side = el('div', { class: 'app-sidebar' });
    const main = el('div', { class: 'app-main' });
    root.append(side, main);

    /* ---------------- sidebar ---------------- */
    const SECTIONS = [
      { id: 'listen', name: 'Listen Now', icon: Icons.glyph('music') },
      { id: 'radio', name: 'Radio', icon: Icons.glyph('wifi') },
      { id: 'songs', name: 'Songs', icon: Icons.glyph('list') },
    ];
    let section = 'listen';
    let favs = [];
    try { favs = JSON.parse(localStorage.getItem('macos27.music.likes') || '[]') || []; } catch { favs = []; }
    const saveFavs = () => { try { localStorage.setItem('macos27.music.likes', JSON.stringify(favs)); } catch { } };
    side.append(el('div', { class: 'sb-title' }, 'Library'));
    function renderSide() {
      side.querySelectorAll('.sb-item, .sb-fav-item').forEach(n => n.remove());
      for (const s of SECTIONS) {
        const row = el('button', { class: 'sb-item' + (section === s.id ? ' sel' : '') }, [
          el('span', { html: s.icon }),
          el('span', {}, s.name),
          s.id === 'songs' ? el('span', { class: 'sb-count' }, String(MUSIC_TRACKS.length)) : null,
        ]);
        row.addEventListener('click', () => {
          section = s.id;
          Sound.play('click');
          renderSide();
          scrollMain.scrollTop = 0;
        });
        side.append(row);
      }
      /* favorites */
      if (favs.length) {
        side.append(el('div', { class: 'sb-title' }, '收藏'));
        favs.forEach((ti) => {
          const t = MUSIC_TRACKS[ti];
          if (!t) return;
          const row = el('button', { class: 'sb-item sb-fav-item' }, [
            el('span', { html: Icons.glyph('heart'), style: { color: 'var(--danger)' } }),
            el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.name),
          ]);
          row.addEventListener('click', () => { MusicPlayer.playTrack(ti); renderSide(); });
          side.append(row);
        });
      }
    }

    /* ---------------- main: hero + track list ---------------- */
    const scrollMain = el('div', { style: { flex: '1', overflowY: 'auto', padding: '18px 20px' } });
    const player = el('div', { class: 'music-player' });
    main.append(scrollMain, player);

    const heroPlayGlyph = el('span', { html: Icons.glyph('play') });
    const hero = el('div', {
      style: {
        background: 'linear-gradient(120deg, #7c4dff 0%, #0a84ff 55%, #7ad7c8 100%)',
        borderRadius: '14px', padding: '22px 24px', color: '#fff',
        marginBottom: '18px', position: 'relative', overflow: 'hidden',
      },
    }, [
      el('div', { style: { fontSize: '11px', fontWeight: '700', letterSpacing: '.5px', opacity: '.8', textTransform: 'uppercase' } }, 'Listen Now'),
      el('div', { style: { fontSize: '26px', fontWeight: '700', marginTop: '4px', letterSpacing: '-.3px' } }, 'Liquid Radio'),
      el('div', { style: { fontSize: '13px', opacity: '.92', marginTop: '2px' } }, 'A generative station — five tracks synthesized live, no files.'),
      el('button', {
        class: 'btn',
        style: { marginTop: '14px', background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.45)', color: '#fff' },
        onclick: () => { Sound.play('click'); MusicPlayer.toggle(); },
      }, heroPlayGlyph, ' Play'),
    ]);

    const listTitle = el('div', { style: { fontSize: '13px', fontWeight: '600', margin: '4px 0 4px' } }, 'Songs');
    const list = el('div', {});
    const rows = [];
    MUSIC_TRACKS.forEach((t, i) => {
      const art = el('canvas', {
        width: 40, height: 40,
        style: { width: '40px', height: '40px', borderRadius: '7px', flex: 'none' },
      });
      drawArt(art, t.colors[0], t.colors[1], i);
      const liked = favs.includes(i);
      const heart = el('button', {
        class: 'icon-btn', title: liked ? '取消收藏' : '收藏',
        style: { color: liked ? 'var(--danger)' : 'var(--text-3)', flex: 'none' },
        onclick: (e) => {
          e.stopPropagation();
          const idx = favs.indexOf(i);
          if (idx >= 0) favs.splice(idx, 1); else favs.push(i);
          saveFavs();
          heart.style.color = favs.includes(i) ? 'var(--danger)' : 'var(--text-3)';
          renderSide();
        },
      }, el('span', { html: Icons.glyph('heart') }));
      const row = el('button', { class: 'music-track', onclick: () => { Sound.play('click'); selectTrack(i); } }, [
        art,
        el('div', { class: 'music-meta' }, [
          el('div', { class: 'mm-title' }, t.name),
          el('div', { class: 'mm-artist' }, t.artist),
        ]),
        el('span', { class: 'mono dimmer' }, fmtDur(t.dur)),
        heart,
      ]);
      rows.push(row);
      list.append(row);
    });
    scrollMain.append(hero, listTitle, list);

    function selectTrack(i) {
      const st = MusicPlayer.getState();
      if (i === st.trackIndex) {
        if (st.playing) MusicPlayer.pause();
        else MusicPlayer.play();
      } else {
        MusicPlayer.playTrack(i);
      }
    }

    /* ---------------- bottom player bar ---------------- */
    const artCanvas = el('canvas', { width: 92, height: 92 });
    const artWrap = el('div', { class: 'music-art' }, artCanvas);
    const mmTitle = el('div', { class: 'mm-title' }, 'Liquid Radio');
    const mmArtist = el('div', { class: 'mm-artist' }, 'Select a track');
    const meta = el('div', { class: 'music-meta', style: { flex: '0 1 140px' } }, [mmTitle, mmArtist]);

    const prevBtn = el('button', { class: 'icon-btn', title: 'Previous', onclick: () => { Sound.play('click'); MusicPlayer.prev(); } },
      el('span', { html: Icons.glyph('prev') }));
    const playBtn = el('button', { class: 'icon-btn', title: 'Play / Pause', onclick: () => { Sound.play('click'); MusicPlayer.toggle(); } });
    const playGlyph = el('span', { html: Icons.glyph('play') });
    playBtn.append(playGlyph);
    const nextBtn = el('button', { class: 'icon-btn', title: 'Next', onclick: () => { Sound.play('click'); MusicPlayer.next(); } },
      el('span', { html: Icons.glyph('next') }));

    /* shuffle + repeat */
    const shuffleBtn = el('button', { class: 'icon-btn', title: '随机播放', onclick: () => { Sound.play('click'); MusicPlayer.setShuffle(!MusicPlayer.getState().shuffle); syncMeta(); } },
      el('span', { html: Icons.glyph('shuffle') }));
    const repeatBtn = el('button', { class: 'icon-btn', title: '循环', onclick: () => { Sound.play('click'); MusicPlayer.cycleRepeat(); syncMeta(); } },
      el('span', { html: Icons.glyph('repeat') }));
    const eqBtn = el('button', { class: 'icon-btn', title: '均衡器', onclick: () => { eqPanel.classList.toggle('hidden'); } },
      el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M9 6v12M14 8v8M19 5v14"/></svg>' }));

    /* EQ panel */
    const eqPanel = el('div', { class: 'music-eq hidden' });
    const eqSlider = (band, label) => {
      const input = el('input', { class: 'slider', type: 'range', min: -12, max: 12, step: 1, value: 0,
        oninput: (e) => MusicPlayer.setEQ(band, +e.target.value) });
      return el('div', { class: 'music-eq-row' }, [
        el('span', { class: 'dimmer', style: { width: '44px', fontSize: '11px' } }, label),
        input,
      ]);
    };
    eqPanel.append(eqSlider('low', '低音'), eqSlider('mid', '中音'), eqSlider('high', '高音'));
    main.append(eqPanel);

    let scrubbing = false;
    const progress = el('input', {
      class: 'slider', type: 'range', min: 0, max: 1000, step: 1, value: 0,
      style: { flex: '1', minWidth: '70px' },
      oninput: () => { scrubbing = true; MusicPlayer.seek(+progress.value / 1000 * MusicPlayer.getState().dur); },
      onchange: () => { scrubbing = false; },
      onpointerup: () => { scrubbing = false; },
    });
    const elapsedLbl = el('span', {
      class: 'mono dimmer',
      style: { fontSize: '11px', minWidth: '64px', textAlign: 'right', flex: 'none' },
    }, '0:00 / 0:00');
    const volIcon = el('span', { style: { flex: 'none', width: '15px', height: '15px' }, html: Icons.glyph('volume') });
    const volSlider = el('input', {
      class: 'slider', type: 'range', min: 0, max: 100, step: 1,
      value: Math.round(MusicPlayer.getState().vol * 100),
      style: { width: '72px', flex: 'none' },
      oninput: (e) => MusicPlayer.volume(+e.target.value / 100),
    });
    const vis = el('canvas', { class: 'music-vis', width: 120, height: 34 });

    player.append(artWrap, meta, shuffleBtn, prevBtn, playBtn, nextBtn, repeatBtn, eqBtn, progress, elapsedLbl, volIcon, volSlider, vis);

    /* ---------------- state sync + visualizer loop ---------------- */
    let freqData = null;
    function drawVis() {
      const st = MusicPlayer.getState();
      const g = vis.getContext('2d');
      const w = vis.width, h = vis.height;
      const accent = accentColor();
      const bars = 24;
      const bw = w / bars;
      g.clearRect(0, 0, w, h);
      if (st.analyser) {
        const a = st.analyser;
        if (!freqData || freqData.length !== a.frequencyBinCount) freqData = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(freqData);
        for (let i = 0; i < bars; i++) {
          const v = freqData[Math.floor(i * freqData.length / bars)] / 255;
          const bh = Math.max(2, v * h);
          g.globalAlpha = 0.3 + 0.7 * v;
          g.fillStyle = accent;
          g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      } else {
        g.fillStyle = accent;
        g.globalAlpha = 0.35;
        for (let i = 0; i < bars; i++) {
          const bh = Math.max(2, (Math.sin(Date.now() / 420 + i) * 0.5 + 0.5) * 5 + 2);
          g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      }
      g.globalAlpha = 1;
    }

    function syncMeta() {
      const st = MusicPlayer.getState();
      playGlyph.innerHTML = Icons.glyph(st.playing ? 'pause' : 'play');
      heroPlayGlyph.innerHTML = Icons.glyph(st.playing ? 'pause' : 'play');
      mmTitle.textContent = st.name;
      mmArtist.textContent = st.artist;
      if (setTitle) setTitle(st.name + ' — ' + st.artist);
      drawArt(artCanvas, st.colors[0], st.colors[1], st.trackIndex);
      rows.forEach((r, i) => r.classList.toggle('playing', i === st.trackIndex));
      volSlider.value = Math.round(st.vol * 100);
      shuffleBtn.style.color = st.shuffle ? 'var(--accent)' : '';
      repeatBtn.style.color = st.repeat !== 'off' ? 'var(--accent)' : '';
      repeatBtn.title = st.repeat === 'off' ? '循环：关' : st.repeat === 'all' ? '循环：全部' : '循环：单曲';
    }

    function syncProgress() {
      const st = MusicPlayer.getState();
      if (!scrubbing) progress.value = Math.round((st.played / st.dur) * 1000);
      elapsedLbl.textContent = fmtDur(st.played) + ' / ' + fmtDur(st.dur);
    }

    let rafId = null;
    function frame() {
      drawVis();
      syncProgress();
      rafId = requestAnimationFrame(frame);
    }

    renderSide();
    MusicPlayer.onChange = syncMeta;
    syncMeta();
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      MusicPlayer.onChange = null;
    };
  },
});
