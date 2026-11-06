/* ===== The Gym: a free-roam practice gym. Racks of balls, a varnished floor that mirrors the room and squeaks under your cuts,
   a pad that spawns a defender (four levels) or a rebounder, and timed shooting challenges with saved records. =====
   Hooks the rest of the game calls: buildGymFloor / buildGym from buildArena, gymStart from startMatch, gymUpdate from update(),
   gymAfterScore from afterScore, gymHud from updateHud, gymReflect from frame(), gymRebAI / gymNpcAI from update(). */
const GYM = { on: false, racks: [], pads: [], strays: [], npc: null, reb: null, lvl: 1, ch: null, t: 0, best: {}, rt: null, mcam: null, floorMat: null, floor: null, boardC: null, boardTex: null, boardT: 0, lastSb: '', lanes: [], cur: -1, split: false, snap: true, hudEls: [], spots: [], ceilMeshes: [], ball2: null, shadow2: null, mat2: null, result: '', resultT: 0, pad: null, grabT: 0, scored1: 0, bannerT: 0, bannerTxt: '', tipT: 18, tipI: 0, hintT: 0 };
const GYM_LVLS = ['Rookie', 'Pro', 'All-Star', 'Legend'];
const GYM_W = FLOOR_W / 2, GYM_H = FLOOR_H / 2;                 // the walls stand at the edge of the floor
const GYM_PX = GYM_W - 1.0, GYM_PZ = GYM_H - 1.3;                // how far a player can walk (benches and bleachers line the walls)
const GYM_CLIP = [new T.Plane(new T.Vector3(0, 1, 0), 0)];       // the mirror pass only sees what stands on the floor
const GYM_TIPS = ['WALK INTO A RACK TO GRAB A BALL', 'THE RED PAD SPAWNS A DEFENDER · FOUR LEVELS', 'THE GREEN PAD RUNS THE SHOOTING CHALLENGES', 'BOTH BASKETS ARE LIVE · PICK AN END', 'THREE MAKES IN A ROW AND YOU CATCH FIRE', 'SQUARE ON THE RED PAD BRINGS IN A REBOUNDER', 'A BALL ON THE FLOOR IS YOURS · WALK OVER IT', 'SPRINT AT THE RIM WITH SQUARE TO DUNK'];
try { GYM.best = JSON.parse(localStorage.getItem('hoopdreams.gym') || '{}') || {}; } catch (e) { GYM.best = {}; }
function gymSave() { try { localStorage.setItem('hoopdreams.gym', JSON.stringify(GYM.best)); } catch (e) { } }
const _gv1 = new T.Vector3(), _gv2 = new T.Vector3(), _gm = new T.Matrix4();

/* ---- the floor: the court texture under a varnish that reflects the room (a mirror pass each frame) and catches the ceiling lights ---- */
const GYM_VS = 'varying vec2 vUv; varying vec4 vRef; varying vec3 vWp; uniform mat4 texM;\nvoid main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vRef = texM * wp; gl_Position = projectionMatrix * viewMatrix * wp; }';
const GYM_FS = 'uniform sampler2D map; uniform sampler2D tRef; uniform float kRef; uniform vec3 lp[3]; varying vec2 vUv; varying vec4 vRef; varying vec3 vWp;\n' +
  'void main(){ vec3 base = texture2D(map, vUv).rgb; vec3 V = normalize(cameraPosition - vWp); float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5); vec3 col = base;\n' +
  ' if (kRef > 0.0) { vec3 r = texture2DProj(tRef, vRef).rgb; col = mix(col, col * 0.62 + r * 0.95, kRef * (0.14 + 0.42 * fr)); }\n' +
  ' float spec = 0.0; for (int i = 0; i < 3; i++) { vec3 L = normalize(lp[i] - vWp); vec3 H = normalize(L + V); float nh = max(H.y, 0.0); spec += pow(nh, 160.0) * 0.5 + pow(nh, 18.0) * 0.07; }\n' +
  ' col += vec3(1.0, 0.96, 0.86) * spec * (0.5 + 0.7 * fr);\n gl_FragColor = vec4(col, 1.0); }';
function buildGymFloor(tex) {
  const m = new T.ShaderMaterial({ uniforms: { map: { value: tex }, tRef: { value: null }, kRef: { value: 0 }, texM: { value: new T.Matrix4() }, lp: { value: [new T.Vector3(-9, 6.8, 0.5), new T.Vector3(0, 6.8, -0.5), new T.Vector3(9, 6.8, 0.5)] } }, vertexShader: GYM_VS, fragmentShader: GYM_FS });
  const floor = new T.Mesh(new T.PlaneGeometry(FLOOR_W, FLOOR_H), m); floor.rotation.x = -Math.PI / 2;
  GYM.floorMat = m; GYM.floor = floor; return floor;
}
// the mirror pass: a second camera under the floor looks up at the room; the floor shader samples its picture by projection (three.js Reflector, trimmed)
function gymReflect(C, V) {
  const m = GYM.floorMat; if (!GYM.on || !m || !GYM.floor) return;
  if (!CFG.quality || window.__noReflect) { m.uniforms.kRef.value = 0; return; }
  const w = clamp(Math.round((V ? V.w : canvas.clientWidth || 960) * 0.5), 256, 1024), h = clamp(Math.round((V ? V.h : canvas.clientHeight || 540) * 0.5), 144, 640);
  if (!GYM.rt || GYM.rt.width !== w || GYM.rt.height !== h) { if (GYM.rt) GYM.rt.dispose(); GYM.rt = new T.WebGLRenderTarget(w, h); GYM.rt.texture.minFilter = T.LinearFilter; }
  if (!GYM.mcam) GYM.mcam = new T.PerspectiveCamera();
  C.updateMatrixWorld();
  const mc = GYM.mcam, cp = _gv1.setFromMatrixPosition(C.matrixWorld); if (cp.y <= 0.05) { m.uniforms.kRef.value = 0; return; }
  const rot = _gm.extractRotation(C.matrixWorld);
  mc.position.set(cp.x, -cp.y, cp.z);
  const la = _gv2.set(0, 0, -1).applyMatrix4(rot).add(cp); la.y = -la.y;
  mc.up.set(0, 1, 0).applyMatrix4(rot); mc.up.y = -mc.up.y;
  mc.lookAt(la); mc.near = C.near; mc.far = C.far; mc.updateMatrixWorld(); mc.projectionMatrix.copy(C.projectionMatrix);
  const tm = m.uniforms.texM.value; tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(mc.projectionMatrix); tm.multiply(mc.matrixWorldInverse);
  GYM.floor.visible = false; const cur = renderer.getRenderTarget();
  renderer.clippingPlanes = GYM_CLIP; renderer.setRenderTarget(GYM.rt); renderer.clear(); renderer.render(scene, mc); renderer.setRenderTarget(cur); renderer.clippingPlanes = [];
  GYM.floor.visible = true; m.uniforms.tRef.value = GYM.rt.texture; m.uniforms.kRef.value = 1;
}

/* ---- set dressing: walls, banners, bleachers, benches, racks, station pads ---- */
function gymText(w, h, draw) { return canvasTex(w, h, draw); }
function gymLabel(text, color, w = 2.8) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  const t = new T.CanvasTexture(c); const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w, w / 4, 1); s.userData.c = c; s.userData.t = t; s.userData.col = color;
  gymLabelSet(s, text); return s;
}
function gymLabelSet(s, text) {
  if (s.userData.txt === text) return; s.userData.txt = text; const c = s.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.font = '700 64px Anton, Impact, sans-serif'; const tw = g.measureText(text).width; if (tw > 470) g.font = '700 ' + Math.floor(64 * 470 / tw) + 'px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineJoin = 'round'; g.strokeText(text, 256, 64); g.fillStyle = s.userData.col; g.fillText(text, 256, 64); s.userData.t.needsUpdate = true;
}
function buildGym(arena) {
  GYM.racks = []; GYM.pads = []; GYM.strays = []; GYM.spots = []; GYM.ceilMeshes = []; GYM.ball2 = GYM.shadow2 = null;
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); arena.add(o); return o; };
  const WH = 7.2;
  // walls: cream block above a brick-red band with a gold stripe, faint mortar lines
  const wallT = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#ddd4bf'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 2;
    for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    const band = Math.round(h * (1 - 2.4 / WH)); c.fillStyle = '#7e2b22'; c.fillRect(0, band, w, h - band); c.fillStyle = '#e8b53c'; c.fillRect(0, band - 6, w, 8); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, h - 10, w, 10);
  }, [4, 1]);
  const wm = new T.MeshLambertMaterial({ map: wallT });
  const side = new T.Mesh(new T.PlaneGeometry(FLOOR_W, WH), wm); side.position.set(0, WH / 2, -GYM_H); arena.add(side);
  const side2 = new T.Mesh(side.geometry, wm); side2.position.set(0, WH / 2, GYM_H); side2.rotation.y = Math.PI; arena.add(side2);
  const endT = wallT.clone(); endT.needsUpdate = true; endT.repeat.set(2.5, 1); const em = new T.MeshLambertMaterial({ map: endT });
  for (const d of [-1, 1]) { const e = new T.Mesh(new T.PlaneGeometry(FLOOR_H, WH), em); e.position.set(d * GYM_W, WH / 2, 0); e.rotation.y = -d * Math.PI / 2; arena.add(e); }
  // ceiling, beams and the light fixtures (the floor shader takes its highlights from these three rows)
  const ceil = new T.Mesh(new T.PlaneGeometry(FLOOR_W, FLOOR_H), new T.MeshLambertMaterial({ color: 0x3a342e })); ceil.rotation.x = Math.PI / 2; ceil.position.y = WH; arena.add(ceil); GYM.ceilMeshes.push(ceil);
  for (let i = -3; i <= 3; i++) GYM.ceilMeshes.push(add(boxG, mat(0x2b2724), i * 5.2, WH - 0.3, 0, 0.35, 0.6, FLOOR_H));
  const lm = new T.MeshBasicMaterial({ color: 0xfff1d2 });
  for (const x of [-9, 0, 9]) for (const z of [-4, 4]) { GYM.ceilMeshes.push(add(boxG, lm, x, WH - 0.62, z, 2.6, 0.14, 0.9)); GYM.ceilMeshes.push(add(boxG, mat(0x55504a), x, WH - 0.45, z, 2.8, 0.2, 1.1)); }
  // high windows on the end walls, exit doors in the corners, padded mats behind each backboard
  const win = new T.MeshBasicMaterial({ color: 0xd7e6ff });
  for (const d of [-1, 1]) {
    for (let i = -2; i <= 2; i++) add(boxG, win, d * (GYM_W - 0.08), 5.3, i * 3.6, 0.1, 1.1, 2.2);
    for (let i = -2; i <= 2; i++) add(boxG, mat(0x3a342e), d * (GYM_W - 0.1), 5.3, i * 3.6, 0.14, 1.3, 0.12);
    add(boxG, mat(0x2a2320), d * (GYM_W - 0.08), 1.1, d * -8.6, 0.12, 2.2, 1.3); add(boxG, new T.MeshBasicMaterial({ color: 0x3df08a }), d * (GYM_W - 0.12), 2.45, d * -8.6, 0.1, 0.22, 0.8);
    add(boxG, mat(0x1d4f8a), d * (GYM_W - 0.14), 1.05, 0, 0.18, 2.1, 4.2);
    for (let k = -1; k <= 1; k += 2) add(boxG, mat(0x2a66a8), d * (GYM_W - 0.2), 1.05, k * 1.05, 0.1, 1.9, 0.9);
  }
  // banners and lettering on the far sideline wall, the live scoreboard, the clock
  const banners = [['CITY CHAMPS', "'16", '#7e2b22'], ['HOOP', 'DREAMS', '#1d4f8a'], ['GYM', 'RATS', '#2a6b3f'], ['STATE FINAL', "'98", '#7e2b22'], ['NO', 'EXCUSES', '#4a3a7a']];
  banners.forEach((b, i) => {
    const t = canvasTex(128, 192, (c, w, h) => { c.fillStyle = b[2]; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h - 30); c.lineTo(w / 2, h); c.lineTo(0, h - 30); c.closePath(); c.fill(); c.strokeStyle = '#e8b53c'; c.lineWidth = 6; c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 26px Anton, Impact, sans-serif'; c.fillText(b[0], w / 2, 60); c.font = '700 40px Anton, Impact, sans-serif'; c.fillText(b[1], w / 2, 110); });
    const p = new T.Mesh(new T.PlaneGeometry(1.4, 2.1), new T.MeshBasicMaterial({ map: t, transparent: true })); p.position.set(-13 + i * 2.1, 5.2, -GYM_H + 0.06); arena.add(p);
  });
  const big = canvasTex(1024, 160, (c, w, h) => { c.clearRect(0, 0, w, h); c.font = '700 120px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8b53c'; c.fillText('THE GYM', w / 2, h / 2 + 4); c.lineWidth = 4; c.strokeStyle = '#7e2b22'; c.strokeText('THE GYM', w / 2, h / 2 + 4); });
  const bigM = new T.Mesh(new T.PlaneGeometry(9, 1.4), new T.MeshBasicMaterial({ map: big, transparent: true })); bigM.position.set(2, 5.3, -GYM_H + 0.06); arena.add(bigM);
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 192; GYM.boardC = bc; GYM.boardTex = new T.CanvasTexture(bc); GYM.lastSb = ''; gymBoardDraw('0', '0', '0:00', 'YOU', 'GYM');
  const board = new T.Mesh(new T.PlaneGeometry(4.6, 1.72), new T.MeshBasicMaterial({ map: GYM.boardTex })); board.position.set(11.5, 5.1, -GYM_H + 0.08); arena.add(board);
  add(boxG, mat(0x15171c), 11.5, 5.1, -GYM_H + 0.03, 4.8, 1.9, 0.08);
  const clk = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 5; c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 6 * Math.PI; c.beginPath(); c.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); c.lineTo(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55); c.stroke(); } c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke(); });
  const clkM = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshBasicMaterial({ map: clk, transparent: true })); clkM.position.set(-13, 5.3, GYM_H - 0.06); clkM.rotation.y = Math.PI; arena.add(clkM);
  const big2 = new T.Mesh(bigM.geometry, bigM.material); big2.position.set(4, 5.3, GYM_H - 0.06); big2.rotation.y = Math.PI; arena.add(big2);
  // folded bleachers along the far sideline, benches, a water cooler and gym bags along the near one
  const bl = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#3b4a5c'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 4; y < h; y += 12) c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 2, h); }, [10, 1]);
  const blM = new T.Mesh(boxG, new T.MeshLambertMaterial({ map: bl })); blM.scale.set(26, 2.4, 1.0); blM.position.set(0, 1.2, -GYM_H + 0.55); arena.add(blM);
  for (const x of [-12, 12]) { add(boxG, mat(0x8a5a2b), x, 0.46, GYM_H - 0.55, 3.2, 0.1, 0.42); for (const k of [-1.3, 1.3]) add(boxG, mat(0x2a2a2e), x + k, 0.22, GYM_H - 0.55, 0.08, 0.44, 0.38); }
  add(boxG, mat(0xe9e9ee), -8.6, 0.55, GYM_H - 0.5, 0.5, 1.1, 0.5); add(boxG, new T.MeshLambertMaterial({ color: 0x7fc0ff, transparent: true, opacity: 0.7 }), -8.6, 1.4, GYM_H - 0.5, 0.42, 0.6, 0.42);
  add(boxG, mat(0x23262e), 13.4, 0.2, GYM_H - 0.5, 0.8, 0.4, 0.45); add(boxG, mat(0xd9473a), 14.3, 0.18, GYM_H - 0.55, 0.7, 0.36, 0.4);
  // the two ball racks on the near sideline, six balls each
  for (const x of [-5.5, 5.5]) {
    const g = new T.Group(); g.position.set(x, 0, GYM_H - 0.75); arena.add(g);
    const r = { x, z: GYM_H - 0.75, g, balls: [], refill: [] };
    const fm = mat(0x3a3d46);
    for (const k of [-1, 1]) for (const j of [-1, 1]) { const o = new T.Mesh(boxG, fm); o.scale.set(0.05, 1.15, 0.05); o.position.set(k * 0.58, 0.575, j * 0.22); g.add(o); }
    for (const y of [0.4, 0.86]) { const s = new T.Mesh(boxG, fm); s.scale.set(1.2, 0.04, 0.5); s.position.set(0, y, 0); g.add(s); const lip = new T.Mesh(boxG, fm); lip.scale.set(1.2, 0.1, 0.03); lip.position.set(0, y + 0.06, 0.25); g.add(lip); }
    for (const y of [0.4, 0.86]) for (const dx of [-0.36, 0, 0.36]) { const b = new T.Mesh(gymBallG(), ballMat); b.position.set(dx, y + BALL_R + 0.03, 0); g.add(b); r.balls.push(b); }
    r.label = gymLabel('BALL RACK', '#ffc533', 2.2); r.label.position.set(0, 1.75, 0); g.add(r.label);
    GYM.racks.push(r);
  }
  // station pads: red spawns a defender or a rebounder, green runs the shooting challenges
  const padAt = (x, z, col, text, kind) => {
    const ring = new T.Mesh(new T.RingGeometry(0.95, 1.15, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.025, z); ring.renderOrder = 2; arena.add(ring);
    const disc = new T.Mesh(new T.CircleGeometry(0.95, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.02, z); disc.renderOrder = 1; arena.add(disc);
    const label = gymLabel(text, css(col), 3.4); label.position.set(x, 2.1, z); arena.add(label);
    const pad = { x, z, kind, ring, disc, label, col }; GYM.pads.push(pad); return pad;
  };
  padAt(0, -GYM_H + 1.95, 0xff4d5e, 'SPAWN A DEFENDER', 'def');
  padAt(0, GYM_H - 2.0, 0x35e0a1, 'CHALLENGES', 'ch');
  // the challenge spot markers (hidden until a challenge runs)
  const mk = (r0, r1, col) => { const m = new T.Mesh(new T.RingGeometry(r0, r1, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; m.visible = false; arena.add(m); return m; };
  for (const c of [0xffc533, 0x35e0a1]) { const lab = gymLabel('', css(c), 2.4); lab.visible = false; arena.add(lab); GYM.spots.push({ ring: mk(0.7, 0.9, c), ring2: mk(0.75, 0.82, 0xffffff), label: lab }); }
  GYM.mat2 = ballMat.clone(); GYM.ball2 = new T.Mesh(gymBallG(), GYM.mat2); GYM.ball2.visible = false; arena.add(GYM.ball2); GYM.shadow2 = makeShadow(0.5); GYM.shadow2.visible = false; arena.add(GYM.shadow2);
}
let _gymBallG = null; function gymBallG() { return _gymBallG || (_gymBallG = new T.SphereGeometry(BALL_R * 1.02, 12, 9)); }
function gymBoardDraw(a, b, t, na, nb) {
  const key = a + '|' + b + '|' + t + '|' + na + '|' + nb; if (key === GYM.lastSb) return; GYM.lastSb = key;
  const c = GYM.boardC, g = c.getContext('2d'); g.fillStyle = '#0d1016'; g.fillRect(0, 0, 512, 192);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 30px Anton, Impact, sans-serif'; g.fillStyle = '#9aa4c2'; g.fillText(na, 110, 40); g.fillText(nb, 402, 40); g.fillText('TIME', 256, 40);
  g.font = '700 86px Anton, Impact, sans-serif'; g.fillStyle = '#ff4d2a'; g.fillText(a, 110, 118); g.fillText(b, 402, 118); g.fillStyle = '#ffc533'; g.font = '700 64px Anton, Impact, sans-serif'; g.fillText(t, 256, 118);
  g.fillStyle = '#2a3250'; g.fillRect(0, 170, 512, 22); g.fillStyle = '#e8b53c'; g.font = '700 16px Anton, Impact, sans-serif'; g.fillText('HOOP DREAMS · THE GYM', 256, 181);
  GYM.boardTex.needsUpdate = true;
}
const gymClock = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

/* ---- lanes: every human has a lane of their own: a ball, a basket, their own defender and rebounder, their own challenge and their own camera.
   The engine has one live ball (B) and one possession (S.poss), so the lane being processed is swapped into B, S.poss and the attack directions (gymUse). ---- */
const GYM_BK = ['state', 'owner', 'last', 'lastTeam', 'shot', 'pass', 'lock', 'dPhase', 'fireT', 'dBounced'];
function gymBallRec() { const r = { pos: new T.Vector3(0, 1, 0), vel: new T.Vector3(), poss: 0, atk: 1 }; for (const k of GYM_BK) r[k] = null; r.state = 'dead'; r.lastTeam = r.lock = r.dPhase = r.fireT = 0; r.dBounced = false; return r; }
function gymSaveCtx(L) { const r = L.bs; r.pos.copy(B.pos); r.vel.copy(B.vel); for (const k of GYM_BK) r[k] = B[k]; r.poss = S.poss; r.atk = S.teams[0].atk; }
function gymLoadCtx(L) { const r = L.bs; S.teams[0].players = L.pl[0]; S.teams[1].players = L.pl[1]; B.pos.copy(r.pos); B.vel.copy(r.vel); for (const k of GYM_BK) B[k] = r[k]; S.poss = r.poss; S.teams[0].atk = r.atk; S.teams[1].atk = -r.atk; }
function gymUse(i) { if (GYM.cur === i) return; if (GYM.cur >= 0) gymSaveCtx(GYM.lanes[GYM.cur]); GYM.cur = i; gymLoadCtx(GYM.lanes[i]); }
function gymWith(i, fn) { const old = GYM.cur; gymUse(i); const r = fn(); if (old >= 0) gymUse(old); return r; }
const gymLanePl = L => S.players.filter(p => p.lane === L.id);

/* ---- session ---- */
function gymHudBuild() {
  const hud = $('hud'), d = document.createElement('div'); d.id = 'gdiv'; hud.appendChild(d); GYM.hudEls.push(d);
  GYM.lanes.forEach((L, i) => { const g = document.createElement('div'); g.className = 'gl'; g.style.left = (i * 50) + '%'; g.innerHTML = '<div></div><div></div><div></div>'; hud.appendChild(g); GYM.hudEls.push(g); L.el = { banner: g.children[0], toast: g.children[1], hint: g.children[2] }; });
}
function gymHudClear() { for (const e of GYM.hudEls) e.remove(); GYM.hudEls = []; }
function gymStart() {
  gymHudClear(); GYM.on = true; GYM.t = 0; GYM.cur = -1; GYM.snap = true; GYM.strays = [];
  S.live = true; S.countT = 0; S.dead = 0; S.finish = false; S.shotClock = 24; S.poss = 0; CFG.diff = 1;
  const t0 = S.teams[0]; GYM.split = S.humans.length > 1;
  GYM.lanes = S.humans.map((h, i) => { const p = h.p; p.lane = i; return { id: i, h, p, bs: gymBallRec(), npc: null, reb: null, ch: null, lvl: clamp(CFG.gymLvl | 0, 0, 3), pad: null, result: '', resultT: 0, grabT: 0, npcScore: 0, sT: 0, bannerT: 0, bannerTxt: '', tipT: 14 + i * 4, tipI: i * 3, hintT: 0, hintTxt: '', glide: null, el: null, pl: [[p], []], sp: GYM.spots[i], view: null }; });
  t0.players.forEach((p, i) => { const sp = GYM.split ? (i ? [3.5, 6.4] : [-3.5, 6.4]) : [1.8, 5.2]; p.x = sp[0]; p.z = sp[1]; p.face = GYM.split && !i ? -Math.PI / 2 : Math.PI / 2; p.lookX = p.face > 0 ? 12.7 : -12.7; p.lookZ = 0; p.vx = p.vz = 0; p.y = 0; p.act = ''; p.lane = i; });
  GYM.lanes.forEach((L, i) => { const p = L.p; L.view = { cam: i === 0 ? cam : new T.PerspectiveCamera(46, 16 / 9, 0.5, 260), x: 0, y: 0, w: 1280, h: 720, dir: p.face > 0 ? 1 : -1, mapDir: 0, yaw: 0, cx: p.x, cz: p.z, map: '2k', lx: 0, ly: 0, lm: 0, hf: hoops.map(() => 1) }; L.view.mapDir = L.view.dir; L.view.yaw = L.view.dir > 0 ? 0 : Math.PI; L.bs.atk = L.view.dir; });
  if (GYM.split) gymHudBuild();
  const chipA = $('tmA').querySelector('.chip'), chipB = $('tmB').querySelector('.chip'); chipA.style.background = '#ff4d5e'; chipB.style.background = GYM.split ? '#35e0a1' : '#3b4a5c';
  GYM.lanes.forEach(L => { gymUse(L.id); const p = L.p; B.pos.set(p.x, 1, p.z); giveBall(p, 'rack'); B.lock = 0; S.poss = 0; banner('THE GYM'); toast(GYM.split ? 'YOUR OWN BALL · YOUR OWN SCREEN' : 'SHOOT AROUND · RACKS AND PADS ON THE SIDES'); hint(''); });
  gymUse(0); gymCams(0.016); GYM.snap = true; gymCams(0.016);
  Snd.squeak(1.4); setTimeout(() => Snd.squeak(1.2), 180);
}
function gymStop() { GYM.on = false; GYM.lanes = []; GYM.cur = -1; GYM.split = false; GYM.strays = []; gymHudClear(); if (GYM.floorMat) GYM.floorMat.uniforms.kRef.value = 0; resize(); }
const gymCanTake = () => !B.owner && B.state !== 'pass' && !(B.state === 'shot' && B.shot && !B.shot.scored && !B.shot.missed);
// a ball left behind stays on the floor as a stray that anyone with empty hands can pick up (the oldest is cleared past seven)
function gymStray(x, z) {
  if (Math.abs(x) > GYM_W - 0.3 || Math.abs(z) > GYM_H - 0.3) return;
  const m = new T.Mesh(gymBallG(), ballMat); m.position.set(x, BALL_R, z); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); const sh = makeShadow(0.5); sh.position.set(x, 0.013, z);
  arena.add(m); arena.add(sh); GYM.strays.push({ x, z, m, sh });
  if (GYM.strays.length > 7) { const s = GYM.strays.shift(); arena.remove(s.m); arena.remove(s.sh); }
}
function gymTake(L, p, x, z, how) {
  if (B.state !== 'dead' && !B.owner && B.state !== 'pass') gymStray(B.pos.x, B.pos.z);
  B.pos.set(x, 1.0, z); B.vel.set(0, 0, 0); giveBall(p, how || 'rack'); B.lock = 0; B.shot = null; B.pass = null; S.dead = 0; S.poss = 0;
  Snd.catch_(); L.grabT = 0.35; p.catchLock = 0;
}
function gymHuman(L, dt) {
  const p = L.p, I = INP[L.id], eat = () => { I.xP = I.oP = I.tP = I.shootP = false; I.shoot = false; };
  if (L.glide) { eat(); return; }
  // racks and strays: walk over with empty hands
  if (L.grabT <= 0 && gymCanTake() && B.owner !== p && (p.act === '' || p.act === 'land') && !L.ch) {
    for (const r of GYM.racks) if (d2(p.x, p.z, r.x, r.z) < 1.3) { gymTake(L, p, r.x, r.z, 'rack'); gymRackPull(r); return; }
    for (let i = 0; i < GYM.strays.length; i++) { const s = GYM.strays[i]; if (d2(p.x, p.z, s.x, s.z) < 0.7) { GYM.strays.splice(i, 1); arena.remove(s.m); arena.remove(s.sh); gymTake(L, p, s.x, s.z, 'pick'); return; } }
  }
  // station pads: the buttons work the station while you stand on it
  let on = null; for (const pd of GYM.pads) if (d2(p.x, p.z, pd.x, pd.z) < 1.35) on = pd;
  L.pad = on; if (!on) return;
  if (on.kind === 'def') {
    if (I.oP) { L.lvl = (L.lvl + 1) % 4; CFG.gymLvl = L.lvl; Snd.tick(); toast('DEFENDER LEVEL · ' + GYM_LVLS[L.lvl].toUpperCase()); eat(); }
    else if (I.xP) { gymSpawnDef(L, L.lvl); eat(); }
    else if (I.tP) { if (L.npc) { toast(L.npc.short.toUpperCase() + ' WENT HOME'); gymRemove(L.npc); } else toast('NOBODY TO SEND HOME'); eat(); }
    else if (I.shootP) { if (L.reb) { toast('REBOUNDER OUT'); gymRemove(L.reb); } else gymSpawnReb(L); eat(); }
  } else if (on.kind === 'ch') {
    if (L.ch) { if (I.oP) { gymEndCh(L, true); eat(); } }
    else if (I.xP) { gymStartCh(L, 'tp'); eat(); } else if (I.oP) { gymStartCh(L, 'atw'); eat(); } else if (I.tP) { gymStartCh(L, 'hot'); eat(); }
  }
}
function gymRackPull(r) { const b = r.balls.find(x => x.visible); if (b) { b.visible = false; r.refill.push({ b, t: 6 + rnd(0, 3) }); } }
// a challenge or a spawn moves you by walking, never by teleporting: the lane takes the stick for a moment and jogs you to the spot
function gymGlide(L, dt) {
  const g = L.glide, p = L.p; g.t += dt; const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.4 || g.t > 4.5) { L.glide = null; p.wx = p.wz = 0; if (L.ch) { p.lookX = L.ch.H.x; p.lookZ = 0; } return; }
  const k = Math.min(1, d / 1.6); p.wx = dx / d * k; p.wz = dz / d * k; p.sprint = d > 3; p.lookX = L.ch ? L.ch.H.x : p.lookX; p.lookZ = 0;
}

/* ---- NPCs: a defender at one of four levels, or a rebounder who feeds you ---- */
function gymSpawnDef(L, lvl) {
  if (L.npc) gymRemove(L.npc);
  const used = new Set(S.players.map(p => p.pl.id)), pool = POOL.filter(q => !used.has(q.id));
  const want = lvl === 0 ? pool.filter(q => q.ovr < 88) : lvl === 1 ? pool.filter(q => q.ovr >= 86 && q.ovr < 94) : lvl === 2 ? pool.filter(q => q.ovr >= 92 && q.ovr < 98) : pool.filter(q => q.ovr >= 97);
  const pl = pick(want.length ? want : pool), t1 = S.teams[1];
  const p = makePlayer(t1, 0, pl); p.gymRole = 'def'; p.gymLvl = lvl; p.lane = L.id;
  if (lvl === 0) { p.rat.spd -= 0.5; p.rat.def *= 0.75; p.rat.reb *= 0.8; }
  if (lvl === 3) { p.rat.def = 1; p.rat.spd += 0.55; p.rat.reb = Math.min(1.2, p.rat.reb + 0.25); p.rat.three = Math.min(1, p.rat.three + 0.12); p.rat.inside = Math.min(1, p.rat.inside + 0.12); p.rat.handle = 1; }
  t1.players.push(p); S.players.push(p); makeTag(p, GYM_LVLS[lvl].toUpperCase());
  const h = L.p, H = hoopOf(S.teams[0]); p.x = clamp(h.x + (H.x - h.x) * 0.45, -HALF_L + 1, HALF_L - 1); p.z = clamp(h.z * 0.5, -5, 5); p.face = Math.atan2(h.x - p.x, h.z - p.z); p.hold = 0.7;
  L.npc = p; L.npcScore = 0;
  banner(p.short.toUpperCase() + ' CHECKS IN'); toast(GYM_LVLS[lvl].toUpperCase() + ' DEFENDER · SCORE ON HIM'); Snd.whistle(); Snd.squeak(1.3);
  burst(p.x, 1.0, p.z, 28, 3, 1, [[1, 1, 1], [1, 0.8, 0.5]], 0.6, 0.3, -2);
}
function gymSpawnReb(L) {
  const used = new Set(S.players.map(p => p.pl.id)), pool = POOL.filter(q => !used.has(q.id) && q.role !== 'G');
  const pl = pick(pool.length ? pool : POOL), t0 = S.teams[0];
  const p = makePlayer(t0, t0.players.length, pl); p.gymRole = 'reb'; p.lane = L.id; p.rebT = 0; p.rat.spd = Math.max(p.rat.spd, 6.4);
  t0.players.push(p); S.players.push(p); makeTag(p, 'REB');
  const H = hoopOf(t0); p.x = H.x - H.dir * 1.6; p.z = 1.5; p.face = -Math.PI / 2 * H.dir; L.reb = p;
  toast('REBOUNDER IN · HE FEEDS YOU THE BALL'); Snd.whistle();
}
function gymRemove(p) {
  if (!p || p.gone) return;
  if (GYM.cur !== p.lane) return gymWith(p.lane, () => gymRemove(p));
  const L = GYM.lanes[p.lane];
  if (B.owner === p) { B.owner = null; B.state = 'loose'; B.pos.set(p.x, 0.5, p.z); B.vel.set(0, 0.5, 0); B.lock = 0; }
  if (B.pass && (B.pass.tgt === p || B.pass.by === p)) { B.pass = null; B.state = 'loose'; B.vel.set(0, 1, 0); B.lock = 0.1; }
  scene.remove(p.m.root); scene.remove(p.shadow); if (p.tag) { p.tag.remove(); p.tag = null; }
  const ti = p.team.players.indexOf(p); if (ti >= 0) p.team.players.splice(ti, 1); const si = S.players.indexOf(p); if (si >= 0) S.players.splice(si, 1);
  for (const h of S.humans) if (h.txtP === p) h.txtP = null; if (S.callFor === p) S.callFor = null; if (S.lastScorer === p) S.lastScorer = L.p;
  if (L.npc === p) { L.npc = null; L.npcScore = 0; } if (L.reb === p) L.reb = null;
  S.poss = 0; p.gone = true;
}
function gymNpcAI(p, dt) {
  const L = GYM.lanes[p.lane], hum = L.p; p.idx = Math.max(0, S.teams[0].players.indexOf(hum));
  // he guards his lane's player and waits at the top of the key while that player is off the floor
  const off = Math.abs(hum.x) > HALF_L + 0.3 || Math.abs(hum.z) > HALF_W + 0.3;
  if (off && B.owner !== p && p.act === '') { const H = hoopOf(S.teams[0]); p.sprint = false; moveTo(p, H.x - H.dir * 5.2, 0, false); p.lookX = hum.x; p.lookZ = hum.z; p.aiT = 0.3; return; }
  aiUpdate(p, dt);
}
function gymRebAI(p, dt) {
  p.sprint = false; p.protect = false; if (p.act !== '' || p.stun > 0 || p.hold > 0) { p.wx = p.wz = 0; return; }
  const L = GYM.lanes[p.lane], hum = L.p, H = hoopOf(p.team);
  if (B.owner === p) {
    p.rebT += dt; p.wx = p.wz = 0; p.lookX = hum.x; p.lookZ = hum.z;
    if (p.rebT > 0.45 && (hum.act === '' || hum.act === 'land') && hum.catchLock <= 0) { const d = d2(p.x, p.z, hum.x, hum.z); if (d > 1.4) { doPass(p, hum, d > 9 ? 'lob' : 'chest'); callOut(p, 'nice'); } p.rebT = 0.1; }
    return;
  }
  p.rebT = 0;
  if (!B.owner && (B.state === 'loose' || B.state === 'shot') && !(B.shot && B.shot.scored && B.lock > 90)) {
    if (B.state === 'shot' && B.shot && !B.shot.touched && !B.shot.missed && !B.shot.scored) { moveTo(p, H.x - H.dir * 1.3, (p.z >= 0 ? 1 : -1) * 1.5, true); }
    else { const tx = B.pos.x + B.vel.x * 0.35, tz = B.pos.z + B.vel.z * 0.35; const d = moveTo(p, tx, tz, true); if (B.pos.y > 1.8 && B.pos.y < 3.4 && d < 2.0 && p.jumpT <= 0) p.jumpT = 0.5; }
    p.lookX = B.pos.x; p.lookZ = B.pos.z; return;
  }
  const side = hum.z >= 0 ? -1 : 1; moveTo(p, H.x - H.dir * 1.1, side * 1.7, false); p.lookX = hum.x; p.lookZ = hum.z;
}

/* ---- challenges ---- */
const GYM_CH = { tp: { name: '3PT CONTEST', limit: 60 }, atw: { name: 'AROUND THE WORLD', limit: 0 }, hot: { name: 'HOT SPOTS', limit: 45 } };
function gymSpot(H, dist, ang) { return [H.x - H.dir * dist * Math.cos(ang), dist * Math.sin(ang)]; }
function gymStartCh(L, kind) {
  if (L.ch) return; const t0 = S.teams[0], p = L.p, H = hoopOf(t0);
  const ch = { kind, name: GYM_CH[kind].name, limit: GYM_CH[kind].limit, t: 0, score: 0, shots: 0, made: 0, i: 0, spots: [], H, pending: null, last: null, ok: false, streak: 0, balls: 25, ballN: 0, cur: null, done: false };
  if (kind === 'tp') { const a = 0.82, c = Math.sqrt(ARC * ARC - CORNER * CORNER) - 0.35; ch.spots = [[H.x - H.dir * c, -CORNER - 0.3], gymSpot(H, ARC + 0.35, -a), gymSpot(H, ARC + 0.35, 0), gymSpot(H, ARC + 0.35, a), [H.x - H.dir * c, CORNER + 0.3]]; }
  else if (kind === 'atw') { for (let i = 0; i < 7; i++) ch.spots.push(gymSpot(H, 5.1, -1.25 + i * 2.5 / 6)); }
  else { ch.pool = []; for (const a of [-1.05, -0.35, 0.35, 1.05]) ch.pool.push(gymSpot(H, 4.9, a)); for (const a of [-1.15, -0.6, 0, 0.6, 1.15]) ch.pool.push(gymSpot(H, ARC + 0.3, a)); ch.cur = pick(ch.pool); }
  L.ch = ch; const sp = gymChSpot(L);
  if (L.npc && B.owner === L.npc) { B.owner = null; B.state = 'loose'; }
  p.act = ''; p.y = 0; gymTake(L, p, p.x, p.z, 'rack'); L.grabT = 0;
  L.glide = { x: sp[0], z: sp[1], t: 0 }; // you jog to the first spot, the clock starts when you get there
  banner(ch.name); toast(kind === 'tp' ? '5 RACKS OF 5 · LAST BALL IS MONEY · 60 S' : kind === 'atw' ? '7 SPOTS · MAKE IT TO MOVE ON' : 'HIT THE LIT SPOT · 45 S'); Snd.whistle();
}
function gymChSpot(L) { const ch = L.ch; if (!ch) return null; return ch.kind === 'hot' ? ch.cur : ch.spots[Math.min(ch.i, ch.spots.length - 1)]; }
function gymChTick(L, dt) {
  if (L.glide) return;
  const ch = L.ch, p = L.p, sp = gymChSpot(L); if (!p || !sp) return;
  ch.t += dt; if (ch.limit && ch.t >= ch.limit) { gymEndCh(L, false); return; }
  if (!ch.pending && B.state === 'shot' && B.shot && B.shot.by === p && B.shot !== ch.last) { ch.pending = B.shot; ch.last = B.shot; ch.ok = d2(p.x, p.z, sp[0], sp[1]) < 1.6 && ch.H.dir === hoopOf(p.team).dir; }
  if (ch.pending && (ch.pending.scored || ch.pending.missed || B.shot !== ch.pending)) { const made = !!ch.pending.scored; ch.pending = null; if (ch.ok) gymChShot(L, made); else toast('SHOOT FROM THE SPOT'); if (!L.ch) return; }
  // the ball boy: a fresh ball waits at the spot
  const sp2 = gymChSpot(L); if (!ch.pending && gymCanTake() && B.owner !== p && (p.act === '' || p.act === 'land') && d2(p.x, p.z, sp2[0], sp2[1]) < 1.6 && !(ch.kind === 'tp' && ch.balls <= 0)) gymTake(L, p, sp2[0], sp2[1], 'rack');
}
function gymChShot(L, made) {
  const ch = L.ch;
  if (ch.kind === 'tp') {
    ch.ballN++; ch.balls--; ch.shots++; const money = ch.ballN === 5;
    if (made) { ch.score += money ? 2 : 1; ch.made++; toast(money ? 'MONEY BALL · +2' : '+1 · ' + ch.score); } else if (money) toast('MONEY BALL MISSED');
    if (ch.ballN >= 5) { ch.ballN = 0; ch.i++; if (ch.i >= 5) { gymEndCh(L, false); return; } toast('NEXT RACK'); Snd.tick(); }
  } else if (ch.kind === 'atw') {
    ch.shots++;
    if (made) { ch.i++; ch.made++; if (ch.i >= 7) { ch.done = true; gymEndCh(L, false); return; } toast('SPOT ' + (ch.i + 1) + ' OF 7'); Snd.tick(); } else toast('STAY ON IT');
  } else {
    ch.shots++; const three = isThree(ch.cur[0], ch.cur[1], ch.H);
    if (made) { let pts = three ? 3 : 2; ch.streak++; ch.made++; if (ch.streak >= 3) { pts += 1; toast('HEAT CHECK · +' + pts); } else toast('+' + pts + ' · ' + (ch.score + pts)); ch.score += pts; }
    else { ch.streak = 0; }
    let n = ch.cur; while (n === ch.cur) n = pick(ch.pool); ch.cur = n; Snd.tick();
  }
}
function gymEndCh(L, cancel) {
  const ch = L.ch; if (!ch) return; L.ch = null; L.glide = null; L.sp.ring.visible = L.sp.ring2.visible = L.sp.label.visible = false;
  if (cancel) { banner('CALLED OFF'); toast(''); L.result = ''; return; }
  let res = '', rec = false, b = GYM.best;
  if (ch.kind === 'tp') { res = ch.name + ' · ' + ch.score + ' PTS (' + ch.made + ' OF ' + ch.shots + ')'; if (!(b.tp >= ch.score)) { rec = ch.score > 0; b.tp = ch.score; } res += ' · BEST ' + b.tp; }
  else if (ch.kind === 'atw') { if (ch.done) { res = 'AROUND THE WORLD · ' + ch.shots + ' SHOTS · ' + gymClock(ch.t); if (!(b.atw <= ch.shots)) { rec = true; b.atw = ch.shots; } res += ' · BEST ' + b.atw + ' SHOTS'; } else res = 'AROUND THE WORLD · ' + ch.i + ' OF 7'; }
  else { res = ch.name + ' · ' + ch.score + ' PTS (' + ch.made + ' OF ' + ch.shots + ')'; if (!(b.hot >= ch.score)) { rec = ch.score > 0; b.hot = ch.score; } res += ' · BEST ' + b.hot; }
  gymSave(); L.result = res; L.resultT = 9; Snd.buzzer(); banner(ch.kind === 'atw' && ch.done ? 'DONE!' : 'TIME!');
  if (rec) { L.bannerT = 1.5; L.bannerTxt = 'NEW RECORD!'; Snd.cheer(0.9, 2.5); burst(L.p.x, 1, L.p.z, 60, 5, 1, [[1, 0.85, 0.3], [1, 1, 1]], 0.9, 0.6, 2); Com.say('fire', L.p.short, 2, 0); }
  else Snd.cheer(0.4, 1.4);
}

/* ---- per frame: players first (inputs, stations, AI, movement), then balls (physics, scoring, animation), lane by lane ---- */
function gymLane(L, dt) {
  const p = L.p, t0 = S.teams[0], t1 = S.teams[1];
  if (L.grabT > 0) L.grabT -= dt; if (L.resultT > 0) L.resultT -= dt;
  if (L.bannerT > 0) { L.bannerT -= dt; if (L.bannerT <= 0) banner(L.bannerTxt, true); }
  // the basket you shoot at is the end you stand at (both ends are live); a challenge pins it
  // his defender is not tied to one court: whoever he takes the ball from, he shoots at the end he is standing at, and the camera only follows you
  const nb = !!L.npc && B.owner === L.npc;
  if (nb && !L.npcHad) { const n = L.npc; L.npcHad = true; const d = Math.abs(n.x) > 1 ? (n.x > 0 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1); t1.atk = d; t0.atk = -d; } else if (!nb) L.npcHad = false;
  if (!L.ch && !nb && Math.abs(p.x) > 1.0) { const d = p.x > 0 ? 1 : -1; if (d !== t0.atk) { t0.atk = d; t1.atk = -d; } }
  if (L.ch && t0.atk !== L.ch.H.dir) { t0.atk = L.ch.H.dir; t1.atk = -t0.atk; }
  gymHuman(L, dt);
  if (L.ch) gymChTick(L, dt);
  if (p.streak >= 4 && p.streak > (GYM.best.streak || 0)) { GYM.best.streak = p.streak; gymSave(); toast('STREAK RECORD · ' + p.streak + ' IN A ROW'); }
  if (!L.ch && !L.pad) { L.tipT -= dt; if (L.tipT <= 0) { L.tipT = 26 + rnd(0, 10); L.hintT = 5; L.hintTxt = GYM_TIPS[L.tipI++ % GYM_TIPS.length]; } }
  if (L.hintT > 0) L.hintT -= dt;
  hint(gymHint(L));
}
function gymPlayers(dt) {
  GYM.t += dt;
  for (const L of GYM.lanes) {
    gymUse(L.id); gymLane(L, dt); humanUpdate(L.h, dt); if (L.glide) gymGlide(L, dt);
    const ps = gymLanePl(L);
    for (const p of ps) { if (p.hold > 0) { p.wx = p.wz = 0; } if (!p.ctrl) { if (p.gymRole === 'reb') gymRebAI(p, dt); else if (p.gymRole) gymNpcAI(p, dt); else aiUpdate(p, dt); } }
    for (const p of ps) movePlayer(p, dt);
  }
}
function gymBalls(dt) {
  const t1 = S.teams[1];
  for (const L of GYM.lanes) {
    gymUse(L.id);
    const s0 = t1.score; updateBall(dt);
    if (t1.score > s0) { L.npcScore += t1.score - s0; toast('HE SCORED ON YOU'); Snd.ooh(1); }
    // a made shot is over once it has dropped through: the ball is free again
    if (B.shot && B.shot.scored) { L.sT += dt; if (L.sT > 0.9 && B.state !== 'held') { if (B.state === 'shot') B.state = 'loose'; B.shot = null; B.lock = 0; L.sT = 0; } } else L.sT = 0;
    for (const p of gymLanePl(L)) { emberFx(p, dt); animatePlayer(p, dt); }
  }
  gymUse(0); gymShared(dt);
}
function gymShared(dt) {
  const tt = performance.now() * 0.001, ls = GYM.lanes;
  for (const r of GYM.racks) { for (let i = r.refill.length - 1; i >= 0; i--) { const f = r.refill[i]; f.t -= dt; if (f.t <= 0) { f.b.visible = true; r.refill.splice(i, 1); } } r.label.position.y = 1.75 + Math.sin(tt * 1.6 + 1) * 0.05; }
  for (const pd of GYM.pads) { const near = ls.some(L => L.pad === pd); pd.ring.material.opacity = near ? 0.75 + 0.25 * Math.sin(tt * 8) : 0.55 + 0.2 * Math.sin(tt * 2.5); pd.ring.scale.setScalar(near ? 1.04 + 0.04 * Math.sin(tt * 8) : 1); pd.disc.material.opacity = near ? 0.32 : 0.16; pd.label.position.y = 2.1 + Math.sin(tt * 1.6) * 0.06; }
  for (const L of ls) {
    const sp = L.sp, ch = L.ch; if (!sp) continue;
    if (!ch) { sp.ring.visible = sp.ring2.visible = sp.label.visible = false; continue; }
    const c = gymChSpot(L); sp.ring.visible = sp.label.visible = true;
    sp.ring.position.set(c[0], 0.03, c[1]); sp.ring.scale.setScalar(1 + 0.08 * Math.sin(tt * 6)); sp.ring.material.opacity = 0.7 + 0.3 * Math.sin(tt * 6);
    const nx = ch.kind === 'tp' && ch.i < 4 ? ch.spots[ch.i + 1] : ch.kind === 'atw' && ch.i < 6 ? ch.spots[ch.i + 1] : null;
    sp.ring2.visible = !!nx; if (nx) { sp.ring2.position.set(nx[0], 0.03, nx[1]); sp.ring2.material.opacity = 0.35; }
    sp.label.position.set(c[0], 1.9 + Math.sin(tt * 2) * 0.05, c[1]);
    gymLabelSet(sp.label, ch.kind === 'tp' ? (5 - ch.ballN) + (5 - ch.ballN === 1 ? ' BALL · MONEY' : ' BALLS') : ch.kind === 'atw' ? 'SPOT ' + (ch.i + 1) + ' OF 7' : (isThree(c[0], c[1], ch.H) ? '3 POINTS' : '2 POINTS'));
  }
  GYM.boardT -= dt;
  if (GYM.boardT <= 0 && ls.length) {
    GYM.boardT = 0.5; const L0 = ls[0], L1 = ls[1], ch = L0.ch, sn = x => x.short.toUpperCase().slice(0, 6);
    gymBoardDraw(String(L0.p.stats.pts), String(L1 ? L1.p.stats.pts : L0.npcScore), ch && ch.limit && !L1 ? gymClock(ch.limit - ch.t) : gymClock(GYM.t), sn(L0.p), L1 ? sn(L1.p) : L0.npc ? sn(L0.npc) : 'GYM');
  }
}
const G_B = (c, t) => '<span class="k ' + c + '">' + t + '</span>';
function gymHint(L) {
  const pd = L.pad, p = L.p, best = GYM.best;
  if (pd && pd.kind === 'def') {
    const l = GYM_LVLS[L.lvl].toUpperCase();
    return G_B('x', '✕') + ' SPAWN ' + l + ' &nbsp; ' + G_B('o', '◯') + ' LEVEL &nbsp; ' + (L.npc ? G_B('t', '△') + ' SEND HOME &nbsp; ' : '') + G_B('s', '□') + (L.reb ? ' REBOUNDER OUT' : ' REBOUNDER');
  }
  if (pd && pd.kind === 'ch') {
    if (L.ch) return G_B('o', '◯') + ' CALL OFF ' + L.ch.name;
    return G_B('x', '✕') + ' 3PT CONTEST' + (best.tp ? ' <b>' + best.tp + '</b>' : '') + ' &nbsp; ' + G_B('o', '◯') + ' AROUND THE WORLD' + (best.atw ? ' <b>' + best.atw + '</b>' : '') + ' &nbsp; ' + G_B('t', '△') + ' HOT SPOTS' + (best.hot ? ' <b>' + best.hot + '</b>' : '');
  }
  const ch = L.ch;
  if (ch) {
    const sp = gymChSpot(L), far = p && d2(p.x, p.z, sp[0], sp[1]) > 1.6;
    if (ch.kind === 'tp') return (far ? 'GET TO THE LIT SPOT · ' : '') + 'RACK ' + (ch.i + 1) + ' OF 5 · ' + ch.score + ' PTS';
    if (ch.kind === 'atw') return (far ? 'GET TO THE LIT SPOT · ' : '') + 'SPOT ' + (ch.i + 1) + ' OF 7 · ' + ch.shots + ' SHOTS';
    return (far ? 'GET TO THE LIT SPOT · ' : '') + ch.score + ' PTS' + (ch.streak >= 2 ? ' · ' + ch.streak + ' IN A ROW' : '');
  }
  if (L.resultT > 0 && L.result) return L.result;
  if (L.npc && B.owner === L.npc) return 'HE HAS THE BALL · ' + G_B('s', '□') + ' REACH &nbsp; ' + G_B('t', '△') + ' BLOCK';
  if (L.hintT > 0) return L.hintTxt || '';
  return '';
}
function gymAfterScore() { B.lock = 0; B.shot = null; }
function gymHud() {
  const ls = GYM.lanes; if (!ls.length) return; const L0 = ls[0], L1 = ls[1];
  const a = $('tmA').querySelector('.pts'), b = $('tmB').querySelector('.pts'), ab = $('tmA').querySelector('.abbr'), bb = $('tmB').querySelector('.abbr');
  const na = L0.p.short.toUpperCase().slice(0, 7), nb = L1 ? L1.p.short.toUpperCase().slice(0, 7) : L0.npc ? L0.npc.short.toUpperCase().slice(0, 7) : 'GYM';
  const pa = String(L0.p.stats.pts), pb = String(L1 ? L1.p.stats.pts : L0.npcScore);
  if (ab.textContent !== na) ab.textContent = na; if (bb.textContent !== nb) bb.textContent = nb; if (a.textContent !== pa) a.textContent = pa; if (b.textContent !== pb) b.textContent = pb;
  const clk = document.querySelector('#score .clk'), sub = document.querySelector('#score .sub'), ch = L0.ch;
  const t = !L1 && ch && ch.limit ? gymClock(ch.limit - ch.t) : gymClock(GYM.t); if (clk.textContent !== t) clk.textContent = t;
  let l; const st = p => 'FG ' + p.stats.fg + '/' + p.stats.fga;
  if (L1) l = st(L0.p) + ' · ' + st(L1.p);
  else if (ch) l = ch.name + (ch.kind === 'tp' ? ' · ' + ch.balls + ' BALLS' : ch.kind === 'atw' ? ' · ' + gymClock(ch.t) : ' · ' + ch.score + ' PTS');
  else { const p = L0.p; l = st(p) + ' · STREAK ' + p.streak + ' · BEST ' + Math.max(p.stats.best, GYM.best.streak || 0); }
  if (_hc.sub !== l) { _hc.sub = l; sub.textContent = l; } sub.style.fontSize = '';
}
// the second player's ball, and the ceiling only shows while the camera is under it
function gymFx(dt) {
  const b = GYM.ball2, s = GYM.shadow2, L1 = GYM.lanes[1]; if (!b) return;
  b.visible = s.visible = !!L1; if (!L1) return;
  const r = L1.bs; b.position.copy(r.pos); b.rotation.x += r.vel.z * dt * 3 + dt; b.rotation.z -= r.vel.x * dt * 3;
  const fire = r.fireT > 0 || (r.owner && r.owner.fire); GYM.mat2.emissive.setHex(fire ? 0xff5a10 : 0);
  s.position.set(r.pos.x, 0.013, r.pos.z); const bs = 0.5 * (1 - Math.min(0.6, r.pos.y * 0.12)); s.scale.set(bs, bs, 1);
}

/* ---- cameras: one per lane, split screen with two players. Nothing snaps: the 2K view swings slowly round to the other basket once you are well past
   the middle, and a held stick keeps its direction until you let go or reverse (so a long run across the gym never turns you around). ---- */
function gymLayout() {
  const W = canvas.clientWidth || innerWidth, Hh = canvas.clientHeight || innerHeight, n = GYM.lanes.length, w = n > 1 ? Math.floor(W / 2) : W;
  GYM.lanes.forEach((L, i) => { const V = L.view; if (!V) return; V.x = i * w; V.y = 0; V.w = i === n - 1 ? W - i * w : w; V.h = Hh; });
}
function gymSetFov(C, f, asp) { if (C.fov !== f || C.aspect !== asp) { C.fov = f; C.aspect = asp; C.updateProjectionMatrix(); } }
function gymHoopK(h, C) { // ghost a backboard that is right in front of the lens
  C.getWorldDirection(_gv1); const dx = h.x + h.dir * 0.6 - C.position.x, dy = 3.4 - C.position.y, dz = -C.position.z, dist = Math.hypot(dx, dy, dz);
  return dist < 8.5 && (dx * _gv1.x + dy * _gv1.y + dz * _gv1.z) / dist > 0.5 ? 0.15 : 1;
}
function gymViewCam(L, dt, snap) {
  const V = L.view, p = L.p, C = V.cam, asp = V.w / V.h, mode = CFG.cam === 'drone' ? 'drone' : (CFG.cam === '2k' || CFG.cam === 'fp') ? '2k' : 'side';
  V.map = mode === '2k' ? '2k' : 'screen'; const sk = CAMS.shake * CAMS.shake;
  if (mode === '2k') {
    if (V.dir > 0 && p.x < -3.2) V.dir = -1; else if (V.dir < 0 && p.x > 3.2) V.dir = 1;
    const ty = V.dir > 0 ? 0 : Math.PI; V.yaw = snap ? ty : V.yaw + angDiff(V.yaw, ty) * (1 - Math.exp(-2.8 * dt));
    gymSetFov(C, asp < 1.15 ? 58 : 46, asp);
    const ax = p.x + clamp(p.vx * 0.3, -1.5, 1.5), az = p.z;
    V.cx = snap ? ax : damp(V.cx, ax, 3.4, dt); V.cz = snap ? az : damp(V.cz, az, 3, dt);
    const ahead = 5.5, back = asp < 1.15 ? 10.5 : 9.6, fx = Math.cos(V.yaw), fz = Math.sin(V.yaw);
    const px = clamp(V.cx - fx * back, -GYM_W + 0.9, GYM_W - 0.9), pz = clamp(V.cz * 0.55 - fz * back, -GYM_H + 0.9, GYM_H - 0.9);
    C.position.set(px + (Math.random() - 0.5) * sk * 0.5, 6 + (Math.random() - 0.5) * sk * 0.4, pz);
    C.lookAt(V.cx + fx * ahead, 1.1, V.cz * 0.35 + fz * ahead);
  } else if (mode === 'drone') {
    gymSetFov(C, asp < 1.15 ? 56 : 44, asp);
    const ax = clamp(p.x, -9, 9), az = p.z * 0.4; V.cx = snap ? ax : damp(V.cx, ax, 2.4, dt); V.cz = snap ? az : damp(V.cz, az, 2.2, dt);
    C.position.set(V.cx + (Math.random() - 0.5) * sk * 0.4, 16, V.cz + 6.5); C.lookAt(V.cx, 0, V.cz + 0.6);
  } else {
    gymSetFov(C, asp < 1.15 ? 56 : asp < 1.3 ? 52 : asp < 1.6 ? 42 : 36, asp);
    const ax = clamp(p.x, -8.5, 8.5); V.cx = snap ? ax : damp(V.cx, ax, 2.8, dt);
    const dist = 19.4 * (asp < 1.5 ? 1.22 : 1);
    C.position.set(V.cx + (Math.random() - 0.5) * sk * 0.5, dist * 0.55 + (Math.random() - 0.5) * sk * 0.4, dist); C.lookAt(V.cx, 0.9, 0.4);
  }
  C.updateMatrixWorld();
  hoops.forEach((h, i) => { const k = gymHoopK(h, C); V.hf[i] = snap ? k : V.hf[i] + (k - V.hf[i]) * (1 - Math.exp(-10 * dt)); });
}
function gymCams(dt) {
  if (!GYM.lanes.length) return; gymLayout();
  const snap = GYM.snap; GYM.snap = false; CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2);
  for (const L of GYM.lanes) gymViewCam(L, dt, snap);
  const under = CFG.cam === '2k' || CFG.cam === 'fp'; for (const m of GYM.ceilMeshes) if (m.visible !== under) m.visible = under;
}
// the left stick, per lane (STICK.h says whose stick it is). A held stick keeps the direction it was pushed in until it is released or reversed.
function gymStickWorld(sx, sy, ro) {
  const L = GYM.lanes[STICK.h], V = L && L.view; if (!V || V.map !== '2k') return { x: sx, z: sy };
  if (!ro) {
    const m = Math.hypot(sx, sy);
    if (m < 0.15) { V.mapDir = V.dir; V.lm = 0; }
    else { if (V.lm > 0.4 && (sx * V.lx + sy * V.ly) / (m * V.lm) < -0.5) V.mapDir = V.dir; V.lx = sx; V.ly = sy; V.lm = m; }
  }
  return { x: -V.mapDir * sy, z: V.mapDir * sx };
}
function gymView(V) { pmat.uniforms.sc.value = V.h * 0.5 / Math.tan(V.cam.fov * Math.PI / 360) * PR; hoops.forEach((h, i) => hoopFade(h, V.hf[i] === undefined ? 1 : V.hf[i])); }
function gymRender() {
  const ls = GYM.lanes; if (!ls.length) { renderer.render(scene, cam); return; }
  gymLayout(); const W = canvas.clientWidth || innerWidth, Hh = canvas.clientHeight || innerHeight;
  if (ls.length === 1) { const V = ls[0].view; gymView(V); gymReflect(V.cam, V); gfxRender(scene, V.cam); return; }
  for (const L of ls) {
    const V = L.view; gymView(V); renderer.setScissorTest(false); gymReflect(V.cam, V);
    renderer.setViewport(V.x, V.y, V.w, V.h); renderer.setScissor(V.x, V.y, V.w, V.h); renderer.setScissorTest(true); renderer.render(scene, V.cam);
  }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, Hh);
}
