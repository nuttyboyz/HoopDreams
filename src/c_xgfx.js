/* ===== Graphics pass (v22): visuals only, no gameplay. Post chain (MSAA scene target, bloom, lens flare, warm grade), soft shadows,
   a glossy reflecting floor, arena spotlights with light beams and floor pools, a blurred crowd with camera flashes, a sunset sky,
   and the Blacktop street set (brick walls, graffiti, fence rails). CFG.quality 0 ("Low") skips the post chain, shadows,
   reflection and beams and keeps the old fast path. Hooks: gfxArena(mode, tA, tB) from buildArena, gfxRender(scene, cam) from the frame loop
   and the gym, gfxUpdate(dt) once per frame, gfxAdapt(ema) from the frame loop. ===== */
const GFX = { w: 0, h: 0, rt: null, bl: [], mats: null, quad: null, qcam: null, t: 0, mode: 'play', lite: 0, off: 0, lights: [], beams: [], pools: [], sparks: null, dome: null, floorMat: null, floor: null, shPlane: null, rr: null, mcam: null, flare: [], slow: 0, ready: 0, hdr: false };
const GFX_CLIP = [new T.Plane(new T.Vector3(0, 1, 0), 0)];
const _gx1 = new T.Vector3(), _gx2 = new T.Vector3(), _gxm = new T.Matrix4(), _gxv = new T.Vector2();

/* ---------- post chain ---------- */
const GFX_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const GFX_BRIGHT = 'uniform sampler2D tD; uniform vec2 px; uniform float thr; varying vec2 vUv;\n' +
  'vec3 s(vec2 o){ vec3 c = texture2D(tD, vUv + o * px).rgb; float l = max(c.r, max(c.g, c.b)); float k = max(l - thr, 0.0) / max(l, 1e-4); return c * k; }\n' +
  'void main(){ vec3 c = (s(vec2(-.5,-.5)) + s(vec2(.5,-.5)) + s(vec2(-.5,.5)) + s(vec2(.5,.5))) * .25; gl_FragColor = vec4(min(c, vec3(12.0)), 1.0); }';
const GFX_BLUR = 'uniform sampler2D tD; uniform vec2 dir; varying vec2 vUv;\n' +
  'void main(){ vec3 c = texture2D(tD, vUv).rgb * .227027; c += (texture2D(tD, vUv + dir * 1.3846).rgb + texture2D(tD, vUv - dir * 1.3846).rgb) * .3162162; c += (texture2D(tD, vUv + dir * 3.2308).rgb + texture2D(tD, vUv - dir * 3.2308).rgb) * .0702703; gl_FragColor = vec4(c, 1.0); }';
const GFX_COMP = 'uniform sampler2D tS; uniform sampler2D b0; uniform sampler2D b1; uniform sampler2D b2; uniform sampler2D b3; uniform float kB; uniform float asp; uniform float tm; uniform vec2 res;\n' +
  'uniform vec3 fl[4]; uniform vec3 warm; uniform float vig; uniform float sat; uniform float exp0; uniform float flk; varying vec2 vUv;\n' +
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + tm) * 43758.5453); }\n' +
  'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\n' +
  'void main(){\n' +
  ' vec2 c0 = vUv - .5; float rr = dot(c0, c0);\n' +
  ' vec2 ca = c0 * rr * 0.0045;\n' +
  ' vec3 c = vec3(texture2D(tS, vUv + ca).r, texture2D(tS, vUv).g, texture2D(tS, vUv - ca).b);\n' +
  ' vec3 bl = texture2D(b0, vUv).rgb * .42 + texture2D(b1, vUv).rgb * .36 + texture2D(b2, vUv).rgb * .3 + texture2D(b3, vUv).rgb * .26;\n' +
  ' c += bl * kB;\n' +
  ' vec3 f = vec3(0.0); vec2 as = vec2(asp, 1.0);\n' +
  ' for (int i = 0; i < 4; i++) { vec3 L = fl[i]; if (L.z > 0.002) {\n' +
  '  float vis = clamp(dot(texture2D(b2, L.xy).rgb, vec3(.33)) * 1.1, 0.0, 1.0) * L.z; vec2 d = (vUv - L.xy) * as;\n' +
  '  f += vec3(.5, .72, 1.0) * vis * exp(-abs(d.y) * 55.0) * exp(-abs(d.x) * 2.4) * .32;\n' +
  '  f += vec3(1.0, .8, .55) * vis * .05 / (dot(d, d) * 90.0 + .25);\n' +
  '  for (int g = 0; g < 3; g++) { float t = .45 + float(g) * .55; vec2 gp = L.xy + (vec2(.5) - L.xy) * t * 2.0; float gd = length((vUv - gp) * as); float r = .03 + .02 * float(g); f += mix(vec3(1.0, .55, .25), vec3(.35, .7, 1.0), float(g) * .5) * vis * smoothstep(r, r * .5, gd) * .06; }\n' +
  '  f += vec3(1.0, .72, .45) * vis * smoothstep(.016, .0, abs(length(d) - .15)) * .035; } }\n' +
  ' c += f * flk;\n' +
  ' c *= exp0 * warm;\n' +
  ' float l = dot(c, vec3(.299, .587, .114)); c += (1.0 - clamp(c, 0.0, 1.0)) * vec3(.0, .008, .02) * (1.0 - l);\n' +
  ' c = mix(vec3(l), c, sat);\n' +
  ' vec3 a = aces(c * 1.05); c = mix(c / (1.0 + max(c - .85, 0.0) * .55), a, .38);\n' +
  ' c = mix(c, c * c * (3.0 - 2.0 * c), .22);\n' +
  ' c *= mix(1.0, smoothstep(.95, .28, length(c0 * vec2(1.0, .92))), vig);\n' +
  ' c += (hash(vUv * res) - .5) / 200.0;\n' +
  ' gl_FragColor = vec4(c, 1.0); }';
function gfxInitPost() {
  if (GFX.ready) return; GFX.ready = 1;
  GFX.hdr = !!(renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float')) || !!renderer.extensions.has('EXT_color_buffer_half_float');
  const mk = (fs, u) => new T.ShaderMaterial({ uniforms: u, vertexShader: GFX_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  const tex = () => ({ value: null });
  GFX.mats = {
    bright: mk(GFX_BRIGHT, { tD: tex(), px: { value: new T.Vector2() }, thr: { value: 0.82 } }),
    blur: mk(GFX_BLUR, { tD: tex(), dir: { value: new T.Vector2() } }),
    comp: mk(GFX_COMP, { tS: tex(), b0: tex(), b1: tex(), b2: tex(), b3: tex(), kB: { value: 0.5 }, asp: { value: 1.78 }, tm: { value: 0 }, res: { value: new T.Vector2(1280, 720) }, fl: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()] }, warm: { value: new T.Vector3(1.02, 1.0, 0.97) }, vig: { value: 0.35 }, sat: { value: 1.04 }, exp0: { value: 0.97 }, flk: { value: 1.0 } })
  };
  GFX.quad = new T.Mesh(new T.PlaneGeometry(2, 2), GFX.mats.bright); GFX.quad.frustumCulled = false;
  GFX.qscene = new T.Scene(); GFX.qscene.add(GFX.quad); GFX.qcam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
function gfxTargets(w, h) {
  if (GFX.rt && GFX.w === w && GFX.h === h) return;
  GFX.w = w; GFX.h = h;
  if (GFX.rt) GFX.rt.dispose(); GFX.bl.forEach(t => t.dispose());
  const o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: GFX.hdr ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: true };
  GFX.rt = renderer.capabilities.isWebGL2 ? new T.WebGLMultisampleRenderTarget(w, h, o) : new T.WebGLRenderTarget(w, h, o);
  if (GFX.rt.samples !== undefined) GFX.rt.samples = 4;
  GFX.bl = [];
  let bw = w, bh = h;
  for (let i = 0; i < 4; i++) { bw = Math.max(8, bw >> 1); bh = Math.max(8, bh >> 1); const p = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: GFX.hdr ? T.HalfFloatType : T.UnsignedByteType, depthBuffer: false };
    GFX.bl.push(new T.WebGLRenderTarget(bw, bh, p), new T.WebGLRenderTarget(bw, bh, p)); }
}
function gfxPass(mat, target) { GFX.quad.material = mat; renderer.setRenderTarget(target); renderer.render(GFX.qscene, GFX.qcam); }
function gfxFlares(c) {
  const M = GFX.mats.comp.uniforms.fl.value; for (const v of M) v.set(0.5, 0.5, 0);
  const rows = [];
  for (const p of GFX.lights) { _gx1.copy(p).project(c); if (_gx1.z > 1 || _gx1.z < -1) continue; const e = Math.max(Math.abs(_gx1.x), Math.abs(_gx1.y)); if (e > 1.15) continue; rows.push([_gx1.x * 0.5 + 0.5, _gx1.y * 0.5 + 0.5, Math.max(0, 1.15 - e) / 1.15]); }
  rows.sort((a, b) => b[2] - a[2]); for (let i = 0; i < 4 && i < rows.length; i++) M[i].set(rows[i][0], rows[i][1], rows[i][2]);
}
function gfxRender(scn, c) {
  if (!CFG.quality || GFX.off) { renderer.render(scn, c); return; }
  gfxInitPost();
  renderer.getDrawingBufferSize(_gxv); const w = Math.max(64, Math.round(_gxv.x)), h = Math.max(64, Math.round(_gxv.y));
  gfxTargets(w, h);
  if (S.mode !== 'gym') gfxReflect(c);
  renderer.setRenderTarget(GFX.rt); renderer.render(scn, c);
  const m = GFX.mats, B = GFX.bl;
  m.bright.uniforms.tD.value = GFX.rt.texture; m.bright.uniforms.px.value.set(1 / w, 1 / h); m.bright.uniforms.thr.value = GFX.mode === 'black' ? 0.9 : 0.82; gfxPass(m.bright, B[0]);
  let src = B[0];
  for (let i = 0; i < 4; i++) {
    const a = B[i * 2], b = B[i * 2 + 1];
    if (i > 0) { m.bright.uniforms.tD.value = src.texture; m.bright.uniforms.px.value.set(1 / src.width, 1 / src.height); m.bright.uniforms.thr.value = 0; gfxPass(m.bright, a); }
    m.blur.uniforms.tD.value = a.texture; m.blur.uniforms.dir.value.set(1 / a.width, 0); gfxPass(m.blur, b);
    m.blur.uniforms.tD.value = b.texture; m.blur.uniforms.dir.value.set(0, 1 / a.height); gfxPass(m.blur, a);
    src = a;
  }
  const u = m.comp.uniforms; u.tS.value = GFX.rt.texture; u.b0.value = B[0].texture; u.b1.value = B[2].texture; u.b2.value = B[4].texture; u.b3.value = B[6].texture;
  u.asp.value = w / h; u.tm.value = (GFX.t * 0.37) % 1; u.res.value.set(w, h); gfxFlares(c);
  gfxPass(m.comp, null);
}

/* ---------- glossy reflecting floor (play + blacktop) ---------- */
const GFX_FLOOR_VS = 'varying vec2 vUv; varying vec4 vRef; varying vec3 vWp; uniform mat4 texM;\nvoid main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vRef = texM * wp; gl_Position = projectionMatrix * viewMatrix * wp; }';
const GFX_FLOOR_FS = 'uniform sampler2D map; uniform sampler2D tRef; uniform float kRef; uniform float gloss; uniform vec3 lp[3]; uniform vec3 lcol; varying vec2 vUv; varying vec4 vRef; varying vec3 vWp;\n' +
  'void main(){ vec3 base = texture2D(map, vUv).rgb; vec3 V = normalize(cameraPosition - vWp); float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.2); vec3 col = base;\n' +
  ' if (kRef > 0.0) { vec2 gr = (texture2D(map, vUv * 23.0).rg - .5) * .006; vec4 q = vRef; vec3 r = vec3(0.0); float wsum = 0.0;\n' +
  '  for (int i = -2; i <= 2; i++) { float w = 1.0 - abs(float(i)) * .18; vec4 o = q; o.x += (float(i) * .0035 + gr.x) * q.w; o.y += gr.y * q.w; r += texture2DProj(tRef, o).rgb * w; wsum += w; } r /= wsum;\n' +
  '  col = mix(col, col * .7 + r * .9, kRef * (0.1 + 0.4 * fr)); }\n' +
  ' float spec = 0.0; for (int i = 0; i < 3; i++) { vec3 L = normalize(lp[i] - vWp); vec3 H = normalize(L + V); float nh = max(H.y, 0.0); spec += pow(nh, 140.0) * .55 + pow(nh, 16.0) * .06; }\n' +
  ' col += lcol * spec * gloss * (0.45 + 0.8 * fr);\n gl_FragColor = vec4(col, 1.0); }';
function gfxFloor(tex, mode) {
  const black = mode === 'black';
  const m = new T.ShaderMaterial({ uniforms: { map: { value: tex }, tRef: { value: null }, kRef: { value: 0 }, gloss: { value: black ? 0.35 : 1.0 }, texM: { value: new T.Matrix4() }, lcol: { value: new T.Vector3(1.0, 0.95, 0.85) }, lp: { value: [new T.Vector3(-10, 16, -2), new T.Vector3(0, 16, -2), new T.Vector3(10, 16, -2)] } }, vertexShader: GFX_FLOOR_VS, fragmentShader: GFX_FLOOR_FS });
  const f = new T.Mesh(new T.PlaneGeometry(FLOOR_W, FLOOR_H), m); f.rotation.x = -Math.PI / 2; GFX.floorMat = m; GFX.floor = f;
  if (black) { m.uniforms.lp.value = [new T.Vector3(27, 6, -13), new T.Vector3(27, 6, -13), new T.Vector3(27, 6, -13)]; m.uniforms.lcol.value.set(1.0, 0.6, 0.3); }
  return f;
}
function gfxReflect(C) {
  const m = GFX.floorMat; if (!m || !GFX.floor || GFX.lite) { if (m) m.uniforms.kRef.value = 0; return; }
  const w = clamp(Math.round(GFX.w * 0.5), 256, 1024), h = clamp(Math.round(GFX.h * 0.5), 144, 640);
  if (!GFX.rr || GFX.rr.width !== w || GFX.rr.height !== h) { if (GFX.rr) GFX.rr.dispose(); GFX.rr = new T.WebGLRenderTarget(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.UnsignedByteType }); }
  if (!GFX.mcam) GFX.mcam = new T.PerspectiveCamera();
  C.updateMatrixWorld(); const mc = GFX.mcam, cp = _gx1.setFromMatrixPosition(C.matrixWorld); if (cp.y <= 0.05) { m.uniforms.kRef.value = 0; return; }
  const rot = _gxm.extractRotation(C.matrixWorld);
  mc.position.set(cp.x, -cp.y, cp.z); const la = _gx2.set(0, 0, -1).applyMatrix4(rot).add(cp); la.y = -la.y;
  mc.up.set(0, 1, 0).applyMatrix4(rot); mc.up.y = -mc.up.y; mc.lookAt(la); mc.near = C.near; mc.far = C.far; mc.updateMatrixWorld(); mc.projectionMatrix.copy(C.projectionMatrix);
  const tm = m.uniforms.texM.value; tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(mc.projectionMatrix); tm.multiply(mc.matrixWorldInverse);
  GFX.floor.visible = false; if (GFX.shPlane) GFX.shPlane.visible = false; const sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  renderer.clippingPlanes = GFX_CLIP; renderer.setRenderTarget(GFX.rr); renderer.render(scene, mc); renderer.clippingPlanes = [];
  renderer.shadowMap.autoUpdate = sh; GFX.floor.visible = true; if (GFX.shPlane) GFX.shPlane.visible = true;
  m.uniforms.tRef.value = GFX.rr.texture; m.uniforms.kRef.value = GFX.mode === 'black' ? 0.55 : 1;
}

/* ---------- textures ---------- */
function gfxCrowdTex(tA, tB) {
  const cols = [tA ? tA.home : 0xc2493d, tB ? (tB.away === 0xf1f3f8 ? tB.home : tB.away) : 0x3d7ac2].map(css);
  const pal = ['#9a4a44', '#41607f', '#b0955a', '#b8b8c0', '#4a6a54', '#6a5585', '#2b2f3d', '#a8693a', '#1c1f2b', '#8a8a96'].concat(cols, cols);
  const skins = ['#f3d2b4', '#e0b48a', '#c08a5c', '#93603a', '#6b4128', '#4a2c1a'];
  const W = 1024, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07080e'); bg.addColorStop(1, '#2a2230'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const rows = 13;
  for (let r = 0; r < rows; r++) {
    const k = r / (rows - 1), y = 18 + r * (H - 40) / rows, sz = 15 + k * 12, n = Math.ceil(W / (sz * 1.05)), lit = 0.2 + k * 0.5;
    for (let i = 0; i < n; i++) {
      const x = (i + rnd(-0.2, 0.2) + (r % 2) * 0.5) * sz * 1.05, col = pick(pal), sk = pick(skins);
      g.globalAlpha = lit * rnd(0.7, 1); g.fillStyle = col; g.beginPath(); g.ellipse(x, y + sz * 0.95, sz * 0.52, sz * 0.62, 0, Math.PI, 0); g.fill(); g.fillRect(x - sz * 0.52, y + sz * 0.95, sz * 1.04, sz * 0.6);
      g.fillStyle = sk; g.globalAlpha = lit * rnd(0.75, 1); g.beginPath(); g.arc(x, y + sz * 0.3, sz * 0.27, 0, 6.283); g.fill();
      if (Math.random() < 0.35) { g.fillStyle = '#17110c'; g.beginPath(); g.arc(x, y + sz * 0.2, sz * 0.28, Math.PI, 0); g.fill(); }
      if (Math.random() < 0.09) { g.fillStyle = col; g.fillRect(x + sz * 0.36, y - sz * 0.3, sz * 0.16, sz * 0.8); g.fillStyle = sk; g.beginPath(); g.arc(x + sz * 0.44, y - sz * 0.33, sz * 0.12, 0, 6.283); g.fill(); }
      if (Math.random() < 0.07) { g.globalAlpha = 0.9; g.fillStyle = '#cfe6ff'; g.fillRect(x - sz * 0.08, y + sz * 0.05, sz * 0.16, sz * 0.2); }
    }
  }
  g.globalAlpha = 1;
  const o = document.createElement('canvas'); o.width = W; o.height = H; const og = o.getContext('2d');
  try { og.filter = 'blur(2.2px)'; } catch (e) { }
  og.drawImage(c, 0, 0);
  og.filter = 'none'; og.globalCompositeOperation = 'lighter'; og.globalAlpha = 0.3; try { og.filter = 'blur(6px)'; } catch (e) { } og.drawImage(c, 0, 0); og.filter = 'none';
  const t = new T.CanvasTexture(o); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function gfxBrickTex() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#7d756c'; g.fillRect(0, 0, S, S); const bw = 64, bh = 28;
  const hc = document.createElement('canvas'); hc.width = hc.height = S; const hg = hc.getContext('2d'); hg.fillStyle = '#303030'; hg.fillRect(0, 0, S, S);
  for (let r = 0; r * bh < S; r++) for (let i = -1; i * bw < S; i++) {
    const x = i * bw + (r % 2) * bw / 2 + 2, y = r * bh + 2, v = rnd(-1, 1), h = 0.04 + rnd(0, 0.03), L = 33 + v * 7 + (Math.random() < 0.12 ? rnd(-10, 8) : 0);
    g.fillStyle = `hsl(${10 + v * 6},${46 + v * 10}%,${L}%)`; g.fillRect(x, y, bw - 4, bh - 4);
    for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,200'},${rnd(0.04, 0.12)})`; g.fillRect(x + rnd(0, bw - 6), y + rnd(0, bh - 6), rnd(1, 4), rnd(1, 3)); }
    hg.fillStyle = `rgb(${150 + v * 30},${150 + v * 30},${150 + v * 30})`; hg.fillRect(x, y, bw - 4, bh - 4);
  }
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,.0)'); gr.addColorStop(1, 'rgba(10,6,4,.22)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new T.CanvasTexture(c), b = new T.CanvasTexture(hc); for (const x of [t, b]) { x.wrapS = x.wrapT = T.RepeatWrapping; x.anisotropy = 8; } return [t, b];
}
function gfxGraffiti(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.lineJoin = 'round'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const spray = ['#35e0a1', '#ff4d5e', '#ffc533', '#4da3ff', '#c35bff', '#ff7a1a', '#f5f5f5', '#2ee6e6'];
  const words = seed ? ['HOOP', 'DREAMS', 'BALL', 'NO FOULS', 'BUCKETS', 'CLUTCH', 'RIM', 'HOOP LIFE'] : ['BLACKTOP', 'HOOP DREAMS', 'GAME ON', 'SWISH', 'AND ONE', 'HOOPERS'];
  const n = Math.max(2, Math.round(w / (h * 2.5)));
  for (let i = 0; i < n; i++) {
    const sp = w / n, x = (i + 0.5) * sp, y = h * rnd(0.42, 0.58), wd = words[(i * 2 + (seed || 0)) % words.length];
    let fs = rnd(0.34, 0.46) * h; g.font = `700 ${fs}px Anton, Impact, sans-serif`; const tw0 = g.measureText(wd).width; if (tw0 > sp * 0.82) fs *= sp * 0.82 / tw0;
    g.save(); g.translate(x, y); g.rotate(rnd(-0.06, 0.06)); g.font = `700 ${fs}px Anton, Impact, sans-serif`;
    const a = pick(spray), b = pick(spray.filter(q => q !== a));
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetY = 4; g.lineWidth = fs * 0.2; g.strokeStyle = '#0c0c14'; g.strokeText(wd, 0, 0);
    g.shadowColor = 'transparent'; g.lineWidth = fs * 0.1; g.strokeStyle = b; g.strokeText(wd, 0, 0);
    const gr = g.createLinearGradient(0, -fs / 2, 0, fs / 2); gr.addColorStop(0, a); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillText(wd, 0, 0);
    const tw = g.measureText(wd).width; g.fillStyle = a;
    for (let d = 0; d < 4; d++) { const dx = rnd(-tw / 2, tw / 2), dl = rnd(10, 50); g.fillRect(dx, fs * 0.3, 3.5, dl); g.beginPath(); g.arc(dx + 1.7, fs * 0.3 + dl, 4, 0, 6.283); g.fill(); }
    g.restore();
    g.fillStyle = pick(spray); g.font = `${h * 0.14}px sans-serif`; g.fillText(pick(['★', '♛', '✦', '☺', '⚡']), x + rnd(-sp * 0.4, sp * 0.4), h * pick([0.1, 0.9]));
  }
  g.globalAlpha = 0.6; for (let i = 0; i < 80; i++) { g.fillStyle = pick(spray); g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(1, 5), 0, 6.283); g.fill(); }
  const t = new T.CanvasTexture(c); t.anisotropy = 8; return t;
}

/* ---------- arena dressing ---------- */
const GFX_BEAM_VS = 'varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT = -position.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }';
const GFX_BEAM_FS = 'uniform vec3 col; uniform float k; varying float vT; varying vec3 vN; varying vec3 vV;\nvoid main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = pow(1.0 - vT, 0.8) * smoothstep(0.0, 0.12, vT) * f; gl_FragColor = vec4(col * a * k, a * k); }';
let _gfxPoolTex = null;
function gfxPoolTex() { return _gfxPoolTex || (_gfxPoolTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 62); g.addColorStop(0, 'rgba(255,240,215,.55)'); g.addColorStop(0.5, 'rgba(255,225,185,.22)'); g.addColorStop(1, 'rgba(255,220,180,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); })); }
function gfxBeam(arena, from, color, k, i) {
  const grp = new T.Group(); grp.position.copy(from); arena.add(grp);
  const geo = new T.CylinderGeometry(0.18, 1.0, 1, 28, 1, true); geo.translate(0, -0.5, 0);
  const mat = new T.ShaderMaterial({ uniforms: { col: { value: new T.Color(color) }, k: { value: k } }, vertexShader: GFX_BEAM_VS, fragmentShader: GFX_BEAM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
  const cone = new T.Mesh(geo, mat); cone.rotation.x = -Math.PI / 2; cone.frustumCulled = false; cone.renderOrder = 3; grp.add(cone);
  const pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: gfxPoolTex(), transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, color: new T.Color(color) })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.018; pool.renderOrder = 2; arena.add(pool);
  const b = { grp, cone, pool, from: from.clone(), ph: i * 1.7 + Math.random() * 3, cx: 0, cz: 0, ax: rnd(2, 5), az: rnd(1, 3) }; GFX.beams.push(b); return b;
}
function gfxLightRig(mode) {
  const black = mode === 'black', gym = mode === 'gym';
  hemi.color.setHex(black ? 0xffcfa6 : 0xfff6ea); hemi.groundColor.setHex(black ? 0x5d4b6c : 0x4e5878); hemi.intensity = black ? 0.78 : 0.9;
  sun.color.setHex(black ? 0xff9b55 : 0xffe9c8); sun.intensity = black ? 1.15 : 0.85;
  sun.position.set(black ? 27 : 6, black ? 6 : 24, black ? -13 : 9);
  fill.color.setHex(black ? 0xa7b4ff : 0xbfd4ff); fill.intensity = black ? 0.46 : 0.22; fill.position.set(black ? -12 : -10, black ? 9 : 12, black ? 7 : -8);
  const lite = !CFG.quality || GFX.lite >= 1; sun.castShadow = !lite;
  if (sun.castShadow) { const s = sun.shadow, c = s.camera; s.mapSize.set(2048, 2048); c.left = -26; c.right = 26; c.top = 18; c.bottom = -18; c.near = 1; c.far = 90; s.bias = -0.0004; s.normalBias = 0.03; s.radius = 3.5; c.updateProjectionMatrix(); if (s.map) { s.map.dispose(); s.map = null; } }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.needsUpdate = true;
  shadowMat.opacity = sun.castShadow ? 0.5 : 1;
}
function gfxSky(arena, black) {
  const m = new T.ShaderMaterial({
    uniforms: { sunDir: { value: new T.Vector3(0.9, 0.11, -0.42).normalize() }, tm: { value: 0 } }, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 sunDir; uniform float tm; varying vec3 vD;\n' +
      'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }\n' +
      'float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= .5; } return s; }\n' +
      'void main(){ vec3 d = normalize(vD); float e = d.y; float sd = max(dot(d, sunDir), 0.0);\n' +
      ' vec3 hor = vec3(1.0, .50, .22), mid = vec3(.78, .30, .36), top = vec3(.10, .12, .30);\n' +
      ' vec3 c = mix(hor, mid, smoothstep(0.0, .22, e)); c = mix(c, top, smoothstep(.18, .75, e));\n' +
      ' c += vec3(1.0, .55, .2) * pow(sd, 6.0) * .7 + vec3(1.0, .75, .4) * pow(sd, 60.0) * 1.1;\n' +
      ' vec2 cp = d.xz / (e + .28) * 1.1 + vec2(tm * .004, 0.); float cl = smoothstep(.46, .78, fbm(cp * vec2(1.6, 4.2))) * smoothstep(.0, .06, e) * (1.0 - smoothstep(.4, .7, e));\n' +
      ' vec3 cc = mix(vec3(.38, .14, .26), vec3(1.0, .62, .34), pow(sd, 1.5) + .25 * (1.0 - e * 2.0)); c = mix(c, cc, cl * .8);\n' +
      ' float disc = smoothstep(.9987, .9993, sd); c += vec3(7.0, 4.6, 2.4) * disc;\n' +
      ' c = mix(c, hor * .55, smoothstep(.0, -.06, e)); gl_FragColor = vec4(c, 1.0); }'
  });
  const dome = new T.Mesh(new T.SphereGeometry(180, 36, 20), m); dome.renderOrder = -20; dome.frustumCulled = false; arena.add(dome); GFX.dome = dome; GFX.sunDir = m.uniforms.sunDir.value;
  GFX.lights.push(GFX.sunDir.clone().multiplyScalar(170));
}

function gfxArena(mode, tA, tB) {
  GFX.mode = mode; GFX.beams = []; GFX.lights = []; GFX.sparks = null; GFX.dome = null; GFX.shPlane = null;
  if (mode !== 'play' && mode !== 'black' && mode !== 'gym') return;
  const black = mode === 'black', gym = mode === 'gym', lite = !CFG.quality || GFX.lite >= 1;
  gfxLightRig(mode);
  // soft shadow catcher on top of the floor
  const sp = new T.Mesh(new T.PlaneGeometry(FLOOR_W, FLOOR_H), new T.ShadowMaterial({ opacity: black ? 0.5 : 0.36 })); sp.rotation.x = -Math.PI / 2; sp.position.y = 0.006; sp.receiveShadow = true; sp.renderOrder = 0; sp.visible = !lite; arena.add(sp); GFX.shPlane = sp;
  if (gym) return;
  if (!black) {
    // arena lights: HDR panels are the flare/bloom sources, beams sweep the court, pools of light follow them
    const hdr = new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.8, 2.2) });
    for (const o of arena.children.slice()) if (o.isMesh && o.position.y === 16 && o.material && o.material.color && o.material.color.getHex() === 0xfff0d0) o.material = hdr;
    for (let i = -2; i <= 2; i++) GFX.lights.push(new T.Vector3(i * 9, 16, -2));
    const trussM = new T.MeshBasicMaterial({ color: 0x0b0d14 });
    for (const z of [-11, 11]) { const t = new T.Mesh(boxG, trussM); t.scale.set(46, 0.22, 0.22); t.position.set(0, 17.3, z); arena.add(t); }
    if (!lite) {
      const cols = [0xfff2d8, 0xfff2d8, 0xcfe0ff, 0xfff2d8, 0xffd9a0, 0xcfe0ff];
      for (let i = 0; i < 6; i++) { const x = -20 + i * 8, z = i % 2 ? 11 : -11; gfxBeam(arena, new T.Vector3(x, 17.1, z), cols[i], 0.7, i); }
      const f = new T.MeshBasicMaterial({ color: new T.Color(2.6, 2.4, 2.0) });
      for (let i = 0; i < 6; i++) { const x = -20 + i * 8, z = i % 2 ? 11 : -11; const q = new T.Mesh(boxG, f); q.scale.set(0.9, 0.35, 0.9); q.position.set(x, 17.0, z); arena.add(q); }
      for (let i = 0; i < 6; i++) GFX.lights.push(new T.Vector3(-20 + i * 8, 17.0, i % 2 ? 11 : -11));
    }
    // LED ribbon: the ad boards glow brighter than the arena
    arena.traverse(o => { if (o.isMesh && o.material && o.material.map && o.geometry && o.geometry.parameters && o.geometry.parameters.height === 1 && o.geometry.parameters.width > 20) o.material.color.setRGB(1.8, 1.8, 1.8); });
    // camera flashes in the stands
    const crowd = []; arena.traverse(o => { if (o.userData.crowd) crowd.push(o); }); arena.updateMatrixWorld(true);
    if (crowd.length && !lite) {
      const N = 110, pos = new Float32Array(N * 3), ph = new Float32Array(N), fr = new Float32Array(N);
      for (let i = 0; i < N; i++) { const o = crowd[i % crowd.length], gp = o.geometry.parameters; _gx1.set(rnd(-0.5, 0.5) * gp.width, rnd(-0.45, 0.2) * gp.height, 0.05).applyMatrix4(o.matrixWorld); pos.set([_gx1.x, _gx1.y, _gx1.z], i * 3); ph[i] = rnd(0, 20); fr[i] = rnd(0.25, 0.9); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('ph', new T.BufferAttribute(ph, 1)); geo.setAttribute('fr', new T.BufferAttribute(fr, 1));
      const mat = new T.ShaderMaterial({ uniforms: { tm: { value: 0 }, sc: { value: 600 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
        vertexShader: 'attribute float ph; attribute float fr; uniform float tm; uniform float sc; varying float vA; void main(){ float s = sin(tm * fr * 3.1 + ph * 7.0); float f = pow(max(s, 0.0), 90.0); vA = f; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (2.0 + 26.0 * f) * sc / -mv.z * .12; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(vec3(5.0, 4.8, 4.2) * a * vA, a * vA); }' });
      const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; arena.add(pts); GFX.sparks = pts;
    }
  } else {
    gfxSky(arena, true);
    const [bt, bb] = gfxBrickTex();
    const wallM = (rx, ry) => { const t = bt.clone(), b = bb.clone(); t.needsUpdate = b.needsUpdate = true; t.repeat.set(rx, ry); b.repeat.set(rx, ry); return new T.MeshPhongMaterial({ map: t, bumpMap: b, bumpScale: 1.6, specular: 0x1a1410, shininess: 8, side: T.FrontSide }); };
    const wall = (w, h, x, y, z, ry, gseed) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), wallM(w / 3.2, h / 3.2)); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; arena.add(m);
      const gm = new T.Mesh(new T.PlaneGeometry(w * 0.96, h * 0.82), new T.MeshBasicMaterial({ map: gfxGraffiti(Math.round(w * 110), Math.round(h * 0.82 * 110), gseed), transparent: true, depthWrite: false, color: 0xe8dcd0, polygonOffset: true, polygonOffsetFactor: -2 }));
      gm.position.set(0, -h * 0.02, 0.02); m.add(gm);
      return m;
    };
    wall(HALF_L + 8.5, 3.8, (HALF_L + 8.5) / 2 - 5.2, 1.9, -HALF_W - 3.3, 0, 1);              // sideline wall, seen from the court
    wall(HALF_L + 8.5, 3.8, (HALF_L + 8.5) / 2 - 5.2, 1.9, HALF_W + 3.3, Math.PI, 2);          // other sideline
    wall(HALF_W * 2 + 6.6, 4.4, HALF_L + 3.6, 2.2, 0, -Math.PI / 2, 3);                          // end wall behind the hoop
    // fence top rails, so the chain link reads as a real fence
    const rail = mat(0x4a4e58);
    const rl = (x, z, lx, lz) => { const r = new T.Mesh(boxG, rail); r.scale.set(lx, 0.07, lz); r.position.set(x, 3.4, z); arena.add(r); };
    rl(HALF_L / 2 + 1, -HALF_W - 0.6, HALF_L + 6, 0.07); rl(HALF_L / 2 + 1, HALF_W + 0.6, HALF_L + 6, 0.07); rl(-0.6, 0, 0.07, HALF_W * 2 + 1.2); rl(HALF_L + 2.2, 0, 0.07, HALF_W * 2 + 1.2);
    // a gap in the skyline so the low sun shows
    arena.children.forEach(o => { if (o.isMesh && o.geometry === boxG && o.material && o.material.map && o.scale.y > 9) { o.scale.y = Math.min(o.scale.y, rnd(9, 16)); if (o.position.z < -33 && o.position.x > 20) o.scale.y = rnd(4, 7); o.position.y = o.scale.y / 2; } });
    scene.fog.color.setHex(0xb06a4a); scene.fog.near = 46; scene.fog.far = 150;
  }
}
function gfxUpdate(dt) {
  GFX.t += dt; const t = GFX.t;
  if (GFX.dome) { GFX.dome.position.copy(cam.position); GFX.dome.material.uniforms.tm.value = t; }
  if (GFX.sparks) { GFX.sparks.material.uniforms.tm.value = t; GFX.sparks.material.uniforms.sc.value = (canvas.clientHeight || innerHeight) * 0.5 / Math.tan(cam.fov * Math.PI / 360) * PR; }
  for (const b of GFX.beams) {
    const x = Math.sin(t * 0.22 + b.ph) * b.ax + (b.from.x * 0.4), z = Math.cos(t * 0.17 + b.ph * 1.3) * b.az; _gx1.set(x, 0, z).sub(b.from); const len = _gx1.length();
    b.grp.lookAt(x, 0, z); b.cone.scale.set(len * 0.2, len, len * 0.2); b.pool.position.set(x, 0.018, z); const ps = len * 0.34; b.pool.scale.set(ps, ps, 1); b.pool.visible = !!CFG.quality && !GFX.lite;
    b.grp.visible = !!CFG.quality && !GFX.lite;
  }
}
// slow machine? drop the costly extras first (reflection, shadows, beams), then the post chain
function gfxAdapt(ema, pr) {
  if (!CFG.quality) return;
  if (ema > 0.034 && pr <= 0.62) { if (++GFX.slow > 150) { GFX.slow = 0; if (!GFX.lite) { GFX.lite = 1; gfxArena2(); } else if (!GFX.off) GFX.off = 1; } } else if (ema < 0.03) GFX.slow = 0;
}
function gfxArena2() { if (typeof S !== 'undefined' && arena && GFX.shPlane) { sun.castShadow = false; GFX.shPlane.visible = false; shadowMat.opacity = 1; for (const b of GFX.beams) { b.grp.visible = false; b.pool.visible = false; } } }
