// ===== Dynamic face: eyelids, mouth shapes, blush drawn over the original face patch =====
'use strict';
const Face = (() => {
  let cv, ctx, imgs, F, maskCv; // F = [x0,y0,x1,y1,K]
  const LASH = '#2b1613', MOUTH_IN = '#6b2a28', TONGUE = '#d9817c', LIP = '#8a4a44';
  // eye geometry in body (2x) coordinates
  const EYES = {
    L: { open: [[454, 126.5], [461, 122.2], [471, 120.8], [481, 121.6], [488.5, 124.5]],
         closed: [[455, 130], [463, 134.2], [473, 135.6], [482, 134.4], [489, 131]],
         happy: [[456, 135.5], [463.5, 129.6], [472.5, 127.4], [481.5, 129.2], [489, 134.5]],
         top: 116, clipX: [452, 489], iris: [475, 130.5], ir: 6.2 },
    R: { open: [[515, 124.6], [522, 121], [534, 119.4], [546, 119.8], [553.5, 121.6]],
         closed: [[515, 128.5], [524, 132.6], [535, 134], [546, 132.6], [554.5, 128.5]],
         happy: [[516, 133.5], [524.5, 127.6], [535, 125.4], [545.5, 127.2], [554.5, 132.6]],
         top: 114, clipX: [512, 557], iris: [529, 129.5], ir: 6.2 },
  };
  function init(images, meta) {
    imgs = images; F = meta.face;
    cv = document.createElement('canvas'); cv.width = (F[2] - F[0]) * F[4]; cv.height = (F[3] - F[1]) * F[4];
    ctx = cv.getContext('2d');
    maskCv = document.createElement('canvas'); maskCv.width = cv.width; maskCv.height = cv.height;
    const m = maskCv.getContext('2d'); const fe = 14;
    m.fillStyle = '#fff'; m.filter = 'blur(' + (fe / 2.5) + 'px)'; m.fillRect(fe, fe, cv.width - 2 * fe, cv.height - 2 * fe); m.filter = 'none';
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function curve(e, c, happy) {
    const tgt = happy ? e.happy : e.closed;
    return e.open.map((p, i) => [lerp(p[0], tgt[i][0], c), lerp(p[1], tgt[i][1], c)]);
  }
  function pathThrough(pts) { // smooth curve through points (Catmull-Rom -> Bezier)
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }
  function lash(pts, w) { // tapered lash stroke
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = LASH;
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const t = (i + 0.5) / (n - 1); ctx.lineWidth = w * (0.45 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      ctx.beginPath(); const sub = pts.slice(Math.max(0, i - 1), Math.min(n, i + 3)); // local segment
      ctx.moveTo(pts[i][0], pts[i][1]);
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawEye(e, c, happy, wide) {
    if (c < 0.02 && wide < 0.02) return;
    if (wide > 0.02 && c < 0.02) {
      // surprised: raise the upper lash; reveal more iris (round eyes)
      const up = e.open.map((p, k) => [p[0], p[1] - 2.6 * wide * Math.sin(Math.PI * (0.15 + 0.7 * k / 4))]);
      ctx.save(); ctx.beginPath(); pathThrough(up); const back = e.open.map(p => [p[0], p[1] + 3.2]).reverse();
      back.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#e9e0dc'; ctx.fillRect(e.clipX[0], e.top, 60, 40);
      const ix = e.iris[0], iy = e.iris[1] - 0.6;
      const g = ctx.createRadialGradient(ix, iy - 2, 1, ix, iy, e.ir + 0.6); g.addColorStop(0, '#5d606b'); g.addColorStop(1, '#3a3b44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, e.ir + 0.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f2026'; ctx.beginPath(); ctx.arc(ix, iy + 0.5, e.ir * 0.42, 0, 7); ctx.fill();
      ctx.restore();
      lash(up, 3.0);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(ix - 2.2, iy - 2.2, 1.3, 0, 7); ctx.fill();
      return;
    }
    const lid = curve(e, c, happy);
    if (c > 0.72) { // (nearly) closed: hide the whole eye, then draw the closed lash
      ctx.save(); ctx.beginPath(); ctx.ellipse((e.clipX[0] + e.clipX[1]) / 2, e.iris[1] - 1, (e.clipX[1] - e.clipX[0]) / 2 + 1, 11, 0, 0, 7); ctx.clip();
      ctx.drawImage(imgs.face_noeyes, F[0], F[1], F[2] - F[0], F[3] - F[1]); ctx.restore();
      const k = (c - 0.72) / 0.28; const lidk = curve(e, 0.72 + 0.28 * k, happy);
      lash(lidk, happy ? 2.7 : 2.5);
      if (!happy) { // tiny lower lashes for a relaxed closed eye
        ctx.save(); ctx.strokeStyle = 'rgba(43,22,19,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); const q = lidk[4]; ctx.moveTo(q[0] - 0.5, q[1]); ctx.lineTo(q[0] + 2.2, q[1] + 1.6); ctx.stroke(); ctx.restore();
      }
      return;
    }
    // eyelid (skin) region: from above eye to the lid edge -> painted with the 'no eyes' face
    ctx.save(); ctx.beginPath();
    ctx.moveTo(e.clipX[0], e.top); ctx.lineTo(e.clipX[1], e.top);
    ctx.lineTo(lid[lid.length - 1][0] + 1.5, lid[lid.length - 1][1]);
    pathThrough(lid.slice().reverse());
    ctx.lineTo(e.clipX[0], lid[0][1]); ctx.closePath();
    if (happy && c > 0.5) { // happy closed: also cover below the arc
      ctx.moveTo(e.clipX[0], lid[0][1]); pathThrough(lid); ctx.lineTo(e.clipX[1], e.top + 30); ctx.lineTo(e.clipX[0], e.top + 30); ctx.closePath();
    }
    ctx.clip();
    ctx.drawImage(imgs.face_noeyes, F[0], F[1], F[2] - F[0], F[3] - F[1]);
    ctx.restore();
    if (c > 0.85 && !happy) { // fully closed: the lower lid line meets
      lash(lid, 2.6);
    } else lash(lid, 2.9 - 0.4 * c);
  }
  function eraseMouth() {
    ctx.save(); ctx.beginPath(); ctx.ellipse(507, 171, 27, 12.5, 0, 0, 7); ctx.clip();
    ctx.drawImage(imgs.face_nomouth, F[0], F[1], F[2] - F[0], F[3] - F[1]); ctx.restore();
  }
  function drawMouth(m) {
    const t = m.type, o = Math.max(0, Math.min(1, m.open || 0));
    if (t === 'neutral' && o < 0.05) return;
    eraseMouth();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cx = 507, cy = 169.5;
    if (t === 'neutral' || t === 'smile' || t === 'talk' || t === 'eat') {
      // smiling mouth that opens: D-shape
      const w = 19 - 3 * o, up = 2.2; const depth = 1.5 + 9.5 * o;
      ctx.beginPath();
      ctx.moveTo(cx - w, cy - 1.4);
      ctx.quadraticCurveTo(cx, cy + up - 0.5 * o, cx + w + 1, cy - 2.4);
      ctx.quadraticCurveTo(cx + w * 0.5, cy + depth * 1.25, cx, cy + depth);
      ctx.quadraticCurveTo(cx - w * 0.55, cy + depth * 1.2, cx - w, cy - 1.4);
      ctx.closePath();
      if (o > 0.05) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = MOUTH_IN; ctx.fillRect(cx - 30, cy - 10, 60, 30);
        ctx.fillStyle = TONGUE; ctx.beginPath(); ctx.ellipse(cx + 1, cy + depth + 2.5, w * 0.62, depth * 0.55, 0, 0, 7); ctx.fill();
        if (o > 0.35) { ctx.fillStyle = '#f5efec'; ctx.beginPath(); ctx.ellipse(cx, cy - 1.5, w * 0.8, 1.6 + o, 0, 0, 7); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = '#3d1c19'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - w - 1.5, cy - 2.2); ctx.quadraticCurveTo(cx, cy + up - 0.5 * o, cx + w + 2.5, cy - 3.2);
      ctx.strokeStyle = '#4a221f'; ctx.lineWidth = 2.2; ctx.stroke();
      if (o < 0.3) { ctx.strokeStyle = 'rgba(150,90,85,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 7, cy + 5.5); ctx.quadraticCurveTo(cx, cy + 7.5, cx + 7, cy + 5); ctx.stroke(); }
    } else if (t === 'o') { // surprise
      const rx = 4.5 + 2 * o, ry = 5 + 3.5 * o;
      ctx.fillStyle = MOUTH_IN; ctx.beginPath(); ctx.ellipse(cx, cy + 2.5, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = TONGUE; ctx.beginPath(); ctx.ellipse(cx, cy + 2.5 + ry * 0.55, rx * 0.7, ry * 0.38, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3d1c19'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.ellipse(cx, cy + 2.5, rx, ry, 0, 0, 7); ctx.stroke();
    } else if (t === 'wavy') { // embarrassed
      ctx.strokeStyle = '#4a221f'; ctx.lineWidth = 2.1; ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const x = cx - 12 + i, y = cy + 1.5 + Math.sin(i / 24 * Math.PI * 3) * 1.6; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    } else if (t === 'content') { // satisfied: small soft smile
      ctx.strokeStyle = '#4a221f'; ctx.lineWidth = 2.1; ctx.beginPath();
      ctx.moveTo(cx - 11, cy - 0.5); ctx.quadraticCurveTo(cx, cy + 5.5, cx + 11, cy - 1); ctx.stroke();
    } else if (t === 'pant') { // full/tired: small open
      const ry = 2.5 + 3 * o;
      ctx.fillStyle = MOUTH_IN; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 7, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3d1c19'; ctx.lineWidth = 1.6; ctx.stroke();
    } else if (t === 'chew') { // cheeks puffed chewing
      const ry = 1 + 2.5 * o;
      ctx.fillStyle = MOUTH_IN; ctx.beginPath(); ctx.ellipse(cx, cy + 1.5, 6 + 2 * o, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a221f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.quadraticCurveTo(cx, cy + 3 + ry, cx + 10, cy - 0.5); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBlush(b) {
    if (b < 0.02) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, b);
    for (const [x, y] of [[466, 151], [547, 149]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 13);
      g.addColorStop(0, 'rgba(240,110,120,0.55)'); g.addColorStop(1, 'rgba(240,110,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 13, 7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(205,70,85,0.55)'; ctx.lineWidth = 1.1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 4.2 + 2, y - 3); ctx.lineTo(x + i * 4.2 - 1.5, y + 3); ctx.stroke(); }
    }
    ctx.restore();
  }
  // state: {blink, happy(0/1), wide, mouth:{type,open}, blush}
  function render(s) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(F[4], 0, 0, F[4], -F[0] * F[4], -F[1] * F[4]);
    ctx.drawImage(imgs.face_base, F[0], F[1], F[2] - F[0], F[3] - F[1]);
    drawMouth(s.mouth);
    drawEye(EYES.L, s.blink, s.happy, s.wide);
    drawEye(EYES.R, s.blink, s.happy, s.wide);
    drawBlush(s.blush);
    // feather the patch borders so it blends invisibly into the body texture
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskCv, 0, 0); ctx.globalCompositeOperation = 'source-over';
    return cv;
  }
  return { init, render, get canvas() { return cv; } };
})();
