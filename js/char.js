// ===== Character renderer (WebGL): body mesh + deformable belly + upper layer + dynamic face =====
'use strict';
const CharGL = (() => {
  const VS = `
  attribute vec2 aPos; attribute vec2 aUV;
  uniform vec3 uView; uniform vec2 uRes; uniform vec4 uAnim; // breath, sway, headTilt, time
  varying vec2 vUV; varying vec2 vBody;
  vec2 deform(vec2 p){
    float br=uAnim.x;
    float chest=smoothstep(930.0,560.0,p.y);
    float bust=exp(-pow((p.y-470.0)/150.0,2.0))*smoothstep(950.0,500.0,p.y);
    p.y-=br*3.2*chest;
    p.x+=(p.x-491.0)*br*0.0045*bust;
    // gentle head tilt around neck
    float head=smoothstep(250.0,150.0,p.y);
    vec2 nk=vec2(491.0,240.0); vec2 d=p-nk; float a=uAnim.z*head;
    p=mix(p, nk+vec2(d.x*cos(a)-d.y*sin(a), d.x*sin(a)+d.y*cos(a)), head);
    // sway pivot at feet
    float w=clamp((2670.0-p.y)/2670.0,0.0,1.0);
    p.x+=uAnim.y*(2670.0-p.y)*w;
    return p;
  }
  void main(){
    vec2 p=deform(aPos);
    vec2 s=p*uView.x+uView.yz;
    gl_Position=vec4(s.x/uRes.x*2.0-1.0, 1.0-s.y/uRes.y*2.0, 0.0, 1.0);
    vUV=aUV; vBody=aPos;
  }`;
  const FS_TEX = `
  precision highp float; varying vec2 vUV; uniform sampler2D uTex; uniform float uAlpha; uniform vec3 uTint;
  void main(){ vec4 c=texture2D(uTex,vUV); c.rgb*=uTint; gl_FragColor=c*uAlpha; }`; // premultiplied
  const FS_BELLY = `
  precision highp float;
  varying vec2 vBody;
  uniform sampler2D uTex; uniform vec2 uTexSize;
  uniform vec2 uC; uniform vec2 uR; uniform vec2 uC0; uniform vec2 uR0;
  uniform float uPx;      // screen px per body unit
  uniform float uG;       // growth factor (visual)
  uniform float uFlat;    // bottom flatten 0..1
  uniform vec4 uWave;     // amp, phase, poke strength, unused
  uniform vec2 uPoke;     // normalized poke position
  uniform vec3 uTint;
  float snorm(vec2 p){
    float n = p.y>0.0 ? 2.0+uFlat*3.0 : 2.0;
    return pow(pow(abs(p.x),n)+pow(abs(p.y),n),1.0/n);
  }
  void main(){
    vec2 p=(vBody-uC)/uR;
    float r=snorm(p);
    float Rm=0.5*(uR.x+uR.y), R0=0.5*(uR0.x+uR0.y);
    float aa=1.3/(Rm*uPx);
    if(r>1.0+aa) discard;
    // ripple 'purun' wave + poke dent
    float wv=uWave.x*sin(r*9.0-uWave.y)*r*(1.0-r*0.6);
    vec2 q=p*(1.0+wv);
    vec2 dp=p-uPoke; float pk=uWave.z*exp(-dot(dp,dp)/0.06);
    q+= dp*pk*0.35;
    float rq=max(snorm(q),1e-4);
    // outline-preserving radial remap
    float t0=6.0/R0, t=min(6.0/Rm, t0);
    float rs = rq<=1.0-t ? rq*(1.0-t0)/(1.0-t) : 1.0-(1.0-rq)*(t0/t);
    vec2 ps=q*(rs/rq);
    vec2 uv=(uC0+ps*uR0)/uTexSize;
    vec3 col=texture2D(uTex,uv).rgb;
    float gs=clamp((uG-1.0)/3.0,0.0,1.0);
    // extra volume shading when big
    col*=1.0-0.22*gs*smoothstep(0.55,1.0,r);
    vec2 h=p-vec2(-0.38,-0.42);
    col+=vec3(0.30,0.12,0.12)*gs*0.55*exp(-dot(h,h)/0.035);
    vec2 h2=p-vec2(0.42,-0.30);
    col+=vec3(0.22,0.09,0.09)*gs*0.35*exp(-dot(h2,h2)/0.02);
    // soft shadow under breasts
    float bs=smoothstep(60.0,0.0,vBody.y-640.0)*smoothstep(260.0,120.0,abs(vBody.x-491.0));
    col*=1.0-0.35*bs*smoothstep(1.05,1.6,uG);
    // procedural constant-width outline (sides/bottom)
    float ang=atan(p.x,-p.y);
    float wA=smoothstep(0.45,1.05,abs(ang));
    float ow=2.6/(Rm*uPx)+3.0/Rm;
    float underO=texture2D(uTex,vBody/uTexSize).a;
    float wO=max(wA,1.0-smoothstep(0.6,0.98,underO));
    float ol=smoothstep(1.0-ow-aa,1.0-ow,r)*wO*smoothstep(1.02,1.25,uG);
    col=mix(col,vec3(0.075,0.025,0.025),ol*0.92);
    float a=1.0-smoothstep(1.0-aa,1.0+aa,r);
    // top centre blends into the waist, but only where the body exists underneath
    float under=texture2D(uTex,vBody/uTexSize).a;
    float wB=max(wA,1.0-smoothstep(0.6,0.98,under));
    a*=mix(smoothstep(1.0,0.86,r),1.0,wB);
    col*=uTint;
    gl_FragColor=vec4(col*a,a);
  }`;
  let gl, cv, progTex, progBelly, meshes = {}, tex = {}, meta, texSize;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); p.u[u.name] = gl.getUniformLocation(p, u.name); } p.aPos = gl.getAttribLocation(p, 'aPos'); p.aUV = gl.getAttribLocation(p, 'aUV'); return p; }
  function grid(x0, y0, x1, y1, nx, ny, u0, v0, u1, v1) {
    const pos = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const fx = i / nx, fy = j / ny; pos.push(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy, u0 + (u1 - u0) * fx, v0 + (v1 - v0) * fy); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { vb, ib, n: idx.length, nx, ny, pos: new Float32Array(pos) };
  }
  function regrid(m, x0, y0, x1, y1) { // update positions of a grid (uv unchanged)
    const p = m.pos; let k = 0;
    for (let j = 0; j <= m.ny; j++) for (let i = 0; i <= m.nx; i++) { p[k] = x0 + (x1 - x0) * i / m.nx; p[k + 1] = y0 + (y1 - y0) * j / m.ny; k += 4; }
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, p);
  }
  function mkTex(src, mip) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  function init(canvas, imgs, m) {
    cv = canvas; meta = m;
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL not available');
    gl.getExtension('OES_standard_derivatives');
    progTex = prog(VS, FS_TEX); progBelly = prog(VS, FS_BELLY);
    const [W, H] = m.size; texSize = [W, H];
    // NPOT textures: WebGL1 can't mipmap NPOT -> pad body to POT canvas
    const pot = document.createElement('canvas'); pot.width = 1024; pot.height = 4096; // fits 982x2684
    pot.getContext('2d').drawImage(imgs.body, 0, 0);
    tex.body = mkTex(pot, true); texSize = [1024, 4096];
    const potU = document.createElement('canvas'); potU.width = 1024; potU.height = 1024; potU.getContext('2d').drawImage(imgs.upper, 0, 0);
    tex.upper = mkTex(potU, true);
    // body texture without mip for belly sampling (sharp)
    const uh = imgs.upper.height;
    meshes.body = grid(0, 0, W, H, 24, 72, 0, 0, W / 1024, H / 4096);
    meshes.upper = grid(0, 0, W, uh, 24, 24, 0, 0, W / 1024, uh / 1024);
    meshes.belly = grid(0, 0, 1, 1, 48, 48, 0, 0, 1, 1);
    const f = m.face; meshes.face = grid(f[0], f[1], f[2], f[3], 8, 8, 0, 0, 1, 1);
    tex.face = gl.createTexture();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function updateFace(canvas) {
    gl.bindTexture(gl.TEXTURE_2D, tex.face);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  function bindMesh(p, m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.enableVertexAttribArray(p.aPos); gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 16, 0);
    if (p.aUV >= 0) { gl.enableVertexAttribArray(p.aUV); gl.vertexAttribPointer(p.aUV, 2, gl.FLOAT, false, 16, 8); }
  }
  function common(p, st) {
    gl.uniform3f(p.u.uView, st.view[0], st.view[1], st.view[2]);
    gl.uniform2f(p.u.uRes, cv.width, cv.height);
    gl.uniform4f(p.u.uAnim, st.breath, st.sway, st.headTilt, st.time);
  }
  // bellyShape(st) -> {cx,cy,rx,ry,flat}
  function draw(st) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const tint = st.tint || [1, 1, 1];
    // base body
    gl.useProgram(progTex); common(progTex, st);
    gl.uniform1f(progTex.u.uAlpha, 1); gl.uniform3f(progTex.u.uTint, tint[0], tint[1], tint[2]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.body); gl.uniform1i(progTex.u.uTex, 0);
    bindMesh(progTex, meshes.body); gl.drawElements(gl.TRIANGLES, meshes.body.n, gl.UNSIGNED_SHORT, 0);
    // belly
    const b = st.belly, B0 = meta.belly;
    const pad = 4;
    regrid(meshes.belly, b.cx - b.rx - pad, b.cy - b.ry - pad, b.cx + b.rx + pad, b.cy + b.ry + pad);
    gl.useProgram(progBelly); common(progBelly, st);
    const u = progBelly.u;
    gl.bindTexture(gl.TEXTURE_2D, tex.body); gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uTexSize, texSize[0], texSize[1]);
    gl.uniform2f(u.uC, b.cx, b.cy); gl.uniform2f(u.uR, b.rx, b.ry);
    gl.uniform2f(u.uC0, B0.cx, B0.cy); gl.uniform2f(u.uR0, B0.rx, B0.ry);
    gl.uniform1f(u.uPx, st.view[0]); gl.uniform1f(u.uG, b.g); gl.uniform1f(u.uFlat, b.flat);
    gl.uniform4f(u.uWave, b.wave, b.wavePhase, b.poke, 0); gl.uniform2f(u.uPoke, b.pokeX, b.pokeY);
    gl.uniform3f(u.uTint, tint[0], tint[1], tint[2]);
    bindMesh(progBelly, meshes.belly); gl.drawElements(gl.TRIANGLES, meshes.belly.n, gl.UNSIGNED_SHORT, 0);
    // upper (head/bust/arms)
    gl.useProgram(progTex); common(progTex, st);
    gl.bindTexture(gl.TEXTURE_2D, tex.upper);
    bindMesh(progTex, meshes.upper); gl.drawElements(gl.TRIANGLES, meshes.upper.n, gl.UNSIGNED_SHORT, 0);
    // face
    gl.bindTexture(gl.TEXTURE_2D, tex.face);
    bindMesh(progTex, meshes.face); gl.drawElements(gl.TRIANGLES, meshes.face.n, gl.UNSIGNED_SHORT, 0);
  }
  // CPU version of the vertex deform (for hit testing / effects)
  function deform(x, y, st) {
    const br = st.breath; const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const chest = ss(930, 560, y); const bust = Math.exp(-Math.pow((y - 470) / 150, 2)) * ss(950, 500, y);
    y -= br * 3.2 * chest; x += (x - 491) * br * 0.0045 * bust;
    const head = ss(250, 150, y); const dx = x - 491, dy = y - 240, a = st.headTilt * head;
    const rx = 491 + dx * Math.cos(a) - dy * Math.sin(a), ry = 240 + dx * Math.sin(a) + dy * Math.cos(a);
    x = x + (rx - x) * head; y = y + (ry - y) * head;
    const w = Math.min(1, Math.max(0, (2670 - y) / 2670)); x += st.sway * (2670 - y) * w;
    return [x, y];
  }
  return { init, draw, updateFace, deform, get gl() { return gl; } };
})();
