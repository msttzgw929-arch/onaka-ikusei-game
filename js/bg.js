// ===== World / background renderer: true-scale scenes from a room to beyond the universe =====
'use strict';
const World = (() => {
  const R_EARTH = 6.371e6, LY = 9.4607e15, AU = 1.496e11;
  let W = 0, H = 0, ctx, rnd;
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lss = (a, b, v) => ss(Math.log(a), Math.log(b), Math.log(Math.max(v, 1e-9)));
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ---------- procedural content generated once ----------
  let houses = [], trees = [], people = [], cars = [], blds = [], sky = [], mtns = [], clouds = [], stars = [], galaxies = [], earthImg, galaxyImg, nebulaImg, bubbles = [];
  function gen() {
    rnd = mulberry(12345);
    const R = rnd;
    const hcols = ['#e8d9c0', '#d9c7a8', '#f0e6d6', '#c9d6df', '#e3c9b9', '#d8dcc8', '#f2efe6', '#c8b49a'];
    const rcols = ['#7a3b30', '#4a5568', '#5a3e36', '#2f4f5f', '#8b4a3c', '#3d4a3a'];
    for (let row = 0; row < 3; row++) for (let x = -260; x < 260; x += 11 + R() * 6) {
      if (Math.abs(x) < 6 && row === 0) continue;
      houses.push({ x, z: 18 + row * 22 + R() * 6, w: 8 + R() * 3, h: 5.5 + R() * 3.5, roof: 2 + R() * 1.6, c: hcols[(R() * hcols.length) | 0], rc: rcols[(R() * rcols.length) | 0], two: R() < 0.6 });
    }
    for (let i = 0; i < 70; i++) trees.push({ x: -250 + R() * 500, z: 10 + R() * 70, h: 4 + R() * 6, c: R() });
    for (let i = 0; i < 26; i++) people.push({ x: -40 + R() * 80, z: 2 + R() * 8, v: (R() - 0.5) * 1.6, c: ['#334', '#844', '#448', '#484', '#a63', '#666'][(R() * 6) | 0], h: 1.55 + R() * 0.3 });
    for (let i = 0; i < 12; i++) cars.push({ x: -120 + R() * 240, z: 6 + R() * 4, v: (R() < 0.5 ? -1 : 1) * (6 + R() * 8), c: ['#c33', '#eee', '#225', '#999', '#e8b030', '#1a6'][(R() * 6) | 0] });
    for (let i = 0; i < 160; i++) { const z = 150 + R() * 1200, tall = R() < 0.18; blds.push({ x: (R() - 0.5) * 3000, z, w: 20 + R() * 40, h: tall ? 120 + R() * 180 : 20 + R() * 70, c: 140 + R() * 70 | 0, tint: R() }); }
    for (let i = 0; i < 70; i++) { sky.push({ x: (R() - 0.5) * 12000, z: 2000 + R() * 5000, w: 40 + R() * 70, h: 180 + R() * 330, c: 120 + R() * 80 | 0 }); }
    blds.sort((a, b) => b.z - a.z); sky.sort((a, b) => b.z - a.z); houses.sort((a, b) => b.z - a.z);
    for (let L = 0; L < 4; L++) { const pts = []; const z = [9000, 18000, 30000, 50000][L], hh = [900, 1500, 2300, 3000][L]; for (let x = -200000; x <= 200000; x += 1500 + L * 900) pts.push([x, hh * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.00011 * (L + 1) + L) * Math.sin(x * 0.000037 + L * 2))) + R() * hh * 0.2]); mtns.push({ z, pts, L }); }
    mtns.reverse();
    for (let i = 0; i < 46; i++) clouds.push({ x: (R() - 0.5) * 60000, y: 900 + R() * 2600, z: 2000 + R() * 25000, s: 600 + R() * 1800, v: 3 + R() * 6, seed: R() * 1000 });
    for (let i = 0; i < 700; i++) stars.push({ x: R(), y: R(), m: R(), c: R() });
    for (let i = 0; i < 170; i++) galaxies.push({ x: (R() - 0.5) * 1.2e24, y: (R() - 0.25) * 7e23, d: (2 + R() * 6) * 1e22, a: R() * 3, t: R(), e: 0.3 + R() * 0.7 });
    for (let i = 0; i < 40; i++) bubbles.push({ x: R(), y: R(), r: 0.3 + R(), h: R() * 360, p: R() * 6 });
    earthImg = makeEarth(512); galaxyImg = makeGalaxy(512); nebulaImg = makeNebula(512);
  }
  // value noise
  function noise2(seed) {
    const P = new Float32Array(256 * 256); const r = mulberry(seed); for (let i = 0; i < P.length; i++) P[i] = r();
    const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
    return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v; };
  }
  function makeEarth(N) {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const id = g.createImageData(N, N); const d = id.data;
    const n1 = noise2(7), n2 = noise2(99);
    const fbm = (n, x, y) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * n(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1, r2 = x * x + y * y, k = (j * N + i) * 4;
      if (r2 > 1) { d[k + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2); const lat = Math.asin(-y), lon = Math.atan2(x, z) + 0.6;
      const u = lon * 3, v = lat * 3;
      const h = fbm(n1, u + 20, v + 20) + 0.15 * Math.cos(lat * 2);
      const cl = fbm(n2, u * 1.7 + 5, v * 2.2 + 3);
      let col;
      const ice = Math.abs(lat) > 1.22;
      if (ice) col = [235, 242, 248];
      else if (h > 0.53) { const t = Math.min(1, (h - 0.53) * 5); const dry = fbm(n2, u * 3, v * 3); col = dry > 0.55 ? [196 - 30 * t, 170 - 30 * t, 120 - 20 * t] : [70 + 50 * t, 120 + 20 * t, 60 + 20 * t]; }
      else { const t = h / 0.53; col = [20 + 20 * t, 60 + 50 * t, 130 + 60 * t]; }
      const cloud = Math.max(0, Math.min(1, (cl - 0.52) * 4));
      col = col.map(cc => cc * (1 - cloud) + 250 * cloud);
      const light = Math.max(0.12, 0.25 + 0.85 * (x * -0.45 + y * -0.35 + z * 0.82));
      const rim = Math.pow(1 - z, 3);
      d[k] = Math.min(255, col[0] * light + 90 * rim); d[k + 1] = Math.min(255, col[1] * light + 140 * rim); d[k + 2] = Math.min(255, col[2] * light + 255 * rim); d[k + 3] = 255;
    }
    g.putImageData(id, 0, 0); return c;
  }
  function makeGalaxy(N) {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const r = mulberry(5);
    g.globalCompositeOperation = 'lighter';
    const core = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.18); core.addColorStop(0, 'rgba(255,240,200,0.9)'); core.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = core; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) {
      const arm = i % 2, t = r() ** 0.7 * 4.2, ang = t * 1.35 + arm * Math.PI + (r() - 0.5) * 0.55 / (0.4 + t * 0.2);
      const rad = (0.04 + t / 4.2 * 0.44) * N; const x = N / 2 + Math.cos(ang) * rad + (r() - 0.5) * 8, y = N / 2 + Math.sin(ang) * rad + (r() - 0.5) * 8;
      const blue = r() < 0.5; g.fillStyle = blue ? `rgba(150,180,255,${0.15 + r() * 0.3})` : `rgba(255,220,190,${0.12 + r() * 0.25})`;
      const s = r() < 0.03 ? 2.2 : 1.1; g.fillRect(x, y, s, s);
    }
    g.filter = 'blur(2px)'; g.globalAlpha = 0.6; g.drawImage(c, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
    return c;
  }
  function makeNebula(N) {
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const r = mulberry(77);
    g.globalCompositeOperation = 'lighter';
    const cols = ['255,80,160', '120,90,255', '60,200,255', '255,150,80'];
    for (let i = 0; i < 160; i++) { const x = N / 2 + (r() - 0.5) * N * 0.7, y = N / 2 + (r() - 0.5) * N * 0.5, rr = 20 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${cols[(r() * 4) | 0]},0.09)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(N / 2 + (r() - 0.5) * N * 0.8, N / 2 + (r() - 0.5) * N * 0.6, 1.2, 1.2); }
    return c;
  }
  // ---------- camera helpers ----------
  let cam; // {k, cx, gy, V, d, t}
  const sx = (x, s) => cam.cx + x * cam.k * s;
  const sy = (y, s) => cam.gy - y * cam.k * s;
  const persp = z => cam.d / (cam.d + z);
  // ---------- scenes ----------
  function drawSky(a) {
    const V = cam.V; const space = lss(2.5e4, 3e5, V);
    const g = ctx.createLinearGradient(0, 0, 0, cam.gy);
    const top = mix3([92, 160, 225], [5, 8, 22], space), bot = mix3([200, 228, 248], [10, 18, 45], space);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stars
    const st = lss(4e4, 4e5, V);
    if (st > 0.01) {
      const tw = cam.t;
      for (const s of stars) { const a2 = st * (0.3 + 0.7 * s.m) * (0.75 + 0.25 * Math.sin(tw * (1 + s.c * 2) + s.m * 50)); ctx.fillStyle = s.c < 0.15 ? `rgba(180,200,255,${a2})` : s.c > 0.9 ? `rgba(255,220,180,${a2})` : `rgba(255,255,255,${a2})`; const z = (s.m > 0.97 ? 2.2 : 1.2) * (W / 1200 + 0.5); ctx.fillRect(s.x * W, s.y * H, z, z); }
    }
    return space;
  }
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  function drawSun(V) { // sunlight glow from upper-left in space; daytime sun in sky
    const space = lss(2.5e4, 3e5, V);
    const x = W * 0.12, y = H * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.35);
    g.addColorStop(0, `rgba(255,250,230,${0.55 + 0.3 * space})`); g.addColorStop(0.06, `rgba(255,240,200,${0.35})`); g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawMountains(a) {
    if (a <= 0.01) return;
    for (const m of mtns) {
      const s = persp(m.z); const hz = cam.gy;
      const col = [[150, 175, 205], [130, 160, 190], [110, 145, 170], [95, 130, 150]][m.L];
      const fade = Math.min(1, a);
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${fade})`;
      ctx.beginPath(); ctx.moveTo(-10, hz + 1);
      for (const p of m.pts) { const X = sx(p[0], s), Y = sy(p[1], s); if (X < -2000 || X > W + 2000) continue; ctx.lineTo(X, Y); }
      ctx.lineTo(W + 10, hz + 1); ctx.closePath(); ctx.fill();
    }
    // Mt. Fuji (3776 m) as a landmark
    const fz = 9000, s = persp(fz), fx = 7000, X = sx(fx, s), Y0 = sy(0, s), hh = 3776 * cam.k * s, ww = 3776 * 2.4 * cam.k * s;
    if (hh > 2 && X - ww < W + 50 && X + ww > -50) {
      ctx.save(); ctx.globalAlpha = Math.min(1, a);
      const g = ctx.createLinearGradient(0, Y0 - hh, 0, Y0); g.addColorStop(0, '#6d86a8'); g.addColorStop(1, '#3f5a78');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X - ww, Y0); ctx.quadraticCurveTo(X - ww * 0.35, Y0 - hh * 0.55, X - ww * 0.09, Y0 - hh); ctx.lineTo(X + ww * 0.09, Y0 - hh); ctx.quadraticCurveTo(X + ww * 0.35, Y0 - hh * 0.55, X + ww, Y0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f7fb'; ctx.beginPath(); ctx.moveTo(X - ww * 0.09, Y0 - hh); ctx.lineTo(X + ww * 0.09, Y0 - hh);
      for (let i = 0; i <= 10; i++) { const t = i / 10; const yy = 0.66 + 0.07 * Math.abs(Math.sin(i * 2.1)); ctx.lineTo(X + ww * (0.27 - 0.54 * t) * (1 - yy) / 0.34, Y0 - hh * yy); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      label('富士山 3,776m', X, Y0 - hh - 10, a * ss(18, 60, hh));
    }
  }
  function drawGround(a, space) {
    // flat ground (horizon at feet); grass->asphalt tint
    const g = ctx.createLinearGradient(0, cam.gy, 0, H);
    g.addColorStop(0, `rgba(118,150,96,${a})`); g.addColorStop(1, `rgba(78,110,62,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, cam.gy, W, H - cam.gy);
    // haze on horizon
    const hz = ctx.createLinearGradient(0, cam.gy - H * 0.25, 0, cam.gy); hz.addColorStop(0, 'rgba(220,235,250,0)'); hz.addColorStop(1, `rgba(220,235,250,${0.55 * a * (1 - space)})`);
    ctx.fillStyle = hz; ctx.fillRect(0, cam.gy - H * 0.25, W, H * 0.25);
  }
  function drawEarth(a) { // Earth as a sphere under her feet
    if (a <= 0.005) return;
    const r = R_EARTH * cam.k; const X = cam.cx, Y = cam.gy + r;
    ctx.save(); ctx.globalAlpha = a;
    if (r < 6000) {
      // atmosphere glow
      const ag = ctx.createRadialGradient(X, Y, r * 0.98, X, Y, r * 1.12); ag.addColorStop(0, 'rgba(120,180,255,0.65)'); ag.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(X, Y, r * 1.12, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(X, Y); ctx.rotate(cam.t * 0.01); ctx.drawImage(earthImg, -r, -r, 2 * r, 2 * r); ctx.restore();
      if (r > 2) label('地球 12,742km', X, Y + r + 18, ss(10, 30, r) * (1 - ss(2000, 4000, r)), true);
    } else {
      // huge: only the top arc is visible, draw a big circle with gradient
      const g = ctx.createLinearGradient(0, cam.gy, 0, H); g.addColorStop(0, '#5d8fbf'); g.addColorStop(0.02, '#2f5f8f'); g.addColorStop(1, '#1d3d66');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
      const ag = ctx.createLinearGradient(0, cam.gy - 40, 0, cam.gy + 4); ag.addColorStop(0, 'rgba(140,190,255,0)'); ag.addColorStop(1, 'rgba(140,190,255,0.7)');
      ctx.fillStyle = ag; ctx.fillRect(0, cam.gy - 40, W, 44);
    }
    ctx.restore();
  }
  function drawClouds(a) {
    if (a <= 0.01) return;
    for (const c of clouds) {
      const s = persp(c.z), x = ((c.x + cam.t * c.v) % 60000 + 90000) % 60000 - 30000;
      const X = sx(x, s), Y = sy(c.y, s), R = c.s * cam.k * s;
      if (R < 3 || X + R * 2 < 0 || X - R * 2 > W || R > W * 4) continue;
      ctx.save(); ctx.globalAlpha = a * 0.85 * (1 - ss(W * 1.5, W * 4, R));
      for (let i = 0; i < 6; i++) { const ox = (Math.sin(c.seed + i * 1.7)) * R * 0.9, oy = Math.cos(c.seed + i * 2.3) * R * 0.18 - R * 0.1 * (i % 2), rr = R * (0.45 + 0.25 * Math.abs(Math.sin(c.seed * 3 + i)));
        const g = ctx.createRadialGradient(X + ox, Y + oy - rr * 0.3, rr * 0.1, X + ox, Y + oy, rr); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(240,245,252,0.75)'); g.addColorStop(1, 'rgba(230,238,248,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X + ox, Y + oy, rr, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawSkyscrapers(a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    for (const b of sky) { const s = persp(b.z), X = sx(b.x - b.w / 2, s), w = b.w * cam.k * s, h = b.h * cam.k * s; if (X > W || X + w < 0 || h < 1) continue; const Y = sy(0, s);
      ctx.fillStyle = `rgb(${b.c - 30},${b.c - 15},${b.c + 10})`; ctx.fillRect(X, Y - h, w, h);
      ctx.fillStyle = `rgba(255,255,255,0.12)`; ctx.fillRect(X, Y - h, w * 0.35, h); }
    // Skytree-like tower 634 m
    tower(2400, 2200, 634, 'sky');
    ctx.restore();
  }
  function tower(x, z, h, type) {
    const s = persp(z), X = sx(x, s), Y = sy(0, s), H2 = h * cam.k * s; if (H2 < 3 || X < -200 || X > W + 200) return;
    ctx.save();
    if (type === 'sky') {
      ctx.fillStyle = '#dfe6ee'; ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = Math.max(0.5, H2 * 0.004);
      ctx.beginPath(); ctx.moveTo(X - H2 * 0.07, Y); ctx.lineTo(X - H2 * 0.012, Y - H2 * 0.82); ctx.lineTo(X - H2 * 0.004, Y - H2); ctx.lineTo(X + H2 * 0.004, Y - H2); ctx.lineTo(X + H2 * 0.012, Y - H2 * 0.82); ctx.lineTo(X + H2 * 0.07, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b8c6d6'; ctx.fillRect(X - H2 * 0.03, Y - H2 * 0.56, H2 * 0.06, H2 * 0.03); ctx.fillRect(X - H2 * 0.022, Y - H2 * 0.71, H2 * 0.044, H2 * 0.025);
      label('スカイツリー 634m', X, Y - H2 - 8, ss(40, 120, H2) * (1 - ss(1200, 2600, H2)));
    } else {
      ctx.fillStyle = '#e8462e'; ctx.beginPath(); ctx.moveTo(X - H2 * 0.16, Y); ctx.quadraticCurveTo(X - H2 * 0.05, Y - H2 * 0.5, X - H2 * 0.008, Y - H2); ctx.lineTo(X + H2 * 0.008, Y - H2); ctx.quadraticCurveTo(X + H2 * 0.05, Y - H2 * 0.5, X + H2 * 0.16, Y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (const f of [0.15, 0.42, 0.66]) ctx.fillRect(X - H2 * (0.13 - f * 0.12), Y - H2 * f, H2 * (0.26 - f * 0.24), H2 * 0.035);
      label('東京タワー 333m', X, Y - H2 - 8, ss(40, 120, H2) * (1 - ss(1000, 2400, H2)));
    }
    ctx.restore();
  }
  function drawCity(a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    tower(-520, 700, 333, 'tokyo');
    for (const b of blds) { const s = persp(b.z), X = sx(b.x - b.w / 2, s), w = b.w * cam.k * s, h = b.h * cam.k * s; if (X > W || X + w < 0 || h < 1) continue; const Y = sy(0, s);
      const c = b.c; ctx.fillStyle = `rgb(${c},${c + 6},${c + 16})`; ctx.fillRect(X, Y - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X + w * 0.7, Y - h, w * 0.3, h);
      if (w > 12 && h > 18) { ctx.fillStyle = b.tint < 0.5 ? 'rgba(120,170,220,0.55)' : 'rgba(60,80,110,0.5)'; const cols = Math.max(2, Math.round(w / 7)), rows = Math.max(2, Math.round(h / 9)); const cw = w / cols, rh = h / rows;
        if (cols * rows < 900) for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) ctx.fillRect(X + i * cw + cw * 0.2, Y - h + j * rh + rh * 0.15, cw * 0.6, rh * 0.5); }
    }
    ctx.restore();
  }
  function drawTown(a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    for (const t of trees) if (t.z > 40) tree(t);
    for (const hs of houses) house(hs);
    for (const t of trees) if (t.z <= 40) tree(t);
    // road
    const s0 = persp(4), s1 = persp(9);
    ctx.fillStyle = '#6b6f75'; ctx.fillRect(0, sy(0, s1), W, Math.max(1, sy(0, s0) - sy(0, s1)) + (cam.gy - sy(0, s0)));
    // cars & people
    for (const c of cars) { const x = ((c.x + cam.t * c.v) % 240 + 360) % 240 - 120; const s = persp(c.z), X = sx(x, s), Y = sy(0, s), L = 4.3 * cam.k * s, Hh = 1.45 * cam.k * s; if (L < 1.5 || X < -L || X > W + L) continue;
      ctx.fillStyle = c.c; rr(X - L / 2, Y - Hh * 0.62, L, Hh * 0.45, Hh * 0.15); rr(X - L * 0.28, Y - Hh, L * 0.56, Hh * 0.45, Hh * 0.18);
      ctx.fillStyle = 'rgba(160,200,230,0.9)'; ctx.fillRect(X - L * 0.22, Y - Hh * 0.92, L * 0.44, Hh * 0.28);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(X - L * 0.3, Y - Hh * 0.17, Hh * 0.17, 0, 7); ctx.arc(X + L * 0.3, Y - Hh * 0.17, Hh * 0.17, 0, 7); ctx.fill(); }
    for (const p of people) { const x = ((p.x + cam.t * p.v) % 80 + 120) % 80 - 40; const s = persp(p.z), X = sx(x, s), Y = sy(0, s), h = p.h * cam.k * s; if (h < 2 || X < -10 || X > W + 10) continue;
      ctx.fillStyle = p.c; rr(X - h * 0.13, Y - h * 0.78, h * 0.26, h * 0.42, h * 0.08); ctx.fillRect(X - h * 0.1, Y - h * 0.38, h * 0.08, h * 0.38); ctx.fillRect(X + h * 0.02, Y - h * 0.38, h * 0.08, h * 0.38);
      ctx.fillStyle = '#f0cfb0'; ctx.beginPath(); ctx.arc(X, Y - h * 0.87, h * 0.1, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) : ctx.rect(x, y, w, h); ctx.fill(); }
  function tree(t) {
    const s = persp(t.z), X = sx(t.x, s), Y = sy(0, s), h = t.h * cam.k * s; if (h < 1.5 || X < -h || X > W + h) return;
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(X - h * 0.05, Y - h * 0.45, h * 0.1, h * 0.45);
    const g = 90 + t.c * 50 | 0; ctx.fillStyle = `rgb(${50 + t.c * 30 | 0},${g},${55})`;
    ctx.beginPath(); ctx.arc(X, Y - h * 0.62, h * 0.3, 0, 7); ctx.arc(X - h * 0.17, Y - h * 0.5, h * 0.22, 0, 7); ctx.arc(X + h * 0.17, Y - h * 0.5, h * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(X - h * 0.08, Y - h * 0.7, h * 0.14, 0, 7); ctx.fill();
  }
  function house(hs) {
    const s = persp(hs.z), X = sx(hs.x, s), Y = sy(0, s), w = hs.w * cam.k * s, h = hs.h * cam.k * s, rf = hs.roof * cam.k * s; if (w < 1.5 || X + w < 0 || X - w > W) return;
    ctx.fillStyle = hs.c; ctx.fillRect(X - w / 2, Y - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(X + w * 0.2, Y - h, w * 0.3, h);
    ctx.fillStyle = hs.rc; ctx.beginPath(); ctx.moveTo(X - w * 0.58, Y - h); ctx.lineTo(X, Y - h - rf); ctx.lineTo(X + w * 0.58, Y - h); ctx.closePath(); ctx.fill();
    if (w > 10) { ctx.fillStyle = 'rgba(110,160,200,0.85)'; const fl = hs.two ? 2 : 1; for (let f = 0; f < fl; f++) for (let i = 0; i < 2; i++) ctx.fillRect(X - w * 0.36 + i * w * 0.46, Y - h + h * (0.18 + f * 0.42), w * 0.22, h * 0.2);
      ctx.fillStyle = '#7a5236'; ctx.fillRect(X + w * 0.12, Y - h * 0.38, w * 0.16, h * 0.38); }
  }
  // ----- room -----
  function drawRoom(a) {
    if (a <= 0.01) return;
    const k = cam.k; ctx.save(); ctx.globalAlpha = a;
    const ceil = sy(2.5, 1);
    // wall
    const wg = ctx.createLinearGradient(0, ceil, 0, cam.gy); wg.addColorStop(0, '#f6ead8'); wg.addColorStop(1, '#ead6bb');
    ctx.fillStyle = wg; ctx.fillRect(0, ceil, W, cam.gy - ceil);
    // wallpaper stripes
    ctx.fillStyle = 'rgba(200,160,120,0.10)'; const sp = 0.22 * k; if (sp > 3) for (let x = cam.cx % (sp * 2) - sp * 2; x < W; x += sp * 2) ctx.fillRect(x, ceil, sp * 0.5, cam.gy - ceil);
    // wainscot
    const wy = sy(0.9, 1); ctx.fillStyle = '#c99f74'; ctx.fillRect(0, wy, W, cam.gy - wy); ctx.fillStyle = '#b48760'; ctx.fillRect(0, wy - 0.035 * k, W, 0.05 * k);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; const pw = 0.6 * k; if (pw > 4) for (let x = cam.cx % pw - pw; x < W; x += pw) ctx.fillRect(x, wy + 0.08 * k, 2, cam.gy - wy - 0.16 * k);
    ctx.fillStyle = '#8d6748'; ctx.fillRect(0, cam.gy - 0.1 * k, W, 0.1 * k);
    // ceiling
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(0, 0, W, ceil); ctx.fillStyle = '#e2d3bf'; ctx.fillRect(0, ceil - 0.06 * k, W, 0.08 * k);
    // window (right)
    win(1.6, 1.0, 1.25, 1.15);
    win(-2.9, 1.0, 1.25, 1.15);
    // door (left)
    const dx = sx(-1.6, 1), dw = 0.85 * k, dh = 2.0 * k; ctx.fillStyle = '#9a6a45'; ctx.fillRect(dx - dw / 2, cam.gy - dh, dw, dh); ctx.fillStyle = '#7d5435'; ctx.fillRect(dx - dw * 0.4, cam.gy - dh * 0.95, dw * 0.8, dh * 0.4); ctx.fillRect(dx - dw * 0.4, cam.gy - dh * 0.5, dw * 0.8, dh * 0.45);
    ctx.fillStyle = '#e0c060'; ctx.beginPath(); ctx.arc(dx + dw * 0.35, cam.gy - dh * 0.48, 0.03 * k, 0, 7); ctx.fill();
    // clock
    const cxk = sx(-0.95, 1), cyk = sy(1.95, 1), cr = 0.16 * k; ctx.fillStyle = '#7a5236'; ctx.beginPath(); ctx.arc(cxk, cyk, cr, 0, 7); ctx.fill(); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(cxk, cyk, cr * 0.82, 0, 7); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1, cr * 0.08); const tm = Date.now() / 1000; ctx.beginPath(); ctx.moveTo(cxk, cyk); ctx.lineTo(cxk + Math.sin(tm / 600) * cr * 0.5, cyk - Math.cos(tm / 600) * cr * 0.5); ctx.moveTo(cxk, cyk); ctx.lineTo(cxk + Math.sin(tm / 10) * cr * 0.7, cyk - Math.cos(tm / 10) * cr * 0.7); ctx.stroke();
    // plant
    const px = sx(-2.35, 1); ctx.fillStyle = '#b5653a'; ctx.beginPath(); ctx.moveTo(px - 0.18 * k, cam.gy - 0.42 * k); ctx.lineTo(px + 0.18 * k, cam.gy - 0.42 * k); ctx.lineTo(px + 0.13 * k, cam.gy); ctx.lineTo(px - 0.13 * k, cam.gy); ctx.fill();
    ctx.fillStyle = '#4f8a4a'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(px + Math.sin(i * 1.3) * 0.2 * k, cam.gy - (0.6 + 0.35 * Math.abs(Math.cos(i))) * k, 0.09 * k, 0.26 * k, Math.sin(i * 1.3) * 0.7, 0, 7); ctx.fill(); }
    // pendant light
    const lx = sx(-0.6, 1); ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, 0.01 * k); ctx.beginPath(); ctx.moveTo(lx, ceil); ctx.lineTo(lx, sy(2.15, 1)); ctx.stroke(); ctx.fillStyle = '#f2c66b'; ctx.beginPath(); ctx.moveTo(lx - 0.18 * k, sy(2.0, 1)); ctx.lineTo(lx + 0.18 * k, sy(2.0, 1)); ctx.lineTo(lx + 0.07 * k, sy(2.17, 1)); ctx.lineTo(lx - 0.07 * k, sy(2.17, 1)); ctx.fill();
    const lg = ctx.createRadialGradient(lx, sy(1.95, 1), 0, lx, sy(1.95, 1), 1.6 * k); lg.addColorStop(0, 'rgba(255,230,160,0.35)'); lg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 1.6 * k, sy(1.95, 1) - 1.6 * k, 3.2 * k, 3.2 * k);
    // floor
    const fg = ctx.createLinearGradient(0, cam.gy, 0, H); fg.addColorStop(0, '#b88a5c'); fg.addColorStop(1, '#8f6540'); ctx.fillStyle = fg; ctx.fillRect(0, cam.gy, W, H - cam.gy);
    ctx.strokeStyle = 'rgba(70,40,20,0.25)'; ctx.lineWidth = 1; const vpx = cam.cx; ctx.beginPath();
    for (let i = -30; i <= 30; i++) { const x0 = cam.cx + i * 0.25 * k; ctx.moveTo(x0, cam.gy); ctx.lineTo(vpx + (x0 - vpx) * 3, H + (H - cam.gy) * 2); } ctx.stroke();
    for (let j = 1; j < 8; j++) { const y = cam.gy + (H - cam.gy) * (j * j) / 49; ctx.fillStyle = 'rgba(60,35,15,0.12)'; ctx.fillRect(0, y, W, 1); }
    // table (right of her) with dishes
    table(1.25, 0.95);
    // rug shadow
    ctx.restore();
  }
  function win(x, y, w, h) {
    const X = sx(x, 1), Y = sy(y + h, 1), Wd = w * cam.k, Hd = h * cam.k;
    const g = ctx.createLinearGradient(0, Y, 0, Y + Hd); g.addColorStop(0, '#8cc4f0'); g.addColorStop(1, '#d6ecfa'); ctx.fillStyle = g; ctx.fillRect(X, Y, Wd, Hd);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(X + Wd * 0.3, Y + Hd * 0.35, Wd * 0.16, Hd * 0.06, 0, 0, 7); ctx.ellipse(X + Wd * 0.42, Y + Hd * 0.32, Wd * 0.12, Hd * 0.07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7ba05b'; ctx.fillRect(X, Y + Hd * 0.82, Wd, Hd * 0.18);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, 0.05 * cam.k); ctx.strokeRect(X, Y, Wd, Hd); ctx.beginPath(); ctx.moveTo(X + Wd / 2, Y); ctx.lineTo(X + Wd / 2, Y + Hd); ctx.moveTo(X, Y + Hd / 2); ctx.lineTo(X + Wd, Y + Hd / 2); ctx.stroke();
    ctx.fillStyle = '#d9798a'; ctx.fillRect(X - Wd * 0.18, Y - Hd * 0.08, Wd * 0.22, Hd * 1.2); ctx.fillRect(X + Wd * 0.96, Y - Hd * 0.08, Wd * 0.22, Hd * 1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 3; i++) { ctx.fillRect(X - Wd * 0.15 + i * Wd * 0.07, Y - Hd * 0.08, 2, Hd * 1.2); ctx.fillRect(X + Wd * 0.99 + i * Wd * 0.07, Y - Hd * 0.08, 2, Hd * 1.2); }
    ctx.fillStyle = '#b07a4f'; ctx.fillRect(X - Wd * 0.25, Y - Hd * 0.1, Wd * 1.5, Math.max(2, 0.04 * cam.k));
  }
  function table(x, w) {
    const k = cam.k, X = sx(x, 1), top = sy(0.72, 1), Wd = w * k;
    ctx.fillStyle = '#7a4f2d'; ctx.fillRect(X - Wd * 0.42, top, 0.05 * k, 0.72 * k); ctx.fillRect(X + Wd * 0.38, top, 0.05 * k, 0.72 * k);
    ctx.fillStyle = '#fff6f2'; ctx.fillRect(X - Wd / 2, top - 0.03 * k, Wd, 0.2 * k);
    ctx.fillStyle = '#e8a0a8'; for (let i = 0; i < 8; i++) ctx.fillRect(X - Wd / 2 + i * Wd / 8, top + 0.1 * k, Wd / 16, 0.07 * k);
    // plates
    for (const [ox, e] of [[-0.25, '🍰'], [0.18, '🍙']]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(X + ox * k, top - 0.03 * k, 0.13 * k, 0.03 * k, 0, 0, 7); ctx.fill(); emoji(e, X + ox * k, top - 0.09 * k, 0.15 * k); }
  }
  function emoji(e, x, y, s) { if (s < 4) return; ctx.font = `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }
  function label(t, x, y, a, below) {
    if (a <= 0.02) return; ctx.save(); ctx.globalAlpha = Math.min(1, a) * (ctx.globalAlpha || 1);
    const fs = Math.max(11, Math.min(16, W / 80)) * (window.devicePixelRatio || 1); ctx.font = `bold ${fs}px "Hiragino Kaku Gothic ProN","Noto Sans JP","Noto Sans CJK JP",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = below ? 'top' : 'bottom';
    ctx.lineWidth = fs * 0.28; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(t, x, y); ctx.fillStyle = '#fff'; ctx.fillText(t, x, y); ctx.restore();
  }
  // ----- space -----
  function drawMoon(a) {
    if (a <= 0.01) return; const r = 1.737e6 * cam.k; const X = sx(3.844e8 * 0.25, 1), Y = sy(R_EARTH * -1 + 3.844e8 * 0.12, 1);
    if (r < 0.6) return; ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(X - r * 0.4, Y - r * 0.4, r * 0.1, X, Y, r); g.addColorStop(0, '#f2f2ee'); g.addColorStop(1, '#8d8d88'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, Math.max(r, 0.8), 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(90,90,90,0.25)'; for (const [u, v, s] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.15], [-0.05, 0.35, 0.18]]) { ctx.beginPath(); ctx.arc(X + u * r, Y + v * r, s * r, 0, 7); ctx.fill(); }
    label('月 3,474km', X, Y + r + 8, ss(8, 30, r) * (1 - ss(800, 2000, r)), true); ctx.restore();
  }
  function drawSunBody(a) { // the Sun as a comparison object beside her
    if (a <= 0.01) return; const D = 1.392e9, r = D / 2 * cam.k; const X = sx(-D * 1.5, 1), Y = sy(D * 0.9, 1);
    if (r < 0.8 || r > W * 6) return; ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(X, Y, r * 0.2, X, Y, r * 2.2); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.42, 'rgba(255,190,80,0.95)'); g.addColorStop(0.47, 'rgba(255,160,60,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 2.2, 0, 7); ctx.fill(); label('太陽 139万km', X, Y + r * 1.15, ss(10, 40, r) * (1 - ss(900, 2200, r)), true); ctx.restore();
  }
  function drawSolar(a) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a;
    const sunX = sx(-AU * 0.7, 1), sunY = sy(AU * 0.3, 1);
    const orb = [0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30.1]; const cols = ['#bbb', '#e8c27a', '#5aa0e8', '#d0623b', '#d9b48a', '#e3cf8f', '#9fd8e0', '#5a7be0'];
    ctx.lineWidth = Math.max(1, W / 1400);
    orb.forEach((o, i) => { const r = o * AU * cam.k; if (r < 2 || r > W * 20) return; ctx.strokeStyle = `rgba(160,190,255,${0.35})`; ctx.beginPath(); ctx.ellipse(sunX, sunY, r, r * 0.35, 0, 0, 7); ctx.stroke();
      const ang = cam.t * 0.05 / Math.pow(o, 1.5) + i * 1.3; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(sunX + Math.cos(ang) * r, sunY + Math.sin(ang) * r * 0.35, Math.max(1.5, W / 700), 0, 7); ctx.fill(); });
    const gr = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(6, W / 60)); gr.addColorStop(0, 'rgba(255,245,200,1)'); gr.addColorStop(1, 'rgba(255,180,80,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sunX, sunY, Math.max(6, W / 60), 0, 7); ctx.fill();
    const rr2 = 30.1 * AU * cam.k; label('太陽系（海王星軌道）', sunX, sunY + rr2 * 0.35 + 6, ss(30, 100, rr2) * (1 - ss(W * 2, W * 5, rr2)), true);
    ctx.restore();
  }
  function drawNebula(a) {
    if (a <= 0.01) return; const D = 2.5e17, s = D * cam.k; if (s < 4) return; ctx.save(); ctx.globalAlpha = a * (1 - ss(W * 3, W * 8, s));
    ctx.drawImage(nebulaImg, sx(-D * 0.9, 1) - s / 2, sy(D * 0.35, 1) - s / 2, s, s);
    ctx.drawImage(nebulaImg, sx(D * 1.1, 1) - s * 0.35, sy(D * 0.9, 1) - s * 0.35, s * 0.7, s * 0.7);
    label('オリオン大星雲（約24光年）', sx(-D * 0.9, 1), sy(D * 0.35, 1) + s * 0.3, ss(60, 160, s) * (1 - ss(W * 1.5, W * 3, s)), true); ctx.restore();
  }
  function drawGalaxy(a) {
    if (a <= 0.01) return; const D = 1e5 * LY, s = D * cam.k * 1.15; if (s < 3) return; ctx.save(); ctx.globalAlpha = a * (1 - ss(W * 3, W * 8, s));
    const X = sx(-D * 0.95, 1), Y = sy(D * 0.55, 1); ctx.translate(X, Y); ctx.rotate(cam.t * 0.004); ctx.scale(1, 0.55); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(galaxyImg, -s / 2, -s / 2, s, s); ctx.restore();
    label('天の川銀河（約10万光年）', X, Y + s * 0.3, ss(60, 160, s) * (1 - ss(W * 1.5, W * 3, s)), true);
  }
  function drawCluster(a) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    for (const g of galaxies) { const s = g.d * cam.k; if (s < 1) continue; const X = sx(g.x, 1), Y = sy(g.y, 1); if (X < -s || X > W + s || Y < -s || Y > H + s) continue;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(g.a); ctx.scale(1, g.e); ctx.globalAlpha = Math.min(1, a * 1.4); ctx.drawImage(galaxyImg, -s / 2, -s / 2, s, s); ctx.restore(); }
    ctx.restore();
  }
  function drawWeb(a) { // cosmic web
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    const unit = 3e25 * cam.k; const r = mulberry(4242);
    for (let i = 0; i < 260; i++) { const x = sx((r() - 0.5) * 3e27, 1), y = sy((r() - 0.3) * 2e27, 1); const len = (0.5 + r()) * unit * 3; const ang = r() * 6.28;
      if (x < -len || x > W + len || y < -len || y > H + len) continue;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.addColorStop(0, 'rgba(140,120,255,0)'); g.addColorStop(0.5, `rgba(${150 + r() * 100 | 0},140,255,0.35)`); g.addColorStop(1, 'rgba(140,120,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, unit * 0.12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke(); }
    ctx.restore();
  }
  function drawBeyond(a, S) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.8); const h = (cam.t * 6) % 360;
    g.addColorStop(0, `hsla(${h},70%,25%,0.6)`); g.addColorStop(1, `hsla(${(h + 120) % 360},70%,8%,0.9)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const lv = Math.log10(S); ctx.globalCompositeOperation = 'lighter';
    for (const b of bubbles) { const ph = (lv * 0.7 + b.p) % 1; const r = b.r * Math.min(W, H) * 0.25 * (1 - ph) ; const x = b.x * W, y = b.y * H;
      const gg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r); gg.addColorStop(0, `hsla(${b.h + h},80%,60%,0)`); gg.addColorStop(0.9, `hsla(${b.h + h},80%,70%,${0.35 * ph})`); gg.addColorStop(1, `hsla(${b.h + h},80%,70%,0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  // ---------- main ----------
  function draw(c, camera, S) {
    ctx = c; W = c.canvas.width; H = c.canvas.height; cam = camera; cam.d = cam.V * 1.6;
    const V = cam.V;
    const space = drawSky();
    drawSun(V);
    const out = lss(2.7, 4.3, V);            // outdoors
    const flatA = 1 - lss(6e4, 6e5, V);    // flat terrestrial scenery
    // far -> near
    drawCluster(lss(3e21, 3e22, V) * (1 - lss(3e25, 3e26, V)));
    drawWeb(lss(3e24, 3e25, V) * (1 - lss(1e28, 1e29, V)));
    drawGalaxy(lss(2e19, 2e20, V) * (1 - lss(1e23, 1e24, V)));
    drawNebula(lss(3e15, 3e16, V) * (1 - lss(4e19, 4e20, V)));
    drawSolar(lss(5e11, 5e12, V) * (1 - lss(5e15, 5e16, V)));
    drawSunBody(lss(5e8, 2e9, V) * (1 - lss(2e12, 2e13, V)));
    drawMoon(lss(1e7, 6e7, V) * (1 - lss(1e10, 1e11, V)));
    if (flatA > 0.01) {
      drawMountains(out * flatA);
      drawClouds(lss(400, 1500, V) * flatA * (1 - lss(2e5, 1e6, V)));
      drawSkyscrapers(lss(60, 250, V) * flatA * (1 - lss(4e4, 2e5, V)));
      drawCity(lss(12, 40, V) * flatA * (1 - lss(2e4, 1e5, V)));
      drawGround(out * flatA, space);
      drawTown(out * (1 - lss(3000, 15000, V)));
    }
    drawEarth(lss(2e4, 2e5, V) * (1 - lss(1e10, 1e11, V)));
    drawRoom(1 - out);
    drawBeyond(lss(3e27, 3e28, V), S);
  }
  return { gen, draw, R_EARTH, LY };
})();
