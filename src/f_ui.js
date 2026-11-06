/* ===== Menus, HUD, camera, main loop ===== */
const ballGroup = new T.Group(); ballGroup.add(ballMesh); scene.add(ballGroup); scene.add(ballShadow); ballGroup.visible = false; ballShadow.visible = false;
const HCOL = [0xff4d5e, 0x35e0a1];

function buildHumanFx() {
  for (const e of $('hud').querySelectorAll('.mtr,.mtt,.icon')) e.remove();
  for (const h of S.humans) {
    if (h.ring) { scene.remove(h.ring); scene.remove(h.arrow); }
    h.ring = new T.Mesh(new T.RingGeometry(0.55, 0.7, 28), new T.MeshBasicMaterial({ color: HCOL[h.id], transparent: true, opacity: 0.95, side: T.DoubleSide, depthWrite: false })); h.ring.rotation.x = -Math.PI / 2; h.ring.renderOrder = 2; scene.add(h.ring);
    h.arrow = new T.Mesh(new T.ConeGeometry(0.15, 0.32, 8), new T.MeshBasicMaterial({ color: HCOL[h.id] })); h.arrow.rotation.x = Math.PI; scene.add(h.arrow);
    h.meter = document.createElement('div'); h.meter.className = 'mtr hidden'; h.meter.innerHTML = '<div class="g"></div><div class="f"></div>'; $('hud').appendChild(h.meter);
    h.txt = document.createElement('div'); h.txt.className = 'mtt'; $('hud').appendChild(h.txt);
    h.icons = []; for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'icon hidden'; d.textContent = ['✕', '◯', '□', '△'][i]; d.style.color = ['#7f9cf5', '#ff6b6b', '#e38be0', '#5fd6a2'][i]; d.style.borderColor = ['#7f9cf5', '#ff6b6b', '#e38be0', '#5fd6a2'][i]; $('hud').appendChild(d); h.icons.push(d); }
  }
  for (const e of $('hud').querySelectorAll('.tag')) e.remove();
  for (const p of S.players) makeTag(p);
  if (!$('flash')) { const f = document.createElement('div'); f.id = 'flash'; $('hud').appendChild(f); }
}
function makeTag(p, label) { const d = document.createElement('div'); d.className = 'tag'; d.innerHTML = '<i style="background:' + css(p.team.kit.jersey === 0xf1f3f8 ? p.team.kit.shorts : p.team.kit.jersey) + '"></i>' + p.short + ' <b>' + (label || p.ovr) + '</b><u></u>'; $('hud').appendChild(d); p.tag = d; return d; }
const _v = new T.Vector3();
function toScreen(x, y, z, V) { _v.set(x, y, z).project(V ? V.cam : cam); const w = V ? V.w : canvas.clientWidth, h = V ? V.h : canvas.clientHeight; return [(_v.x * 0.5 + 0.5) * w + (V ? V.x : 0), (-_v.y * 0.5 + 0.5) * h, _v.z < 1]; }

/* ---------- per-frame world update ---------- */
let _lastCount = -1;
function update(rawDt) {
  if (S.slowT > 0) { S.slowT -= rawDt; S.ts = 0.35; } else S.ts = damp(S.ts, 1, 6, rawDt);
  const dt = rawDt * S.ts; S.elapsed += dt;
  for (const h of S.humans) if (INP[h.id].pauseP) { pauseGame(); return; }
  if (S.countT > 0) {
    S.countT -= dt; const c = Math.ceil(S.countT);
    if (c !== _lastCount && c > 0) { _lastCount = c; banner(String(c)); Snd.tick(); }
    if (S.countT <= 0) { S.live = true; _lastCount = -1; banner(S.mode === 'play' ? 'TIP-OFF!' : 'CHECK!'); Snd.whistle(); S.callFor = null; }
  }
  if (S.callT > 0) S.callT -= dt;
  if (S.nextT > 0) { S.nextT -= dt; if (S.nextT <= 0) tipOff(S.nextTeam, false); }
  if (S.mode === 'shoot') shPlayers(dt);
  else if (S.mode === 'gym') gymPlayers(dt); // lane by lane: racks, pads, challenges, the player, his NPCs
  else {
    for (const h of S.humans) humanUpdate(h, dt);
    for (const p of S.players) { if (p.hold > 0) { p.wx = p.wz = 0; } if (!p.ctrl) aiUpdate(p, dt); }
    inbUpdate(dt);
    for (const p of S.players) movePlayer(p, dt);
  }
  // separation
  const ps = S.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j]; if (a.act === 'dunk' || b.act === 'dunk' || a.act === 'oop' || b.act === 'oop' || a.act === 'dunkEnd' || b.act === 'dunkEnd') continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = 0.62; if (d < m && d > 1e-4) { const wa = a.role === 'B' ? 0.7 : 1, wb = b.role === 'B' ? 0.7 : 1, tw = wa + wb, k = (m - d) / d, ka = k * wb / tw, kb = k * wa / tw; a.x -= dx * ka; a.z -= dz * ka; b.x += dx * kb; b.z += dz * kb; // v22: a big man gives less ground, and bodies that run into each other lose some of that speed
      const nx = dx / d, nz = dz / d, rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; if (rv > 0) { const dv = rv * 0.22; a.vx -= nx * dv * wb / tw * 2; a.vz -= nz * dv * wb / tw * 2; b.vx += nx * dv * wa / tw * 2; b.vz += nz * dv * wa / tw * 2; } }
  }
  if (S.mode === 'gym') gymBalls(dt); else if (S.mode === 'shoot') { updateBall(dt); shBall(dt); } else { updateBall(dt); rulesUpdate(dt); }
  if (S.live) {
    S.checkT = Math.max(0, S.checkT - dt);
    if (S.dead > 0) {
      S.dead -= dt;
      if (S.dead <= 0) { if (S.finish) { S.finish = false; gameOver(); } else if (S.mode === 'play' && S.clock <= 0) endPeriod(); else afterScore(); }
    } else {
      if (S.mode === 'play') {
        if (B.state !== 'dead' && !S.ft && S.deadT <= 0 && !S.inb) S.clock -= dt; // the clock stops for free throws and whistles
        const inFlight = B.state === 'shot' && B.shot && !B.shot.scored;
        if (S.clock <= 0 && !inFlight) { S.clock = 0; endPeriod(); }
        else if ((B.state === 'held' || B.state === 'pass') && !S.ft && !S.inb) {
          S.shotClock -= dt;
          if (S.shotClock <= 0) { S.shotClock = 24; Snd.buzzer(); const t = opp(S.teams[S.poss]); const px = B.pos.x, side = B.pos.z > 0 ? HALF_W - 0.3 : -HALF_W + 0.3; B.owner = null; B.pass = null; turnoverTo(t, px, side, 'SHOT CLOCK'); Com.say('clock', '', 1, 8000); }
        }
      } else if (S.mode === 'black' && (B.state === 'held' || B.state === 'pass') && S.checkT <= 0 && S.countT <= 0) { // Blacktop: a 14 second possession clock, so nobody holds it forever
        if (S.shotClock > 20) S.shotClock = 20; if (!S.clear[S.poss]) S.shotClock -= dt; // the clock waits while you take it back
        if (S.shotClock <= 0) { S.shotClock = 20; Snd.buzzer(); const t = opp(S.teams[S.poss]); B.owner = null; B.pass = null; turnoverTo(t, B.pos.x, B.pos.z > 0 ? HALF_W - 0.3 : -HALF_W + 0.3, 'SHOT CLOCK'); Com.say('stall', '', 1, 8000); }
        else if (B.owner && S.stallT > 9) { S.stallT = -9; Com.say('stall', '', 1, 15000); }
      }
    }
  }
  if (S.mode !== 'gym') for (const p of S.players) { emberFx(p, dt); animatePlayer(p, dt); }
  updateFx(dt);
}
function afterScore() {
  if (S.mode === 'gym' || S.mode === 'shoot') return gymAfterScore(); // the gym has no inbound: the ball drops and the floor is yours
  const sc = S.lastScorer.team; B.lock = 0; B.shot = null;
  if (S.mode === 'play') { const o = opp(sc); B.owner = null; turnoverTo(o, -o.atk * (HALF_L - 0.45), 0, ''); S.shotClock = 24; }
  else { checkBall(CFG.mit ? sc : opp(sc)); }
}
function pauseGame() {
  if (S.state !== 'play') return; S.state = 'paused'; Snd.stopVox(); if (window.speechSynthesis) speechSynthesis.cancel(); showMenu('pause');
}
function updateFx(dt) {
  const t = performance.now() * 0.001;
  for (const h of hoops) {
    h.shake = Math.max(0, h.shake - dt * 2.4); const s = Math.sin(t * 55) * h.shake;
    h.rim.rotation.z = s * 0.06; h.rim.rotation.x = s * 0.04; h.board.rotation.z = s * 0.012; h.board.position.y = s * 0.01;
    if (h.netT > 0) { h.netT -= dt; h.net.scale.set(1, 1 + Math.sin(h.netT * 12) * 0.3 * (h.netT / 0.5), 1); } else h.net.scale.set(1, 1, 1);
  }
  ballGroup.visible = ballShadow.visible = S.state !== 'menu';
  ballGroup.position.copy(B.pos); ballSpin(dt);
  const fireBall = B.fireT > 0 || (B.owner && B.owner.fire); ballMat.emissive.setHex(fireBall ? 0xff5a10 : S.mode === 'shoot' && SH.money ? 0xb88a10 : 0);
  if (fireBall && B.state === 'held' && Math.random() < dt * 40) emit(B.pos.x, B.pos.y, B.pos.z, rnd(-0.3, 0.3), rnd(0.5, 1.5), rnd(-0.3, 0.3), 0.45, 0.35, 1, 0.7, 0.2, 0, 2);
  ballShadow.position.set(B.pos.x, 0.013, B.pos.z); const bs = 0.5 * (1 - Math.min(0.6, B.pos.y * 0.12)); ballShadow.scale.set(bs, bs, 1);
  if (S.mode === 'gym') gymFx(dt);
  updateParticles(dt); updateWaves(dt); if (typeof fxUpdate === 'function') fxUpdate(dt);
  // name tags only where they matter: your players, the ball handler, the two nearest the ball, foul trouble, injured, on fire. The rest fade out.
  let n1 = null, n2 = null, d1 = 1e9, d2b = 1e9;
  for (const p of S.players) { if (p === B.owner) continue; const d = d2(p.x, p.z, B.pos.x, B.pos.z); if (d < d1) { n2 = n1; d2b = d1; n1 = p; d1 = d; } else if (d < d2b) { n2 = p; d2b = d; } }
  const spl = S.mode === 'gym' && GYM.split;
  for (const p of S.players) {
    if (p.fire && !p._wasFire && p.stats) p.stats.fire = (p.stats.fire || 0) + 1; p._wasFire = p.fire; // times caught fire, for the post-game
    const [sx, sy, vis] = toScreen(p.x, p.y + 2.25 * p.sc, p.z); const tg = p.tag; if (!tg) continue;
    tg.style.transform = 'translate(' + sx.toFixed(0) + 'px,' + sy.toFixed(0) + 'px) translate(-50%,-100%)'; tg.classList.toggle('me', !!p.ctrl); tg.classList.toggle('inj', !!p.inj);
    const u = tg._u || (tg._u = tg.querySelector('u') || tg.appendChild(document.createElement('u'))); // a bench guy's tag is made without the foul slot
    const pf = p.fouls ? ' PF' + p.fouls : ''; if (u.textContent !== pf) u.textContent = pf; tg.classList.toggle('fire', p.fire); tg.classList.toggle('hot', !p.fire && p.streak >= 2);
    const show = !!p.ctrl || p === B.owner || p === n1 || p === n2 || !!p.inj || p.fire || (p.fouls > 0 && p.fouls >= CFG.foulLimit - 1);
    tg.classList.toggle('off', !show); tg.style.display = vis && S.state !== 'fight' && !spl ? '' : 'none';
    tg._sx = sx; tg._sy = sy; tg._on = show && vis && S.state !== 'fight' && !spl;
  }
  { // keep shown tags from sitting on top of each other in a crowd: stack the lower one under the higher one
    const on = S.players.map(p => p.tag).filter(t => t && t._on).sort((a, b) => a._sy - b._sy);
    for (let i = 0; i < on.length; i++) { let y = on[i]._sy; for (let j = 0; j < i; j++) if (Math.abs(on[j]._sx - on[i]._sx) < 70 && Math.abs(on[j]._ty - y) < 20) y = on[j]._ty + 20; on[i]._ty = y; if (y !== on[i]._sy) on[i].style.transform = 'translate(' + on[i]._sx.toFixed(0) + 'px,' + y.toFixed(0) + 'px) translate(-50%,-100%)'; }
  }
  if (arcGlow) { const on = S.mode === 'black' && S.state === 'play' && S.live && !!S.clear[S.poss]; arcGlow.visible = on; if (on) arcGlow.material.opacity = 0.75 + 0.25 * Math.sin(t * 6); }
  for (const h of S.humans) {
    const p = h.p; if (!p) continue; const GL = S.mode === 'gym' && GYM.lanes[h.id], V = GL ? GL.view : null;
    h.ring.visible = h.arrow.visible = true; h.ring.position.set(p.x, 0.03, p.z); h.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    h.arrow.position.set(p.x, p.y + 2.5 + Math.sin(t * 5) * 0.06, p.z);
    // shot meter
    const mt = h.meter;
    if (p.act === 'wind' && p.ctrl === h) {
      const [sx, sy, vis] = toScreen(p.x, p.y + 2.1, p.z, V); mt.classList.remove('hidden'); mt.style.left = sx + 'px'; mt.style.top = sy + 'px';
      const w = GL ? gymWith(h.id, () => meterW(p)) : meterW(p);
      mt.firstChild.style.bottom = (Math.max(0, METER_T - w) * 100) + '%'; mt.firstChild.style.height = (Math.min(1, 2 * w) * 100) + '%';
      mt.lastChild.style.height = (clamp(p.fill, 0, 1) * 100) + '%';
    } else mt.classList.add('hidden');
    if (h.txtP) { const [sx, sy] = toScreen(h.txtP.x, h.txtP.y + 2.3, h.txtP.z, V); h.txt.style.left = sx + 'px'; h.txt.style.top = Math.max(sy, 270) + 'px'; } // margin-top -150: never up over the scoreboard
    const showI = INP[h.id].l1 && S.state === 'play' && S.mode !== 'gym'; // all match long, ball or no ball
    h.icons.forEach((d, i) => d.classList.add('hidden'));
    if (showI) { const mates = p.team.players.filter(q => q !== p); mates.forEach((q, i) => { if (i > 3) return; let [sx, sy, vis] = toScreen(q.x, 0.05, q.z); const d = h.icons[i]; const W = canvas.clientWidth, Hh = canvas.clientHeight; if (!vis) { sx = W - sx; sy = Hh + 40; } const off = sx < 30 || sx > W - 30 || sy < 60 || sy > Hh - 70; sx = clamp(sx, 30, W - 30); sy = clamp(sy, 60, Hh - 70); d.classList.remove('hidden'); d.classList.toggle('edge', off); d.dataset.n = q.short; d.style.left = sx + 'px'; d.style.top = sy + 'px'; }); }
  }
}
const CAM_NAMES = { '2k': '2K', full: 'FULL COURT', tv: 'BROADCAST', drone: 'DRONE', fp: 'FIRST PERSON' };
const camList = () => S.mode === 'gym' ? ['2k', 'full', 'drone'] : S.mode === 'shoot' ? ['2k', 'full', 'tv', 'drone'] : CFG.players === 'solo' ? ['2k', 'full', 'tv', 'drone', 'fp'] : ['2k', 'full', 'tv', 'drone'];
const camName = () => CAM_NAMES[CFG.cam] || '2K';
function stepCam(d) { const l = camList(); let i = l.indexOf(CFG.cam); if (i < 0) i = 0; CFG.cam = l[(i + d + l.length) % l.length]; CAMS.snap = true; saveCfg(); }
// first person is one player only: fall back when a second player joins
function camGuard() { if (CFG.cam === 'fp' && CFG.players !== 'solo') CFG.cam = '2k'; }
/* BROADCAST: the TV camera, high on the near sideline, pans with the ball and zooms in when the play reaches the paint. */
function tvCam(dt) {
  const black = S.mode === 'black', snap = CAMS.snap; CAMS.snap = false;
  const bx = B.owner ? B.owner.x : B.pos.x, bz = B.owner ? B.owner.z : B.pos.z;
  const tx = black ? clamp(bx * 0.5 + 4, 2, 9) : clamp(bx * 0.8, -9, 9);
  CAMS.x = snap ? tx : damp(CAMS.x, tx, 1.8, dt); CAMS.z = snap ? bz : damp(CAMS.z, bz, 1.5, dt);
  const H = black ? hoops[0] : (B.owner ? hoopOf(B.owner.team) : hoops[0]);
  const near = clamp(1 - (Math.abs(bx - H.x) - 3) / 9, 0, 1); // 0 far from the basket, 1 in the paint
  const fov = (black ? 27 : 25) - 5 * near; setFov(damp(cam.fov, fov, 2, dt));
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake * 0.5;
  const dist = black ? 19 : 24, h = black ? 7 : 8.5;
  cam.position.set(CAMS.x * 0.85 + (Math.random() - 0.5) * sk * 0.4, h + (Math.random() - 0.5) * sk * 0.3, dist);
  cam.lookAt(CAMS.x, 1.3 + near * 0.6, CAMS.z * 0.3);
}
/* DRONE: straight down from high above, drifting with the ball. */
function droneCam(dt) {
  const black = S.mode === 'black', snap = CAMS.snap; CAMS.snap = false;
  const bx = B.owner ? B.owner.x : B.pos.x, bz = B.owner ? B.owner.z : B.pos.z;
  const tx = black ? clamp(bx * 0.6 + 2.5, 3, 8.5) : clamp(bx * 0.75, -8, 8);
  CAMS.x = snap ? tx : damp(CAMS.x, tx, 2.2, dt); CAMS.z = snap ? bz * 0.4 : damp(CAMS.z, bz * 0.4, 2, dt);
  setFov(44);
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake * 0.5;
  cam.position.set(CAMS.x + (Math.random() - 0.5) * sk * 0.4, black ? 16 : 19, CAMS.z + (black ? 6.5 : 8.5));
  cam.lookAt(CAMS.x, 0, CAMS.z + 0.6);
}
/* FIRST PERSON (one player): through the eyes of the player you control. He faces the basket he attacks (the ball on defence), so up on the stick is forward and sideways strafes. */
function fpCam(dt) {
  const h = S.humans[0], p = h && h.p; if (!p) return behindCam(dt);
  CAMS.snap = false; CAMS.fpYaw = p.face; CAMS.dir = hoopOf(p.team).dir;
  const fx = Math.sin(p.face), fz = Math.cos(p.face), eye = p.y + 1.68 * p.sc;
  const bob = Math.hypot(p.vx, p.vz) > 0.8 ? Math.sin(p.phase * 2) * 0.03 : 0;
  setFov(72);
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake * 0.3;
  cam.position.set(p.x + fx * 0.12 + (Math.random() - 0.5) * sk, eye + bob + (Math.random() - 0.5) * sk * 0.5, p.z + fz * 0.12);
  cam.lookAt(p.x + fx * 6, eye - 0.35 + (p.act === 'wind' ? 1.2 : 0), p.z + fz * 6);
}
/* FIRST PERSON stick: up is where the player looks, sideways strafes. Wraps the camera mapping from c_world.js. */
const stickToWorldBase = stickToWorld;
stickToWorld = function (sx, sy, ro) {
  if (S.mode === 'gym' || CFG.cam !== 'fp' || S.state !== 'play' || CAMS.fpYaw === undefined) return stickToWorldBase(sx, sy, ro);
  const fx = Math.sin(CAMS.fpYaw), fz = Math.cos(CAMS.fpYaw);
  return { x: fx * -sy - fz * sx, z: fz * -sy + fx * sx };
};
function fpHeads() { // the first-person player's head is hidden so the camera can sit in it
  for (const q of S.players) if (q.m) { const hide = CFG.cam === 'fp' && S.mode !== 'gym' && S.state !== 'fight' && q.ctrl && S.humans[0] && q.ctrl === S.humans[0]; if (q.m.head.visible === hide) q.m.head.visible = !hide; }
}
/* 2K, after the NBA 2K "2K" camera: high and behind the ball handler, looking down the court at the basket he attacks. When the ball changes
   ends it swings around to the other side (2K calls that auto flip). The stick is mapped to the same view in stickToWorld(). It works the same on the
   Blacktop half court, where both sides attack the one basket, so it never flips. */
function behindCam(dt) {
  const black = S.mode === 'black', snap = CAMS.snap; CAMS.snap = false;
  CAMS.flipT -= dt; CAMS.flipHold = Math.max(0, CAMS.flipHold - dt);
  let want = black ? 1 : CAMS.dir;
  if (!black) { const tm = B.owner ? B.owner.team : S.teams[S.poss]; if (tm) want = tm.atk; }
  if (want !== CAMS.dir && (snap || CAMS.flipT <= 0)) {
    if (!snap) { const now = performance.now(); CAMS.oldDir = CAMS.dir; CAMS.flipHold = 0.35; CAMS.flipSticks = CAMS.sticks.filter(v => now - v[2] < 150); } // sticks held right now keep the old mapping briefly
    CAMS.dir = want; CAMS.flipT = 1.1;
  }
  const ty = CAMS.dir > 0 ? 0 : Math.PI;
  CAMS.yaw = snap ? ty : CAMS.yaw + angDiff(CAMS.yaw, ty) * (1 - Math.exp(-8 * dt));
  const fov = 46; setFov(fov);
  const span = 2 * Math.tan(fov * Math.PI / 360) * cam.aspect;
  const sf = S.mode === 'shoot' && SH.focusP, kz = sf ? [0.85, 0.75] : [0.55, 0.35]; // Shootout: the camera stays on the shooter, never chases the ball
  let ax = sf ? sf.x : B.owner ? B.owner.x : B.pos.x; const az = sf ? sf.z : B.owner ? B.owner.z : B.pos.z;
  if (black) ax = clamp(ax, 2, 13);
  else if (S.mode !== 'shoot') { let hx = 0, c = 0; for (const h of S.humans) if (h.p) { hx += h.p.x; c++; } if (c) ax = ax * 0.8 + hx / c * 0.2; }
  CAMS.x = snap ? ax : damp(CAMS.x, ax, 3.6, dt); CAMS.z = snap ? az : damp(CAMS.z, az, 3, dt);
  const ahead = 5.5, back = clamp(18.5 / span - ahead * 0.55, 7, 13), fx = Math.cos(CAMS.yaw), fz = Math.sin(CAMS.yaw);
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake;
  let px = CAMS.x - fx * back; px = black ? Math.max(px, -3.5) : clamp(px, -15.6, 15.6);
  cam.position.set(px + (Math.random() - 0.5) * sk * 0.5, 6 + (Math.random() - 0.5) * sk * 0.4, CAMS.z * kz[0] - fz * back);
  cam.lookAt(CAMS.x + fx * ahead, 1.1, CAMS.z * kz[1] + fz * ahead);
  // never look through the near backboard: the hoop behind the play (not the one being attacked) ghosts out while it is in front of the lens
  for (const h of hoops) {
    let k = 1; if (!black && h.dir !== CAMS.dir && (h.x + h.dir * 0.6 - cam.position.x) * fx + (0 - cam.position.z) * fz > -0.6) k = 0.15;
    const nk = snap ? k : h.fade + (k - h.fade) * (1 - Math.exp(-10 * dt)); hoopFade(h, Math.abs(nk - k) < 0.02 ? k : nk);
  }
}
// FULL COURT: the camera the game started with. Sideline, high, the whole floor in view, easing along with the ball.
function updateCam(dt) {
  camGuard(); fpHeads();
  if (S.mode === 'gym') return gymCams(dt);
  if (CFG.cam === '2k') return behindCam(dt);
  for (const h of hoops) if (h.fade !== 1) hoopFade(h, 1);
  if (CFG.cam === 'tv') return tvCam(dt);
  if (CFG.cam === 'drone') return droneCam(dt);
  if (CFG.cam === 'fp') return fpCam(dt);
  setFov(baseFov());
  let fx;
  if (S.mode === 'black') fx = clamp(lerp(8, B.pos.x, 0.3), 6, 9.4);
  else { const bx = S.mode === 'shoot' && SH.focusP ? SH.focusP.x : B.owner ? B.owner.x : B.pos.x; let hx = 0, c = 0; for (const h of S.humans) if (h.p) { hx += h.p.x; c++; } fx = clamp(bx * 0.72 + (c ? hx / c : 0) * 0.28, -7.2, 7.2); }
  CAMS.x = damp(CAMS.x, fx, 2.8, dt);
  const asp = cam.aspect, dist = (S.mode === 'black' ? 15.2 : 19.4) * (asp < 1.5 ? 1.22 : 1);
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake;
  cam.position.set(CAMS.x + (Math.random() - 0.5) * sk * 0.5, dist * 0.55 + (Math.random() - 0.5) * sk * 0.4, dist);
  cam.lookAt(CAMS.x, 0.9, 0.4);
}
let _hc = {};
function setTxt(el, v) { if (_hc[el.id || el] !== v) { _hc[el.id || el] = v; el.textContent = v; } }
function updateHud(dt) {
  const A = S.teams[0], Bt = S.teams[1]; if (!A) return;
  const a = $('tmA').querySelector('.pts'), b = $('tmB').querySelector('.pts');
  if (S.mode !== 'gym' && S.mode !== 'shoot') { if (a.textContent != A.score) a.textContent = A.score; if (b.textContent != Bt.score) b.textContent = Bt.score; }
  const clk = document.querySelector('#score .clk'), sub = document.querySelector('#score .sub');
  if (S.mode === 'shoot') shHud(); else if (S.mode === 'gym') gymHud(); else if (S.mode === 'play') {
    const c = Math.max(0, S.clock), m = Math.floor(c / 60), s = c % 60; const t = c < 10 ? '0:0' + s.toFixed(1) : m + ':' + ('0' + Math.floor(s)).slice(-2);
    if (clk.textContent !== t) clk.textContent = t;
    const sc = Math.max(0, Math.ceil(S.shotClock)), lbl = (S.period > 4 ? 'OT' : 'Q' + S.period) + ' · <span class="sc' + (sc <= 5 ? ' low' : '') + '">' + sc + '</span>' + (Bt.tf >= 5 ? ' · <span class="bon">' + (A.info.abbr || A.info.short) + ' BONUS</span>' : '') + (A.tf >= 5 ? ' · <span class="bon">' + (Bt.info.abbr || Bt.info.short) + ' BONUS</span>' : '');
    if (_hc.sub !== lbl) { _hc.sub = lbl; sub.innerHTML = lbl; }
  } else {
    const t = 'TO ' + CFG.target + ' · ' + Math.max(0, Math.ceil(S.shotClock)); if (clk.textContent !== t) clk.textContent = t;
    const l = (CFG.scoring === '12' ? '1s & 2s' : '2s & 3s') + (CFG.mit ? ' · make it, take it' : ''); sub.style.fontSize = CFG.mit ? '12px' : ''; if (_hc.sub !== l) { _hc.sub = l; sub.textContent = l; }
  }
  let ht = ''; if (S.mode === 'black' && S.live) { const t = S.teams[S.poss]; if (S.checkT > 0) ht = 'CHECK BALL'; else if (S.clear[S.poss]) ht = '<b>TAKE IT BACK</b> · clear it past the arc to score'; }
  if (!S.ft && S.mode !== 'gym' && S.mode !== 'shoot') hint(ht); // free throws own the hint line (ftHint); the gym writes its own
  S.humans.forEach((h, i) => {
    const el = $('heat' + (i + 1)), p = h.p; if (!p) return;
    const lab = el.querySelector('.nm span:first-child'), st = el.querySelector('.nm span:last-child'), segs = el.querySelectorAll('.seg i');
    const tgt = p.fire ? 100 : Math.min(100, p.streak * 34); p.heatShow = damp(p.heatShow, tgt, 8, dt);
    const nm = 'P' + (h.id + 1) + ' · ' + p.short.toUpperCase(); if (lab.textContent !== nm) lab.textContent = nm;
    const s = p.fire ? 'ON FIRE \u00B7 NEXT SHOT GOOD' : p.streak >= 2 ? 'HOT' : p.streak === 1 ? 'WARMING' : 'COLD'; if (st.textContent !== s) st.textContent = s;
    segs.forEach((sg, k) => sg.style.transform = 'scaleX(' + clamp(p.heatShow / 33.4 - k, 0, 1).toFixed(3) + ')');
    el.classList.toggle('fire', p.fire);
  });
}

/* ---------- fullscreen ---------- */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
let fsFail = false;
function toggleFs() {
  const app = $('app');
  try {
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const req = app.requestFullscreen || app.webkitRequestFullscreen;
    if (!req) { fsFail = true; renderMenu(); return; }
    const r = req.call(app); if (r && r.catch) r.catch(() => { fsFail = true; renderMenu(); });
  } catch (e) { fsFail = true; renderMenu(); }
}
const fsItem = () => ({ label: 'Fullscreen', sub: fsFail ? 'Blocked here. Open the standalone file, or press F11' : 'Fills the whole screen. Press F to toggle', val: () => fsEl() ? 'On' : 'Off', left: toggleFs, right: toggleFs, act: toggleFs });
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { resize(); if (!$('menu').classList.contains('hidden')) renderMenu(); }));

/* ---------- menus ---------- */
const MS = { screen: 'title', sel: 0, items: [], back: null, from: 'title' };
const cyc = (arr, v, d) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
function rebuildSetup() { const s = MS.sel; showMenu('setup'); MS.sel = s; renderMenu(); }
function pickPlayer(side, i, d) {
  const sq = side ? CFG.sq1 : CFG.sq0, used = CFG.mode === 'gym' ? new Set(CFG.sq0.slice(0, CFG.players === 'coop' ? 2 : 1)) : new Set([...CFG.sq0.slice(0, CFG.size), ...CFG.sq1.slice(0, CFG.size)]); used.delete(sq[i]); // the gym only keeps your two apart: everyone else is yours to pick
  let k = POOL.findIndex(p => p.id === sq[i]); for (let n = 0; n < POOL.length; n++) { k = (k + d + POOL.length) % POOL.length; if (!used.has(POOL[k].id)) break; } sq[i] = POOL[k].id;
}
const tier = v => v >= 90 ? 't4' : v >= 78 ? 't3' : v >= 62 ? 't2' : 't1';
function statCard(pl) {
  const bars = [['3PT', pl.t3], ['MID', pl.mid], ['INS', pl.fin], ['DNK', pl.dnk], ['SPD', pl.spd], ['DEF', pl.def], ['REB', pl.reb]].map(b => '<div class="st"><span>' + b[0] + '</span><div class="bar"><i class="' + tier(b[1]) + '" style="width:' + b[1] + '%"></i></div><b>' + b[1] + '</b></div>').join('');
  return '<div class="scard"><div class="sch"><div><b>' + pl.name + '</b><span>' + ({ G: 'Guard', W: 'Wing', B: 'Big' })[pl.role] + ' \u00B7 ' + pl.hgt.toFixed(2) + ' m \u00B7 #' + pl.num + '</span></div><em class="' + tier(pl.ovr) + '">' + pl.ovr + '</em></div><div class="sbars">' + bars + '</div></div>';
}
function teamCard(t) {
  return '<div class="scard"><div class="sch"><div><b>' + t.name + '</b><span>Team overall</span></div><em class="' + tier(t.ovr) + '">' + t.ovr + '</em></div><div class="tl">' + t.roster.map(id => { const p = PBY[id]; return '<div><span>' + p.name + '</span><span>' + p.role + '</span><span>3PT ' + p.t3 + '</span><b class="' + tier(p.ovr) + '">' + p.ovr + '</b></div>'; }).join('') + '</div></div>';
}
const camItem = () => ({ label: 'Camera', sub: 'C switches it in game · 2K behind the ball handler · FULL COURT the original whole-floor view · BROADCAST the TV angle · DRONE from above · FIRST PERSON (1 player) through your own eyes', val: camName, left: () => stepCam(-1), right: () => stepCam(1) });
const shotItem = () => ({ label: 'Shooting', sub: 'Shot stick: pull the right stick down and hold, let go in the green. Square always works', val: () => CFG.shotStick ? 'Shot Stick (right stick down)' : 'Square button', left: () => { CFG.shotStick = 1 - CFG.shotStick; saveCfg(); }, right: () => { CFG.shotStick = 1 - CFG.shotStick; saveCfg(); } });
const foulItem = () => ({ label: 'Foul Out', sub: 'Personal fouls before a player is in foul trouble and has to fight the referee to stay in (the NBA uses 6)', val: () => CFG.foulLimit + ' fouls', left: () => CFG.foulLimit = cyc([2, 3, 4, 5, 6], CFG.foulLimit, -1), right: () => CFG.foulLimit = cyc([2, 3, 4, 5, 6], CFG.foulLimit, 1) });
const personaRow = () => typeof personaItem === 'function' ? [Object.assign(personaItem(), { label: 'Commentator Persona' }), shortyItem()] : [];
const talkItem = () => ({ label: 'Commentary', sub: 'Commentator on or off (N in game)', val: () => CFG.talk ? 'On' : 'Off', left: toggleTalk, right: toggleTalk });
function toggleTalk() { CFG.talk = !CFG.talk; Snd.talk = CFG.talk; saveCfg(); if (!CFG.talk) { Com.clear(); Snd.stopVox(); if (window.speechSynthesis) speechSynthesis.cancel(); } }
const tchip = t => '<i class="chip" style="background:' + t.hex + '"></i>';
function glyph(c, t) { return '<span class="k ' + c + '">' + t + '</span>'; }
function showMenu(name) {
  MS.screen = name; MS.sel = 0; MS.back = null; Snd.init(); $('menu').scrollTop = 0;
  $('menu').classList.remove('hidden');
  const go = { label: 'Start Game', cls: 'big go', act: () => startMatch() };
  if (name === 'title') {
    MS.items = [
      { label: 'Play Now', sub: '5v5 full court · four quarters · shot clock', cls: 'big', act: () => { CFG.mode = 'play'; showMenu('setup'); } },
      { label: 'Blacktop', sub: 'street ball on a half court · first to the target wins', cls: 'big', act: () => { CFG.mode = 'black'; showMenu('setup'); } },
      { label: 'The Gym', sub: 'free roam practice gym · racks of balls, a shiny squeaky floor, spawn a defender, timed challenges', cls: 'big', act: () => { CFG.mode = 'gym'; if (CFG.players === 'vs') CFG.players = 'coop'; showMenu('setup'); } },
      { label: 'Shootout', sub: 'a tournament of shooting games · 3-point shootout, around the world and more · crowd and booth on', cls: 'big', act: () => { CFG.mode = 'shoot'; if (CFG.players === 'vs') CFG.players = 'coop'; showMenu('setup'); } },
      { label: 'Controls', sub: 'PlayStation layout, keyboard fallback', act: () => { MS.from = 'title'; showMenu('controls'); } },
      { label: 'Settings', sub: 'camera, commentator voice, sound, graphics', act: () => showMenu('settings') },
      fsItem(),
    ];
  } else if (name === 'settings') {
    MS.items = [
      camItem(), shotItem(), foulItem(),
      { label: 'Sound', val: () => CFG.sound ? 'On' : 'Off', left: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); }, right: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); } },
      talkItem(), ...personaRow(),
      voiceItem(),
      fsItem(),
      { label: 'Graphics', val: () => CFG.quality ? 'High' : 'Low (fastest)', left: () => setQuality(1 - CFG.quality), right: () => setQuality(1 - CFG.quality) },
      { label: 'Players', val: () => CFG.bodies === 'classic' ? 'Classic (fastest)' : 'Realistic athletes', left: () => { CFG.bodies = CFG.bodies === 'classic' ? 'real' : 'classic'; saveCfg(); }, right: () => { CFG.bodies = CFG.bodies === 'classic' ? 'real' : 'classic'; saveCfg(); } },
      { label: 'Back', act: () => showMenu('title') },
    ]; MS.back = () => showMenu('title');
  } else if (name === 'setup') {
    const pl = { solo: '1 Player vs CPU', coop: '2 Player Co-op vs CPU', vs: '2 Player Versus' };
    const it = [go]; // START GAME first, preselected; Options starts it from anywhere on this screen
    const sg = CFG.mode === 'gym' || CFG.mode === 'shoot', pls = sg ? ['solo', 'coop'] : ['solo', 'coop', 'vs'], pl2 = Object.assign({}, pl, CFG.mode === 'shoot' ? { solo: '1 Player', coop: '2 Players (take turns)' } : CFG.mode === 'gym' ? { solo: '1 Player', coop: '2 Players (split screen, own balls)' } : {});
    it.push({ label: 'Players', val: () => pl2[CFG.players], left: () => { CFG.players = cyc(pls, CFG.players, -1); if (sg) rebuildSetup(); }, right: () => { CFG.players = cyc(pls, CFG.players, 1); if (sg) rebuildSetup(); } });
    if (CFG.mode === 'shoot') {
      for (let i = 0; i < (CFG.players === 'coop' ? 2 : 1); i++) it.push({ label: i ? 'P2 Player' : 'Your Player', val: () => PBY[CFG.sq0[i]].name + ' · ' + PBY[CFG.sq0[i]].ovr, left: () => pickPlayer(0, i, -1), right: () => pickPlayer(0, i, 1), card: () => statCard(PBY[CFG.sq0[i]]) });
      it.push({ label: 'Rebounder', sub: 'a big man who chases every miss and passes it back to you', val: () => CFG.shReb ? 'On' : 'Off', left: () => CFG.shReb = !CFG.shReb, right: () => CFG.shReb = !CFG.shReb });
      const fm = ['all', 'tp', 'atw', 'hot', 'ft', 'deep'], fn = { all: 'Full Shootout · all 5 events', tp: '3-Point Shootout', atw: 'Around the World', hot: 'Hot Spots', ft: 'Free Throw Frenzy', deep: 'Deep Range' };
      it.push({ label: 'Format', sub: 'the whole tournament, or one event on its own', val: () => fn[CFG.shEv] || fn.all, left: () => CFG.shEv = cyc(fm, CFG.shEv, -1), right: () => CFG.shEv = cyc(fm, CFG.shEv, 1) });
      it.push({ label: 'Rivals', sub: 'CPU shooters who take their turns against you', val: () => CFG.shRiv + (CFG.shRiv === 1 ? ' rival' : ' rivals'), left: () => CFG.shRiv = (CFG.shRiv + 3) % 4, right: () => CFG.shRiv = (CFG.shRiv + 1) % 4 });
    } else if (CFG.mode === 'gym') {
      for (let i = 0; i < (CFG.players === 'coop' ? 2 : 1); i++) it.push({ label: i ? 'P2 Player' : 'Your Player', val: () => PBY[CFG.sq0[i]].name + ' · ' + PBY[CFG.sq0[i]].ovr, left: () => pickPlayer(0, i, -1), right: () => pickPlayer(0, i, 1), card: () => statCard(PBY[CFG.sq0[i]]) });
      it.push({ label: 'Defender', sub: 'the level the red pad spawns first · ◯ on the pad cycles it', val: () => GYM_LVLS[clamp(CFG.gymLvl | 0, 0, 3)], left: () => CFG.gymLvl = (clamp(CFG.gymLvl | 0, 0, 3) + 3) % 4, right: () => CFG.gymLvl = (clamp(CFG.gymLvl | 0, 0, 3) + 1) % 4 });
    } else if (CFG.mode === 'play') {
      it.push({ label: () => CFG.players === 'vs' ? 'P1 Team' : 'Your Team', val: () => tchip(TEAMS[CFG.t0]) + TEAMS[CFG.t0].name + ' · ' + TEAMS[CFG.t0].ovr, left: () => CFG.t0 = (CFG.t0 + TEAMS.length - 1) % TEAMS.length, right: () => CFG.t0 = (CFG.t0 + 1) % TEAMS.length, card: () => teamCard(TEAMS[CFG.t0]) });
      it.push({ label: () => CFG.players === 'vs' ? 'P2 Team' : 'Opponent', val: () => tchip(TEAMS[CFG.t1]) + TEAMS[CFG.t1].name + ' · ' + TEAMS[CFG.t1].ovr, left: () => CFG.t1 = (CFG.t1 + TEAMS.length - 1) % TEAMS.length, right: () => CFG.t1 = (CFG.t1 + 1) % TEAMS.length, card: () => teamCard(TEAMS[CFG.t1]) });
    } else {
      it.push({ label: 'Team Size', val: () => CFG.size + 'v' + CFG.size, left: () => { CFG.size = cyc([1, 2, 3], CFG.size, -1); rebuildSetup(); }, right: () => { CFG.size = cyc([1, 2, 3], CFG.size, 1); rebuildSetup(); } });
      for (let side = 0; side < 2; side++) for (let i = 0; i < CFG.size; i++) {
        const lab = side === 0 ? (i === 0 ? (CFG.players === 'vs' ? 'P1 Player' : 'Your Player') : (i === 1 && CFG.players === 'coop' ? 'P2 Player (co-op)' : 'Teammate ' + (i + 1))) : (i === 0 && CFG.players === 'vs' ? 'P2 Player' : 'Opponent ' + (i + 1));
        it.push({ label: lab, val: () => PBY[(side ? CFG.sq1 : CFG.sq0)[i]].name + ' · ' + PBY[(side ? CFG.sq1 : CFG.sq0)[i]].ovr, left: () => pickPlayer(side, i, -1), right: () => pickPlayer(side, i, 1), card: () => statCard(PBY[(side ? CFG.sq1 : CFG.sq0)[i]]) });
      }
    }
    if (CFG.mode === 'gym' || CFG.mode === 'shoot') { }
    else if (CFG.mode === 'play') { it.push({ label: 'Quarter Length', val: () => (CFG.qlen / 60) + ' min', left: () => CFG.qlen = cyc([60, 120, 180, 300], CFG.qlen, -1), right: () => CFG.qlen = cyc([60, 120, 180, 300], CFG.qlen, 1) }); it.push(foulItem()); }
    else {
      it.push({ label: 'Play To', val: () => CFG.target + ' points', left: () => CFG.target = cyc([11, 15, 21], CFG.target, -1), right: () => CFG.target = cyc([11, 15, 21], CFG.target, 1) });
      it.push({ label: 'Scoring', val: () => CFG.scoring === '12' ? '1s and 2s' : '2s and 3s', left: () => CFG.scoring = CFG.scoring === '12' ? '23' : '12', right: () => CFG.scoring = CFG.scoring === '12' ? '23' : '12' });
      it.push({ label: 'Make It, Take It', val: () => CFG.mit ? 'On' : 'Off', left: () => CFG.mit = !CFG.mit, right: () => CFG.mit = !CFG.mit });
    }
    if (CFG.mode !== 'gym') it.push({ label: CFG.mode === 'shoot' ? 'Rival Skill' : 'CPU Difficulty', val: () => ['Rookie', 'Pro', 'All-Star'][CFG.diff], left: () => CFG.diff = (CFG.diff + 2) % 3, right: () => CFG.diff = (CFG.diff + 1) % 3 });
    it.push({ label: 'Sound', val: () => CFG.sound ? 'On' : 'Off', left: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); }, right: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); } });
    it.push(talkItem()); it.push(...personaRow()); it.push(voiceItem());
    it.push(camItem()); it.push(shotItem());
    it.push(fsItem());
    it.push({ label: 'Graphics', val: () => CFG.quality ? 'High' : 'Low (fastest)', left: () => setQuality(1 - CFG.quality), right: () => setQuality(1 - CFG.quality) });
    it.push({ label: 'Players', val: () => CFG.bodies === 'classic' ? 'Classic (fastest)' : 'Realistic athletes', left: () => { CFG.bodies = CFG.bodies === 'classic' ? 'real' : 'classic'; saveCfg(); }, right: () => { CFG.bodies = CFG.bodies === 'classic' ? 'real' : 'classic'; saveCfg(); } });
    it.push({ label: 'Back', act: () => showMenu('title') });
    MS.items = it; MS.back = () => showMenu('title');
  } else if (name === 'controls') {
    MS.items = [{ label: 'Back', act: () => MS.from === 'pause' ? showMenu('pause') : showMenu(MS.from) }]; MS.back = MS.items[0].act;
  } else if (name === 'pause') {
    MS.items = [
      { label: 'Resume', cls: 'big', act: resumeGame },
      { label: 'Controls', act: () => { MS.from = 'pause'; showMenu('controls'); } },
      camItem(), shotItem(),
      fsItem(),
      { label: 'Sound', val: () => CFG.sound ? 'On' : 'Off', left: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); }, right: () => { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); } },
      talkItem(), ...personaRow(), voiceItem(),
      { label: 'Restart Game', act: () => startMatch() },
      { label: 'Quit to Menu', act: quitToMenu },
    ]; MS.back = resumeGame;
  } else if (name === 'over') {
    MS.items = [{ label: 'Rematch', sub: 'same teams, same settings', cls: 'big go', act: () => startMatch() }, { label: 'Main Menu', act: quitToMenu }];
    MS.lockT = performance.now() + 700; // a button mashed at the buzzer does not skip the box score
  }
  renderMenu();
}
function resumeGame() { $('menu').classList.add('hidden'); S.state = 'play'; }
function quitToMenu() {
  disposeMatch(); S.state = 'menu'; S.live = false; B.state = 'dead'; $('hud').classList.add('hidden'); for (const e of $('hud').querySelectorAll('.mtr,.mtt,.icon')) e.remove();
  gymStop(); buildArena('play', TEAMS[CFG.t0], TEAMS[CFG.t1]); S.hoops = hoops; S.mode = 'play'; if (typeof fxMode === 'function') fxMode('play'); if (REF) REF.m.root.visible = REF.shadow.visible = false; showMenu('title');
}
function setQuality(q) { CFG.quality = q; GFX.lite = 0; GFX.off = 0; if (q === 0 && GFX.floorMat) GFX.floorMat.uniforms.kRef.value = 0; gfxLightRig(GFX.mode); if (GFX.shPlane) GFX.shPlane.visible = !!q; PR_MAX = q ? Math.min(window.devicePixelRatio || 1, 1.5) : 1; prCap = 9; PR = Math.min(PR, PR_MAX); if (q) PR = PR_MAX; renderer.setPixelRatio(PR); resize(); }
function controlsHtml() {
  const row = (g, t) => '<dt>' + g + '</dt><dd>' + t + '</dd>';
  const K = x => '<span class="k kb">' + x + '</span>';
  return '<div class="ctl">' +
    '<section><h3>Offense · with the ball</h3><dl>' +
    row(glyph('s', '□'), '<span class="hl">Shoot</span> · hold, release in the green. Near the rim it becomes a layup, then a dunk') +
    row(glyph('', 'R2') + glyph('s', '□'), 'Force a dunk (sprint at the rim)') +
    row(glyph('x', '✕'), 'Pass toward the left stick') +
    row(glyph('o', '◯'), 'Bounce pass') +
    row(glyph('t', '△'), 'Lob pass · alley-oop when a teammate is at the rim') +
    row(glyph('', 'L1') + glyph('x', '✕') + glyph('o', '◯') + glyph('s', '□') + glyph('t', '△'), '<span class="hl">Icon pass</span> · hold L1 any time and a button appears under every teammate. With the ball, press it to pass to him; without the ball, press it to take control of him') +
    row(glyph('', 'R2'), 'Sprint') + row(glyph('', 'L2'), 'Protect the ball') +
    row(glyph('', 'LS'), 'Move · the left stick only moves you') +
    row(glyph('', 'RS') + ' ' + glyph('', 'Up'), '<span class="hl">Hesi cross</span> · flick up, hitch then cross toward the basket') +
    row(glyph('', 'RS') + ' ' + glyph('', 'L') + glyph('', 'R'), '<span class="hl">Crossover</span> · flick left or right and the ball switches hands in front of you, low and quick, and you cut that way. If the ball is already on that side you go between the legs first, then cross') +
    row(glyph('', 'RS') + ' ' + glyph('', 'Down'), '<span class="hl">Between the legs / behind the back</span> · flick down, the ball goes through the legs (behind the back when you are running) and you leave off the other hand. With the Shot stick on, down is the shot instead') +
    row(glyph('', 'L2') + glyph('', 'RS'), 'Hold L2 + flick: hop step (up), spin move (sideways), step back (down)') +
    row(glyph('', 'R3') + glyph('', 'RS'), 'Hold R3 + push: hesitation (up), between the legs (left), behind the back (right), in-and-out (down)') +
    row(glyph('', 'R3'), 'Size up · tap the right stick while standing still') +
    '</dl><p class="note">The right stick is read from the basket you attack: up is toward it. In 2K that is up the screen; in FULL COURT it is along the court toward that basket.</p></section>' +
    '<section><h3>Defense · off the ball</h3><dl>' +
    row(glyph('s', '□'), '<span class="hl">Steal</span> · reach in close') + row(glyph('t', '△'), 'Block · jump for the shot or the rebound') +
    row(glyph('o', '◯'), 'Switch player') + row(glyph('x', '✕'), 'Call for help') +
    row(glyph('', 'L2'), 'Intense D (slower, longer reach)') + row(glyph('', 'R2'), 'Sprint') +
    row(glyph('', 'Any'), 'Offense without the ball: any face button calls for the pass') + row(glyph('', 'Options'), 'Pause') +
    '</dl></section>' +
    '<section><h3>Keyboard · Player 1</h3><dl>' +
    row(K('W') + K('A') + K('S') + K('D'), 'Move') + row(K('J'), 'Shoot · steal') + row(K('K'), 'Pass · help') + row(K('L'), 'Bounce pass · switch') + row(K('I'), 'Lob · block') +
    row(K('Shift'), 'Sprint') + row(K('Q'), 'Protect ball · intense D') + row(K('E'), 'Icon pass (hold, then K, L, J, I)') + row(K('Space'), 'One of the four crossovers toward the held direction (forward, left, right, back) · alone = size up · hold Q for hop, spin, step back') + row(K('P'), 'Pause') +
    '</dl></section>' +
    '<section><h3>Keyboard · Player 2</h3><dl>' +
    row(K('←') + K('↑') + K('↓') + K('→'), 'Move') + row(K('.'), 'Shoot · steal') + row(K(','), 'Pass · help') + row(K('/'), 'Bounce pass · switch') + row(K(';'), 'Lob · block') +
    row(K('R-Shift'), 'Sprint') + row(K('\''), 'Protect ball · intense D') + row(K(']'), 'Icon pass') + row(K('Enter'), 'Dribble key, same as Space (arrows pick the crossover)') + row(K('\\'), 'Pause') +
    '</dl></section>' +
    '<section><h3>Fouls, free throws, the referee · Play Now</h3><p class="note">A referee works every Play Now game, a different character each time. Reaching with <span class="hl">□</span> is how you knock the ball loose, but reach over and over and it is a <span class="hl">foul</span>: a hack on a shooter gives free throws (and-one when the shot still drops), five team fouls in a period put the other team in the <span class="hl">bonus</span>, and a late block on a jumper is a foul too. At free throws you shoot with the same meter you shoot jumpers with. Pick up too many personal fouls (set the limit in Setup) and you are in <span class="hl">foul trouble</span>: the game stops and you <span class="hl">fight the referee</span>. Win and your fouls are wiped; lose and you are ejected and a bench guy checks in. Hard falls can <span class="hl">injure</span> a player (a red + on his name): he plays on, slower and with less lift.</p><dl>' + row(glyph('x', '✕'), 'Fight · light') + row(glyph('o', '◯'), 'Fight · heavy') + row(glyph('s', '□'), 'Fight · block') + row(glyph('t', '△'), 'Fight · jump') + row(glyph('', 'R2'), 'Fight · dash') + '</dl></section>' +
    '<section><h3>Shot stick · Settings</h3><p class="note">Turn on <span class="hl">Shot stick</span> in Settings to shoot with the right stick like 2K: pull it <span class="hl">down and hold</span>, let go in the green. □ still works. With the shot stick on, down is the shot and the step-back cross lives on L2 + flick down.</p></section>' +
    '<section><h3>Cameras</h3><p class="note"><b class="hl">2K</b> behind the ball handler · <b class="hl">FULL COURT</b> the sideline view · <b class="hl">BROADCAST</b> the TV camera that zooms into the paint · <b class="hl">DRONE</b> straight down from above · <b class="hl">FIRST PERSON</b> (one player only) through your player\'s eyes, up on the stick is where you look. Press C or change it in Settings or Pause.</p></section>' +
    '<section><h3>On fire</h3><p class="note">Score three in a row with the same player and the heat meter fills: <span class="hl">warming, hot, ON FIRE</span>. Once you are on fire your <span class="hl">next shot is guaranteed</span>: any 2 or 3 point jumper goes in, or a special flaming dunk from outside the paint. The moment that shot drops, the fire goes out and the heat meter resets, and you start building it up again.</p></section>' +
    '<section><h3>Modes</h3><p class="note"><b class="hl">Play Now</b> is 5v5 on the full court with quarters, a 24 second shot clock and 2s and 3s.<br><b class="hl">Blacktop</b> is half court street ball. Scoring is 1s and 2s by default, you play to a target, the scorer keeps the ball, and after a change of possession you must clear it past the three point line before you can score.<br><b class="hl">Shootout</b> is a tournament in the Play Now arena with the crowd and the booth: 3-Point Shootout, Around the World, Hot Spots, Free Throw Frenzy and Deep Range. You (and a friend, taking turns) shoot against CPU rivals. Walk to the lit spot and shoot, a shot only counts from the spot. Each event pays out points by placing and the most points at the end is the champ.<br><b class="hl">The Gym</b> is a free-roam practice gym with no clock: both baskets are live. Walk into a <span class="hl">ball rack</span> on the near sideline to grab a ball, walk over any ball on the floor to pick it up. The <span class="hl">red pad</span> on the far sideline spawns a defender (✕; ◯ cycles Rookie, Pro, All-Star, Legend; △ sends him home) who scores on you if he gets the ball, and □ on it brings in a rebounder who feeds you. The <span class="hl">green pad</span> runs the challenges: ✕ 3PT Contest (5 racks of 5, money ball last, 60 s), ◯ Around the World (7 spots, fewest shots), △ Hot Spots (45 s, hit the lit spot). Records are saved on this device. With two players the screen splits: each of you gets your own balls, defender, rebounder, challenges and camera, so you can both shoot on your own. The floor is varnished: it mirrors the gym and squeaks on every cut.</p></section>' +
    '<section><h3>Also</h3><dl>' + row(K('Esc'), 'Pause') + row(K('M'), 'Sound on or off') + row(K('N'), 'Commentator on or off') + row(K('F'), 'Fullscreen') + row(K('C'), 'Camera: 2K or FULL COURT') + '</dl><p class="note">Two controllers: the first controller is Player 1, the second is Player 2. The keyboard always works too.</p></section></div>';
}
function renderMenu() {
  const body = $('menuBody'), name = MS.screen; let h = '';
  const pads = Pad.list().length;
  const status = '<div class="status"><span class="' + (pads ? 'ok' : '') + '">' + (pads ? pads + ' controller' + (pads > 1 ? 's' : '') + ' connected' : ((Pad.blocked || Pad.embedded()) ? 'Controllers are blocked in this embedded view · open index.html on its own' : 'No controller yet · press any button on it')) + '</span><span>Keyboard ready</span></div>';
  if (name === 'title') h += '<h1 class="logo">Hoop<br><em>Dreams</em></h1><p class="tag">3D arcade hoops · local co-op · get hot, catch fire</p>' + status;
  else if (name === 'setup') h += '<h2 class="logo" style="font-size:clamp(40px,8vw,72px)">' + (CFG.mode === 'play' ? 'Play Now' : CFG.mode === 'shoot' ? 'Shootout' : CFG.mode === 'gym' ? 'The Gym' : 'Blacktop') + '</h2><p class="tag">' + (CFG.mode === 'play' ? 'Full court · four quarters' : CFG.mode === 'shoot' ? 'Five shooting events · most points wins' : CFG.mode === 'gym' ? 'Practice gym · free roam · no clock' : 'Half court · street rules') + '</p>' + status;
  else if (name === 'settings') h += '<h2 class="logo" style="font-size:clamp(40px,8vw,72px)">Settings</h2>' + status;
  else if (name === 'controls') h += '<h2 class="logo" style="font-size:clamp(40px,8vw,72px)">Controls</h2>' + controlsHtml();
  else if (name === 'pause') h += '<h2 class="logo" style="font-size:clamp(40px,8vw,72px)">Paused</h2>';
  else if (name === 'over' && S.mode === 'shoot') h += shResultsHtml();
  else if (name === 'over') {
    const a = S.teams[0], b = S.teams[1], w = a.score > b.score ? a : b;
    const top = t => t.players.slice().sort((x, y) => y.stats.pts - x.stats.pts)[0];
    const line = t => { const p = top(t); return p.short + ' ' + p.stats.pts + ' pts' + (p.stats.dk ? ' · ' + p.stats.dk + ' dunks' : '') + (p.stats.best >= 3 ? ' · best streak ' + p.stats.best : ''); };
    const kc = t => css(t.kit.jersey === 0xf1f3f8 ? t.kit.shorts : t.kit.jersey);
    // every player who played: an ejected man is kept (q.subFor on the bench guy who replaced him), so the rows add up to the score
    const rowsOf = t => { const out = []; for (const p of t.players) { const ch = []; for (let q = p; q; q = q.subFor) ch.unshift(q); out.push(...ch); } return out; };
    const fts = S.mode === 'play'; // Blacktop has no fouls or free throws
    const box = t => '<table class="bx"><tr><th>' + t.info.short + '</th><th>PTS</th><th>3PM</th><th>DNK</th><th>STL</th><th>BLK</th>' + (fts ? '<th>FT</th><th>PF</th>' : '') + '<th>BEST</th></tr>' + rowsOf(t).map(p => '<tr' + (p.ejected ? ' class="ej"' : '') + '><td>' + p.name + (p.ejected ? ' <i class="ejx">EJ</i>' : '') + (p.inj ? ' <i class="injx">+</i>' : '') + '</td><td>' + p.stats.pts + '</td><td>' + p.stats.tp + '</td><td>' + p.stats.dk + '</td><td>' + p.stats.stl + '</td><td>' + p.stats.blk + '</td>' + (fts ? '<td>' + (p.stats.ft || 0) + '/' + (p.stats.fta || 0) + '</td><td>' + (p.stats.pf || 0) + '</td>' : '') + '<td>' + p.stats.best + '</td></tr>').join('') + '</table>';
    // player of the game: points plus stocks, the winner breaks a tie. Then up to three plays worth remembering.
    const all = [...rowsOf(a), ...rowsOf(b)], val = p => p.stats.pts + p.stats.stl + p.stats.blk;
    const pog = all.slice().sort((x, y) => val(y) - val(x) || (y.team === w) - (x.team === w) || y.stats.pts - x.stats.pts)[0];
    const plays = [], by = f => all.filter(f), nm = p => '<b>' + p.short + '</b>';
    for (const p of by(p => p.stats.fightW)) plays.push(nm(p) + ' fought the referee and won' + (p.stats.fightW > 1 ? ', ' + p.stats.fightW + ' times' : '') + '. He stayed in');
    for (const p of by(p => p.stats.fightL)) plays.push(nm(p) + ' lost his fight with the referee and was ejected');
    for (const p of by(p => p.stats.fire).sort((x, y) => y.stats.fire - x.stats.fire)) plays.push(nm(p) + ' caught fire' + (p.stats.fire > 1 ? ' ' + p.stats.fire + ' times' : ''));
    const dk = by(p => p.stats.dk).sort((x, y) => y.stats.dk - x.stats.dk)[0]; if (dk) plays.push(nm(dk) + ' threw down ' + dk.stats.dk + ' dunk' + (dk.stats.dk > 1 ? 's' : ''));
    const tp = by(p => p.stats.tp).sort((x, y) => y.stats.tp - x.stats.tp)[0]; if (tp && tp.stats.tp >= 2) plays.push(nm(tp) + ' hit ' + tp.stats.tp + ' threes');
    const st = all.slice().sort((x, y) => y.stats.best - x.stats.best)[0]; if (st && st.stats.best >= 2) plays.push(nm(st) + ' made ' + st.stats.best + ' in a row');
    const pogH = pog ? '<div class="pog"><span>Player of the game</span><b>' + pog.name + '</b><em>' + pog.team.info.short + ' · ' + pog.stats.pts + ' pts' + (pog.stats.stl ? ' · ' + pog.stats.stl + ' stl' : '') + (pog.stats.blk ? ' · ' + pog.stats.blk + ' blk' : '') + (pog.stats.dk ? ' · ' + pog.stats.dk + ' dnk' : '') + '</em></div>' : '';
    const playsH = plays.length ? '<ul class="plays">' + plays.slice(0, 3).map(x => '<li>' + x + '</li>').join('') + '</ul>' : '';
    h += '<p class="tag">Final</p><h2 class="logo" style="font-size:clamp(40px,8vw,84px)">' + w.info.short + ' win</h2>' +
      '<div class="list"><div class="row"><span><i class="chip" style="background:' + kc(a) + '"></i> ' + a.info.name + '</span><span class="val">' + a.score + '</span></div><div class="row"><span><i class="chip" style="background:' + kc(b) + '"></i> ' + b.info.name + '</span><span class="val">' + b.score + '</span></div></div>' + pogH + playsH + '<div class="bxwrap">' + box(a) + box(b) + '</div>';
  }
  h += '<div class="split"><div class="list" id="mlist">';
  MS.items.forEach((it, i) => {
    const lab = typeof it.label === 'function' ? it.label() : it.label;
    h += '<div class="row ' + (it.cls || '') + (i === MS.sel ? ' sel' : '') + '" data-i="' + i + '"><span>' + lab + (it.sub ? '<small>' + it.sub + '</small>' : '') + '</span>' + (it.val ? '<span class="val"><span class="arr">‹</span>' + it.val() + '<span class="arr">›</span></span>' : '') + '</div>';
  });
  h += '</div><div id="cardbox"></div></div>';
  if (name === 'title' || name === 'setup') h += '<p class="note">Navigate with the d-pad or left stick, ✕ to select, ◯ to go back. Mouse and keyboard work too (arrows, Enter, Esc).</p>';
  $('menu').classList.toggle('solid', name === 'over'); if (name === 'over') for (const e of document.querySelectorAll('#hud .tag')) e.style.display = 'none';
  body.classList.toggle('two', name === 'setup'); body.classList.toggle('wide', name === 'over'); body.innerHTML = h; updateCard();
  const sel = body.querySelector('.row.sel'); if (sel && sel.scrollIntoView && name !== 'controls') sel.scrollIntoView({ block: 'nearest' });
}
function updateCard() { const b = $('cardbox'); let it = MS.items[MS.sel]; if (!(it && it.card)) it = MS.items.slice(0, MS.sel).reverse().find(x => x.card) || MS.items.find(x => x.card); if (b) b.innerHTML = it && it.card ? it.card() : ''; }
function menuMove(dy) {
  if (MS.screen === 'controls') { $('menu').scrollBy({ top: dy * 160 }); return; } MS.sel = (MS.sel + dy + MS.items.length) % MS.items.length; Snd.tick(); renderMenu(); }
function menuChange(d) { const it = MS.items[MS.sel]; if (!it) return; const f = d < 0 ? it.left : it.right; if (f) { f(); Snd.tick(); renderMenu(); } }
function menuConfirm() { const it = MS.items[MS.sel]; if (!it) return; if (MS.screen === 'over' && performance.now() < (MS.lockT || 0)) return; if (it.act) { Snd.init(); it.act(); if (MS.screen !== 'over' || true) { } } else if (it.right) { it.right(); Snd.tick(); renderMenu(); } }
function menuBack() { if (MS.back) MS.back(); }
$('menuBody').addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; MS.sel = +r.dataset.i; const arr = e.target.closest('.arr'); if (arr && MS.items[MS.sel].left) { menuChange(arr.textContent === '‹' ? -1 : 1); } else menuConfirm(); });
$('menuBody').addEventListener('mousemove', e => { const r = e.target.closest('.row'); if (r && +r.dataset.i !== MS.sel) { MS.sel = +r.dataset.i; document.querySelectorAll('#mlist .row').forEach((x, i) => x.classList.toggle('sel', i === MS.sel)); updateCard(); } });
addEventListener('keydown', e => {
  if (e.repeat && e.code !== 'ArrowUp' && e.code !== 'ArrowDown' && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
  if (e.code === 'KeyF' && !e.repeat) toggleFs();
  if (e.code === 'KeyC' && !e.repeat) { stepCam(1); toast('CAMERA · ' + camName().toUpperCase()); if (!$('menu').classList.contains('hidden')) renderMenu(); }
  if (e.code === 'KeyM') { CFG.sound = !CFG.sound; Snd.setOn(CFG.sound); saveCfg(); }
  if (e.code === 'KeyN') { CFG.talk = !CFG.talk; Snd.talk = CFG.talk; saveCfg(); if (!CFG.talk) { Com.clear(); Snd.stopVox(); if (window.speechSynthesis) speechSynthesis.cancel(); } }
  if (e.code === 'Escape') { if (S.state === 'play') pauseGame(); else if (S.state === 'paused' && MS.screen === 'pause') resumeGame(); else if (!$('menu').classList.contains('hidden')) menuBack(); return; }
  if ($('menu').classList.contains('hidden')) return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') menuMove(-1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') menuMove(1);
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') menuChange(-1); else if (e.code === 'ArrowRight' || e.code === 'KeyD') menuChange(1);
  else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); menuConfirm(); }
});
let navT = 0, navLast = [0, 0], padStatusT = 0;
function menuPad(dt) {
  let mx = 0, my = 0, ok = false, back = false, start = false;
  for (let i = 0; i < 2; i++) { const I = INP[i], g = padActive[i]; if (!g) continue; if (Math.abs(I.mx) > Math.abs(mx)) mx = I.mx; if (Math.abs(I.my) > Math.abs(my)) my = I.my; if (I.xP || I.shootP) ok = true; if (I.oP) back = true; if (I.pauseP) start = true; }
  const dx = Math.abs(mx) > 0.6 ? Math.sign(mx) : 0, dy = Math.abs(my) > 0.6 ? Math.sign(my) : 0;
  if (dx !== navLast[0] || dy !== navLast[1]) { navLast = [dx, dy]; navT = 0.38; if (dy) menuMove(dy); else if (dx) menuChange(dx); }
  else if (dx || dy) { navT -= dt; if (navT <= 0) { navT = 0.13; if (dy) menuMove(dy); else menuChange(dx); } }
  if (ok) menuConfirm(); if (back) menuBack(); if (start && MS.screen === 'pause') resumeGame(); else if (start && MS.screen === 'setup') startMatch();
  if (start) for (const I of INP) I.pauseP = false; // the same press must not reach update() and pause again this frame
  padStatusT -= dt; if (padStatusT <= 0) { padStatusT = 1; if (MS.screen === 'title' || MS.screen === 'setup') { const st = $('menuBody').querySelector('.status'); if (st) { const n = Pad.list().length; const h = '<span class="' + (n ? 'ok' : '') + '">' + (n ? n + ' controller' + (n > 1 ? 's' : '') + ' connected' : ((Pad.blocked || Pad.embedded()) ? 'Controllers are blocked in this embedded view · open index.html on its own' : 'No controller yet · press any button on it')) + '</span><span>Keyboard ready</span>'; if (st.innerHTML !== h) st.innerHTML = h; } } }
}

/* ---------- main loop ---------- */
// fight results for the post-game (p.stats.fightW / fightL), and the commentary caption hidden while a fight is on
let _fightP = null, _fighting = false;
function trackFight() {
  const f = S.state === 'fight'; if (f !== _fighting) { _fighting = f; $('hud').classList.toggle('fighting', f); }
  if (f) { if (typeof FIGHT !== 'undefined' && FIGHT.p) _fightP = FIGHT.p; return; }
  if (_fightP) { const st = _fightP.stats; if (_fightP.ejected) st.fightL = (st.fightL || 0) + 1; else st.fightW = (st.fightW || 0) + 1; _fightP = null; }
}
// the caption shows the line cut to about two short lines (the voice still reads all of it): a whole sentence when one fits, else a word break
const CAP_MAX = 90;
new MutationObserver(() => {
  const el = $('caption'), b = el.firstChild; if (!b || b.nodeName !== 'B' || el.childNodes.length < 2) return;
  const txt = el.textContent.slice(b.textContent.length); if (txt.length <= CAP_MAX) return;
  let cut = -1; for (let i = 0; i < CAP_MAX; i++) if ('.!?'.includes(txt[i]) && (txt[i + 1] === ' ' || i + 1 === txt.length) && i > 24) cut = i + 1;
  const short = cut > 0 ? txt.slice(0, cut) : txt.slice(0, txt.lastIndexOf(' ', CAP_MAX - 1)) + '\u2026';
  while (el.childNodes.length > 1) el.removeChild(el.lastChild); el.appendChild(document.createTextNode(short));
}).observe($('caption'), { childList: true });
const _bsq = new T.Quaternion(), _bsa = new T.Vector3();
// v22: the ball turns the way a real one does: rolls on the floor, backspins off the hand, holds a lazy turn in the dribble
function ballSpin(dt) {
  const sp = Math.hypot(B.vel.x, B.vel.z); let w = 0;
  if (B.state === 'held') { w = 2.5; _bsa.set(1, 0, 0); }
  else if (sp > 0.15) { _bsa.set(B.vel.z / sp, 0, -B.vel.x / sp); w = B.pos.y < BALL_R + 0.03 ? sp / BALL_R : (B.state === 'shot' ? -9 : -3); }
  if (w) ballMesh.quaternion.premultiply(_bsq.setFromAxisAngle(_bsa, w * dt));
}
let lastT = performance.now(), ema = 0.016, slowF = 0, fastF = 0, attractA = 0, prUpT = -1e9, prCap = 9;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, Math.max(0.0005, (now - lastT) / 1000)); lastT = now;
  ema = lerp(ema, raw, 0.05);
  // hold 60fps: below ~55fps for most of a second, render fewer pixels; after 8 smooth seconds try one step sharper, and if that step was too much, never retry it
  if (ema > 0.0195 && PR > 0.6) { if (++slowF > 45) { slowF = 0; if (now - prUpT < 6000) prCap = PR / 1.12 + 0.001; PR = Math.max(0.6, PR * 0.87); renderer.setPixelRatio(PR); resize(); } } else slowF = 0;
  if (ema < 0.0172 && PR < Math.min(PR_MAX, prCap)) { if (++fastF > 480) { fastF = 0; PR = Math.min(PR_MAX, prCap, PR * 1.12); prUpT = now; renderer.setPixelRatio(PR); resize(); } } else fastF = 0;
  if (!window.__noPoll) pollInput(raw);
  if (!$('menu').classList.contains('hidden')) menuPad(raw);
  trackFight();
  if (S.state === 'fight') { for (const h of S.humans) { if (h.ring) h.ring.visible = false; if (h.arrow) h.arrow.visible = false; if (h.meter) h.meter.classList.add('hidden'); } for (const q of S.players) if (q.tag) q.tag.style.display = 'none'; if (typeof updateFight === 'function') updateFight(raw); else S.state = 'play'; Snd.update(raw); renderer.render(scene, cam); return; }
  if (S.state === 'play') { update(raw); updateCam(raw * S.ts); updateHud(raw); }
  else if (S.state === 'paused' || S.state === 'over') { updateFx(0.0001); updateParticles(0.0001); updateCam(raw * 0.2); }
  else { attractA += raw * 0.12; const hx = RIM_X - 1; cam.position.set(hx - 6 + Math.cos(attractA) * 7, 4.2 + Math.sin(attractA * 0.7) * 1.5, Math.sin(attractA) * 9); cam.lookAt(hx, 2.6, 0); updateFx(raw); updateParticles(raw); }
  Snd.update(raw);
  gfxUpdate(raw); gfxAdapt(ema, PR);
  if (S.mode === 'gym' && S.state !== 'menu') gymRender(); else gfxRender(scene, cam); // the gym draws one view per player, with the varnish mirroring the room
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'play') pauseGame(); });
window.__SD = { S, B, CFG, INP, MS, CAMS, classifyMove, dribbleMove, MOVES, stickToWorld, shotP, meterW, ARC, cam, scene, renderer, PBY, Snd, Com, pollInput, startMatch, TEAMS, update, hoops: () => hoops, showMenu, startDunk, startJump, startLayup, ignite, giveBall, doPass, hoopOf, GYM, gymSpawnDef, gymSpawnReb, gymStartCh, gymEndCh, gymRemove, gymWith, gymUse, render: (dt) => { updateCam(dt); updateHud(dt); gfxUpdate(dt); if (S.mode === 'gym') gymRender(); else gfxRender(scene, cam); } };

/* boot */
resize();
buildArena('play', TEAMS[0], TEAMS[1]); S.hoops = hoops; if (typeof fxMode === 'function') fxMode('play');
showMenu('title');
requestAnimationFrame(frame);
