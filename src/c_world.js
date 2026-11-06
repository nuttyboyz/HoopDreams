/* ===== 3D world: renderer, arena, hoops, player models, ball, particles, camera ===== */
const canvas = $('gl');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let PR_MAX = Math.min(window.devicePixelRatio || 1, 1.5), PR = PR_MAX;
renderer.setPixelRatio(PR);
const scene = new T.Scene();
const cam = new T.PerspectiveCamera(36, 16 / 9, 0.5, 260);
const hemi = new T.HemisphereLight(0xfff6ea, 0x4e5878, 0.9); scene.add(hemi);
const sun = new T.DirectionalLight(0xffe9c8, 0.85); sun.position.set(8, 22, 10); scene.add(sun);   // warm key light
const fill = new T.DirectionalLight(0xbfd4ff, 0.22); fill.position.set(-10, 12, -8); scene.add(fill); // cool fill from the far side so players have a rim edge
let arena = null;     // group rebuilt per mode
let hoops = [];       // {x,dir,rim,net,board,shake,netT}
const MATS = {};      // shared materials
const boxG = new T.BoxGeometry(1, 1, 1);
const sphG = new T.SphereGeometry(1, 14, 10);
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return MATS[k] || (MATS[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o))); };

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const css = n => '#' + ('000000' + n.toString(16)).slice(-6);

/* ---- court texture (metres -> canvas px) ---- */
const FLOOR_W = HALF_L * 2 + 6, FLOOR_H = HALF_W * 2 + 6;
function drawCourt(ctx, w, h, mode, tA, tB) {
  const sc = w / FLOOR_W; ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(sc, sc);
  const black = mode === 'black', gym = mode === 'gym';
  if (gym) { // varnished maple wall to wall, the court a shade lighter, keys in Hoop Dreams orange, a vignette toward the walls
    ctx.fillStyle = '#d8ab6c'; ctx.fillRect(-FLOOR_W / 2, -FLOOR_H / 2, FLOOR_W, FLOOR_H);
    for (let x = -FLOOR_W / 2; x < FLOOR_W / 2; x += 0.1524) { ctx.fillStyle = `rgba(${Math.random() < .5 ? '255,232,180' : '90,50,10'},${rnd(0.02, 0.09)})`; ctx.fillRect(x, -FLOOR_H / 2, 0.1524, FLOOR_H); }
    ctx.fillStyle = 'rgba(60,35,10,.14)'; for (let x = -FLOOR_W / 2; x < FLOOR_W / 2; x += 0.1524) ctx.fillRect(x, -FLOOR_H / 2, 0.008, FLOOR_H);
    ctx.fillStyle = 'rgba(50,30,10,.1)'; for (let z = -FLOOR_H / 2; z < FLOOR_H / 2; z += 2.4) ctx.fillRect(-FLOOR_W / 2, z + rnd(0, 1.2), FLOOR_W, 0.006);
    ctx.fillStyle = 'rgba(255,240,205,.16)'; ctx.fillRect(-HALF_L, -HALF_W, HALF_L * 2, HALF_W * 2);
    const paintG = dir => { ctx.fillStyle = '#c9481f'; ctx.globalAlpha = 0.82; const bx = dir * HALF_L; ctx.fillRect(Math.min(bx, bx - dir * 5.79), -2.44, 5.79, 4.88); ctx.beginPath(); ctx.arc(bx - dir * 5.79, 0, 1.83, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
    paintG(-1); paintG(1);
    const vg = ctx.createRadialGradient(0, 0, 8, 0, 0, FLOOR_W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,.3)'); ctx.fillStyle = vg; ctx.fillRect(-FLOOR_W / 2, -FLOOR_H / 2, FLOOR_W, FLOOR_H);
  } else if (!black) {
    ctx.fillStyle = '#7d5128'; ctx.fillRect(-FLOOR_W / 2, -FLOOR_H / 2, FLOOR_W, FLOOR_H);
    ctx.fillStyle = '#d29a52'; ctx.fillRect(-HALF_L, -HALF_W, HALF_L * 2, HALF_W * 2);
    for (let x = -HALF_L; x < HALF_L; x += 0.1524) { ctx.fillStyle = `rgba(${Math.random() < .5 ? '255,230,170' : '90,50,10'},${rnd(0.02, 0.1)})`; ctx.fillRect(x, -HALF_W, 0.1524, HALF_W * 2); }
    ctx.fillStyle = 'rgba(60,35,10,.12)'; for (let x = -HALF_L; x < HALF_L; x += 0.1524) ctx.fillRect(x, -HALF_W, 0.008, HALF_W * 2);
    const paint = (dir, col) => { ctx.fillStyle = css(col); ctx.globalAlpha = 0.92; const bx = dir * HALF_L; ctx.fillRect(Math.min(bx, bx - dir * 5.79), -2.44, 5.79, 4.88); ctx.beginPath(); ctx.arc(bx - dir * 5.79, 0, 1.83, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
    paint(-1, tA.home); paint(1, tB.away === 0xf1f3f8 ? tB.home : tB.away);
  } else {
    ctx.fillStyle = '#2a2d34'; ctx.fillRect(-FLOOR_W / 2, -FLOOR_H / 2, FLOOR_W, FLOOR_H);
    ctx.fillStyle = '#41444d'; ctx.fillRect(0, -HALF_W, HALF_L, HALF_W * 2);
    for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${rnd(0.02, 0.09)})`; ctx.fillRect(rnd(0, HALF_L), rnd(-HALF_W, HALF_W), 0.07, 0.07); }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.02; for (let i = 0; i < 9; i++) { ctx.beginPath(); let x = rnd(0, HALF_L), z = rnd(-HALF_W, HALF_W); ctx.moveTo(x, z); for (let j = 0; j < 6; j++) { x += rnd(-.5, .5); z += rnd(-.5, .5); ctx.lineTo(x, z); } ctx.stroke(); }
    ctx.fillStyle = '#7a2b34'; ctx.globalAlpha = 0.85; ctx.fillRect(HALF_L - 5.79, -2.44, 5.79, 4.88); ctx.beginPath(); ctx.arc(HALF_L - 5.79, 0, 1.83, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 0.06; ctx.lineJoin = 'round';
  const line = (x0, z0, x1, z1) => { ctx.beginPath(); ctx.moveTo(x0, z0); ctx.lineTo(x1, z1); ctx.stroke(); };
  const hoopLines = dir => {
    const bx = dir * HALF_L, hx = dir * RIM_X, ftx = bx - dir * 5.79;
    line(bx, -2.44, ftx, -2.44); line(bx, 2.44, ftx, 2.44); line(ftx, -2.44, ftx, 2.44);
    ctx.beginPath(); ctx.arc(ftx, 0, 1.83, dir > 0 ? Math.PI / 2 : -Math.PI / 2, dir > 0 ? Math.PI * 1.5 : Math.PI * 0.5); ctx.stroke();
    ctx.setLineDash([0.28, 0.28]); ctx.beginPath(); ctx.arc(ftx, 0, 1.83, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(hx, 0, 1.22, dir > 0 ? Math.PI / 2 : -Math.PI / 2, dir > 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
    line(bx - dir * 1.2, -0.9, bx - dir * 1.2, 0.9); // backboard mark
    const tm = Math.asin(CORNER / ARC); ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const a = -tm + (2 * tm * i) / 60, px = hx - dir * ARC * Math.cos(a), pz = ARC * Math.sin(a); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }
    ctx.stroke(); line(bx, -CORNER, hx - dir * ARC * Math.cos(tm), -CORNER); line(bx, CORNER, hx - dir * ARC * Math.cos(tm), CORNER);
  };
  ctx.strokeRect(black ? 0 : -HALF_L, -HALF_W, black ? HALF_L : HALF_L * 2, HALF_W * 2);
  if (!black) { hoopLines(-1); hoopLines(1); line(0, -HALF_W, 0, HALF_W); ctx.beginPath(); ctx.arc(0, 0, 1.83, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '700 0.62px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gym ? 'THE' : 'HOOP', 0, -0.25); ctx.fillText(gym ? 'GYM' : 'DREAMS', 0, 0.32);
    ctx.font = '700 0.8px Anton, Impact, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.save(); ctx.translate(-HALF_L + 2.6, 0); ctx.fillText(gym ? 'HOOP' : tA.short.toUpperCase(), 0, 0); ctx.restore(); ctx.save(); ctx.translate(HALF_L - 2.6, 0); ctx.fillText(gym ? 'DREAMS' : tB.short.toUpperCase(), 0, 0); ctx.restore();
  } else { hoopLines(1); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '700 0.9px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HOOP DREAMS', HALF_L * 0.45, 0); }
  ctx.restore();
}

/* ---- hoop ---- */
function buildHoop(dir) {
  const g = new T.Group(), hx = dir * RIM_X; g.position.set(hx, 0, 0);
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  add(boxG, mat(0x2a2e38), dir * 2.0, 1.7, 0, 0.2, 3.4, 0.2);                   // pole
  add(boxG, mat(0x14171f), dir * 1.98, 0.95, 0, 0.62, 1.9, 0.62);                // padded base
  add(boxG, mat(0xff5a1a), dir * 1.98, 1.93, 0, 0.64, 0.06, 0.64);               // pad trim
  add(boxG, mat(0x2a2e38), dir * 1.3, 3.3, 0, 1.4, 0.14, 0.14);                  // arm
  add(boxG, mat(0x2a2e38), dir * 0.78, 3.2, 0, 0.16, 0.5, 0.2);                  // arm to board bracket
  const bg = new T.Group(); bg.position.set(dir * 0.6, 0, 0); g.add(bg);
  const gl = new T.MeshPhongMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.3, specular: 0xffffff, shininess: 120, side: T.DoubleSide });
  const board = new T.Mesh(boxG, gl); board.scale.set(0.04, 1.05, 1.83); board.position.set(0, 3.43, 0); bg.add(board);
  const edge = (y, z, sy, sz, c) => { const e = new T.Mesh(boxG, mat(c)); e.scale.set(0.058, sy, sz); e.position.set(0, y, z); bg.add(e); };
  edge(3.43 + 0.525, 0, 0.045, 1.83, 0xf2f6ff); edge(3.43 - 0.525, 0, 0.045, 1.83, 0xf2f6ff); edge(3.43, 0.915, 1.05, 0.045, 0xf2f6ff); edge(3.43, -0.915, 1.05, 0.045, 0xf2f6ff); // frame
  edge(3.2 + 0.225, 0, 0.02, 0.61, 0xff3b20); edge(3.2 - 0.225, 0, 0.02, 0.61, 0xff3b20); edge(3.2, 0.295, 0.45, 0.02, 0xff3b20); edge(3.2, -0.295, 0.45, 0.02, 0xff3b20); // shooter's square
  const rimG = new T.Group(); g.add(rimG);
  const rim = new T.Mesh(new T.TorusGeometry(RIM_R + 0.012, 0.017, 10, 36), new T.MeshPhongMaterial({ color: 0xff5a1a, emissive: 0x7a2208, specular: 0xffd2a0, shininess: 70 })); rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM_H, 0); rimG.add(rim);
  const brace = add(boxG, mat(0xff5a1a), dir * 0.34, RIM_H, 0, 0.3, 0.03, 0.08); g.remove(brace); rimG.add(brace);
  const net = new T.Group(); rimG.add(net); // placeholder the old net animation scales; the real net is the strand mesh fxNet() hangs from the rim (h.fx)
  const h = { x: hx, dir, g, rim: rimG, net, board: bg, shake: 0, netT: 0, fx: null, fade: 1, mats: [] };
  // own copies of the shared materials so one hoop can fade (2K looking past the near board) without touching the other
  g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData.op = o.material.opacity; h.mats.push(o.material); } });
  if (typeof fxNet === 'function') fxNet(h);
  return h;
}

// k = 1 solid .. ~0.15 ghosted. The net's own opacity is reset every frame in c_fx, so it is scaled after that runs.
function hoopFade(h, k) {
  if (h.fade !== k) { h.fade = k; for (const m of h.mats) { const ghost = k < 0.99; m.opacity = m.userData.op * k; m.transparent = ghost || m.userData.op < 1; m.depthWrite = !ghost; } }
  if (h.fx && h.fx.mat) h.fx.mat.opacity = 0.92 * k;
}
/* Blacktop: the three point arc glows while the team on the ball still has to take it back past it. A flat ribbon on the floor, shown by f_ui. */
let arcGlow = null;
function buildArcGlow() {
  const hx = RIM_X, tm = Math.asin(CORNER / ARC), pts = [[HALF_L, -CORNER]];
  for (let i = 0; i <= 48; i++) { const a = -tm + (2 * tm * i) / 48; pts.push([hx - ARC * Math.cos(a), ARC * Math.sin(a)]); }
  pts.push([HALF_L, CORNER]);
  const w = 0.16, pos = [], idx = [];
  pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; pos.push(p[0] - tz * w, 0.02, p[1] + tx * w, p[0] + tz * w, 0.02, p[1] - tx * w); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  m.renderOrder = 1; m.visible = false; return m;
}

/* ---- arena set dressing ---- */
function crowdTex() { return canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#12151f'; c.fillRect(0, 0, w, h); for (let r = 0; r < 12; r++) for (let i = 0; i < 64; i++) { c.fillStyle = pick(['#c2493d', '#3d7ac2', '#e8c34b', '#d9d9de', '#4e8f5b', '#8b5bb8', '#2b2f3d', '#e58c3a', '#f0b9a0', '#6d4a33']); c.globalAlpha = rnd(0.35, 0.9); c.fillRect(i * 8 + rnd(0, 2), r * 13 + 2, 5, 8); c.beginPath(); c.fillStyle = pick(['#f1c9a5', '#d9a273', '#7a4a2c']); c.arc(i * 8 + 3, r * 13 + 1, 2.2, 0, 7); c.fill(); } c.globalAlpha = 1; }, [10, 1]); }
function skyTex(black) {
  return canvasTex(8, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); if (black) { g.addColorStop(0, '#1d1b3a'); g.addColorStop(0.55, '#8a4a6a'); g.addColorStop(1, '#f0955a'); } else { g.addColorStop(0, '#05060b'); g.addColorStop(1, '#161a2a'); } c.fillStyle = g; c.fillRect(0, 0, w, h); });
}
function buildArena(mode, tA, tB) {
  if (arena) { scene.remove(arena); arena.traverse(o => { if (o.geometry && o.geometry !== boxG && o.geometry !== sphG) o.geometry.dispose(); }); }
  arena = new T.Group(); scene.add(arena); hoops = [];
  const black = mode === 'black', gym = mode === 'gym';
  scene.background = gym ? new T.Color(0x1a1612) : skyTex(black); scene.fog = gym ? new T.Fog(0x1a1612, 60, 160) : new T.Fog(black ? 0x7a4a6a : 0x0a0c14, 38, 110);
  const TW = CFG.quality ? 4096 : 2048, tex = canvasTex(TW, Math.round(TW * FLOOR_H / FLOOR_W), (c, w, h) => drawCourt(c, w, h, mode, tA, tB));
  if (typeof GYM !== 'undefined') { GYM.floor = null; GYM.floorMat = null; }
  const floor = gym ? buildGymFloor(tex) : gfxFloor(tex, mode); floor.rotation.x = -Math.PI / 2; arena.add(floor); // a little sheen on the hardwood; the gym floor is a varnished mirror (e_gym.js)
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); arena.add(o); return o; };
  const dirs = black ? [1] : [-1, 1];
  for (const d of dirs) { const h = buildHoop(d); hoops.push(h); arena.add(h.g); }
  arcGlow = black ? buildArcGlow() : null; if (arcGlow) arena.add(arcGlow);
  if (typeof FX !== 'undefined') { FX.nets = hoops.map(h => h.fx).filter(Boolean); if (typeof fxMode === 'function') fxMode(mode); }
  if (gym) buildGym(arena);
  else if (!black) {
    const ct = gfxCrowdTex(tA, tB); const cm = new T.MeshBasicMaterial({ map: ct, color: 0xb4b9cc });
    const back = new T.Mesh(new T.PlaneGeometry(90, 14), cm); back.position.set(0, 6.4, -15); back.rotation.x = -0.55; back.userData.crowd = 1; arena.add(back);
    const back2 = new T.Mesh(back.geometry, cm); back2.position.set(0, 6.4, 15); back2.rotation.set(0.55, Math.PI, 0); back2.userData.crowd = 1; arena.add(back2); // the far side the behind-the-back camera sees
    const ct2 = gfxCrowdTex(tA, tB); ct2.repeat.set(1.4, 1); const cm2 = new T.MeshBasicMaterial({ map: ct2, color: 0x9a9fb4 });
    for (const d of [-1, 1]) { const e = new T.Mesh(new T.PlaneGeometry(40, 12), cm2); e.position.set(d * 25, 7, 0); e.rotation.y = -d * Math.PI / 2; e.rotation.x = d * 0; e.userData.crowd = 1; arena.add(e); }
    const adT = canvasTex(1024, 64, (c, w, h) => { c.fillStyle = '#0d111d'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff7a1a'; c.font = '700 40px Anton, Impact, sans-serif'; c.textBaseline = 'middle'; for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#fff' : '#ffc533'; c.fillText('HOOP DREAMS', 12 + i * 340, 34); } }, [2, 1]);
    const ad = new T.Mesh(new T.PlaneGeometry(HALF_L * 2 + 4, 1), new T.MeshBasicMaterial({ map: adT })); ad.position.set(0, 0.5, -HALF_W - 1.4); arena.add(ad);
    const ad2 = ad.clone(); ad2.position.z = HALF_W + 1.4; ad2.rotation.y = Math.PI; arena.add(ad2);
    add(boxG, new T.MeshBasicMaterial({ color: 0xffa23a }), 0, 1.03, -HALF_W - 1.42, HALF_L * 2 + 4, 0.05, 0.05);
    // overhead glow panels (cheap fake arena lights)
    for (let i = -2; i <= 2; i++) add(boxG, new T.MeshBasicMaterial({ color: 0xfff0d0 }), i * 9, 16, -2, 3.2, 0.2, 1.2);
  } else {
    // dusk skyline, fence, street lights
    const win = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#15121f'; c.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 18) for (let x = 8; x < w; x += 20) { c.fillStyle = Math.random() < .35 ? '#ffd27a' : '#241d33'; c.fillRect(x, y, 9, 10); } });
    for (let i = 0; i < 16; i++) { const bw = rnd(4, 9), bh = rnd(10, 28); const m = new T.MeshBasicMaterial({ map: win, color: 0xb9a0c8 }); const b = new T.Mesh(boxG, m); b.scale.set(bw, bh, 6); b.position.set(-48 + i * 6.4 + rnd(-1, 1), bh / 2, -34 - rnd(0, 6)); arena.add(b); }
    const fenceT = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(210,214,224,.75)'; c.lineWidth = 3; for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } }, [14, 1.4]);
    const fm = new T.MeshBasicMaterial({ map: fenceT, transparent: true, side: T.DoubleSide, depthWrite: false });
    const f1 = new T.Mesh(new T.PlaneGeometry(HALF_L + 6, 3.4), fm); f1.position.set(HALF_L / 2 + 1, 1.7, -HALF_W - 0.6); arena.add(f1);
    const f2 = new T.Mesh(new T.PlaneGeometry(HALF_W * 2 + 1.2, 3.4), fm); f2.rotation.y = Math.PI / 2; f2.position.set(-0.6, 1.7, 0); arena.add(f2);
    const f3 = f2.clone(); f3.position.x = HALF_L + 2.2; arena.add(f3);
    for (const x of [-0.6, 5, 10, HALF_L + 2.2]) add(boxG, mat(0x3a3d46), x, 1.7, -HALF_W - 0.6, 0.12, 3.4, 0.12);
    // the other sideline, the end and the skyline behind it: only the behind-the-back camera looks this way, and it sees them from the court side
    const fm2 = new T.MeshBasicMaterial({ map: fenceT, transparent: true, side: T.FrontSide, depthWrite: false });
    const f4 = new T.Mesh(new T.PlaneGeometry(HALF_L + 6, 3.4), fm2); f4.rotation.y = Math.PI; f4.position.set(HALF_L / 2 + 1, 1.7, HALF_W + 0.6); arena.add(f4);
    for (const x of [-0.6, 5, 10, HALF_L + 2.2]) add(boxG, mat(0x3a3d46), x, 1.7, HALF_W + 0.6, 0.12, 3.4, 0.12);
    for (let i = 0; i < 14; i++) { const bw = rnd(4, 9), bh = rnd(10, 28); const b = new T.Mesh(boxG, new T.MeshBasicMaterial({ map: win, color: 0xb9a0c8 })); b.scale.set(bw, bh, 6); b.position.set(-30 + i * 7 + rnd(-1, 1), bh / 2, 34 + rnd(0, 6)); arena.add(b); }
    for (let i = 0; i < 9; i++) { const bw = rnd(4, 9), bh = rnd(10, 28); const b = new T.Mesh(boxG, new T.MeshBasicMaterial({ map: win, color: 0xb9a0c8 })); b.scale.set(6, bh, bw); b.position.set(40 + rnd(0, 6), bh / 2, -30 + i * 7.5 + rnd(-1, 1)); arena.add(b); }
    for (const x of [-1, 7.5, 15]) { add(boxG, mat(0x2b2d36), x, 5, -HALF_W - 2, 0.2, 10, 0.2); const l = add(sphG, new T.MeshBasicMaterial({ color: 0xffe2a0 }), x, 10.1, -HALF_W - 2, 0.35, 0.35, 0.35); }
  }
  gfxArena(mode, tA, tB);
}

const shadowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const shadowGeo = new T.PlaneGeometry(1, 1);
function makeShadow(size) { const s = new T.Mesh(shadowGeo, shadowMat); s.rotation.x = -Math.PI / 2; s.scale.set(size, size, 1); s.position.y = 0.012; s.renderOrder = 1; return s; }

/* ---- player model: rigged, baked-per-limb humanoid with proper proportions (1.98 m reference) ---- */
const _bc = new T.Color(), _bn = new T.Matrix3(), _bv = new T.Vector3(), _bq = new T.Quaternion(), _be = new T.Euler(), _bm = new T.Matrix4(), _bp = new T.Vector3(), _bs = new T.Vector3();
function mx(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) { _be.set(rx, ry, rz); _bq.setFromEuler(_be); return new T.Matrix4().compose(_bp.set(x, y, z), _bq, _bs.set(sx, sy, sz)); }
const GEO = { cyl: {}, sph: new T.SphereGeometry(1, 16, 11) };
function cylG(rt, rb, h, seg = 10) { const k = rt + '_' + rb + '_' + h + '_' + seg; return GEO.cyl[k] || (GEO.cyl[k] = new T.CylinderGeometry(rt, rb, h, seg, 1)); }
function bake(parts) {
  let n = 0; const gs = parts.map(p => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo; n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  parts.forEach((p, k) => {
    const g = gs[k], P = g.attributes.position, N = g.attributes.normal; _bn.getNormalMatrix(p.m); _bc.setHex(p.c);
    for (let i = 0; i < P.count; i++, o++) {
      _bv.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[o * 3] = _bv.x; pos[o * 3 + 1] = _bv.y; pos[o * 3 + 2] = _bv.z;
      _bv.fromBufferAttribute(N, i).applyMatrix3(_bn).normalize(); nor[o * 3] = _bv.x; nor[o * 3 + 1] = _bv.y; nor[o * 3 + 2] = _bv.z;
      col[o * 3] = _bc.r; col[o * 3 + 1] = _bc.g; col[o * 3 + 2] = _bc.b;
    }
  });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
}
const bodyMat = new T.MeshPhongMaterial({ vertexColors: true, specular: 0x1c1c1c, shininess: 18 });
const numTex = {};
function jerseyTex(color, num, name) {
  const k = color + '|' + num + '|' + name; if (numTex[k]) return numTex[k];
  return numTex[k] = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.textAlign = 'center'; c.fillStyle = css(color); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 3;
    if (name) { c.font = '700 20px Anton, Impact, sans-serif'; c.fillText(name.toUpperCase().slice(0, 9), 64, 28); c.font = '700 86px Anton, Impact, sans-serif'; c.fillText(String(num), 64, 112); }
    else { c.font = '700 96px Anton, Impact, sans-serif'; c.fillText(String(num), 64, 100); } });
}
function buildPlayer(o) {
  if (CFG.bodies !== 'classic') { const a = buildAthlete(o); if (a) return a; }   // v24: realistic skinned athletes (c_body.js)
  const skin = o.skinC !== undefined ? o.skinC : SKIN[o.skin] || SKIN[2], jersey = o.jersey, shorts = o.shorts, hair = o.hairC;
  const W = 0xf4f4f6, shoe = o.shoe, dark = 0x241810;
  const root = new T.Group(), body = new T.Group(), torso = new T.Group(); root.add(body);
  const mesh = (parts, par) => { const m = new T.Mesh(bake(parts), bodyMat); m.castShadow = m.receiveShadow = true; par.add(m); return m; };
  // torso (pivot at hips)
  torso.position.y = 0.95; body.add(torso);
  const trim = o.numColor !== undefined ? o.numColor : 0xffffff, lip = _bc.setHex(skin).multiplyScalar(0.7).offsetHSL(0, 0.06, 0).getHex(), sock = new T.Color(skin).multiplyScalar(0.82).getHex();
  mesh([
    { geo: cylG(0.19, 0.2, 0.34, 20), c: jersey, m: mx(0, 0.17, 0, 1.1, 1, 0.68) },
    { geo: cylG(0.216, 0.19, 0.3, 20), c: jersey, m: mx(0, 0.47, 0, 1.08, 1, 0.68) },
    { geo: cylG(0.07, 0.205, 0.12, 18), c: skin, m: mx(0, 0.655, 0, 1, 1, 0.62) },
    { geo: GEO.sph, c: skin, m: mx(-0.225, 0.58, 0, 0.07, 0.07, 0.07) }, { geo: GEO.sph, c: skin, m: mx(0.225, 0.58, 0, 0.07, 0.07, 0.07) },
    { geo: GEO.sph, c: skin, m: mx(-0.09, 0.66, -0.02, 0.07, 0.04, 0.06) }, { geo: GEO.sph, c: skin, m: mx(0.09, 0.66, -0.02, 0.07, 0.04, 0.06) },
    { geo: cylG(0.055, 0.062, 0.11, 12), c: skin, m: mx(0, 0.73, 0.006) },
    { geo: cylG(0.203, 0.203, 0.03, 20), c: trim, m: mx(0, 0.0, 0, 1.1, 1, 0.68) },
    { geo: boxG, c: trim, m: mx(-0.168, 0.36, 0, 0.016, 0.5, 0.1, 0, 0, 0.06) }, { geo: boxG, c: trim, m: mx(0.168, 0.36, 0, 0.016, 0.5, 0.1, 0, 0, -0.06) },
    { geo: boxG, c: jersey, m: mx(-0.125, 0.612, 0, 0.085, 0.03, 0.16, 0, 0, 0.25) }, { geo: boxG, c: jersey, m: mx(0.125, 0.612, 0, 0.085, 0.03, 0.16, 0, 0, -0.25) },
    { geo: cylG(0.085, 0.1, 0.022, 14), c: trim, m: mx(0, 0.62, 0.008, 1, 1, 0.9) },
  ], torso);
  // number decals
  const nm = (back) => { const m = new T.Mesh(new T.PlaneGeometry(0.26, 0.26), new T.MeshBasicMaterial({ map: jerseyTex(back ? o.numColor : o.numColor, o.num, back ? o.short : ''), transparent: true, depthWrite: false })); m.position.set(0, 0.3, back ? -0.143 : 0.143); if (back) m.rotation.y = Math.PI; torso.add(m); };
  nm(false); nm(true);
  // head
  const head = new T.Group(); head.position.set(0, 0.81, 0.01); torso.add(head);
  const hp = [
    { geo: GEO.sph, c: skin, m: mx(0, 0, 0, 0.094, 0.115, 0.105) },
    { geo: GEO.sph, c: skin, m: mx(0, -0.065, 0.03, 0.07, 0.06, 0.07) },
    { geo: GEO.sph, c: skin, m: mx(-0.052, -0.02, 0.07, 0.03, 0.03, 0.03) }, { geo: GEO.sph, c: skin, m: mx(0.052, -0.02, 0.07, 0.03, 0.03, 0.03) },
    { geo: GEO.sph, c: skin, m: mx(0, 0.004, 0.102, 0.014, 0.03, 0.02) }, { geo: GEO.sph, c: skin, m: mx(0, -0.02, 0.112, 0.019, 0.014, 0.018) },
    { geo: GEO.sph, c: skin, m: mx(-0.093, 0, 0, 0.01, 0.024, 0.015) }, { geo: GEO.sph, c: skin, m: mx(0.093, 0, 0, 0.01, 0.024, 0.015) },
    { geo: GEO.sph, c: sock, m: mx(-0.036, 0.022, 0.088, 0.025, 0.017, 0.014) }, { geo: GEO.sph, c: sock, m: mx(0.036, 0.022, 0.088, 0.025, 0.017, 0.014) },
    { geo: GEO.sph, c: 0xf4f1ec, m: mx(-0.036, 0.022, 0.093, 0.017, 0.011, 0.01) }, { geo: GEO.sph, c: 0xf4f1ec, m: mx(0.036, 0.022, 0.093, 0.017, 0.011, 0.01) },
    { geo: GEO.sph, c: dark, m: mx(-0.036, 0.022, 0.101, 0.008, 0.009, 0.006) }, { geo: GEO.sph, c: dark, m: mx(0.036, 0.022, 0.101, 0.008, 0.009, 0.006) },
    { geo: GEO.sph, c: hair === 0xc9a24a ? 0x6a4a20 : hair, m: mx(-0.037, 0.047, 0.098, 0.024, 0.006, 0.01, 0, 0, 0.12) }, { geo: GEO.sph, c: hair === 0xc9a24a ? 0x6a4a20 : hair, m: mx(0.037, 0.047, 0.098, 0.024, 0.006, 0.01, 0, 0, -0.12) },
    { geo: GEO.sph, c: lip, m: mx(0, -0.046, 0.097, 0.027, 0.009, 0.013) },
  ];
  const hr = o.hair, ex = (o.extra || '').split(' '), has = k => ex.includes(k), stub = new T.Color(skin).multiplyScalar(0.72).getHex();
  if (hr === 'short') hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.028, -0.012, 0.101, 0.092, 0.112) });
  else if (hr === 'fade') hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.04, -0.01, 0.098, 0.075, 0.108) });
  else if (hr === 'long') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.106, 0.1, 0.116) }); hp.push({ geo: cylG(0.1, 0.085, 0.16, 10), c: hair, m: mx(0, -0.07, -0.05, 1, 1, 0.8) }); }
  else if (hr === 'braids') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.102, 0.095, 0.112) }); for (let i = -2; i <= 2; i++) hp.push({ geo: cylG(0.012, 0.01, 0.2, 5), c: hair, m: mx(i * 0.04, -0.09, -0.085, 1, 1, 1, 0.1, 0, 0) }); }
  else if (hr === 'afro') hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.05, -0.012, 0.138, 0.128, 0.14) });
  else if (hr === 'buzz') hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.034, -0.01, 0.096, 0.082, 0.107) });
  else if (hr === 'hightop') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.099, 0.088, 0.11) }); hp.push({ geo: cylG(0.082, 0.09, 0.1, 10), c: hair, m: mx(0, 0.105, -0.014, 1, 1, 1.06) }); }
  else if (hr === 'curly') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.102, 0.09, 0.112) }); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; hp.push({ geo: GEO.sph, c: hair, m: mx(Math.cos(a) * 0.06, 0.1 + (i % 2) * 0.012, Math.sin(a) * 0.06 - 0.012, 0.036, 0.036, 0.036) }); } }
  else if (hr === 'cornrows') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.036, -0.01, 0.097, 0.078, 0.108) }); for (let i = -2; i <= 2; i++) hp.push({ geo: cylG(0.009, 0.009, 0.2, 5), c: 0x2e2622, m: mx(i * 0.034, 0.106 - Math.abs(i) * 0.012, -0.012, 1, 1, 1, Math.PI / 2, 0, 0) }); }
  else if (hr === 'dreads') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.104, 0.095, 0.114) }); for (let i = -3; i <= 3; i++) hp.push({ geo: cylG(0.019, 0.015, 0.27, 6), c: hair, m: mx(i * 0.032, -0.1, -0.075 - (3 - Math.abs(i)) * 0.004, 1, 1, 1, 0.12, 0, i * 0.06) }); }
  else if (hr === 'slicked') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.014, 0.101, 0.09, 0.112) }); hp.push({ geo: GEO.sph, c: hair, m: mx(0, -0.01, -0.075, 0.09, 0.09, 0.06) }); }
  else if (hr === 'manbun') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.03, -0.012, 0.102, 0.092, 0.112) }); hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.125, -0.05, 0.05, 0.05, 0.05) }); }
  else if (hr === 'mohawk') { hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.045, -0.01, 0.096, 0.07, 0.106) }); hp.push({ geo: GEO.sph, c: hair, m: mx(0, 0.105, -0.01, 0.026, 0.07, 0.125) }); }
  if (has('stubble')) hp.push({ geo: GEO.sph, c: stub, m: mx(0, -0.062, 0.034, 0.074, 0.066, 0.07) });
  if (has('stache')) hp.push({ geo: GEO.sph, c: hair === 0xc9a24a ? 0x8a6a30 : hair, m: mx(0, -0.035, 0.1, 0.048, 0.014, 0.018) });
  if (has('goatee')) { hp.push({ geo: GEO.sph, c: hair === 0xc9a24a ? 0x8a6a30 : hair, m: mx(0, -0.1, 0.072, 0.03, 0.04, 0.025) }); hp.push({ geo: GEO.sph, c: hair, m: mx(0, -0.035, 0.1, 0.044, 0.012, 0.016) }); }
  if (has('graybeard')) hp.push({ geo: GEO.sph, c: 0xcfcfcf, m: mx(0, -0.07, 0.045, 0.07, 0.055, 0.062) });
  if (has('beard')) hp.push({ geo: GEO.sph, c: hair === 0xc9a24a ? 0x8a6a30 : dark, m: mx(0, -0.07, 0.045, 0.07, 0.055, 0.062) });
  if (has('bigbeard')) hp.push({ geo: GEO.sph, c: dark, m: mx(0, -0.09, 0.04, 0.082, 0.085, 0.068) });
  if (has('band')) hp.push({ geo: cylG(0.1, 0.1, 0.028, 12), c: o.bandC || W, m: mx(0, 0.045, 0, 1, 1, 1.12) });
  if (has('brow')) hp.push({ geo: GEO.sph, c: dark, m: mx(0, 0.045, 0.1, 0.05, 0.008, 0.01) });
  mesh(hp, head);
  // arms
  const arm = (side) => {
    const sh = new T.Group(); sh.position.set(side * 0.235, 0.58, 0); torso.add(sh);
    mesh([{ geo: cylG(0.054, 0.043, 0.3, 12), c: skin, m: mx(0, -0.15, 0) }, { geo: GEO.sph, c: skin, m: mx(0, -0.3, 0, 0.044, 0.044, 0.044) }, { geo: GEO.sph, c: skin, m: mx(0, -0.1, 0.012, 0.058, 0.1, 0.054) }, { geo: GEO.sph, c: skin, m: mx(0, 0.0, 0, 0.066, 0.06, 0.064) }], sh);
    const el = new T.Group(); el.position.y = -0.3; sh.add(el);
    mesh([{ geo: cylG(0.043, 0.031, 0.27, 10), c: skin, m: mx(0, -0.135, 0) }, { geo: GEO.sph, c: skin, m: mx(0, -0.07, 0.006, 0.046, 0.085, 0.042) }, { geo: GEO.sph, c: skin, m: mx(0, -0.3, 0.005, 0.038, 0.052, 0.022) }, { geo: GEO.sph, c: skin, m: mx(0, -0.34, 0.012, 0.03, 0.036, 0.017) }, { geo: GEO.sph, c: skin, m: mx(-side * 0.03, -0.29, 0.02, 0.014, 0.03, 0.014) }, { geo: cylG(0.043, 0.043, 0.04, 10), c: W, m: mx(0, -0.2, 0) }].concat(has('sleeve') && side > 0 ? [{ geo: cylG(0.046, 0.044, 0.2, 10), c: o.sleeveC || W, m: mx(0, -0.1, 0) }] : []), el);
    return [sh, el];
  };
  const [armL, elbL] = arm(-1), [armR, elbR] = arm(1);
  // legs
  const leg = (side) => {
    const hip = new T.Group(); hip.position.set(side * 0.095, 0.95, 0); body.add(hip);
    mesh([{ geo: cylG(0.086, 0.063, 0.46, 12), c: skin, m: mx(0, -0.23, 0) }, { geo: GEO.sph, c: skin, m: mx(0, -0.46, 0, 0.064, 0.064, 0.064) }, { geo: GEO.sph, c: skin, m: mx(0, -0.2, 0.02, 0.078, 0.16, 0.076) },
      { geo: cylG(0.118, 0.123, 0.3, 16), c: shorts, m: mx(0, -0.14, 0) }, { geo: cylG(0.124, 0.124, 0.024, 16), c: trim, m: mx(0, -0.285, 0) }, { geo: boxG, c: trim, m: mx(side * 0.121, -0.14, 0, 0.01, 0.27, 0.05) }], hip);
    const kn = new T.Group(); kn.position.y = -0.46; hip.add(kn);
    mesh([{ geo: cylG(0.06, 0.041, 0.4, 10), c: skin, m: mx(0, -0.2, 0) }, { geo: GEO.sph, c: skin, m: mx(0, -0.1, -0.026, 0.053, 0.095, 0.05) },
      { geo: cylG(0.048, 0.048, 0.19, 10), c: W, m: mx(0, -0.3, 0) }, { geo: cylG(0.049, 0.049, 0.02, 10), c: trim, m: mx(0, -0.21, 0) },
      { geo: GEO.sph, c: shoe, m: mx(0, -0.425, 0.045, 0.06, 0.054, 0.14) }, { geo: GEO.sph, c: shoe, m: mx(0, -0.41, -0.03, 0.05, 0.055, 0.055) }, { geo: GEO.sph, c: W, m: mx(0, -0.455, 0.05, 0.064, 0.022, 0.157) },
      { geo: GEO.sph, c: W, m: mx(0, -0.4, 0.075, 0.03, 0.012, 0.05) }, { geo: boxG, c: trim, m: mx(-0.06, -0.43, 0.04, 0.006, 0.026, 0.09) }, { geo: boxG, c: trim, m: mx(0.06, -0.43, 0.04, 0.006, 0.026, 0.09) }], kn);
    return [hip, kn];
  };
  const [legL, kneeL] = leg(-1), [legR, kneeR] = leg(1);
  mesh([{ geo: cylG(0.17, 0.2, 0.2, 18), c: shorts, m: mx(0, -0.02, 0, 1.08, 1, 0.64) }], body).position.y = 0.95;
  root.scale.setScalar(o.hgt / 1.98);
  return { root, body, torso, head, armL, armR, elbL, elbR, legL, legR, kneeL, kneeR };
}
function trimOf(c) { return c === 0xf1f3f8 ? 0xd0d4de : c; }

/* ---- ball ---- */
const ballTex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#d9631a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a1206'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 4, 0); c.lineTo(w / 4, h); c.moveTo(w * 3 / 4, 0); c.lineTo(w * 3 / 4, h); c.stroke(); c.beginPath(); c.arc(w / 4 - 20, h / 2, 26, -1, 1); c.arc(w * 3 / 4 + 20, h / 2, 26, Math.PI - 1, Math.PI + 1); c.stroke(); });
const ballMat = new T.MeshLambertMaterial({ map: ballTex, emissive: 0x000000 });
const ballMesh = new T.Mesh(new T.SphereGeometry(BALL_R * 1.02, 16, 12), ballMat);
const ballShadow = makeShadow(0.5);

/* ---- particles (one draw call): fire, sparks, glass, confetti ---- */
const NP = 1400;
const P = { pos: new Float32Array(NP * 3), col: new Float32Array(NP * 4), siz: new Float32Array(NP), vel: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), kind: new Uint8Array(NP), grav: new Float32Array(NP), s0: new Float32Array(NP), c0: new Float32Array(NP * 3), head: 0 };
const pgeo = new T.BufferGeometry();
pgeo.setAttribute('position', new T.BufferAttribute(P.pos, 3)); pgeo.setAttribute('color', new T.BufferAttribute(P.col, 4)); pgeo.setAttribute('size', new T.BufferAttribute(P.siz, 1));
const pmat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { sc: { value: 600 } },
  vertexShader: 'attribute vec4 color; attribute float size; varying vec4 vC; uniform float sc; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*sc/-mv.z; gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,.0,d); gl_FragColor=vec4(vC.rgb*vC.a*a, a*vC.a); }'
});
const points = new T.Points(pgeo, pmat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
function emit(x, y, z, vx, vy, vz, life, size, r, g, b, kind, grav) {
  const i = P.head; P.head = (P.head + 1) % NP;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z; P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
  P.life[i] = life; P.max[i] = life; P.s0[i] = size; P.siz[i] = size; P.kind[i] = kind; P.grav[i] = grav; P.c0[i * 3] = r; P.c0[i * 3 + 1] = g; P.c0[i * 3 + 2] = b;
}
function updateParticles(dt) {
  for (let i = 0; i < NP; i++) {
    if (P.life[i] <= 0) { P.col[i * 4 + 3] = 0; P.siz[i] = 0; continue; }
    P.life[i] -= dt; const u = 1 - P.life[i] / P.max[i];
    P.vel[i * 3 + 1] += P.grav[i] * dt;
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    if (P.kind[i] === 0) { // fire: yellow -> orange -> red, shrinks
      P.col[i * 4] = 1; P.col[i * 4 + 1] = Math.max(0.1, 0.95 - u * 0.85); P.col[i * 4 + 2] = Math.max(0, 0.35 - u * 0.5); P.col[i * 4 + 3] = (1 - u) * 0.9;
      P.siz[i] = P.s0[i] * (1 - u * 0.6);
    } else { P.col[i * 4] = P.c0[i * 3]; P.col[i * 4 + 1] = P.c0[i * 3 + 1]; P.col[i * 4 + 2] = P.c0[i * 3 + 2]; P.col[i * 4 + 3] = Math.min(1, (1 - u) * 1.6); P.siz[i] = P.s0[i]; }
    if (P.pos[i * 3 + 1] < 0.02 && P.kind[i] !== 0) { P.pos[i * 3 + 1] = 0.02; P.vel[i * 3 + 1] *= -0.4; P.vel[i * 3] *= 0.7; P.vel[i * 3 + 2] *= 0.7; }
  }
  pgeo.attributes.position.needsUpdate = pgeo.attributes.color.needsUpdate = pgeo.attributes.size.needsUpdate = true;
}
function burst(x, y, z, n, speed, kind, cols, life = 0.9, size = 0.2, grav = -6) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), e = rnd(-0.3, 1), s = rnd(0.3, 1) * speed, c = cols ? pick(cols) : [1, 0.7, 0.2]; emit(x, y, z, Math.cos(a) * s * (1 - Math.abs(e) * 0.4), e * s, Math.sin(a) * s * (1 - Math.abs(e) * 0.4), life * rnd(0.6, 1.2), size * rnd(0.6, 1.3), c[0], c[1], c[2], kind, grav); }
}
// expanding shockwave rings
const waves = [];
for (let i = 0; i < 5; i++) { const w = new T.Mesh(new T.RingGeometry(0.85, 1, 40), new T.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); w.rotation.x = -Math.PI / 2; w.visible = false; w.userData = { t: 0, on: false }; scene.add(w); waves.push(w); }
function shock(x, y, z, size = 5, color = 0xffb040) { const w = waves.find(q => !q.userData.on) || waves[0]; w.position.set(x, y, z); w.userData = { t: 0, on: true, size }; w.material.color.setHex(color); w.visible = true; }
function updateWaves(dt) { for (const w of waves) { const u = w.userData; if (!u.on) continue; u.t += dt; const k = u.t / 0.6; if (k >= 1) { u.on = false; w.visible = false; continue; } w.scale.setScalar(0.5 + k * u.size); w.material.opacity = (1 - k) * 0.8; } }

/* ---- camera ---- */
// dir: +1 = 2K looks toward +x, -1 toward -x (it sits behind whoever has the ball). yaw is the animated heading, flipT the cooldown between flips.
// flipHold: for a moment after an auto flip a stick held the same way keeps the old mapping (oldDir), so the player does not reverse under you.
const CAMS = { x: 0, z: 0, shake: 0, fov: 36, dir: 1, yaw: 0, flipT: 0, lastPoss: 0, flipHold: 0, oldDir: 1, sticks: [], flipSticks: [] };
// Screen stick -> world (x, z). FULL COURT is a sideline view: right = +x, up = -z. 2K looks down the court from behind the ball handler,
// so up is toward the basket he attacks and right is his right. The target direction is used (not the swinging camera) so the controls never swirl.
function stickToWorld(sx, sy, ro) {
  if (S.mode === 'gym') return gymStickWorld(sx, sy, ro);
  if (CFG.cam !== '2k') return { x: sx, z: sy };
  let d = CAMS.dir; const m = Math.hypot(sx, sy);
  if (m > 0.4) {
    if (CAMS.sticks.length > 5) CAMS.sticks.shift(); CAMS.sticks.push([sx / m, sy / m, performance.now()]); // the last few held sticks, copied to flipSticks when the camera flips
    if (CAMS.flipHold > 0 && CAMS.flipSticks.some(v => v[0] * sx / m + v[1] * sy / m > 0.82)) d = CAMS.oldDir; // still held the same way (within ~35 degrees)
  }
  return { x: -d * sy, z: d * sx };
}
// FULL COURT uses the lens the game first shipped with: wider on narrow screens. 2K sets its own in behindCam().
const baseFov = () => cam.aspect < 1.3 ? 52 : cam.aspect < 1.6 ? 42 : 36;
function setFov(f) {
  if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); }
  pmat.uniforms.sc.value = (canvas.clientHeight || innerHeight) * 0.5 / Math.tan(cam.fov * Math.PI / 360) * PR;
}
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); setFov(baseFov());
}
addEventListener('resize', resize);
