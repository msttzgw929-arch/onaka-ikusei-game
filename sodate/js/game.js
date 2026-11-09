/* ふくばら♡ゴッドハンド — game engine */
(() => {
'use strict';
const ST = window.STORY, CH = ST.chars, CAL = window.CALIB, HC = window.HAND_CAL;
const AM = window.ASSET_MAP || {};
const asset = p => AM[p] || p;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => performance.now() / 1000;
const IMG_W = 592, IMG_H = 1024;
const THR = [0, 15, 32, 50, 68, 85, 100];
const STAGE_NAME = ['ぷにっと', 'ふっくら', 'まんまる', 'どっしり', 'ぱんぱん', 'はち切れ寸前', '★伝説の福腹★'];
const DEBUG_CAL = /calib=1/.test(location.search);

/* ---------------- save ---------------- */
const KEY = 'fukubara_godhand_v1';
const defState = () => ({ pts: 0, total: 0, upg: { oil: 0, tech: 0, circle: 0, focus: 0, auto: 0 },
  ch: CH.map(() => ({ g: 0, seen: 0, done: false, rubs: 0, boings: 0 })), prologue: false, finale: false, tut: false,
  set: { sfx: 0.8, voice: 1.0, bgm: 0.35, mute: false, speed: 1 } });
let S = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.ch) { const b = defState(); return Object.assign(b, d, { set: Object.assign(b.set, d.set), upg: Object.assign(b.upg, d.upg) }); } } catch (e) {}
  return defState();
}
let saveT = 0;
function save(force) { const t = now(); if (!force && t - saveT < 2) return; saveT = t; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const levelOf = g => { let l = 0; for (let i = 1; i < THR.length; i++) if (g >= THR[i]) l = i; return l; };

/* ---------------- upgrades ---------------- */
const UPG = [
  { k: 'oil', ic: '🧴', nm: '福々マッサージオイル', ds: lv => `なでなでの効果 +30%（現在 ×${(1 + .3 * lv).toFixed(1)}）`, base: 60, max: 12 },
  { k: 'tech', ic: '✋', nm: 'ゴッドハンド奥義', ds: lv => `ぽんぽん＆ビヨーンの効果 +40%（現在 ×${(1 + .4 * lv).toFixed(1)}）`, base: 80, max: 12 },
  { k: 'circle', ic: '🌀', nm: '円の極意', ds: lv => `円を描く撫で方のボーナス +35%（現在 ×${(1 + .35 * lv).toFixed(2)}）`, base: 100, max: 12 },
  { k: 'focus', ic: '🔥', nm: '集中のツボ', ds: lv => `コンボが続きやすく、倍率上限アップ（上限 ×${(1.5 + .2 * lv).toFixed(1)}）`, base: 120, max: 10 },
  { k: 'auto', ic: '🔄', nm: '自動ローラー「もみ丸くん」', ds: lv => `何もしなくても自動でお腹が育つ（毎秒 +${(0.02 * lv).toFixed(2)}%）`, base: 220, max: 10 },
];
const cost = u => Math.round(u.base * Math.pow(1.75, S.upg[u.k]));

/* ---------------- audio ---------------- */
const AU = { ctx: null, master: null, sfx: null, bgm: null, noise: null, rub: null, rubG: null, stretch: null, stretchG: null, voiceEl: null, bgmOn: false };
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  const c = AU.ctx = new C();
  AU.master = c.createGain(); AU.master.connect(c.destination);
  const comp = c.createDynamicsCompressor(); comp.connect(AU.master);
  AU.sfx = c.createGain(); AU.sfx.connect(comp);
  AU.bgm = c.createGain(); AU.bgm.connect(comp);
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  let b0 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .97 * b0 + .03 * w; d[i] = b0 * 6 + w * .15; }
  AU.noise = buf;
  // continuous rub noise
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .8;
  AU.rubF = bp; AU.rubG = c.createGain(); AU.rubG.gain.value = 0;
  src.connect(bp); bp.connect(AU.rubG); AU.rubG.connect(AU.sfx); src.start();
  // stretch creak
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 6;
  AU.stretch = o; AU.stretchF = lp; AU.stretchG = c.createGain(); AU.stretchG.gain.value = 0;
  o.connect(lp); lp.connect(AU.stretchG); AU.stretchG.connect(AU.sfx); o.start();
  applyVol(); startBgm();
}
function applyVol() {
  if (!AU.ctx) return; const m = S.set.mute ? 0 : 1, t = AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(m, t, .05); AU.sfx.gain.setTargetAtTime(S.set.sfx, t, .05); AU.bgm.gain.setTargetAtTime(S.set.bgm * .5, t, .1);
  if (AU.voiceEl) AU.voiceEl.volume = S.set.mute ? 0 : S.set.voice;
  if (AU.songEl) AU.songEl.volume = S.set.mute ? 0 : Math.min(1, S.set.voice);
  $('#btnMute').textContent = S.set.mute ? '🔇' : '🔊';
}
function env(g, t, a, peak, dec) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type, f0, f1, dur, vol, when = 0, dest) {
  const c = AU.ctx; if (!c) return; const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, .008, vol, dur); o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  tap() { tone('sine', 260, 110, .16, .5); tone('triangle', 520, 300, .06, .12); },
  pop() { tone('sine', 600 + Math.random() * 300, 1200, .08, .15); },
  boing(amt) {
    const c = AU.ctx; if (!c) return; const t = c.currentTime, dur = .55 + amt * .6;
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(140 + amt * 60, t); o.frequency.exponentialRampToValueAtTime(320 + amt * 160, t + .08);
    o.frequency.exponentialRampToValueAtTime(110, t + dur);
    lfo.frequency.setValueAtTime(14, t); lfo.frequency.linearRampToValueAtTime(7, t + dur);
    lg.gain.setValueAtTime(70 + amt * 60, t); lg.gain.exponentialRampToValueAtTime(3, t + dur);
    lfo.connect(lg); lg.connect(o.frequency); env(g, t, .01, .55, dur);
    o.connect(g); g.connect(AU.sfx); o.start(t); lfo.start(t); o.stop(t + dur + .1); lfo.stop(t + dur + .1);
    tone('sine', 90, 55, .25, .5);
  },
  level() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('triangle', f, 0, .35, .22, i * .08); tone('sine', f * 2, 0, .2, .05, i * .08); }); },
  combo() { tone('sine', 1320, 0, .25, .12); tone('sine', 1760, 0, .3, .08, .06); },
  buy() { tone('square', 880, 0, .08, .08); tone('square', 1320, 0, .12, .08, .07); },
  click() { tone('sine', 900, 600, .05, .1); },
  blip() { tone('square', 1500 + Math.random() * 200, 0, .025, .02); },
  fanfare() { [[523, 0], [659, .15], [784, .3], [1047, .45], [784, .7], [1047, .85]].forEach(([f, w]) => { tone('sawtooth', f, 0, .3, .08, w); tone('triangle', f / 2, 0, .4, .12, w); }); },
};
// gentle generative BGM
const BGM = { step: 0, next: 0, timer: null };
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 59, 62, 65]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function startBgm() {
  if (BGM.timer) return; BGM.next = AU.ctx.currentTime + .1;
  BGM.timer = setInterval(() => {
    const c = AU.ctx; if (!c || c.state !== 'running') return;
    while (BGM.next < c.currentTime + .5) {
      const s = BGM.step, ch = CHORDS[Math.floor(s / 8) % 4], t = BGM.next - c.currentTime;
      if (s % 8 === 0) ch.forEach(n => tone('sine', mtof(n), 0, 3.2, .035, t, AU.bgm));
      if (s % 8 === 0) tone('triangle', mtof(ch[0] - 12), 0, 1.4, .07, t, AU.bgm);
      if (s % 8 === 4) tone('triangle', mtof(ch[0] - 12 + 7), 0, 1.2, .05, t, AU.bgm);
      const arp = [0, 2, 1, 3, 2, 1, 3, 2][s % 8]; if ((s * 7) % 5 !== 0) tone('sine', mtof(ch[arp] + 12), 0, .5, .03, t, AU.bgm);
      BGM.step++; BGM.next += .2;
    }
  }, 100);
}
function playVoice(name, onend) {
  if (AU.voiceEl) { AU.voiceEl.onended = null; AU.voiceEl.pause(); }
  if (!name || S.set.voice <= 0) { onend && onend(false); return null; }
  const a = new Audio(asset('assets/voice/' + name + '.mp3')); a.volume = S.set.mute ? 0 : S.set.voice;
  a.onended = () => onend && onend(true); a.onerror = () => onend && onend(false);
  const p = a.play(); if (p && p.catch) p.catch(() => onend && onend(false));
  AU.voiceEl = a; return a;
}
// duck bgm while voice
function duck(on) { if (AU.ctx) AU.bgm.gain.setTargetAtTime(on ? S.set.bgm * .2 : S.set.bgm * .5, AU.ctx.currentTime, .2); }

/* ---------------- screens ---------------- */
function show(id) { document.querySelectorAll('.screen').forEach(e => e.classList.toggle('active', e.id === id)); cur.screen = id; }
const cur = { screen: 'title', ci: 0 };
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 1800); }

/* ---------------- images ---------------- */
const IM = { n: [], m: [], hl: new Image(), hr: new Image() };
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = asset(src); }); }
const imgReady = Promise.all([
  ...CH.map((c, i) => loadImg(`assets/chara${i + 1}.jpg`).then(im => IM.n[i] = im)),
  ...CH.map((c, i) => loadImg(`assets/chara${i + 1}_m.jpg`).then(im => IM.m[i] = im)),
  loadImg('assets/hand_l.png').then(im => IM.hl = im), loadImg('assets/hand_r.png').then(im => IM.hr = im),
]);

/* ---------------- renderer (WebGL warp) ---------------- */
const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS = `precision highp float;
uniform sampler2D uA,uB;uniform float uMix,uGrow,uWob,uSq,uRg,uDpr;uniform vec4 uCalA,uCalB,uRect;uniform vec2 uJig,uG,uD,uSize;
uniform vec3 uH0,uH1;uniform float uDbg;
vec2 bulge(vec2 p,vec4 cal,out float bm){
  vec2 C=cal.xy+vec2(0.,cal.w*.18*uGrow);
  vec2 R=cal.zw*(1.7+.2*uGrow);
  vec2 d=(p-C)/R;float r=length(d);
  vec2 rb=(p-cal.xy)/(cal.zw*(1.25+.5*uGrow));bm=1.-smoothstep(.55,1.,length(rb));
  if(r>=1.)return p;
  float M=1.+uGrow*min(.8,250./cal.z-1.)+uWob;
  float h=smoothstep(.28,1.,r);
  float kx=mix(1./(M*(1.+uSq)),1.,h),ky=mix(1./(M*(1.-uSq)),1.,h);
  float w=(1.-r*r);w*=w;
  return C+vec2(d.x*kx,d.y*ky)*R-uJig*w;
}
vec2 dimple(vec2 q,vec3 H,float bm,inout float sh){
  vec2 e=q-H.xy;float rh=uRg*.75;float f=exp(-dot(e,e)/(rh*rh))*bm*H.z;
  sh-=.16*f;return H.xy+e*(1.+.5*f);
}
vec4 sampleW(sampler2D t,vec2 p,vec4 cal,out float sh){
  sh=1.;float bm;
  // stretch (inverse of forward map x -> x + D*gauss(x-G))
  vec2 q=p;float rg2=uRg*uRg;float f=0.;
  for(int i=0;i<4;i++){vec2 e=q-uG;f=exp(-dot(e,e)/rg2);q=p-uD*f;}
  sh+=.10*f*clamp(length(uD)/uRg,0.,1.);
  vec2 b=bulge(q,cal,bm);
  b=dimple(b,uH0,bm,sh);b=dimple(b,uH1,bm,sh);
  vec2 uv=b/uSize;
  return texture2D(t,clamp(uv,vec2(.001),vec2(.999)));
}
void main(){
  vec2 fc=vec2(gl_FragCoord.x,uRect.w-gl_FragCoord.y)/uDpr;
  vec2 p=(fc-uRect.xy)/uRect.z;
  float sa,sb;vec4 ca=sampleW(uA,p,uCalA,sa);vec4 cb=uMix>0.001?sampleW(uB,p,uCalB,sb):vec4(0.);
  vec4 c=mix(ca*vec4(vec3(sa),1.),cb*vec4(vec3(sb),1.),uMix);
  vec2 pu=p/uSize;if(pu.x<0.||pu.y<0.||pu.x>1.||pu.y>1.)c=vec4(0.);
  c*=smoothstep(0.,18.,p.x)*smoothstep(0.,18.,uSize.x-p.x)*smoothstep(0.,18.,uSize.y-p.y);
  if(uDbg>.5){vec4 cl=mix(uCalA,uCalB,uMix);vec2 d=(p-cl.xy)/cl.zw;float r=length(d);if(abs(r-1.)<.012)c=vec4(0.,1.,.3,1.);}
  gl_FragColor=vec4(c.rgb*c.a,c.a);
}`;
const R = { gl: null, tex: [], u: {}, w: 0, h: 0, dpr: 1, sc: 1, ox: 0, oy: 0, fb2d: null };
function initGL() {
  const cv = $('#gl');
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { R.fb2d = cv.getContext('2d'); return; }
  R.gl = gl;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr); R.pr = pr;
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  ['uA', 'uB', 'uMix', 'uGrow', 'uWob', 'uSq', 'uRg', 'uDpr', 'uCalA', 'uCalB', 'uRect', 'uJig', 'uG', 'uD', 'uSize', 'uH0', 'uH1', 'uDbg'].forEach(n => R.u[n] = gl.getUniformLocation(pr, n));
  gl.uniform1i(R.u.uA, 0); gl.uniform1i(R.u.uB, 1);
  R.tex = [gl.createTexture(), gl.createTexture()];
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}
function fallback2D() { const old = $('#gl'), cv = old.cloneNode(); old.replaceWith(cv); R.gl = null; R.fb2d = cv.getContext('2d'); resize(); }
function setTex(i, img) {
  const gl = R.gl; if (!gl) return;
  gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, R.tex[i]);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { console.warn('WebGL texture blocked (file://?) -> 2D fallback', e); fallback2D(); return; }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
function resize() {
  const st = $('#stage'), r = st.getBoundingClientRect();
  R.w = r.width; R.h = r.height; R.dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const id of ['#gl', '#fx']) { const c = $(id); c.width = Math.round(R.w * R.dpr); c.height = Math.round(R.h * R.dpr); }
  const VIS = 0.80; // show top 80% of the image (head to knees) to make the belly larger
  R.sc = Math.min(R.w / IMG_W * 0.98, R.h / (IMG_H * VIS));
  R.ox = (R.w - IMG_W * R.sc) / 2; R.oy = Math.min(0, (R.h - IMG_H * VIS * R.sc) / 2) + Math.max(0, (R.h - IMG_H * VIS * R.sc) / 2);
  if (R.gl) R.gl.viewport(0, 0, $('#gl').width, $('#gl').height);
  const hw = CAL[cur.ci].n.rx * (HC.size || 1) * R.sc;
  for (const id of ['#handL', '#handR']) $(id).style.width = hw + 'px';
}
const toImg = (x, y) => [(x - R.ox) / R.sc, (y - R.oy) / R.sc];
const toScr = (x, y) => [x * R.sc + R.ox, y * R.sc + R.oy];

/* ---------------- game state / physics ---------------- */
const G = {
  running: false, g: 0, disp: 0, mix: 0, lastActive: -9, ptr: { x: 0, y: 0, ix: 0, iy: 0, over: false, down: false, id: null },
  down: null, rubbing: false, grab: null, Dx: 0, Dy: 0, Dvx: 0, Dvy: 0, jx: 0, jy: 0, jvx: 0, jvy: 0, wob: 0, wobv: 0, sq: 0, sqv: 0,
  phase: 0, press: 0, tapPress: 0, combo: 0, comboT: -9, comboAcc: 0, lastAng: null, rubSpeed: 0, voiceCD: 0, autoAcc: 0, paused: false, pinchMode: false,
  hl: { x: 0, y: 0, r: 0, s: 1 }, hr: { x: 0, y: 0, r: 0, s: 1 }, parts: [], lv: 0, lastT: now(), boingCD: 0,
};
const calBlend = () => { const c = CAL[cur.ci]; const t = G.mix; return { cx: lerp(c.n.cx, c.m.cx, t), cy: lerp(c.n.cy, c.m.cy, t), rx: lerp(c.n.rx, c.m.rx, t), ry: lerp(c.n.ry, c.m.ry, t) }; };
const growEase = g => 1 - Math.pow(1 - g / 100, 1.6);
function onBelly(ix, iy, pad = 1) {
  const c = calBlend(), k = (1.25 + .5 * growEase(G.disp)) * pad;
  const dx = (ix - c.cx) / (c.rx * k), dy = (iy - (c.cy + c.ry * .18 * growEase(G.disp))) / (c.ry * k); return dx * dx + dy * dy < 1;
}
function rgPx() { return CAL[cur.ci].n.rx * .8; }

function addGrowth(amount, kind, x, y) {
  const ci = cur.ci, cs = S.ch[ci]; if (cs.done && cs.g >= 100) { amount *= 0; }
  const L = levelOf(cs.g); const a = amount / (1 + L * .15);
  const t = now();
  const focus = S.upg.focus;
  if (t - G.comboT > 0.9 + 0.2 * focus) { G.combo = 0; G.comboAcc = 0; }
  G.comboT = t;
  const mult = 1 + Math.min(G.combo / 40, 1) * (0.5 + 0.2 * focus);
  const before = cs.g;
  cs.g = Math.min(100, cs.g + a);
  const pts = (amount * 30 * mult) * (cs.g >= 100 && before >= 100 ? .5 : 1);
  S.pts += pts; S.total += pts; G.ptsAcc = (G.ptsAcc || 0) + pts;
  if (kind) { G.comboAcc += kind === 'rub' ? amount : 1; }
  if (G.comboAcc >= 0.35 || kind === 'tap' || kind === 'boing') { const n = Math.max(1, Math.floor(G.comboAcc / .35)); G.combo += kind === 'rub' ? n : 1; G.comboAcc = kind === 'rub' ? G.comboAcc % .35 : 0; comboPop(); }
  if (G.ptsAcc > 4 && x != null) { floatText('+' + Math.round(G.ptsAcc), x, y - 20, 'pt'); G.ptsAcc = 0; }
  const L2 = levelOf(cs.g);
  if (L2 > L) levelUp(L2);
  save();
}
function comboPop() {
  const e = $('#combo'); $('#comboN').textContent = G.combo; e.classList.add('show');
  const mult = 1 + Math.min(G.combo / 40, 1) * (0.5 + 0.2 * S.upg.focus); $('#comboM').textContent = '×' + mult.toFixed(2);
  e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  if (G.combo > 0 && G.combo % 25 === 0) { SFX.combo(); floatText(G.combo + ' COMBO!', R.w * .5, R.h * .2, 'big'); }
}
function levelUp(L) {
  SFX.level(); const c = calBlend(); const [x, y] = toScr(c.cx, c.cy - c.ry * 1.6);
  floatText(L >= 6 ? '★ 福腹 完成 ★' : `福腹レベル ${L}！ ${STAGE_NAME[L]}`, x, y, 'lv');
  burst(x, y + 60, 40, 'star');
  G.wobv += 3; G.sqv += 4;
  const cs = S.ch[cur.ci];
  setTimeout(() => {
    if (cur.screen !== 'game') return;
    if (L >= 6 && !cs.done) { cs.done = true; save(true); playScene(cur.ci, 'ending'); }
    else if (cs.seen < L && L <= 5) { cs.seen = L; save(true); playScene(cur.ci, L); }
    else sayReact('up');
  }, 900);
}

/* ---------------- floating text + particles ---------------- */
function floatText(t, x, y, cls) {
  const e = document.createElement('div'); e.className = 'float ' + (cls || ''); e.textContent = t;
  e.style.left = x + 'px'; e.style.top = y + 'px'; $('#floats').appendChild(e);
  setTimeout(() => e.remove(), cls === 'say' ? 2300 : 2100);
}
function burst(x, y, n, type) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 1, max: .8 + Math.random() * .8, type: type || (Math.random() < .6 ? 'heart' : 'spark'), s: 6 + Math.random() * 10, rot: Math.random() * 6, hue: Math.random() });
  }
}
function drawParts(dt) {
  const c = $('#fx').getContext('2d'); c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); c.clearRect(0, 0, R.w, R.h);
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.life -= dt / p.max; if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    p.vy += (p.type === 'drop' ? 500 : 120) * dt; p.vx *= .985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 2;
    c.save(); c.globalAlpha = Math.min(1, p.life * 1.6); c.translate(p.x, p.y); c.rotate(p.type === 'heart' ? Math.sin(p.rot) * .4 : p.rot);
    const s = p.s * (0.6 + 0.4 * p.life);
    if (p.type === 'heart') {
      c.fillStyle = `hsl(${330 + p.hue * 30},100%,${65 + p.hue * 15}%)`; c.beginPath(); c.moveTo(0, s * .35);
      c.bezierCurveTo(-s, -s * .3, -s * .5, -s, 0, -s * .45); c.bezierCurveTo(s * .5, -s, s, -s * .3, 0, s * .35); c.fill();
    } else if (p.type === 'drop') { c.fillStyle = 'rgba(255,230,150,.85)'; c.beginPath(); c.ellipse(0, 0, s * .3, s * .45, 0, 0, 7); c.fill(); }
    else { c.fillStyle = p.type === 'star' ? '#ffe27a' : '#fff'; c.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * .25 : s * .8, a = k * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); }
    c.restore();
  }
  if (DEBUG_CAL) { const cb = calBlend(); const [x, y] = toScr(cb.cx, cb.cy); c.strokeStyle = '#0f0'; c.beginPath(); c.ellipse(x, y, cb.rx * R.sc, cb.ry * R.sc, 0, 0, 7); c.stroke(); }
}

/* ---------------- input ---------------- */
function setPtr(e) {
  const r = $('#stage').getBoundingClientRect(); G.ptr.x = e.clientX - r.left; G.ptr.y = e.clientY - r.top;
  [G.ptr.ix, G.ptr.iy] = toImg(G.ptr.x, G.ptr.y);
}
function bindInput() {
  const st = $('#stage');
  st.addEventListener('contextmenu', e => e.preventDefault());
  st.addEventListener('pointerdown', e => {
    if (e.target.closest('.mode-sw')) return;
    initAudio(); if (G.paused) return;
    if (G.ptr.id !== null && G.ptr.id !== e.pointerId) return; // single pointer controls both hands
    G.ptr.id = e.pointerId; try { st.setPointerCapture(e.pointerId); } catch (x) {}
    setPtr(e); G.ptr.down = true; G.ptr.over = true;
    G.down = { x: G.ptr.x, y: G.ptr.y, t: now(), moved: 0 };
    G.lastAng = null;
    const on = onBelly(G.ptr.ix, G.ptr.iy, 1.1);
    if (on && (e.button === 2 || G.pinchMode)) startGrab();
    else if (on) { clearTimeout(G.lpT); G.lpT = setTimeout(() => { if (G.ptr.down && G.down && G.down.moved < 14 && !G.grab) startGrab(); }, 320); }
    e.preventDefault();
  });
  st.addEventListener('pointermove', e => {
    if (G.ptr.id !== null && G.ptr.id !== e.pointerId) return;
    const px = G.ptr.x, py = G.ptr.y, pix = G.ptr.ix, piy = G.ptr.iy; setPtr(e); G.ptr.over = true;
    if (!G.ptr.down || G.paused) return;
    const dsx = G.ptr.x - px, dsy = G.ptr.y - py; if (G.down) G.down.moved += Math.hypot(dsx, dsy);
    if (G.grab) return;
    if (G.down && G.down.moved > 14) clearTimeout(G.lpT);
    rubMove(pix, piy, G.ptr.ix, G.ptr.iy);
  });
  const up = e => {
    if (G.ptr.id !== e.pointerId) return;
    G.ptr.id = null; clearTimeout(G.lpT); G.ptr.down = false;
    if (e.pointerType !== 'mouse') G.ptr.over = false;
    if (G.paused) { G.grab = null; return; }
    if (G.grab) releaseGrab();
    else if (G.down && now() - G.down.t < .3 && G.down.moved < 14 && onBelly(G.ptr.ix, G.ptr.iy, 1.1)) doTap();
    G.down = null; G.rubbing = false;
  };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !G.ptr.down) G.ptr.over = false; });
  $('#modeRub').onclick = () => setMode(false); $('#modePinch').onclick = () => setMode(true);
  window.addEventListener('keydown', e => { if (cur.screen === 'game' && (e.key === 'p' || e.key === 'P')) setMode(!G.pinchMode); });
}
function setMode(p) { G.pinchMode = p; $('#modeRub').classList.toggle('on', !p); $('#modePinch').classList.toggle('on', p); SFX.click(); toast(p ? '🤏 つまむモード：お腹を押さえて引っぱり、離すとビヨーン！' : '🤲 もむモード：円を描くようになでよう'); }
function rubMove(x0, y0, x1, y1) {
  if (!onBelly(x1, y1, 1.15)) { G.rubbing = false; return; }
  let d = Math.hypot(x1 - x0, y1 - y0); if (d < .3) return; d = Math.min(d, 80);
  const c = calBlend(), cy = c.cy + c.ry * .18 * growEase(G.disp);
  const a = Math.atan2(y1 - cy, x1 - c.cx); let da = 0;
  if (G.lastAng !== null) { da = a - G.lastAng; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; }
  G.lastAng = a; da = Math.min(Math.abs(da), .5);
  const circ = da * .06 * (1 + .35 * S.upg.circle);
  const gain = d * .0009 * (1 + .3 * S.upg.oil) + circ;
  G.rubbing = true; G.lastActive = now(); G.rubSpeed = Math.min(1, G.rubSpeed + d / 60);
  G.phase += d * .045;
  G.jvx += (x1 - x0) * 2.2; G.jvy += (y1 - y0) * 2.2;
  addGrowth(gain, 'rub', G.ptr.x, G.ptr.y);
  S.ch[cur.ci].rubs += d / 600;
  if (Math.random() < d / 140) burst(G.ptr.x + (Math.random() - .5) * 120, G.ptr.y + (Math.random() - .5) * 40, 1, S.upg.oil > 0 && Math.random() < .3 ? 'drop' : null);
  if (now() - G.voiceCD > 6 && Math.random() < .02) sayReact('rub');
}
function doTap() {
  G.lastActive = now(); G.tapPress = 1; G.sqv += 3.2; G.wobv -= 1.2; G.jvy += 60;
  SFX.tap(); burst(G.ptr.x, G.ptr.y, 6);
  floatText(['ぽんっ', 'ぽよん', 'ぷにっ', 'ぽむっ'][Math.floor(Math.random() * 4)], G.ptr.x + (Math.random() - .5) * 60, G.ptr.y - 40);
  addGrowth(.22 * (1 + .4 * S.upg.tech), 'tap', G.ptr.x, G.ptr.y);
  if (now() - G.voiceCD > 3.5 && Math.random() < .35) sayReact('tap');
}
function startGrab() {
  clearTimeout(G.lpT);
  G.grab = { ix: G.ptr.ix, iy: G.ptr.iy, t: now(), maxA: 0 }; G.Dx = G.Dy = G.Dvx = G.Dvy = 0;
  G.lastActive = now(); SFX.pop(); $('#stretchMeter').classList.add('show');
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
}
function grabTarget() {
  const g = G.grab, rx = G.ptr.ix - g.ix, ry = G.ptr.iy - g.iy, l = Math.hypot(rx, ry), Dm = rgPx() * .78;
  if (l < .01) return [0, 0, 0]; const v = Dm * Math.tanh(l / (Dm * 1.6)); return [rx / l * v, ry / l * v, v / Dm];
}
function releaseGrab() {
  const g = G.grab; const amt = clamp(Math.hypot(G.Dx, G.Dy) / (rgPx() * .78), 0, 1); G.grab = null;
  $('#stretchMeter').classList.remove('show');
  G.releaseAt = { ix: g.ix, iy: g.iy };
  G.Dvx += -G.Dx * 4; G.Dvy += -G.Dy * 4; // fling back
  G.lastActive = now();
  if (amt < .12) return;
  SFX.boing(amt); G.wobv += 2.5 * amt; G.sqv -= 5 * amt; G.jvx -= G.Dx * 3; G.jvy -= G.Dy * 3;
  const [x, y] = toScr(g.ix, g.iy);
  floatText(amt > .65 ? 'ボイン！' : amt > .35 ? 'ビヨーン！' : 'ぷるん', x, y - 30, 'big');
  burst(x, y, Math.round(8 + amt * 20));
  S.ch[cur.ci].boings++;
  addGrowth((.3 + 2.2 * amt * amt) * (1 + .4 * S.upg.tech), 'boing', x, y);
  if (now() - G.boingCD > 1.2) { G.boingCD = now(); if (amt > .3) sayReact('boing'); }
}
function sayReact(type) {
  const c = CH[cur.ci], arr = c.react[type]; if (!arr) return;
  const i = Math.floor(Math.random() * arr.length); G.voiceCD = now();
  const [x, y] = toScr(CAL[cur.ci].n.cx, 175); floatText(arr[i], x + (Math.random() - .5) * 40, y, 'say');
  playVoice(`c${c.id}_r_${type}_${i}`);
}

/* ---------------- frame loop ---------------- */
function spring(x, v, k, c, dt) { const a = -k * x - c * v; v += a * dt; x += v * dt; return [x, v]; }
function frame() {
  requestAnimationFrame(frame);
  const t = now(); let dt = Math.min(.05, t - G.lastT); G.lastT = t;
  if (cur.screen !== 'game' && !G.vnGame) return;
  const cs = S.ch[cur.ci];
  // auto helper
  if (S.upg.auto > 0 && !G.paused && cur.screen === 'game') {
    G.autoAcc += dt; if (G.autoAcc > 1) { G.autoAcc = 0; if (cs.g < 100) { addGrowth(.02 * S.upg.auto, null); G.jvx += (Math.random() - .5) * 40; } }
  }
  G.disp = lerp(G.disp, cs.g, 1 - Math.exp(-dt * 3));
  const active = (t - G.lastActive < .9) || G.grab;
  G.mix = clamp(G.mix + (active ? dt / .35 : -dt / .55), 0, 1);
  const m = G.mix * G.mix * (3 - 2 * G.mix);
  G.rubSpeed = Math.max(0, G.rubSpeed - dt * 2.5);
  if (!G.rubbing || !G.ptr.down) G.rubSpeed *= .9;
  // physics substeps
  const N = 4, h = dt / N;
  for (let i = 0; i < N; i++) {
    if (G.grab) {
      const [tx, ty] = grabTarget(); [G.Dx, G.Dvx] = spring(G.Dx - tx, G.Dvx, 900, 60, h); G.Dx += tx; [G.Dy, G.Dvy] = spring(G.Dy - ty, G.Dvy, 900, 60, h); G.Dy += ty;
    } else { [G.Dx, G.Dvx] = spring(G.Dx, G.Dvx, 280, 4.2, h); [G.Dy, G.Dvy] = spring(G.Dy, G.Dvy, 280, 4.2, h); }
    [G.jx, G.jvx] = spring(G.jx, G.jvx, 140, 7, h); [G.jy, G.jvy] = spring(G.jy, G.jvy, 140, 7, h);
    [G.wob, G.wobv] = spring(G.wob, G.wobv, 160, 5, h); [G.sq, G.sqv] = spring(G.sq, G.sqv, 260, 7, h);
  }
  G.jx = clamp(G.jx, -30, 30); G.jy = clamp(G.jy, -30, 30); G.wob = clamp(G.wob, -.3, .4); G.sq = clamp(G.sq, -.18, .18);
  if (G.grab) { const a = Math.hypot(G.Dx, G.Dy) / (rgPx() * .78); $('#stretchMeter i').style.height = (a * 100) + '%';
    if (AU.ctx) { AU.stretch.frequency.setTargetAtTime(80 + a * 260, AU.ctx.currentTime, .03); AU.stretchG.gain.setTargetAtTime(a > .05 ? .05 + a * .05 : 0, AU.ctx.currentTime, .05); } }
  else if (AU.ctx) AU.stretchG.gain.setTargetAtTime(0, AU.ctx.currentTime, .05);
  if (AU.ctx) { AU.rubG.gain.setTargetAtTime(G.rubSpeed * .25, AU.ctx.currentTime, .05); AU.rubF.frequency.setTargetAtTime(500 + G.rubSpeed * 700, AU.ctx.currentTime, .05); }
  if (t - G.comboT > 0.9 + 0.2 * S.upg.focus) { if (G.combo) { G.combo = 0; } $('#combo').classList.remove('show'); }
  G.tapPress = Math.max(0, G.tapPress - dt * 4);
  updateHands(dt, m);
  render(m, t);
  drawParts(dt);
  if (cur.screen === 'game') hud();
}
function updateHands(dt, m) {
  const c = calBlend(), ge = growEase(G.disp);
  const bcx = c.cx, bcy = c.cy + c.ry * .18 * ge, brx = c.rx * (1 + Math.min(.8, 250 / c.rx - 1) * .7 * ge);
  let cx, cy, spread, rotIn, scl = 1, press;
  const t = now();
  if (G.grab) {
    const gx = G.grab.ix + G.Dx, gy = G.grab.iy + G.Dy; cx = gx; cy = gy + 20; spread = brx * .30; rotIn = 34; scl = .9; press = 0;
  } else if (G.ptr.over && !G.paused) {
    cx = G.ptr.ix; cy = G.ptr.iy + 10; spread = brx * .55; rotIn = 14;
    press = G.ptr.down ? .65 : .15;
  } else { // idle: rest on both sides of the belly
    cx = bcx + Math.sin(t * .8) * 6; cy = bcy + c.ry * .25 + Math.sin(t * 1.3) * 5; spread = brx * .62; rotIn = 18; press = .1;
  }
  const ph = G.phase, kneading = G.rubbing && G.ptr.down ? 1 : 0;
  const sq = kneading * (.5 + .5 * Math.sin(ph * 2)) * .14;
  const tp = G.tapPress;
  const targets = [
    { x: cx - spread * (1 - sq - tp * .08), y: cy + kneading * Math.sin(ph) * 8, r: rotIn + kneading * Math.sin(ph) * 6, s: scl * (1 - press * .05 - tp * .1 - kneading * .04 * (1 + Math.sin(ph))) },
    { x: cx + spread * (1 - sq - tp * .08), y: cy + kneading * Math.sin(ph + Math.PI) * 8, r: -rotIn - kneading * Math.sin(ph + Math.PI) * 6, s: scl * (1 - press * .05 - tp * .1 - kneading * .04 * (1 + Math.sin(ph + Math.PI))) },
  ];
  const k = 1 - Math.exp(-dt * (G.grab ? 30 : 18));
  targets.forEach(tg => { tg.x = clamp(tg.x, 50, IMG_W - 50); });
  [G.hl, G.hr].forEach((hh, i) => { const tg = targets[i]; hh.x = lerp(hh.x, tg.x, k); hh.y = lerp(hh.y, tg.y, k); hh.r = lerp(hh.r, tg.r, k); hh.s = lerp(hh.s, tg.s, k); });
  G.press = press + tp * .6 + kneading * .25;
  const els = [$('#handL'), $('#handR')], cal = [HC.l, HC.r];
  els.forEach((el, i) => {
    const hh = i ? G.hr : G.hl, [sx, sy] = toScr(hh.x, hh.y), w = el.offsetWidth || 100, hgt = el.offsetHeight || 140;
    const pinch = G.grab ? ' scaleX(.82)' : '';
    el.style.transform = `translate(${sx - w * cal[i].ax}px,${sy - hgt * cal[i].ay}px) rotate(${hh.r + cal[i].rot}deg) scale(${hh.s})${pinch}`;
    el.style.transformOrigin = `${cal[i].ax * 100}% ${cal[i].ay * 100}%`;
  });
}
function render(m, t) {
  const ci = cur.ci, c = CAL[ci];
  const ge = growEase(G.disp) + Math.sin(t * 1.7) * .006;
  const gl = R.gl;
  if (!gl) { // 2D fallback: draw and scale the belly patch
    const x = R.fb2d; if (!x) return; x.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); x.clearRect(0, 0, R.w, R.h);
    const im = m > .5 ? IM.m[ci] : IM.n[ci], cc = m > .5 ? c.m : c.n; x.drawImage(im, R.ox, R.oy, IMG_W * R.sc, IMG_H * R.sc);
    const M = 1 + ge * .6; x.save(); const [bx, by] = toScr(cc.cx, cc.cy); x.beginPath(); x.ellipse(bx, by, cc.rx * R.sc * 1.3 * M, cc.ry * R.sc * 1.3 * M, 0, 0, 7); x.clip();
    x.translate(bx, by); x.scale(M, M); x.translate(-bx, -by); x.drawImage(im, R.ox, R.oy, IMG_W * R.sc, IMG_H * R.sc); x.restore(); return;
  }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  const U = R.u;
  gl.uniform1f(U.uMix, m); gl.uniform1f(U.uGrow, ge); gl.uniform1f(U.uWob, G.wob); gl.uniform1f(U.uSq, G.sq);
  gl.uniform1f(U.uRg, rgPx()); gl.uniform1f(U.uDpr, R.dpr);
  gl.uniform4f(U.uCalA, c.n.cx, c.n.cy, c.n.rx, c.n.ry); gl.uniform4f(U.uCalB, c.m.cx, c.m.cy, c.m.rx, c.m.ry);
  gl.uniform4f(U.uRect, R.ox, R.oy, R.sc, R.h * R.dpr);
  gl.uniform2f(U.uJig, G.jx, G.jy); gl.uniform2f(U.uSize, IMG_W, IMG_H);
  const gp = G.grab || G.releaseAt || { ix: -999, iy: -999 };
  gl.uniform2f(U.uG, gp.ix, gp.iy); gl.uniform2f(U.uD, G.Dx, G.Dy);
  const pr = G.grab ? 0 : clamp(G.press, 0, 1);
  const onB = G.ptr.over || !G.ptr.down ? 1 : 0;
  gl.uniform3f(U.uH0, G.hl.x, G.hl.y - 30, pr * onB); gl.uniform3f(U.uH1, G.hr.x, G.hr.y - 30, pr * onB);
  gl.uniform1f(U.uDbg, DEBUG_CAL ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ---------------- HUD / shop ---------------- */
let hudT = 0;
function hud() {
  const t = now(); if (t - hudT < .12) return; hudT = t;
  const cs = S.ch[cur.ci], L = levelOf(cs.g);
  $('#gLv').textContent = `福腹Lv.${L}  ${STAGE_NAME[L]}`;
  $('#gWaist').textContent = `腹囲 ${Math.round(92 + cs.g * 0.88)}cm`;
  const a = THR[Math.min(L, 5)], b = THR[Math.min(L + 1, 6)], p = L >= 6 ? 1 : (cs.g - a) / (b - a);
  $('#gBar').style.width = (p * 100) + '%'; $('#gBarTxt').textContent = L >= 6 ? 'MAX ♡' : `次のレベルまで ${Math.round((1 - p) * 100)}%`;
  $('#gPts').textContent = Math.floor(S.pts).toLocaleString();
  document.querySelectorAll('.upg').forEach(el => { const u = UPG.find(x => x.k === el.dataset.k); el.classList.toggle('cant', S.pts < cost(u) || S.upg[u.k] >= u.max); });
  $('#autoBadge').classList.toggle('show', S.upg.auto > 0);
  $('#stats').innerHTML = `なでた距離：${cs.rubs.toFixed(1)} 周分<br>ビヨーン回数：${cs.boings} 回<br>累計福ポイント：${Math.floor(S.total).toLocaleString()}`;
}
function buildShop() {
  const box = $('#upgs'); box.innerHTML = '';
  UPG.forEach(u => {
    const el = document.createElement('div'); el.className = 'upg'; el.dataset.k = u.k;
    const lv = S.upg[u.k], mx = lv >= u.max;
    el.innerHTML = `<div class="ic">${u.ic}</div><div class="tx"><div class="nm">${u.nm}<small>Lv.${lv}</small></div><div class="ds">${u.ds(lv)}</div></div><div class="cost">${mx ? 'MAX' : cost(u).toLocaleString() + 'pt'}</div>`;
    el.onclick = () => { initAudio(); if (mx) return; const c = cost(u); if (S.pts < c) { toast('福ポイントが足りません'); return; } S.pts -= c; S.upg[u.k]++; SFX.buy(); save(true); buildShop(); toast(`${u.nm} を Lv.${S.upg[u.k]} に強化！`); };
    box.appendChild(el);
  });
}

/* ---------------- VN ---------------- */
const CHAP = ['第1話　出会い', '第2話　ぽかぽかの予感', '第3話　ふくらむ評判', '第4話　ほんとうの気持ち', '第5話　福がやってくる', '第6話　最後のひと揉み'];
const VN = { lines: null, i: 0, typing: false, full: '', shown: 0, timer: null, auto: false, voiceDone: true, onDone: null, prefix: '', ci: 0 };
function runVN(lines, opt) {
  Object.assign(VN, { lines, i: 0, onDone: opt.onDone, prefix: opt.prefix, ci: opt.ci });
  const back = $('#vnBack'); back.className = 'vn-backdrop' + (opt.dark ? ' dark' : ''); back.innerHTML = opt.backHTML || '';
  $('#vn').classList.add('show'); G.paused = true; duck(true);
  if (opt.chapter) { const c = $('#vnChapter'); c.innerHTML = opt.chapter; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); setTimeout(vnLine, 900); }
  else vnLine();
}
function vnLine() {
  const l = VN.lines[VN.i]; if (!l) return vnEnd();
  const [sp, emo, txt] = l.split('|');
  const nm = $('#vnName'), tx = $('#vnText');
  let name = '', color = '#ff6fa8', cls = '';
  if (sp === 'N') cls = 'narr'; else if (sp === 'P') { name = 'あなた'; color = '#5a8dd6'; cls = 'inner'; }
  else { const c = sp === 'H' ? CH[VN.ci] : CH[+sp - 1]; name = c.name; color = c.color; }
  nm.textContent = name; nm.style.background = color; tx.className = 'vn-text ' + cls;
  VN.full = txt; VN.shown = 0; VN.typing = true; $('.vn-next').classList.remove('on');
  VN.voiceDone = true;
  if (sp !== 'P') { VN.voiceDone = false; playVoice(`${VN.prefix}_${VN.i}`, ok => { VN.voiceDone = true; VN.hadVoice = ok; vnAutoCheck(); }); }
  clearInterval(VN.timer);
  const spd = 30 / (S.set.speed || 1);
  VN.timer = setInterval(() => {
    VN.shown++; tx.textContent = VN.full.slice(0, VN.shown);
    if (VN.voiceDone && VN.shown % 3 === 0) SFX.blip();
    if (VN.shown >= VN.full.length) vnTypeDone();
  }, spd);
}
function vnTypeDone() { clearInterval(VN.timer); VN.typing = false; $('#vnText').textContent = VN.full; $('.vn-next').classList.add('on'); VN.doneAt = now(); vnAutoCheck(); }
function vnAutoCheck() { if (!VN.auto || VN.typing || !VN.voiceDone) return; clearTimeout(VN.autoT); VN.autoT = setTimeout(() => { if (VN.auto && !VN.typing && VN.lines) vnNext(); }, 700 + (VN.hadVoice ? 0 : VN.full.length * 40)); }
function vnNext() { if (!VN.lines) return; if (VN.typing) { vnTypeDone(); return; } VN.i++; SFX.click(); vnLine(); }
function vnEnd() {
  clearInterval(VN.timer); clearTimeout(VN.autoT); if (AU.voiceEl) AU.voiceEl.pause();
  $('#vn').classList.remove('show'); const cb = VN.onDone; VN.lines = null; G.paused = false; duck(false); cb && cb();
  if (VN.after && !VN.lines) { const a = VN.after; VN.after = null; a(); }
}
function playScene(ci, k, replay) {
  const c = CH[ci], end = k === 'ending';
  const lines = end ? c.ending : c.scenes[k];
  runVN(lines, { prefix: end ? `c${c.id}_e` : `c${c.id}_s${k}`, ci, chapter: `<small>${c.name}</small>${end ? 'エンディング　福腹完成' : CHAP[k]}`,
    dark: replay && cur.screen !== 'game', backHTML: replay && cur.screen !== 'game' ? `<div class="one"><img src="${asset(`assets/chara${ci + 1}.jpg`)}"></div>` : '',
    onDone: () => { if (end) playSong(ci, () => { if (!replay) { toast(`${c.short}の福腹が完成しました！`); if (S.ch.every(x => x.done) && !S.finale) setTimeout(() => goSelect(), 600); } }); } });
}

/* ---------------- song ---------------- */
function playSong(ci, onDone) {
  const c = CH[ci], meta = (window.SONGS || {})[c.id];
  $('#songTitle').textContent = '「' + c.song.title + '」'; $('#songBy').textContent = `歌：${c.name}`;
  const ly = $('#songLyrics'); ly.innerHTML = c.song.lyrics.map(l => `<div>${l}</div>`).join('');
  $('#song').classList.add('show'); duck(true); if (AU.ctx) AU.bgm.gain.setTargetAtTime(0, AU.ctx.currentTime, .3);
  const rows = [...ly.children]; let iv;
  const close = () => { clearInterval(iv); if (AU.songEl) { AU.songEl.pause(); AU.songEl = null; } $('#song').classList.remove('show'); duck(false); onDone && onDone(); };
  $('#songClose').onclick = close;
  if (meta && S.set.voice > 0) {
    const a = AU.songEl = new Audio(asset(`assets/song/c${c.id}.mp3`)); a.volume = S.set.mute ? 0 : Math.min(1, S.set.voice);
    a.play().catch(() => {});
    iv = setInterval(() => { const t = a.currentTime; let k = -1; meta.lines.forEach((s, j) => { if (t >= s) k = j; }); rows.forEach((r, j) => r.classList.toggle('now', j === k)); }, 100);
    a.onended = () => setTimeout(close, 1200);
  } else {
    let k = 0; rows[0].classList.add('now'); iv = setInterval(() => { k++; rows.forEach((r, j) => r.classList.toggle('now', j === k)); if (k >= rows.length) clearInterval(iv); }, 3000);
  }
}

/* ---------------- modals ---------------- */
function modal(title, body, btns) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = body; const b = $('#mBtns'); b.innerHTML = '';
  (btns || [{ t: 'とじる', p: 1 }]).forEach(x => { const e = document.createElement('button'); e.className = 'btn ' + (x.p ? 'primary' : '') + (x.d ? ' danger' : ''); e.textContent = x.t; e.onclick = () => { SFX.click(); if (!x.keep) closeModal(); x.f && x.f(); }; b.appendChild(e); });
  $('#modal').classList.add('show'); G.paused = true;
}
function closeModal() { $('#modal').classList.remove('show'); if (!VN.lines) G.paused = false; }
function tutorial() {
  modal('遊び方', `<div class="tut">
  <div class="k">🤲</div><div><b>もむ（なでなで）</b><br>お腹の上でドラッグ。<b>円を描くように</b>なでると「円の極意」ボーナス！両手が自動でもみもみします。</div>
  <div class="k">👆</div><div><b>ぽんぽん</b><br>お腹を軽くタップ。ぷるんと弾んで福が溜まります。</div>
  <div class="k">🤏</div><div><b>つまんでビヨーン</b><br>お腹を<b>長押し</b>（PCは<b>右クリック</b>でも可、または下の「つまむ」モード）でつかみ、そのまま引っぱって<b>離す</b>と「ボイン！」と弾みます。大きく伸ばすほど高得点！</div>
  <div class="k">🔥</div><div><b>コンボ</b><br>手を止めずに続けるとコンボ倍率アップ。</div>
  <div class="k">⭐</div><div><b>成長と物語</b><br>福腹レベルが上がるたびに新しいストーリーが解放。Lv.6で福腹完成＆ヒロインソング！全員完成でグランドフィナーレ。</div>
  <div class="k">🧴</div><div><b>強化</b><br>貯めた福ポイントで、オイル・奥義・自動ローラーなどを強化しよう。</div></div>`, [{ t: 'はじめる！', p: 1 }]);
}
function settings() {
  const s = S.set;
  modal('設定', `
   <div class="set-row"><span>効果音</span><input type="range" min="0" max="1" step=".05" value="${s.sfx}" data-k="sfx"></div>
   <div class="set-row"><span>ボイス・歌</span><input type="range" min="0" max="1" step=".05" value="${s.voice}" data-k="voice"></div>
   <div class="set-row"><span>BGM</span><input type="range" min="0" max="1" step=".05" value="${s.bgm}" data-k="bgm"></div>
   <div class="set-row"><span>文字の速さ</span><input type="range" min=".5" max="3" step=".25" value="${s.speed}" data-k="speed"></div>
   <div class="set-row"><span>セーブデータ</span><button class="btn small danger" id="btnReset">リセット</button></div>`);
  document.querySelectorAll('#mBody input[type=range]').forEach(r => r.oninput = () => { S.set[r.dataset.k] = +r.value; applyVol(); save(true); });
  $('#btnReset').onclick = () => modal('データをリセット', 'すべての進行状況と福ポイントを消去します。よろしいですか？', [{ t: 'やめる' }, { t: '消去する', d: 1, f: () => { localStorage.removeItem(KEY); S = defState(); save(true); toast('リセットしました'); show('title'); refreshTitle(); } }]);
}
function credits() {
  modal('クレジット', `<div class="credit">
  <p><b>ふくばら♡ゴッドハンド 〜7つの福腹物語〜</b><br>企画：木山 聖健 ／ 制作：Grok Bot<br>キャラクター画像：ユーザー提供（AI生成）</p>
  <p><b>音声・歌唱合成</b>（VOICEVOX）</p><ul>
  <li>赤坂ほむら：VOICEVOX:猫使アル</li><li>藍沢ミレイ：VOICEVOX:九州そら</li><li>黄瀬ひなた：VOICEVOX:満別花丸</li>
  <li>白銀ユキ：VOICEVOX:四国めたん</li><li>紫堂レイ：VOICEVOX:猫使ビィ</li><li>黒川みどり：VOICEVOX:もち子(cv 明日葉よもぎ)</li>
  <li>桃井ラブ：VOICEVOX:春日部つむぎ</li><li>ナレーション：VOICEVOX:No.7</li><li>歌唱：VOICEVOX 歌唱機能（各キャラクターの声）</li></ul>
  <p>効果音・BGM：Web Audio によるリアルタイム合成</p></div>`);
}

/* ---------------- screens: title / select ---------------- */
function refreshTitle() { $('#btnContinue').disabled = !(S.prologue || S.ch.some(c => c.g > 0)); }
function buildTitle() {
  const bg = $('#titleBg'); bg.innerHTML = '';
  [6, 2, 4, 0, 3, 1, 5].forEach((ci, k) => { const im = document.createElement('img'); im.src = asset(`assets/chara${ci + 1}.jpg`); im.style.animationDelay = (k * .12) + 's'; im.style.zIndex = 10 - Math.abs(k - 3); bg.appendChild(im); });
}
let selCi = 0;
function goSelect() {
  show('select'); buildCards(); pickCard(selCi); $('#selPts').textContent = Math.floor(S.pts).toLocaleString();
  $('#finaleBar').classList.toggle('show', S.ch.every(c => c.done));
}
function buildCards() {
  const box = $('#cards'); box.innerHTML = '';
  CH.forEach((c, i) => {
    const cs = S.ch[i], L = levelOf(cs.g), el = document.createElement('div');
    el.className = 'card' + (i === selCi ? ' sel' : ''); el.style.setProperty('--c', c.color);
    el.innerHTML = `<img src="${asset(`assets/chara${i + 1}.jpg`)}" alt=""><div class="lvs">Lv.${L}</div>${cs.done ? '<div class="badge">福腹完成</div>' : ''}
      <div class="cinfo"><div class="cname">${c.name}</div><div class="cdept">${c.dept}</div><div class="bar"><i style="width:${cs.g}%"></i></div></div>`;
    el.onclick = () => { initAudio(); SFX.click(); pickCard(i); };
    box.appendChild(el);
  });
}
function pickCard(i) {
  selCi = i; const c = CH[i], cs = S.ch[i];
  document.querySelectorAll('.card').forEach((e, k) => e.classList.toggle('sel', k === i));
  $('#dImg').src = asset(`assets/chara${i + 1}.jpg`); $('#dDept').textContent = `${c.dept}　${c.age}歳`; $('#dName').textContent = c.name; $('#dKana').textContent = c.kana;
  $('#dTag').textContent = c.tag; $('#dTag').style.background = c.color; $('#dProfile').textContent = c.profile; $('#dWish').textContent = c.wish;
  $('#dBar').style.width = cs.g + '%'; $('#dLv').textContent = `Lv.${levelOf(cs.g)} / 6`;
  $('#btnGo').textContent = cs.done ? 'もっと揉む！' : cs.g > 0 ? 'マッサージ再開！' : 'マッサージ開始！';
  $('#btnSong').disabled = !cs.done; $('#btnReplay').disabled = !cs.intro;
}
function startGame(ci) {
  cur.ci = ci; const c = CH[ci], cs = S.ch[ci];
  setTex(0, IM.n[ci]); setTex(1, IM.m[ci]);
  $('#stageBg').style.backgroundImage = `url("${asset(`assets/chara${ci + 1}.jpg`)}")`;
  show('game'); resize();
  Object.assign(G, { disp: cs.g, mix: 0, Dx: 0, Dy: 0, Dvx: 0, Dvy: 0, jx: 0, jy: 0, jvx: 0, jvy: 0, wob: 0, wobv: 0, sq: 0, sqv: 0, combo: 0, grab: null, releaseAt: null, parts: [] });
  const cc = CAL[ci].n; G.hl.x = G.hr.x = cc.cx; G.hl.y = G.hr.y = cc.cy + 200;
  $('#gName').textContent = c.name; $('#gDept').textContent = c.dept; document.documentElement.style.setProperty('--accent', c.color);
  buildShop(); hudT = 0; hud();
  const after = () => { if (!S.tut) { S.tut = true; save(true); tutorial(); } else catchUp(); };
  if (!cs.intro) { cs.intro = true; save(true); setTimeout(() => playScene(ci, 0), 400); VN.after = after; }
  else after();
}
function catchUp() { const cs = S.ch[cur.ci], L = levelOf(cs.g); if (cs.seen < Math.min(L, 5)) { cs.seen++; save(true); playScene(cur.ci, cs.seen); } }
function replayMenu(ci) {
  const c = CH[ci], cs = S.ch[ci]; let h = '<div style="display:flex;flex-direction:column;gap:8px">';
  for (let k = 0; k <= Math.min(cs.seen, 5); k++) h += `<button class="btn" data-k="${k}">${CHAP[k]}</button>`;
  if (cs.done) h += `<button class="btn" data-k="ending">エンディング</button>`;
  modal(`回想：${c.name}`, h + '</div>');
  document.querySelectorAll('#mBody [data-k]').forEach(b => b.onclick = () => { closeModal(); const k = b.dataset.k; playScene(ci, k === 'ending' ? 'ending' : +k, true); });
}

/* ---------------- boot ---------------- */
function boot() {
  buildTitle(); refreshTitle(); initGL(); bindInput();
  $('#handL').src = asset('assets/hand_l.png'); $('#handR').src = asset('assets/hand_r.png');
  const tapA = () => { initAudio(); SFX.click(); };
  $('#btnStart').onclick = () => { tapA(); runVN(ST.prologue, { prefix: 'pro', ci: 0, dark: true, chapter: '<small>プロローグ</small>福腹の言い伝え',
    backHTML: `<div class="lineup">${[6, 2, 4, 0, 3, 1, 5].map(i => `<img src="${asset(`assets/chara${i + 1}.jpg`)}" style="opacity:.35">`).join('')}</div>`,
    onDone: () => { S.prologue = true; save(true); goSelect(); } }); };
  $('#btnContinue').onclick = () => { tapA(); goSelect(); };
  $('#btnSettingsT').onclick = () => { tapA(); settings(); }; $('#btnCreditsT').onclick = () => { tapA(); credits(); };
  $('#btnSettingsS').onclick = () => { tapA(); settings(); }; $('#btnSettingsG').onclick = () => { tapA(); settings(); };
  $('#btnSelBack').onclick = () => { tapA(); refreshTitle(); show('title'); };
  $('#btnGo').onclick = () => { tapA(); startGame(selCi); };
  $('#btnReplay').onclick = () => { tapA(); replayMenu(selCi); };
  $('#btnSong').onclick = () => { tapA(); playSong(selCi); };
  $('#btnGBack').onclick = () => { tapA(); save(true); goSelect(); };
  $('#btnHelp').onclick = () => { tapA(); tutorial(); };
  $('#btnMute').onclick = () => { initAudio(); S.set.mute = !S.set.mute; applyVol(); save(true); };
  $('#panelTab').onclick = () => { const p = $('#panel'); p.classList.toggle('open'); $('#panelTab').textContent = p.classList.contains('open') ? '強化ショップ ▼' : '強化ショップ ▲'; };
  $('#vnBox').onclick = e => { if (e.target.closest('.vn-ctrl')) return; initAudio(); vnNext(); };
  $('#vnAuto').onclick = () => { VN.auto = !VN.auto; $('#vnAuto').classList.toggle('on', VN.auto); vnAutoCheck(); };
  $('#vnSkip').onclick = () => vnEnd();
  window.addEventListener('keydown', e => { if (VN.lines && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); vnNext(); } });
  $('#btnFinale').onclick = () => { tapA(); SFX.fanfare(); runVN(ST.finale, { prefix: 'fin', ci: 0, dark: true, chapter: '<small>グランドフィナーレ</small>福腹グランプリ',
    backHTML: `<div class="lineup">${[6, 2, 4, 0, 3, 1, 5].map(i => `<img src="${asset(`assets/chara${i + 1}_m.jpg`)}">`).join('')}</div>`,
    onDone: () => { S.finale = true; save(true); SFX.fanfare(); credits(); } }); };
  window.addEventListener('resize', () => { if (cur.screen === 'game') resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  window.addEventListener('beforeunload', () => save(true));
  if (DEBUG_CAL) $('#stage').addEventListener('click', () => console.log('img px', Math.round(G.ptr.ix), Math.round(G.ptr.iy)));
  applyVol(); requestAnimationFrame(frame);
  window.__game = { get S() { return S; }, G, R, startGame, goSelect, playScene, addGrowth: (a) => addGrowth(a, 'rub'), set: (ci, g) => { S.ch[ci].g = g; }, cur, VN, vnEnd, closeModal };
}
imgReady.then(boot);
})();
