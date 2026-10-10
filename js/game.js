// ===== お腹育成ゲーム : main =====
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const bgC = $('bg'), glC = $('gl'), fxC = $('fx');
  const bg = bgC.getContext('2d'), fx = fxC.getContext('2d');
  const PCV = $('pcv'), pctx = PCV.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');
  let W = 0, H = 0, meta, imgs = {};
  const BODY_H_UNITS = 2650, HEIGHT_M = 1.70, MPU0 = HEIGHT_M / BODY_H_UNITS; // metres per body unit at scale 1
  let S0 = 0; // initial belly diameter (m)
  // ---------------- state ----------------
  const SAVE_KEY = 'onaka_ikusei_v1';
  const defState = () => ({ S: 0, pts: 0, F: 0, unl: 0, sel: 0, u: { app: 0, sto: 0, mas: 0, chef: 0, est: 0 }, maxStage: 0, bites: 0, rubs: 0, vol: { master: 0.9, voice: 1, se: 0.7, bgm: 0.35 }, sub: true, muted: false, played: 0 });
  let st = defState();
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.S > 0) { st = Object.assign(defState(), s); st.u = Object.assign(defState().u, s.u || {}); } } catch (e) {} }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {} }
  // ---------------- runtime ----------------
  const rt = {
    t: 0, Sd: 0, // displayed (smoothed) size
    jig: 0, jigV: 0, ox: 0, oxV: 0, oy: 0, oyV: 0, wave: 0, wavePh: 0, poke: 0, pokeX: 0, pokeY: 0,
    breathPh: 0, sway: 0,
    expr: 'neutral', exprT: 0, blink: 0, blinkT: 2, blinkPh: -1, mouthOpen: 0, chewT: 0, eatT: 0,
    lastAct: 0, idleT: 0, chefT: 3, view: [1, 0, 0], k: 1, V: 1, bodyScale: 1, belly: null, groundY: 0,
    rubAcc: 0, rubVoiceT: 0, rubbing: false, rubSpeed: 0, lastRubSE: 0,
    flying: [], parts: [], popups: [], drag: null, shake: 0, swell: 0, tint: [1, 1, 1], growFx: 0,
  };
  // ---------------- size model ----------------
  function visualG(S) { const x = S / S0; if (x <= 1) return Math.max(0.6, x); return Math.min(x, 1 + 4.5 * (1 - Math.exp(-(x - 1) / 2.5))); }
  function capF() { return 100 + 25 * st.u.sto; }
  function gMul() { return Math.pow(1.1, st.u.app); }
  function masMul() { return Math.pow(1.18, st.u.mas); }
  function stageBonus() { return 1 + 0.15 * stageOf(st.S).i; }
  // ---------------- layout ----------------
  function panelH() { const p = $('panel'); return p.classList.contains('hidden') ? 0 : p.getBoundingClientRect().height; }
  function resize() {
    W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
    for (const c of [bgC, glC, fxC]) { c.width = W; c.height = H; }
  }
  addEventListener('resize', resize);
  // belly shape in body units from visual g (+ fullness swell + jiggle)
  function bellyShape(g, swell) {
    const B = meta.belly; const gg = g * (1 + swell);
    const gy = gg * 0.97;
    let rx = B.rx * gg, ry = B.ry * gy;
    const top0 = Math.max(560, B.cy - B.ry - 70 * (gg - 1));
    let cy = top0 + ry;
    const ground = 2700; let flat = 0;
    if (cy + ry > ground) { const ry2 = (ground - top0) / 2; flat = Math.min(1, (ry - ry2) / ry * 3); rx *= Math.pow(ry / ry2, 0.35); ry = ry2; cy = top0 + ry; }
    // jiggle (volume-preserving squash) + offsets
    const j = rt.jig; rx *= 1 + j; ry *= 1 - j * 0.85;
    cy += ry * j * 0.4 + rt.oy * ry; const cx = B.cx + rt.ox * rx;
    const br = Math.sin(rt.breathPh) * 0.5 + 0.5; rx *= 1 + 0.006 * br; ry *= 1 + 0.004 * br;
    return { cx, cy, rx, ry, g: gg, flat, wave: rt.wave, wavePhase: rt.wavePh, poke: rt.poke, pokeX: rt.pokeX, pokeY: rt.pokeY };
  }
  // ---------------- camera ----------------
  function updateCamera() {
    const g = visualG(rt.Sd);
    rt.bodyScale = rt.Sd / (S0 * Math.min(g, rt.Sd / S0));
    const b = bellyShape(g, rt.swell);
    rt.belly = b;
    const narrow0 = W < H * 0.9; const top = (narrow0 ? 150 : 14) * DPR, ph = panelH() * DPR;
    rt.groundY = H - Math.max(ph - 30 * DPR, H * 0.06);
    const availH = rt.groundY - top - 10 * DPR;
    const x0 = Math.min(0, b.cx - b.rx - 40), x1 = Math.max(982, b.cx + b.rx + 40);
    const narrow = W < H;
    // when she becomes planet-sized, also frame the Earth she stands on
    const mpu0 = MPU0 * rt.bodyScale; const earthU = 2 * World.R_EARTH / mpu0;
    const ef = Math.min(1, Math.max(0, (Math.log(rt.Sd) - Math.log(1.5e6)) / (Math.log(1.2e7) - Math.log(1.5e6))));
    const extra = Math.min(earthU * 1.08, 2690 * 0.9) * ef * ef * (3 - 2 * ef);
    const s = Math.min(availH / (2690 + extra), (W * (narrow ? 0.96 : 0.8)) / (x1 - x0));
    rt.groundY -= extra * s;
    const cxScreen = W / 2;
    rt.view = [s, cxScreen - (b.cx) * s, rt.groundY - 2668 * s];
    const mpu = MPU0 * rt.bodyScale; rt.k = s / mpu; rt.V = H / rt.k;
  }
  // ---------------- expressions ----------------
  const EXPR = {
    neutral: { blink: 0, happy: 0, mouth: 'neutral', open: 0, blush: 0 },
    smile: { blink: 0, happy: 0, mouth: 'smile', open: 0.25, blush: 0.15 },
    happy: { blink: 1, happy: 1, mouth: 'smile', open: 0.45, blush: 0.4 },
    surprised: { blink: 0, happy: 0, mouth: 'o', open: 0.7, blush: 0.15 },
    embarrassed: { blink: 0.2, happy: 0, mouth: 'wavy', open: 0, blush: 1 },
    relaxed: { blink: 1, happy: 0, mouth: 'content', open: 0, blush: 0.65 },
    tickle: { blink: 1, happy: 1, mouth: 'smile', open: 0.75, blush: 0.75 },
    full: { blink: 0.42, happy: 0, mouth: 'pant', open: 0.5, blush: 0.6 },
    eat: { blink: 0.2, happy: 0, mouth: 'eat', open: 1, blush: 0.2 },
    chew: { blink: 1, happy: 1, mouth: 'chew', open: 0.5, blush: 0.35 },
    content: { blink: 1, happy: 0, mouth: 'content', open: 0, blush: 0.45 },
  };
  function setExpr(e, dur) { rt.expr = e; rt.exprT = dur || 2.5; }
  function faceState(dt) {
    const E = EXPR[rt.expr] || EXPR.neutral;
    // auto blink (only when eyes open in expression)
    rt.blinkT -= dt; if (rt.blinkT <= 0 && rt.blinkPh < 0) { rt.blinkPh = 0; rt.blinkT = 2.2 + Math.random() * 3.5; }
    let b = E.blink;
    if (rt.blinkPh >= 0) { rt.blinkPh += dt / 0.17; const p = rt.blinkPh; const bl = p < 0.45 ? p / 0.45 : Math.max(0, 1 - (p - 0.45) / 0.55); if (p >= 1) rt.blinkPh = -1; if (E.blink < 0.9) b = Math.max(b, bl); }
    let mouth = E.mouth, open = E.open;
    const fullness = st.F / capF();
    let blush = Math.max(E.blush, fullness > 0.7 ? (fullness - 0.7) * 1.6 : 0);
    if (rt.chewT > 0) { mouth = 'chew'; open = 0.5 + 0.5 * Math.sin(rt.t * 16); }
    if (rt.eatT > 0) { mouth = 'eat'; open = 1; }
    const lv = Sound.level();
    if (Sound.speaking() && rt.eatT <= 0) {
      rt.mouthOpen += (Math.min(1, lv * 1.3) - rt.mouthOpen) * Math.min(1, dt * 25);
      if (mouth === 'o') open = 0.35 + rt.mouthOpen * 0.8;
      else if (mouth === 'pant') open = 0.3 + rt.mouthOpen;
      else { mouth = (E.mouth === 'smile' || E.happy) ? 'smile' : 'talk'; open = rt.mouthOpen * 0.85; }
    } else rt.mouthOpen *= 0.8;
    return { blink: Math.min(1, b), happy: E.happy, wide: 0, mouth: { type: mouth, open }, blush };
  }
  // ---------------- speech ----------------
  let bubbleTimer = 0;
  async function say(cat, opt = {}) {
    const r = await Sound.voice(cat, opt);
    if (!r) return null;
    if (st.sub) { $('bubbleTxt').textContent = r.text; const b = $('bubble'); b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bubbleTimer = Math.max(2.2, r.dur + 1.0); }
    return r;
  }
  // ---------------- particles ----------------
  function addPart(p) { rt.parts.push(Object.assign({ vx: 0, vy: 0, life: 1, max: 1, s: 20, rot: 0, vr: 0, g: 0 }, p)); }
  function popup(text, x, y, col) { rt.popups.push({ text, x, y, life: 1.4, col: col || '#fff' }); }
  function bodyToScreen(x, y) { const st2 = animState(); const d = CharGL.deform(x, y, st2); return [d[0] * rt.view[0] + rt.view[1], d[1] * rt.view[0] + rt.view[2]]; }
  function screenToBody(X, Y) { return [(X - rt.view[1]) / rt.view[0], (Y - rt.view[2]) / rt.view[0]]; }
  function mouthScreen() { return bodyToScreen(507, 172); }
  function inBelly(bx, by) { const b = rt.belly; const dx = (bx - b.cx) / b.rx, dy = (by - b.cy) / b.ry; return dx * dx + dy * dy <= 1.0; }
  // ---------------- actions ----------------
  function kick(amount) { rt.jigV += amount * 6; rt.wave = Math.min(0.06, rt.wave + amount * 0.6); }
  function feed(foodIdx, fromXY, auto) {
    const f = FOODS[foodIdx];
    if (st.F + f.full > capF()) {
      Sound.se('nope'); setExpr('full', 2.6); say('full', { prio: 2 });
      popup('おなかいっぱい！なでなでして', W / 2, rt.groundY * 0.45, '#ffd36b');
      return false;
    }
    const [mx, my] = mouthScreen();
    rt.flying.push({ e: f.e, f: foodIdx, x0: fromXY[0], y0: fromXY[1], x: fromXY[0], y: fromXY[1], t: 0, dur: 0.55, auto, mx, my });
    Sound.se('whoosh');
    return true;
  }
  function arriveFood(fl) {
    const f = FOODS[fl.f];
    if (st.F + f.full > capF()) { Sound.se('nope'); return; }
    st.F += f.full; st.bites++;
    const growth = f.g * gMul();
    const before = stageOf(st.S).i;
    st.S *= Math.exp(growth);
    const gain = f.pts * stageBonus(); st.pts += gain;
    rt.eatT = 0.22; rt.chewT = 1.1; setExpr('chew', 1.6);
    Sound.se('munch'); setTimeout(() => { Sound.se('gulp'); kick(0.035 + Math.min(0.03, growth)); Sound.se('boing', 1 + Math.random() * 0.2); }, 900);
    const [mx, my] = mouthScreen();
    for (let i = 0; i < 8; i++) addPart({ type: 'crumb', x: mx, y: my, vx: (Math.random() - 0.5) * 220 * DPR, vy: (-Math.random() * 150 - 40) * DPR, g: 700 * DPR, life: 0.7, max: 0.7, s: (3 + Math.random() * 4) * DPR, c: ['#f6d58e', '#fff', '#e7a35c'][i % 3] });
    popup(`+${fmtPts(gain)}♥`, mx + 60 * DPR, my - 10 * DPR, '#ff9fc0');
    setTimeout(() => { const b = rt.belly; const [bx, by] = bodyToScreen(b.cx + b.rx * 0.5, b.cy - b.ry * 0.2); popup(`お腹 +${(growth * 100).toFixed(1)}%`, bx, by, '#fff3a0'); for (let i = 0; i < 5; i++) addPart({ type: 'heart', x: bx + (Math.random() - 0.5) * 80 * DPR, y: by, vy: -60 * DPR, vx: (Math.random() - 0.5) * 40 * DPR, life: 1.2, max: 1.2, s: (14 + Math.random() * 10) * DPR }); }, 950);
    if (!Sound.speaking()) setTimeout(() => { if (Math.random() < (fl.auto ? 0.25 : 0.6)) say(f.i >= 6 && Math.random() < 0.35 ? 'eatbig' : 'eat'); }, 450);
    checkStage(before);
    rt.lastAct = rt.t;
  }
  function checkStage(before) {
    const s = stageOf(st.S);
    if (s.i > st.maxStage) {
      st.maxStage = s.i;
      const def = STAGES[s.i];
      setTimeout(() => {
        showBanner(def.name, compare(st.S)); Sound.se('stage'); Sound.se('grow'); rt.growFx = 1; rt.shake = 0.6; kick(0.08);
        setExpr('surprised', 3.5); if (def.v) say(def.v, { prio: 5, force: true }).then(() => setTimeout(() => setExpr('happy', 2), 2500));
      }, 1000);
      save();
    } else if (s.i === STAGES.length - 1 && s.extra > (st.extraMax || 0)) {
      st.extraMax = s.extra; setTimeout(() => { showBanner(s.name, compare(st.S)); Sound.se('stage'); kick(0.08); say('grow', { prio: 3 }); }, 1000);
    }
  }
  function showBanner(name, cmp) { $('bannerName').textContent = name; $('bannerCmp').textContent = cmp; const b = $('banner'); b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(showBanner.t); showBanner.t = setTimeout(() => b.classList.add('hidden'), 3300); }
  function massage(distCss, X, Y) {
    const units = distCss / 40; if (units <= 0) return;
    const before = stageOf(st.S).i;
    const dig = Math.min(st.F, 0.3 * masMul() * units * 1.0);
    const f = FOODS[st.unl];
    const g = f.g * gMul() * 0.35 * (dig / f.full) + f.g * gMul() * 0.004 * units * masMul();
    st.F -= dig; st.S *= Math.exp(g); st.pts += 0.02 * f.pts * dig * stageBonus() + 0.01 * units;
    st.rubs += units; rt.rubAcc += units;
    if (Math.random() < 0.5) addPart({ type: 'spark', x: X + (Math.random() - 0.5) * 30 * DPR, y: Y + (Math.random() - 0.5) * 30 * DPR, vy: -40 * DPR, life: 0.8, max: 0.8, s: (6 + Math.random() * 8) * DPR });
    if (rt.t - rt.lastRubSE > 0.12) { Sound.se('rub', Math.min(1.5, rt.rubSpeed / 800)); rt.lastRubSE = rt.t; }
    if (rt.rubAcc > 14) { rt.rubAcc = 0; kick(0.02); Sound.se('boing', 0.9 + Math.random() * 0.3); if (rt.growFx < 0.3) rt.growFx = 0.3; }
    if (rt.t - rt.rubVoiceT > 5.5 && !Sound.speaking()) {
      rt.rubVoiceT = rt.t; const fast = rt.rubSpeed > 900 * DPR;
      if (fast) { setExpr('tickle', 2.5); say('tickle'); } else { setExpr('relaxed', 3); say('relax'); }
    } else if (rt.exprT < 0.5 && !Sound.speaking()) setExpr(rt.rubSpeed > 900 * DPR ? 'tickle' : 'relaxed', 1.2);
    checkStage(before); rt.lastAct = rt.t;
  }
  // ---------------- input ----------------
  let ptr = null;
  fxC.addEventListener('pointerdown', e => {
    Sound.unlock();
    const X = e.clientX * DPR, Y = e.clientY * DPR; const [bx, by] = screenToBody(X, Y);
    ptr = { id: e.pointerId, x: X, y: Y, sx: X, sy: Y, t: rt.t, moved: 0, belly: inBelly(bx, by), face: bx > 420 && bx < 600 && by > 40 && by < 240 };
    fxC.setPointerCapture(e.pointerId);
    if (ptr.belly) { const b = rt.belly; rt.pokeX = (bx - b.cx) / b.rx; rt.pokeY = (by - b.cy) / b.ry; }
  });
  fxC.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const X = e.clientX * DPR, Y = e.clientY * DPR; const dx = X - ptr.x, dy = Y - ptr.y; const d = Math.hypot(dx, dy);
    ptr.moved += d; ptr.x = X; ptr.y = Y;
    const [bx, by] = screenToBody(X, Y);
    if (ptr.belly && inBelly(bx, by)) {
      rt.rubbing = true; const now = performance.now(); const dtm = Math.max(1, now - (ptr.lt || now - 16)); ptr.lt = now;
      rt.rubSpeed = rt.rubSpeed * 0.85 + (d / dtm * 1000) * 0.15;
      const b = rt.belly; rt.pokeX = (bx - b.cx) / b.rx; rt.pokeY = (by - b.cy) / b.ry; rt.poke = Math.min(0.5, rt.poke + d / DPR * 0.004);
      rt.oxV += dx / rt.view[0] / b.rx * 2.2; rt.oyV += dy / rt.view[0] / b.ry * 1.2;
      massage(d / DPR, X, Y);
    }
  });
  function endPtr(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const tap = ptr.moved < 12 * DPR && rt.t - ptr.t < 0.4;
    if (tap && ptr.belly) { kick(0.05); Sound.se('boing', 1.1); rt.poke = 0.6; setExpr(Math.random() < 0.5 ? 'embarrassed' : 'smile', 2); if (!Sound.speaking() && Math.random() < 0.55) say('poke'); addPart({ type: 'heart', x: ptr.x, y: ptr.y, vy: -80 * DPR, life: 1, max: 1, s: 22 * DPR }); rt.lastAct = rt.t; }
    else if (tap && ptr.face) { setExpr('smile', 2.5); say('face'); rt.lastAct = rt.t; }
    rt.rubbing = false; ptr = null;
  }
  fxC.addEventListener('pointerup', endPtr); fxC.addEventListener('pointercancel', endPtr);
  // ---------------- UI build ----------------
  function buildFood() {
    const row = $('foodRow'); row.innerHTML = '';
    FOODS.forEach((f, i) => {
      if (i > st.unl + 1) return;
      const b = document.createElement('div'); b.className = 'food'; b.dataset.i = i;
      const locked = i > st.unl;
      if (locked) { b.classList.add('locked'); b.innerHTML = `<div class="e">${f.e}</div><div class="n">${f.name}</div><div class="cost">♥${fmtPts(f.cost)}で解放</div>`; }
      else { b.innerHTML = `<div class="e">${f.e}</div><div class="n">${f.name}</div><div class="s">成長+${(f.g * gMul() * 100).toFixed(1)}%</div>`; }
      row.appendChild(b);
      b.addEventListener('pointerdown', e => foodDown(e, i, b));
    });
    refreshAfford();
  }
  function buildUp() {
    const row = $('upRow'); row.innerHTML = '';
    UPGRADES.forEach(u => {
      const lv = st.u[u.id]; const c = ucost(u, lv);
      const b = document.createElement('div'); b.className = 'upg'; b.dataset.id = u.id;
      b.innerHTML = `<div class="t">${u.e} ${u.name} <span class="lv">Lv.${lv}</span></div><div class="d">${u.desc(lv)}</div><div class="cost">♥${fmtPts(c)}</div>`;
      b.addEventListener('click', () => buyUp(u));
      row.appendChild(b);
    });
    refreshAfford();
  }
  function refreshAfford() {
    document.querySelectorAll('.food.locked').forEach(b => { const f = FOODS[+b.dataset.i]; b.classList.toggle('afford', st.pts >= f.cost); });
    document.querySelectorAll('.upg').forEach(b => { const u = UPGRADES.find(x => x.id === b.dataset.id); b.classList.toggle('no', st.pts < ucost(u, st.u[u.id])); b.classList.toggle('afford', st.pts >= ucost(u, st.u[u.id])); });
  }
  function buyUp(u) {
    Sound.unlock(); const c = ucost(u, st.u[u.id]);
    if (st.pts < c) { Sound.se('nope'); return; }
    st.pts -= c; st.u[u.id]++; Sound.se('buy'); buildUp(); buildFood();
    if (u.id === 'chef' && st.u.chef === 1) { say('auto', { prio: 2 }); setExpr('happy', 2.5); }
    else if (!Sound.speaking()) { say('upgrade'); setExpr('happy', 2); }
    save();
  }
  function foodDown(e, i, el) {
    Sound.unlock(); e.preventDefault();
    if (i > st.unl) { // unlock
      const f = FOODS[i]; if (st.pts < f.cost) { Sound.se('nope'); return; }
      st.pts -= f.cost; st.unl = i; Sound.se('buy'); buildFood(); say('unlock', { prio: 2 }); setExpr('happy', 2.5); save(); return;
    }
    const r = el.getBoundingClientRect();
    rt.drag = { i, el, sx: e.clientX, sy: e.clientY, x: e.clientX * DPR, y: e.clientY * DPR, moved: false, ox: (r.left + r.width / 2) * DPR, oy: (r.top + r.height / 2) * DPR, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    const mv = ev => { if (!rt.drag || ev.pointerId !== rt.drag.id) return; rt.drag.x = ev.clientX * DPR; rt.drag.y = ev.clientY * DPR; if (Math.hypot(ev.clientX - rt.drag.sx, ev.clientY - rt.drag.sy) > 10) rt.drag.moved = true; };
    const up = ev => {
      if (!rt.drag || ev.pointerId !== rt.drag.id) return;
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      const d = rt.drag; rt.drag = null; Sound.se('click');
      if (!d.moved) { feed(i, [d.ox, d.oy]); }
      else { const [bx, by] = screenToBody(d.x, d.y); const onHer = (bx > 300 && bx < 700 && by > 0 && by < 700) || inBelly(bx, by); if (onHer) feed(i, [d.x, d.y]); }
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    Sound.unlock(); Sound.se('click');
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'up') buildUp();
  }));
  // menu
  const vols = { vMaster: 'master', vVoice: 'voice', vSe: 'se', vBgm: 'bgm' };
  function applyVol() { for (const id in vols) { const k = vols[id]; $(id).value = st.vol[k]; Sound.setVol(k, k === 'master' && st.muted ? 0 : st.vol[k]); } $('btnMute').textContent = st.muted ? '🔇' : '🔊'; $('cSub').checked = st.sub; }
  for (const id in vols) $(id).addEventListener('input', e => { st.vol[vols[id]] = +e.target.value; applyVol(); save(); });
  $('cSub').addEventListener('change', e => { st.sub = e.target.checked; save(); });
  $('btnMenu').addEventListener('click', () => { Sound.se('click'); $('menu').classList.remove('hidden'); });
  $('btnClose').addEventListener('click', () => $('menu').classList.add('hidden'));
  $('btnMute').addEventListener('click', () => { Sound.unlock(); st.muted = !st.muted; applyVol(); save(); });
  $('btnCredits').addEventListener('click', () => { $('menu').classList.add('hidden'); $('credits').classList.remove('hidden'); });
  $('btnCredClose').addEventListener('click', () => $('credits').classList.add('hidden'));
  $('btnReset').addEventListener('click', () => { if (confirm('セーブデータを消して最初からやり直しますか？')) { localStorage.removeItem(SAVE_KEY); location.reload(); } });
  // ---------------- HUD ----------------
  let hudT = 0;
  function updateHud() {
    const s = stageOf(st.S); const f = fmtSize(rt.Sd);
    $('stageName').textContent = s.name; $('sizeVal').textContent = f.v; $('sizeUnit').textContent = f.u; $('cmpLine').textContent = compare(rt.Sd);
    let lo, hi, nm;
    if (s.i < STAGES.length - 1) { lo = STAGES[s.i].s || S0; hi = STAGES[s.i + 1].s; nm = STAGES[s.i + 1].name; }
    else { lo = STAGES[s.i].s * Math.pow(10, s.extra); hi = lo * 10; nm = `超宇宙 Lv.${s.extra + 1}`; }
    const p = Math.max(0, Math.min(1, Math.log(st.S / lo) / Math.log(hi / lo)));
    $('nextFill').style.width = (p * 100).toFixed(1) + '%'; $('nextTxt').textContent = `次：${nm}（${(p * 100).toFixed(0)}%）`;
    $('ptsVal').textContent = fmtPts(st.pts);
    const fr = st.F / capF(); $('fullFill').style.height = (fr * 100).toFixed(1) + '%'; $('fullFill').classList.toggle('max', fr > 0.9); $('fullTxt').textContent = Math.round(st.F) + '%';
    document.querySelectorAll('.food:not(.locked)').forEach(b => { const ff = FOODS[+b.dataset.i]; b.style.opacity = st.F + ff.full > capF() ? 0.55 : 1; });
    refreshAfford();
  }
  // ---------------- portrait ----------------
  function drawPortrait(faceCv) {
    const c = pctx, N = PCV.width; c.clearRect(0, 0, N, N);
    const x0 = 400, y0 = 30, sz = 220; // body region
    c.fillStyle = '#f9e6ea'; c.fillRect(0, 0, N, N);
    c.drawImage(imgs.body, x0, y0, sz, sz, 0, 0, N, N);
    const F = meta.face; const s = N / sz;
    c.drawImage(faceCv, (F[0] - x0) * s, (F[1] - y0) * s, (F[2] - F[0]) * s, (F[3] - F[1]) * s);
  }
  // ---------------- FX drawing ----------------
  function emojiFont(px) { return `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; }
  function drawFx(dt) {
    fx.clearRect(0, 0, W, H);
    // growth glow
    if (rt.growFx > 0.01) { const b = rt.belly; const [bx, by] = bodyToScreen(b.cx, b.cy); const R = Math.max(b.rx, b.ry) * rt.view[0] * 1.25; const g = fx.createRadialGradient(bx, by, R * 0.5, bx, by, R); g.addColorStop(0, 'rgba(255,220,240,0)'); g.addColorStop(0.8, `rgba(255,170,210,${0.35 * rt.growFx})`); g.addColorStop(1, 'rgba(255,170,210,0)'); fx.fillStyle = g; fx.beginPath(); fx.arc(bx, by, R, 0, 7); fx.fill(); }
    // flying foods
    for (const f of rt.flying) { const p = Math.min(1, f.t / f.dur); const [mx, my] = mouthScreen(); const x = f.x0 + (mx - f.x0) * p, y = f.y0 + (my - f.y0) * p - Math.sin(p * Math.PI) * 140 * DPR; const sc = (1 - p * 0.55) * 46 * DPR; fx.save(); fx.translate(x, y); fx.rotate(p * 6); fx.font = emojiFont(sc); fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(f.e, 0, 0); fx.restore(); }
    // drag ghost
    if (rt.drag && rt.drag.moved) { fx.font = emojiFont(54 * DPR); fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.globalAlpha = 0.9; fx.fillText(FOODS[rt.drag.i].e, rt.drag.x, rt.drag.y - 30 * DPR); fx.globalAlpha = 1; const [mx, my] = mouthScreen(); fx.strokeStyle = 'rgba(255,255,255,0.6)'; fx.setLineDash([6 * DPR, 6 * DPR]); fx.lineWidth = 2 * DPR; fx.beginPath(); fx.arc(mx, my, 30 * DPR, 0, 7); fx.stroke(); fx.setLineDash([]); }
    // particles
    for (const p of rt.parts) {
      const a = Math.max(0, p.life / p.max);
      fx.globalAlpha = a;
      if (p.type === 'crumb') { fx.fillStyle = p.c; fx.beginPath(); fx.arc(p.x, p.y, p.s, 0, 7); fx.fill(); }
      else if (p.type === 'heart') { fx.fillStyle = '#ff5c8a'; heart(p.x, p.y, p.s * (1.2 - a * 0.2)); }
      else if (p.type === 'spark') { fx.fillStyle = '#fff6c8'; star(p.x, p.y, p.s * a); }
      else if (p.type === 'sweat') { fx.fillStyle = 'rgba(160,210,255,0.9)'; fx.beginPath(); fx.ellipse(p.x, p.y, p.s * 0.5, p.s * 0.75, 0, 0, 7); fx.fill(); }
    }
    fx.globalAlpha = 1;
    for (const p of rt.popups) { const a = Math.min(1, p.life / 0.5); fx.globalAlpha = a; fx.font = `bold ${18 * DPR}px "Hiragino Maru Gothic ProN","Noto Sans JP","Noto Sans CJK JP",sans-serif`; fx.textAlign = 'center'; fx.lineWidth = 4 * DPR; fx.strokeStyle = 'rgba(80,0,30,0.8)'; fx.strokeText(p.text, p.x, p.y); fx.fillStyle = p.col; fx.fillText(p.text, p.x, p.y); }
    fx.globalAlpha = 1;
    // hand cursor while rubbing
    if (rt.rubbing && ptr) { fx.font = emojiFont(40 * DPR); fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText('🫳', ptr.x, ptr.y - 6 * DPR); }
    // full sweat drop near head
    if (st.F / capF() > 0.88) { const [hx, hy] = bodyToScreen(590, 120); fx.fillStyle = 'rgba(150,205,255,0.9)'; const s = 9 * DPR * Math.max(0.6, rt.view[0] * 2.4); fx.beginPath(); fx.moveTo(hx, hy - s * 1.6); fx.quadraticCurveTo(hx + s, hy, hx, hy + s * 0.6); fx.quadraticCurveTo(hx - s, hy, hx, hy - s * 1.6); fx.fill(); }
  }
  function heart(x, y, s) { fx.beginPath(); fx.moveTo(x, y + s * 0.35); fx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.9, x, y - s * 0.4); fx.bezierCurveTo(x + s * 0.45, y - s * 0.9, x + s * 0.9, y - s * 0.25, x, y + s * 0.35); fx.fill(); }
  function star(x, y, s) { fx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.3 : s; const a = i * Math.PI / 4; fx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } fx.closePath(); fx.fill(); }
  // ---------------- main loop ----------------
  function animState() { return { view: rt.view, breath: Math.sin(rt.breathPh) * 0.5 + 0.5, sway: rt.sway, headTilt: Math.sin(rt.t * 0.7) * 0.012 + (rt.expr === 'tickle' ? Math.sin(rt.t * 9) * 0.02 : 0), time: rt.t, belly: rt.belly, tint: rt.tint }; }
  let last = performance.now(), saveT = 0, started = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; rt.t += dt;
    if (started) step(dt);
    render(dt);
    requestAnimationFrame(frame);
  }
  function step(dt) {
    // smooth displayed size (log-space)
    const ls = Math.log(rt.Sd), lt = Math.log(st.S); rt.Sd = Math.exp(ls + (lt - ls) * Math.min(1, dt * 3.5));
    // natural digestion + esthe
    const dg = (0.6 + 4 * st.u.est) * dt; if (st.F > 0) { const d = Math.min(st.F, dg); st.F -= d; if (st.u.est > 0) { const f = FOODS[st.unl]; st.S *= Math.exp(f.g * gMul() * 0.25 * d / f.full); } }
    rt.swell += ((st.F / capF()) * 0.07 - rt.swell) * Math.min(1, dt * 2);
    // springs
    const k = 120, c = 7;
    rt.jigV += (-k * rt.jig - c * rt.jigV) * dt; rt.jig += rt.jigV * dt; rt.jig = Math.max(-0.12, Math.min(0.12, rt.jig));
    rt.oxV += (-90 * rt.ox - 6 * rt.oxV) * dt; rt.ox += rt.oxV * dt; rt.ox = Math.max(-0.08, Math.min(0.08, rt.ox));
    rt.oyV += (-90 * rt.oy - 6 * rt.oyV) * dt; rt.oy += rt.oyV * dt; rt.oy = Math.max(-0.06, Math.min(0.06, rt.oy));
    rt.wave *= Math.exp(-dt * 2.2); rt.wavePh += dt * 16; rt.poke *= Math.exp(-dt * (rt.rubbing ? 3 : 6));
    rt.growFx *= Math.exp(-dt * 1.5); rt.shake *= Math.exp(-dt * 4);
    rt.breathPh += dt * (st.F / capF() > 0.85 ? 3.2 : 1.7);
    rt.sway = Math.sin(rt.t * 0.55) * 0.0035 + Math.sin(rt.t * 1.3) * 0.001;
    rt.eatT -= dt; rt.chewT -= dt; rt.exprT -= dt;
    if (rt.exprT <= 0 && rt.expr !== 'neutral') { const fr = st.F / capF(); setExpr(fr > 0.85 ? 'full' : 'neutral', 1.5); if (rt.expr === 'neutral') rt.exprT = 0; }
    if (bubbleTimer > 0) { bubbleTimer -= dt; if (bubbleTimer <= 0) $('bubble').classList.add('hidden'); }
    // flying
    for (const f of rt.flying) { f.t += dt; if (f.t >= f.dur && !f.done) { f.done = true; arriveFood(f); } }
    rt.flying = rt.flying.filter(f => !f.done);
    for (const p of rt.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    rt.parts = rt.parts.filter(p => p.life > 0);
    for (const p of rt.popups) { p.life -= dt; p.y -= 40 * DPR * dt; }
    rt.popups = rt.popups.filter(p => p.life > 0);
    // auto chef
    if (st.u.chef > 0) { rt.chefT -= dt; if (rt.chefT <= 0) { rt.chefT = 5 / (1 + 0.3 * (st.u.chef - 1)); if (st.F + FOODS[st.unl].full <= capF()) feed(st.unl, [-40 * DPR, rt.groundY * 0.5], true); } }
    // idle chatter
    if (rt.t - rt.lastAct > 16 && !Sound.speaking()) { rt.lastAct = rt.t; setExpr('smile', 3); say('idle'); }
    Sound.setSpace(Math.min(1, Math.max(0, (Math.log10(rt.V) - 4.5) / 1.5)));
    saveT += dt; if (saveT > 4) { saveT = 0; save(); }
    hudT += dt; if (hudT > 0.1) { hudT = 0; updateHud(); }
  }
  function render(dt) {
    if (!meta) return;
    updateCamera();
    // world
    const shake = rt.shake * 6 * DPR; const sxo = (Math.random() - 0.5) * shake, syo = (Math.random() - 0.5) * shake;
    World.draw(bg, { k: rt.k, cx: W / 2 + sxo, gy: rt.groundY + syo, V: rt.V, t: rt.t }, rt.Sd);
    // contact shadow
    const sh = 1 - Math.min(1, Math.max(0, (Math.log10(rt.V) - 4.6) / 0.6));
    if (sh > 0.01) { const b = rt.belly; const w = Math.max(300, b.rx * 1.05) * rt.view[0]; const gr = bg.createRadialGradient(W / 2, rt.groundY, 0, W / 2, rt.groundY, w); gr.addColorStop(0, `rgba(0,0,0,${0.32 * sh})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); bg.save(); bg.translate(0, rt.groundY); bg.scale(1, 0.12); bg.translate(0, -rt.groundY); bg.fillStyle = gr; bg.beginPath(); bg.arc(W / 2, rt.groundY, w, 0, 7); bg.fill(); bg.restore(); }
    // character tint by environment (space -> slightly cooler/darker, room -> warm)
    const space = Math.min(1, Math.max(0, (Math.log10(rt.V) - 4.4) / 1.2));
    rt.tint = [1 - 0.08 * space, 1 - 0.08 * space, 1 + 0.02 * space];
    const fs = faceState(dt); const fcv = Face.render(fs); CharGL.updateFace(fcv);
    const view0 = rt.view; rt.view = [view0[0], view0[1] + sxo, view0[2] + syo];
    CharGL.draw(animState()); rt.view = view0;
    drawFx(dt); drawPortrait(fcv);
  }
  // ---------------- debug ----------------
  function setupDebug() {
    const d = $('debug'); d.classList.remove('hidden');
    const add = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; d.appendChild(b); };
    add('サイズ×2', () => { const b = stageOf(st.S).i; st.S *= 2; checkStage(b); });
    add('サイズ×10', () => { const b = stageOf(st.S).i; st.S *= 10; checkStage(b); });
    add('次ステージ', () => { const s = stageOf(st.S); const b = s.i; st.S = s.i < STAGES.length - 1 ? STAGES[s.i + 1].s * 1.05 : st.S * 10; checkStage(b); });
    add('♥+100万', () => { st.pts += 1e6; });
    add('満腹0', () => { st.F = 0; });
  }
  window.__game = { st, rt, setS: (s, instant) => { const b = stageOf(st.S).i; st.S = s; if (instant) rt.Sd = s; checkStage(b); }, feed: i => feed(i ?? st.unl, [W / 2, H - 80 * DPR]), massage, say, setExpr, get state() { return st; }, FOODS, Sound, save };
  // ---------------- boot ----------------
  async function boot() {
    resize(); World.gen();
    meta = await (await fetch('assets/img/meta.json')).json();
    S0 = 2 * meta.belly.rx * MPU0;
    const names = ['body', 'upper', 'face_base', 'face_noeyes', 'face_nomouth']; let n = 0;
    await Promise.all(names.map(k => new Promise((res, rej) => { const i = new Image(); i.onload = () => { imgs[k] = i; n++; $('loadPct').textContent = Math.round(n / (names.length + 1) * 100); res(); }; i.onerror = rej; i.src = 'assets/img/' + k + '.png'; })));
    await Sound.loadVoices('assets/voice/');
    $('loadPct').textContent = 100;
    Face.init(imgs, meta); CharGL.init(glC, imgs, meta);
    load(); if (!(st.S > 0)) st.S = S0; rt.Sd = st.S; st.maxStage = Math.max(st.maxStage, stageOf(st.S).i);
    $('loadTxt').classList.add('hidden'); $('btnStart').classList.remove('hidden');
    requestAnimationFrame(frame);
    if (params.has('autostart')) start();
  }
  function start() {
    Sound.unlock(); applyVol(); Sound.preloadAll('assets/voice/'); Sound.bgm(true);
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('panel').classList.remove('hidden');
    buildFood(); buildUp(); updateHud(); started = true; rt.lastAct = rt.t;
    setExpr('smile', 4); setTimeout(() => say('greet', { prio: 3 }), 500);
    st.played++; if (DEBUG) setupDebug();
  }
  $('btnStart').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('keydown', e => { if (e.key === 'F9' || (e.shiftKey && e.key === 'D')) setupDebug(); });
  boot().catch(e => { $('loadTxt').textContent = '読み込みエラー: ' + e.message; console.error(e); });
})();
