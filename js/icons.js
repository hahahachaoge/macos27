/* ============================================================
   macOS 27 — Mammoth · icons.js
   Squircle icon library (inline SVG, dependency-free)
   ============================================================ */
'use strict';

const Icons = (() => {
  function sq(c1, c2) {
    const id = 'g' + uid();
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient></defs><rect width="100" height="100" rx="23" fill="url(#${id})"/>`;
  }
  function app(c1, c2, glyph) {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${sq(c1, c2)}${glyph || ''}</svg>`;
  }
  function raw(inner) { return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }

  const folder = (c1, c2) => raw(`${sq(c1, c2)}
    <path d="M14 28c0-3 2-5 5-5h22l7 8h33c3 0 5 2 5 5v8H14Z" fill="rgba(255,255,255,.28)"/>
    <rect x="14" y="36" width="72" height="36" rx="7" fill="rgba(255,255,255,.12)"/>`);

  return {
    app,
    folder,

    /* ---------- app icons ---------- */
    finder: () => app('#7ed0f5', '#1b6fe0',
      `<path d="M50 17a33 33 0 1 0 0 66 33 33 0 0 0 0-66Z" fill="#fff"/>
       <path d="M83 50a33 33 0 0 1-66 0h33V17a33 33 0 0 1 33 33Z" fill="#1b6fe0"/>
       <circle cx="39" cy="44" r="4.4" fill="#12324a"/><circle cx="61" cy="44" r="4.4" fill="#fff"/>
       <path d="M37 60c3.4 7.6 22.6 7.6 26 0" stroke="#12324a" stroke-width="5" fill="none" stroke-linecap="round"/>`),

    safari: () => app('#3aa0f8', '#0a4fd0',
      `<circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="6"/>
       <path d="M66 34 45 55 34 34l21 11Z" fill="#fff"/>
       <path d="M34 66 55 45l11 21-21-11Z" fill="#fff" opacity=".6"/>`),

    notes: () => raw(`<rect width="100" height="100" rx="23" fill="#fbfbfd"/>
      <path d="M0 23a23 23 0 0 1 23-23h54a23 23 0 0 1 23 23v14H0Z" fill="#f7c948"/>
      <rect x="20" y="46" width="60" height="5" rx="2.5" fill="#c9c9ce"/>
      <rect x="20" y="58" width="60" height="5" rx="2.5" fill="#d8d8dd"/>
      <rect x="20" y="70" width="42" height="5" rx="2.5" fill="#e2e2e6"/>`),

    mail: () => app('#4fa1ff', '#1458e0',
      `<rect x="18" y="28" width="64" height="46" rx="8" fill="rgba(255,255,255,.16)"/>
       <path d="M18 34 50 58 82 34" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),

    messages: () => app('#54e074', '#12a445',
      `<path d="M50 20c18 0 32 12.6 32 28S68 76 50 76c-3.6 0-7-.5-10.3-1.5L22 81l4.6-14.2C22.4 62.6 18 57.7 18 48c0-15.4 14.4-28 32-28Z" fill="#fff" opacity=".95"/>`),

    photos: () => raw(`<rect width="100" height="100" rx="23" fill="#fbfbfd"/>
      <g>${[['#f5c33c', 0], ['#e8863c', 45], ['#e74c3c', 90], ['#c86bd8', 135], ['#7a6ff0', 180], ['#4f9cf7', 225], ['#4ec9b0', 270], ['#7ed957', 315]]
        .map(([c, r]) => `<circle cx="${(50 + 22 * Math.cos(r * Math.PI / 180)).toFixed(1)}" cy="${(50 + 22 * Math.sin(r * Math.PI / 180)).toFixed(1)}" r="12" fill="${c}" opacity=".92"/>`).join('')}</g>`),

    music: () => app('#fb5f7a', '#e82e5b',
      `<path d="M40 22v38.2a12 12 0 1 0 6 10.3V36l26-5.4v26.6a12 12 0 1 0 6 10.3V20Z" fill="#fff"/>`),

    calendar: () => raw(`<rect width="100" height="100" rx="23" fill="#fbfbfd"/>
      <rect x="0" y="0" width="100" height="30" rx="0" fill="#ff5f57"/>
      <text x="50" y="24" text-anchor="middle" font-family="inherit" font-size="19" font-weight="700" fill="#fff">27</text>
      <text x="50" y="66" text-anchor="middle" font-family="inherit" font-size="40" font-weight="200" fill="#3a3a3c">${new Date().getDate()}</text>
      <circle cx="50" cy="58" r="24" fill="none" stroke="#ff5f57" stroke-width="2.4"/>`),

    calculator: () => app('#3b3b40', '#141416',
      `<rect x="22" y="18" width="56" height="14" rx="7" fill="rgba(255,255,255,.9)"/>
       <rect x="22" y="40" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="36.5" y="40" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="51" y="40" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="65.5" y="40" width="12.5" height="10" rx="2.5" fill="#ff9f0a"/>
       <rect x="22" y="54" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="36.5" y="54" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="51" y="54" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="65.5" y="54" width="12.5" height="10" rx="2.5" fill="#ff9f0a"/>
       <rect x="22" y="68" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="36.5" y="68" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="51" y="68" width="12.5" height="10" rx="2.5" fill="rgba(255,255,255,.55)"/>
       <rect x="65.5" y="68" width="12.5" height="10" rx="2.5" fill="#ff9f0a"/>`),

    terminal: () => app('#33333a', '#0c0c0e',
      `<path d="M26 32 42 50 26 68" fill="none" stroke="#4fe26e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M48 68h26" stroke="#4fe26e" stroke-width="7" stroke-linecap="round"/>`),

    settings: () => app('#c9c9cf', '#7f7f87',
      `<circle cx="50" cy="50" r="17" fill="none" stroke="#2c2c30" stroke-width="8"/>
       <g stroke="#2c2c30" stroke-width="7" stroke-linecap="round">
        <path d="M50 14v10M50 76v10M14 50h10M76 50h10M24.5 24.5l7 7M68.5 68.5l7 7M75.5 24.5l-7 7M31.5 68.5l-7 7"/></g>`),

    assistant: () => raw(`<defs>
      <radialGradient id="orb${uid()}" cx=".35" cy=".3" r=".9">
        <stop offset="0" stop-color="#e8dfff"/><stop offset=".4" stop-color="#a78bff"/>
        <stop offset=".75" stop-color="#6f5bff"/><stop offset="1" stop-color="#2b1fd6"/></radialGradient></defs>
      <circle cx="50" cy="50" r="40" fill="url(#orb)"/>
      <circle cx="38" cy="36" r="12" fill="rgba(255,255,255,.5)"/>
      <path d="M18 62a40 40 0 0 0 64 0c-4 8-20 12-32 12s-28-4-32-12Z" fill="rgba(255,255,255,.35)"/>`),

    textedit: () => raw(`<rect width="100" height="100" rx="23" fill="#fbfbfd"/>
      <rect x="18" y="22" width="64" height="60" rx="5" fill="#fff" stroke="#d6d6db"/>
      <rect x="28" y="34" width="44" height="4.5" rx="2.2" fill="#c9c9ce"/>
      <rect x="28" y="45" width="44" height="4.5" rx="2.2" fill="#d8d8dd"/>
      <rect x="28" y="56" width="30" height="4.5" rx="2.2" fill="#e2e2e6"/>
      <rect x="62" y="66" width="16" height="14" rx="3" fill="#0a84ff" transform="rotate(-45 70 73)"/>`),

    preview: () => app('#8e8e96', '#4c4c54',
      `<rect x="20" y="24" width="60" height="52" rx="6" fill="#f4f4f8"/>
       <path d="M26 66 40 50l9 9 8-8 11 15Z" fill="#9ad3ff"/>
       <circle cx="42" cy="40" r="5" fill="#ffd60a"/>
       <circle cx="68" cy="64" r="13" fill="#0a84ff" opacity=".95"/>
       <circle cx="68" cy="64" r="6" fill="none" stroke="#fff" stroke-width="2.5"/>`),

    about: () => app('#c9c9cf', '#7f7f87',
      `<path d="M50 20c9 0 15 8 15 17 0 11-6 15-6 22h-18c0-7-6-11-6-22 0-9 6-17 15-17Z" fill="#3a3a3e"/>
       <path d="M50 15c-2.5 0-4.5-2-4.5-4.5S47.5 6 50 6s4.5 2 4.5 4.5S52.5 15 50 15Z" fill="#3a3a3e"/>
       <rect x="38" y="63" width="24" height="10" rx="5" fill="#2c2c30"/>`),

    trash: () => app('#8e8e96', '#54545c',
      `<path d="M30 36h40l-3 40a8 8 0 0 1-8 7H41a8 8 0 0 1-8-7Z" fill="rgba(255,255,255,.14)"/>
       <path d="M36 36h28" stroke="rgba(255,255,255,.5)" stroke-width="2.5"/>
       <path d="M42 44v28M50 44v28M58 44v28" stroke="rgba(255,255,255,.4)" stroke-width="2.5" stroke-linecap="round"/>`),

    drive: () => raw(`${sq('#b9b9c2', '#6e6e78')}
      <rect x="14" y="22" width="72" height="56" rx="8" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2"/>
      <circle cx="70" cy="30" r="3" fill="#30d158"/>`),

    doc: () => raw(`<path d="M28 14h34l14 14v58a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#fbfbfd" stroke="#d6d6db" stroke-width="2"/>
      <path d="M62 14v14h14" fill="#e8e8ed"/>
      <rect x="32" y="40" width="36" height="4.5" rx="2.2" fill="#c9c9ce"/>
      <rect x="32" y="51" width="36" height="4.5" rx="2.2" fill="#d8d8dd"/>
      <rect x="32" y="62" width="22" height="4.5" rx="2.2" fill="#e2e2e6"/>`),

    image: () => raw(`<path d="M28 14h34l14 14v58a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#fbfbfd" stroke="#d6d6db" stroke-width="2"/>
      <path d="M62 14v14h14" fill="#e8e8ed"/>
      <circle cx="42" cy="42" r="5" fill="#ffd60a"/>
      <path d="M30 74 44 58l9 9 7-7 10 14Z" fill="#7ab8f5"/>`),

    genericApp: () => app('#c9c9cf', '#7f7f87',
      `<circle cx="38" cy="38" r="6" fill="rgba(255,255,255,.75)"/>
       <circle cx="62" cy="38" r="6" fill="rgba(255,255,255,.75)"/>
       <circle cx="38" cy="62" r="6" fill="rgba(255,255,255,.75)"/>
       <circle cx="62" cy="62" r="6" fill="rgba(255,255,255,.75)"/>`),

    /* ---------- UI glyphs (16-ish viewBox-free, inline sized) ---------- */
    glyph: (name) => {
      const G = {
        search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>`,
        wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M5.5 12.5a10.5 10.5 0 0 1 13 0"/><path d="M8.6 16a6 6 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></svg>`,
        battery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="17" height="10" rx="2.5"/><rect x="5" y="10" width="11" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M21.5 10.5v3" stroke-linecap="round"/></svg>`,
        cc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M8.6 8.6a5 5 0 0 0 0 6.8M15.4 8.6a5 5 0 0 1 0 6.8M6.4 6.4a8 8 0 0 0 0 11.2M17.6 6.4a8 8 0 0 1 0 11.2"/></svg>`,
        sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg>`,
        moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5Z"/></svg>`,
        bt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 7.5 17 17 12 21.5V2.5l5 5-11 9.5"/></svg>`,
        airdrop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="12"/></svg>`,
        focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6" fill="currentColor" fill-opacity=".35"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5Z"/></svg>`,
        pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>`,
        next: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5v13l9-6.5ZM16 5.5v13h2.6v-13Z"/></svg>`,
        prev: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5.5v13l-9-6.5ZM8 5.5v13H5.4v-13Z"/></svg>`,
        volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h4l5 4v-13l-5 4Z" fill="currentColor" stroke="none"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.8a8 8 0 0 1 0 10.4"/></svg>`,
        gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none"/></svg>`,
        back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>`,
        fwd: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,
        refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/></svg>`,
        plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
        trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12M10 11.5v5M14 11.5v5"/></svg>`,
        star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>`,
        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M5 12.5V18a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18v-5.5"/></svg>`,
        x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
        send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 11 20 4.5l-3.2 16-5-5.6 3-6.4Z"/></svg>`,
        grid: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/></svg>`,
        list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>`,
        folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h4l2 2.5h7a2 2 0 0 1 2 2V17a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 17Z"/></svg>`,
        doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-16a.5.5 0 0 1 .5-.5Z"/><path d="M13.5 3.5V8H18"/></svg>`,
        image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="m5.5 17 4.5-4.5 3 3 2.5-2.5 3 4"/></svg>`,
        music: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5a3.5 3.5 0 1 1-1.5-2.9V5l10-2v10.5a3.5 3.5 0 1 1-1.5-2.9V7.2L9 8.9Z"/></svg>`,
        pin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 4.5 19.5 9 10 18.5l-2-2-3.2 2.7L3.5 18l2.7-3.2-2-2Z"/></svg>`,
        pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 4.8 16 17 3.8a2.3 2.3 0 0 1 3.2 3.2L8 19.2Z"/><path d="m14.5 6.5 3 3"/></svg>`,
        clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
        mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>`,
        eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>`,
        reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v5"/></svg>`,
        forward: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v5"/></svg>`,
        heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 0-6.5 4.5 4.5 0 0 1 6.4 0l.7.7.7-.7a4.5 4.5 0 0 1 6.4 0 4.6 4.6 0 0 1 0 6.5Z"/></svg>`,
        shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3c3 0 5 3 7 5s4 5 7 5h1M21 7h-1c-3 0-5 3-7 5s-4 5-7 5H3M3 17h3"/><path d="m17 4 4 3-4 3M7 14l-4 3 4 3"/></svg>`,
        repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        forward2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l7 7-7 7"/><path d="M22 12H2"/></svg>`,
      };
      return (G[name] || '').replace('<svg ', '<svg width="100%" height="100%" ');
    },
  };
})();
