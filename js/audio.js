// ===== Audio: voice (with lip-sync analyser), synthesized SE and BGM =====
'use strict';
const Sound = (() => {
  let ac, master, voiceBus, seBus, bgmBus, analyser, rev, buffers = {}, manifest = {}, current = null, unlocked = false;
  const vol = { master: 0.9, voice: 1.0, se: 0.7, bgm: 0.35 };
  let lastPick = {};
  function ensure() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = vol.master; master.connect(ac.destination);
    voiceBus = ac.createGain(); voiceBus.gain.value = vol.voice;
    analyser = ac.createAnalyser(); analyser.fftSize = 512; voiceBus.connect(analyser); voiceBus.connect(master);
    seBus = ac.createGain(); seBus.gain.value = vol.se; seBus.connect(master);
    bgmBus = ac.createGain(); bgmBus.gain.value = vol.bgm; bgmBus.connect(master);
    // small room reverb for SE/BGM
    rev = ac.createConvolver(); const len = ac.sampleRate * 1.6, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; const rg = ac.createGain(); rg.gain.value = 0.22; rev.connect(rg); rg.connect(master);
    return ac;
  }
  async function loadVoices(base) {
    manifest = await (await fetch(base + 'voices.json')).json();
    return manifest;
  }
  async function fetchBuf(url) {
    if (buffers[url]) return buffers[url];
    const p = fetch(url).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ensure().decodeAudioData(b, res, rej)));
    buffers[url] = p; return p;
  }
  function preloadAll(base) { for (const k in manifest) for (const l of manifest[k]) fetchBuf(base + l.f).catch(() => {}); }
  function unlock() { ensure(); if (ac.state === 'suspended') ac.resume(); unlocked = true; }
  // play a voice line from category; returns {text, dur} promise
  let voiceBase = 'assets/voice/';
  function pick(cat) {
    const L = manifest[cat]; if (!L || !L.length) return null;
    let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === lastPick[cat]) i = (i + 1) % L.length; lastPick[cat] = i; return L[i];
  }
  async function voice(cat, opts = {}) {
    if (!ac || vol.voice <= 0) { const l = pick(cat); return l ? { text: l.t, dur: 1.8 } : null; }
    const l = pick(cat); if (!l) return null;
    if (current && !opts.force && current.prio > (opts.prio || 0) && current.end > ac.currentTime) return null;
    if (current) { try { current.src.stop(); } catch (e) {} }
    const buf = await fetchBuf(voiceBase + l.f).catch(() => null); if (!buf) return null;
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(voiceBus); src.start();
    current = { src, end: ac.currentTime + buf.duration, prio: opts.prio || 0 };
    src.onended = () => { if (current && current.src === src) current = null; };
    return { text: l.t, dur: buf.duration };
  }
  const tdata = new Uint8Array(512);
  function level() { // 0..1 voice loudness for lip sync
    if (!analyser || !current) return 0;
    analyser.getByteTimeDomainData(tdata); let s = 0; for (let i = 0; i < tdata.length; i++) { const v = (tdata[i] - 128) / 128; s += v * v; }
    return Math.min(1, Math.sqrt(s / tdata.length) * 5.5);
  }
  function speaking() { return !!current && ac && current.end > ac.currentTime; }
  // ---------- SE ----------
  function noiseBuf(dur) { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  let nb;
  function env(g, t, a, d, peak) { peak = Math.max(peak, 0.0002); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function se(name, p = 1) {
    if (!ac || !unlocked) return; const t = ac.currentTime; nb = nb || noiseBuf(2);
    if (name === 'munch') {
      for (let i = 0; i < 3; i++) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 700; f.Q.value = 1.2; const g = ac.createGain(); s.connect(f); f.connect(g); g.connect(seBus); const tt = t + i * 0.16 + Math.random() * 0.03; env(g, tt, 0.008, 0.09, 0.5); s.start(tt, Math.random()); s.stop(tt + 0.15);
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, tt); o.frequency.exponentialRampToValueAtTime(90, tt + 0.07); const g2 = ac.createGain(); o.connect(g2); g2.connect(seBus); env(g2, tt, 0.005, 0.07, 0.35); o.start(tt); o.stop(tt + 0.1); }
    } else if (name === 'gulp') {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.18); const g = ac.createGain(); o.connect(g); g.connect(seBus); env(g, t, 0.01, 0.2, 0.5); o.start(t); o.stop(t + 0.25);
    } else if (name === 'boing') { // purun jiggle
      const o = ac.createOscillator(); o.type = 'sine'; const base = 150 * p; o.frequency.setValueAtTime(base * 1.9, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.12); o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.22); o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.36);
      const lfo = ac.createOscillator(); lfo.frequency.value = 16; const lg = ac.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
      const g = ac.createGain(); o.connect(g); g.connect(seBus); g.connect(rev); env(g, t, 0.01, 0.42, 0.45); o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5);
    } else if (name === 'grow') {
      const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.9); const g = ac.createGain(); s.connect(f); f.connect(g); g.connect(seBus); g.connect(rev); env(g, t, 0.25, 0.8, 0.35); s.start(t); s.stop(t + 1.2);
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + 0.9); const g2 = ac.createGain(); o.connect(g2); g2.connect(seBus); env(g2, t, 0.2, 0.8, 0.12); o.start(t); o.stop(t + 1.1);
    } else if (name === 'stage') {
      [523.25, 659.25, 783.99, 1046.5].forEach((fq, i) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = fq; const g = ac.createGain(); o.connect(g); g.connect(seBus); g.connect(rev); const tt = t + i * 0.09; env(g, tt, 0.01, 0.6, 0.22); o.start(tt); o.stop(tt + 0.7); });
    } else if (name === 'buy') {
      [880, 1318.5].forEach((fq, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fq; const g = ac.createGain(); o.connect(g); g.connect(seBus); g.connect(rev); const tt = t + i * 0.07; env(g, tt, 0.005, 0.3, 0.25); o.start(tt); o.stop(tt + 0.35); });
    } else if (name === 'click') {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.05); const g = ac.createGain(); o.connect(g); g.connect(seBus); env(g, t, 0.003, 0.06, 0.18); o.start(t); o.stop(t + 0.08);
    } else if (name === 'rub') {
      const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = ac.createGain(); s.connect(f); f.connect(g); g.connect(seBus); env(g, t, 0.04, 0.16, 0.12 * p); s.start(t, Math.random()); s.stop(t + 0.22);
    } else if (name === 'nope') {
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 180; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = ac.createGain(); o.connect(f); f.connect(g); g.connect(seBus); env(g, t, 0.005, 0.18, 0.12); o.start(t); o.stop(t + 0.2);
    } else if (name === 'whoosh') {
      const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.25); const g = ac.createGain(); s.connect(f); f.connect(g); g.connect(seBus); env(g, t, 0.05, 0.25, 0.18); s.start(t); s.stop(t + 0.35);
    }
  }
  // ---------- BGM: gentle procedural loop ----------
  let bgmOn = false, nextT = 0, step = 0, timer = null, space = 0;
  const BPM = 88, SPB = 60 / BPM / 2; // eighth notes
  const prog = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]]; // Fmaj7 Dm7 Bbmaj7 C7 (midi)
  const mel = [72, -1, 69, 72, 74, -1, 72, 69, 69, -1, 67, 65, 67, -1, -1, -1, 65, -1, 69, 72, 74, 76, 74, 72, 70, -1, 69, 67, 67, -1, -1, -1];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function note(f, t, d, type, g0, dest) { g0 = Math.max(g0, 0.0002); const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const g = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; o.connect(lp); lp.connect(g); g.connect(dest || bgmBus); g.connect(rev); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.05); }
  function schedule() {
    while (nextT < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, s8 = step % 8, ch = prog[bar];
      if (s8 % 2 === 0) note(mtof(ch[(s8 / 2) % 4] + 12), nextT, SPB * 2.4, 'triangle', 0.05);
      if (s8 === 0 || s8 === 5) note(mtof(ch[0] - 12), nextT, SPB * 3, 'sine', 0.16);
      if (s8 === 0) for (const n of ch) note(mtof(n), nextT, SPB * 7.5, 'sine', 0.025 + 0.02 * space);
      const m = mel[step % 32]; if (m > 0 && space < 0.7) note(mtof(m), nextT, SPB * 1.8, 'sine', 0.07 * (1 - space));
      if (s8 === 2 || s8 === 6) { const s = ac.createBufferSource(); s.buffer = nb || (nb = noiseBuf(2)); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ac.createGain(); s.connect(f); f.connect(g); g.connect(bgmBus); env(g, nextT, 0.002, 0.05, 0.05 * (1 - space)); s.start(nextT, Math.random()); s.stop(nextT + 0.08); }
      nextT += SPB; step++;
    }
  }
  function bgm(on) {
    ensure(); bgmOn = on; clearInterval(timer);
    if (on) { nextT = ac.currentTime + 0.1; timer = setInterval(schedule, 80); }
  }
  function setSpace(v) { space = v; }
  function setVol(k, v) { vol[k] = v; if (!ac) return; ({ master, voice: voiceBus, se: seBus, bgm: bgmBus })[k].gain.value = v; }
  return { loadVoices, preloadAll, unlock, voice, level, speaking, se, bgm, setSpace, setVol, vol, get manifest() { return manifest; } };
})();
