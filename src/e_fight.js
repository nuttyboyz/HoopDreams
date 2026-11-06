/* ===== Foul-out fight: a player in foul trouble squares up with the referee instead of being ejected =====
   Side-view, one 12-second round, Street Fighter style but tiny: light punch, heavy punch, block, jump, dash.
   A blocked swing leaves the swinger recoiling, open to a counter. The referee reads mashing: the more swings he has
   seen lately, the likelier he blocks the next one and makes you pay. OPTIONS skips the fight at the CPU odds.
   startFight(p, ref, onDone) takes over while S.state === 'fight'; the main loop calls updateFight(dt) and renders.
   Controls (the human on p): ✕ light, ◯ heavy, □ block (hold), △ jump, left stick left/right moves, R2 + direction dashes.
   A second human (2 Player Versus) controls the referee the same way; otherwise the referee is a small AI. A CPU player auto-resolves in a 3 s cut-in. */
const FIGHT_T = 12, REF_WIN_CPU = 0.35, REF_WIN_SKIP = 0.55; // round length; how often the ref beats a CPU player; a skipped fight is a coin flip that leans to the ref, so fighting well still pays
const FIGHT = { on: false, p: null, ref: null, A: null, B: null, t: 0, phase: '', phT: 0, onDone: null, auto: false, winner: null, hud: null, midx: 0, fx: [] };
const FACE_X = dir => dir > 0 ? Math.PI / 2 : -Math.PI / 2; // model faces +x or -x (p.face convention: atan2(vx, vz))
const ATK = { light: { dur: 0.32, a0: 0.1, a1: 0.2, rng: 1.05, dmg: 10, stun: 0.26, push: 2.4, rec: 0.4 }, heavy: { dur: 0.6, a0: 0.28, a1: 0.4, rng: 1.2, dmg: 20, stun: 0.5, push: 4.5, rec: 0.6 } }; // rec: recoil after being blocked

function fightCss() {
  if ($('fight')) return;
  const st = document.createElement('style');
  st.textContent = '#fight{position:absolute;inset:0;pointer-events:none;font-family:var(--display);text-transform:uppercase;letter-spacing:.04em}' +
    '#fight .bar{position:absolute;top:calc(74px + env(safe-area-inset-top,0px));width:34%;height:22px;background:#15171f;border:2px solid #fff;box-shadow:0 4px 14px #000a}' +
    '#fight .bar i{position:absolute;top:0;bottom:0;background:linear-gradient(#ffe066,#e8a90a);transition:width .12s}' +
    '#fight .bar.l{left:7%}#fight .bar.r{right:7%}#fight .bar.r i{right:0}#fight .bar.l i{left:0}' +
    '#fight .bar.low i{background:linear-gradient(#ff8a7a,#d1281e)}' +
    '#fight .nm{position:absolute;top:calc(100px + env(safe-area-inset-top,0px));font-size:22px;color:#fff;text-shadow:0 2px 6px #000}' +
    '#fight .nm.l{left:7%}#fight .nm.r{right:7%;text-align:right}' +
    '#fight .clk{position:absolute;top:calc(64px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);font-size:44px;color:#fff;text-shadow:0 3px 0 #0009,0 0 18px #000}' +
    '#fight .clk.low{color:#ff5a3a}' +
    '#fight .how{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:0;right:0;text-align:center;font-family:var(--body);font-size:17px;color:#dfe3ee;text-shadow:0 1px 4px #000;letter-spacing:.06em}' +
    '#fight.hidden{display:none}';
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'fight'; d.className = 'hidden';
  d.innerHTML = '<div class="bar l"><i></i></div><div class="bar r"><i></i></div><div class="nm l"></div><div class="nm r"></div><div class="clk">' + FIGHT_T + '</div><div class="how"></div>';
  ($('hud') || document.body).appendChild(d);
}
function fighter(m, x, dir, name) { return { m, x, z: 0, y: 0, vy: 0, vx: 0, dir, hp: 100, act: '', actT: 0, hitDone: false, name, ph: Math.random() * 6, blockT: 0, blockW: 0, aiT: 0, dashT: 0, atkN: 0, recN: 0, seenN: 0, seen: [], punN: 0, pun: false }; }
function fallbackRef() {
  const m = buildPlayer({ jersey: 0xffffff, shorts: 0x111111, numColor: 0, shoe: 0x111111, skin: 2, hair: 'short', hairC: 0x222222, extra: '', num: '', short: 'REF', hgt: 1.85 });
  scene.add(m.root); return { m, name: 'Referee', short: 'REF', x: 0.7, z: 0, face: -Math.PI / 2 };
}

function startFight(p, ref, onDone) {
  fightCss();
  if (!ref || !ref.m) ref = fallbackRef();
  const F = FIGHT; F.on = true; F.p = p; F.ref = ref; F.onDone = onDone; F.winner = null; F.t = FIGHT_T; F.el = 0; F.forced = false; F.skipped = false; F.phase = 'intro'; F.phT = p.ctrl ? 1.1 : 0.4; F.midx = 0;
  F.A = fighter(p.m, -0.7, 1, p.short || 'PLAYER'); F.B = fighter(ref.m, 0.7, -1, ref.short || ref.name || 'REF');
  F.A.sc = p.sc || 1; F.B.sc = ref.sc || (ref.hgt ? ref.hgt / 1.98 : 0.93);
  F.auto = !p.ctrl; if (typeof ballMesh !== 'undefined') { ballMesh.visible = false; ballShadow.visible = false; }
  const other = p.ctrl ? S.humans.find(h => h !== p.ctrl && h.p) : null;
  F.A.inp = p.ctrl ? INP[p.ctrl.id] : null; F.B.inp = other ? INP[other.id] : null;
  F.A.diff = 1; F.B.diff = (typeof CFG !== 'undefined' ? CFG.diff : 1);
  const d = $('fight'); d.classList.remove('hidden');
  d.querySelector('.nm.l').textContent = F.A.name; d.querySelector('.nm.r').textContent = F.B.name;
  d.querySelector('.how').textContent = F.auto ? 'FOUL TROUBLE · ' + F.A.name + ' goes after the ref' : '□ block when the ref flashes, then punish with ◯ · ✕ light · △ jump · R2 dash · OPTIONS skip';
  fightHud();
  for (const f of [F.A, F.B]) placeFighter(f);
  banner('FOUL TROUBLE!'); Snd.cheer(1.2, 3); Snd.whistle(); if (typeof Com !== 'undefined') { const m = typeof Talk !== 'undefined' ? Talk.mem : null; Com.clear(); if (m) Talk.mem = m; } // hush the booth, keep the game's line memory
}
function fightState() { return FIGHT; } // for tests and the HUD
function placeFighter(f) { f.m.root.position.set(f.x, f.y, f.z); f.m.root.rotation.y = FACE_X(f.dir); }
function fightHud() {
  const F = FIGHT, d = $('fight'); if (!d) return;
  const bl = d.querySelector('.bar.l'), br = d.querySelector('.bar.r');
  bl.firstChild.style.width = Math.max(0, F.A.hp) + '%'; br.firstChild.style.width = Math.max(0, F.B.hp) + '%';
  bl.classList.toggle('low', F.A.hp <= 30); br.classList.toggle('low', F.B.hp <= 30);
  const c = d.querySelector('.clk'); c.textContent = String(Math.max(0, Math.ceil(F.t))); c.classList.toggle('low', F.t <= 5);
}
function neutralPose(m) {
  for (const k of ['body', 'torso', 'head', 'armL', 'armR', 'elbL', 'elbR', 'legL', 'legR', 'kneeL', 'kneeR']) m[k].rotation.set(0, 0, 0);
  m.body.position.y = 0;
}

/* ---- input: human pad or AI ---- */
// the ref's tell before a swing at a human: a flash at his fist and a click, about 0.3 s ahead, so you can read it and block
function startTell(f, k) { f.tellK = k; f.tellT = k === 'heavy' ? 0.3 : 0.26; burst(f.x + f.dir * 0.35, 1.45, 0, 12, 1.6, 0, [[1, 1, 0.55], [1, 0.8, 0.3]], 0.35, 0.14, 0); if (Snd.tick) Snd.tick(); }
function fightIntent(f, o, dt) {
  const F = FIGHT, I = f.inp, want = { move: 0, dash: false, light: false, heavy: false, block: false, jump: false };
  if (I && !F.auto) { want.move = Math.abs(I.mx) > 0.25 ? Math.sign(I.mx) : 0; want.dash = I.sprint; want.light = I.xP; want.heavy = I.oP; want.block = I.shoot; want.jump = I.tP; return want; }
  // AI: close the distance, mix light and heavy inside range, back off now and then.
  // Defense reads the other guy: each new swing may get blocked, and a string of swings (mashing) almost always does.
  const d = Math.abs(o.x - f.x), toward = Math.sign(o.x - f.x) || f.dir, skill = 0.55 + 0.25 * (f.diff || 1);
  f.aiT -= dt;
  if ((o.act === 'light' || o.act === 'heavy') && o.atkN !== f.seenN) {
    f.seenN = o.atkN; f.seen.push(F.el); while (f.seen.length && F.el - f.seen[0] > 1.6) f.seen.shift();
    const mash = f.seen.length - 1, pb = clamp((0.22 + 0.17 * mash) * (0.75 + 0.3 * skill), 0.1, 0.92);
    if (o.act === 'heavy' && f.act === '' && f.y <= 0.01 && d < 1.1 && Math.random() < 0.35 * skill) { f.jabNow = true; } // a slow heavy wind-up gets jabbed out of the air
    else if ((f.act === '' || f.act === 'block') && f.y <= 0.01 && d < 1.7 && Math.random() < pb) { f.blockW = rnd(0.02, 0.06); f.blockT = ATK[o.act].dur - o.actT + 0.05; }
  }
  if (o.act === 'recoil' && o.recN !== f.punN) { f.punN = o.recN; f.pun = Math.random() < Math.min(0.95, 1.1 * skill); if (f.pun) f.blockW = f.blockT = 0; }
  if (f.jabNow) { f.jabNow = false; f.tellT = 0; want.light = true; return want; }
  if (f.tellT > 0) { f.tellT -= dt; if (f.tellT <= 0) want[f.tellK] = true; return want; } // the tell: a flash, then the swing
  if (f.blockW > 0) { f.blockW -= dt; return want; }
  if (f.blockT > 0) { f.blockT -= dt; want.block = true; return want; }
  // punish a blocked swing while the other guy is still recoiling
  if (f.pun && o.act === 'recoil') {
    if ((f.act === '' || f.act === 'block') && d < 1.15) { f.pun = false; if (o.stun - o.actT > ATK.heavy.a0) want.heavy = true; else want.light = true; return want; }
    want.move = toward; return want;
  }
  if (f.aiT > 0) { want.move = f.aiMove || 0; want.dash = !!f.aiDash; return want; }
  f.aiT = rnd(0.16, 0.36) / skill; f.aiMove = 0; f.aiDash = false;
  if (d > 1.05) { f.aiMove = toward; f.aiDash = d > 2.2 && Math.random() < 0.5; }
  else { const r = Math.random(); const tell = !F.auto && !!o.inp; if (r < 0.22 * skill) { if (tell) startTell(f, 'light'); else want.light = true; } else if (r < 0.44 * skill) { if (tell) startTell(f, 'heavy'); else want.heavy = true; } else if (r < 0.7) { f.aiMove = -toward; } else if (r < 0.76) want.jump = true; }
  want.move = f.aiMove; want.dash = f.aiDash; return want;
}

/* ---- one fighter's step ---- */
function fightStep(f, o, dt, allow) {
  const F = FIGHT; f.ph += dt * 6;
  f.dir = o.x > f.x ? 1 : o.x < f.x ? -1 : f.dir;
  if (f.act === 'ko') { f.actT += dt; f.vx *= 0.9; f.x += f.vx * dt; return; }
  const want = allow ? fightIntent(f, o, dt) : { move: 0 };
  f.actT += dt;
  if (f.act === 'hit' || f.act === 'recoil') { if (f.actT >= f.stun) f.act = ''; }
  else if (f.act === 'light' || f.act === 'heavy') {
    const A = ATK[f.act];
    if (!f.hitDone && f.actT >= A.a0 && f.actT <= A.a1) {
      const dx = (o.x - f.x) * f.dir, dy = Math.abs(o.y - f.y);
      if (dx > -0.2 && dx < A.rng * Math.max(f.sc, 0.8) && dy < 1.0) { f.hitDone = true; fightHit(f, o, A); }
    }
    if (f.actT >= A.dur) f.act = '';
  } else if (f.act === 'block') { if (!want.block) f.act = ''; }
  if (f.act === '' || f.act === 'block' && !want.block) {
    if (want.light) { f.act = 'light'; f.actT = 0; f.hitDone = false; f.atkN++; Snd.grunt(1.1); }
    else if (want.heavy) { f.act = 'heavy'; f.actT = 0; f.hitDone = false; f.atkN++; Snd.grunt(0.8); }
    else if (want.block && f.y <= 0.01) { f.act = 'block'; f.actT = 0; }
    else if (want.jump && f.y <= 0.01) { f.vy = 4.6; f.y = 0.01; Snd.grunt(1.3); }
  }
  // movement: free when idle or airborne, slow while blocking, none while swinging, hit or recoiling
  const free = f.act === '' || f.act === 'block';
  let sp = f.act === 'block' ? 0.9 : 3.0; if (want.dash && f.act === '') sp = 5.6;
  const tx = free ? want.move * sp : 0;
  f.vx += (tx - f.vx) * Math.min(1, dt * (f.act === 'hit' || f.act === 'recoil' ? 4 : 14));
  f.x += f.vx * dt;
  if (f.y > 0 || f.vy > 0) { f.vy -= 13 * dt; f.y += f.vy * dt; if (f.y <= 0) { f.y = 0; f.vy = 0; } }
  f.x = clamp(f.x, -4.2, 4.2);
}
function fightHit(f, o, A) {
  const F = FIGHT, hx = (f.x + o.x) / 2, hy = 1.35 + o.y;
  let blocked = o.act === 'block' && o.dir === -f.dir;
  // the CPU covers up against a string: after two clean hits inside a second, the next swing mostly gets eaten by the guard, and the masher pays for it
  f.covered = false;
  if (!o.inp && !F.auto) { const n = (o.seen || []).filter(t => F.el - t < 1.6).length; // every swing he has seen thrown lately, landed or not
    const chain = n >= 3 || (A === ATK.heavy && n >= 2); // a string of swings, or heavies thrown back to back
    if (!blocked && chain && Math.random() < (A === ATK.heavy ? 0.7 : 0.4)) { blocked = true; f.covered = true; o.act = 'block'; o.actT = 0; o.stun = 0; o.blockT = 0.3; } }
  const punish = !blocked && f.act !== 'recoil' && (o.act === 'recoil'); // catching him while he's off balance from a blocked swing
  const dmg = (blocked ? A.dmg * 0.2 : punish ? A.dmg * 1.8 : A.dmg) * (f.inp || F.auto ? 1 : 0.8); // the ref hits a little softer than a player
  o.hp = Math.max(0, o.hp - dmg);
  o.vx = f.covered ? 0 : f.dir * (blocked ? A.push * 0.5 : A.push);
  if (!blocked) { o.act = 'hit'; o.actT = 0; o.stun = A.stun; o.hitDir = f.dir; }
  if (blocked) { f.act = 'recoil'; f.actT = 0; f.stun = A.rec * (f.inp ? (f.covered ? 1.75 : 1) : 1.35); f.vx = -f.dir * (f.covered ? 0.4 : 1.2); f.recN++; burst(hx, hy, 0, 6, 2, 0, [[0.7, 0.85, 1]], 0.4, 0.18, -4); Snd.squeak ? Snd.squeak() : 0; }
  else { burst(hx, hy, 0, A === ATK.heavy ? 22 : 12, A === ATK.heavy ? 4 : 2.6, 0, [[1, 1, 1], [1, 0.85, 0.3]], 0.5, 0.26, -6); Snd.smack(); CAMS.shake = Math.max(CAMS.shake, A === ATK.heavy ? 0.55 : 0.25); if (A === ATK.heavy) { shock(hx, hy, 0.1, 2.2, 0xffffff); Snd.cheer(0.8, 1.4); } }
  if (o.hp <= 0 && o.act !== 'ko') { o.act = 'ko'; o.actT = 0; o.vx = f.dir * 3.5; F.phase = 'ko'; F.phT = F.auto ? 0.75 : 1.5; F.winner = f; banner('K.O.', true); Snd.cheer(1.8, 3.5); S.slowT = 0.45; CAMS.shake = Math.max(CAMS.shake, 0.8); burst(o.x, 1.4, 0, 30, 5, 1, [[1, 1, 1], [1, 0.9, 0.5]], 0.9, 0.3, -7); }
  fightHud();
}

/* ---- poses ---- */
function fightPose(f, dt) {
  const m = f.m, t = f.ph, dir = f.dir; neutralPose(m);
  const sw = Math.sin(t * 1.4) * clamp(Math.abs(f.vx) / 3, 0, 1);
  let crouch = 0.18 + 0.05 * Math.sin(t), lean = 0.12;
  // stance: guard up, side on, bouncing
  m.armL.rotation.set(-1.45, 0, -0.35); m.elbL.rotation.x = -2.0; m.armR.rotation.set(-1.35, 0, 0.35); m.elbR.rotation.x = -2.1;
  m.torso.rotation.y = 0.35; m.legL.rotation.x = sw * 0.8 - 0.1; m.legR.rotation.x = -sw * 0.8 + 0.1; m.legL.rotation.z = -0.12; m.legR.rotation.z = 0.12;
  m.body.position.y = Math.abs(Math.sin(t)) * 0.02;
  const a = f.act, u = f.actT;
  if (a === 'light') { const A = ATK.light, k = u < A.a0 ? u / A.a0 : u < A.a1 ? 1 : Math.max(0, 1 - (u - A.a1) / (A.dur - A.a1)); m.armR.rotation.set(-1.55, 0, 0.05 * (1 - k)); m.elbR.rotation.x = -2.1 + 2.0 * k; m.torso.rotation.y = 0.35 - 0.6 * k; lean = 0.12 + 0.12 * k; }
  else if (a === 'heavy') { const A = ATK.heavy, w = Math.min(1, u / A.a0), k = u < A.a0 ? 0 : u < A.a1 ? 1 : Math.max(0, 1 - (u - A.a1) / (A.dur - A.a1)); m.armR.rotation.set(-0.5 - 1.1 * k, 0, 0.9 * w * (1 - k) + 0.05); m.elbR.rotation.x = -1.8 * (1 - k) * w - 0.05; m.torso.rotation.y = 0.35 + 0.55 * w * (1 - k) - 0.7 * k; m.body.rotation.z = 0.12 * w * (1 - k); lean = 0.1 + 0.25 * k; crouch += 0.1 * w; }
  else if (a === 'block') { m.armL.rotation.set(-1.25, 0, 0.55); m.armR.rotation.set(-1.25, 0, -0.55); m.elbL.rotation.x = m.elbR.rotation.x = -2.3; crouch += 0.12; lean = 0.22; m.head.rotation.x = 0.25; }
  else if (a === 'recoil') { const k = Math.sin(Math.PI * clamp(u / f.stun, 0, 1)); m.armR.rotation.set(-0.9 + 0.3 * k, 0, 0.6 * k); m.elbR.rotation.x = -0.6; m.torso.rotation.y = 0.35 + 0.4 * k; m.head.rotation.x = -0.25 * k; lean = 0.12 - 0.3 * k; }
  else if (a === 'hit') { const k = Math.sin(Math.PI * clamp(u / f.stun, 0, 1)); m.torso.rotation.x = -0.45 * k; m.head.rotation.x = -0.5 * k; m.armL.rotation.set(-0.6 - 0.5 * k, 0, -0.8); m.armR.rotation.set(-0.6 - 0.5 * k, 0, 0.8); m.body.rotation.z = 0.08 * k; lean = -0.2 * k; }
  else if (a === 'ko') { const k = Math.min(1, u / 0.45), e = 1 - (1 - k) * (1 - k); m.body.rotation.x = -1.5 * e; m.armL.rotation.set(-2.2 * e, 0, -0.9 * e); m.armR.rotation.set(-2.0 * e, 0, 0.9 * e); m.legL.rotation.x = 0.3 * e; m.legR.rotation.x = -0.2 * e; m.kneeL.rotation.x = 0.4 * e; m.torso.rotation.y = 0; m.head.rotation.x = -0.3 * e; m.body.position.y = 0.12 * e; crouch = 0; lean = 0; }
  if (f.y > 0.01) { m.kneeL.rotation.x = 1.1; m.kneeR.rotation.x = 0.7; m.legL.rotation.x = -0.7; m.legR.rotation.x = -0.3; }
  if (crouch > 0) { m.legL.rotation.x -= crouch; m.legR.rotation.x -= crouch; m.kneeL.rotation.x += crouch * 2; m.kneeR.rotation.x += crouch * 2; m.body.position.y -= 0.86 * (1 - Math.cos(crouch)); }
  m.torso.rotation.x = lean; if (a !== 'hit' && a !== 'ko' && a !== 'block') m.head.rotation.x = -lean * 0.5;
  m.root.position.set(f.x, f.y, f.z); m.root.rotation.y = FACE_X(dir);
}

/* ---- the round ---- */
function fightSettle(refWins) { // the loser eats one heavy: CPU cut-ins and skipped fights
  const F = FIGHT, w = refWins ? F.B : F.A, l = refWins ? F.A : F.B;
  l.act = ''; l.y = l.vy = 0; l.hp = Math.min(l.hp, 10); w.act = 'heavy'; w.actT = ATK.heavy.a0; w.hitDone = true; w.y = w.vy = 0; w.x = l.x - w.dir * 0.95; w.dir = Math.sign(l.x - w.x) || w.dir;
  F.forced = true; fightHit(w, l, ATK.heavy);
}
function updateFight(dt) {
  const F = FIGHT; if (!F.on) return;
  const A = F.A, B = F.B; F.el += dt;
  // OPTIONS skips a human fight: settle it now, at slightly worse odds than fighting it well
  if (!F.auto && !F.winner && (F.phase === 'intro' || F.phase === 'go') && [A.inp, B.inp].some(I => I && I.pauseP)) {
    F.auto = F.skipped = true; F.phase = 'go'; const d = $('fight'); if (d) d.querySelector('.how').textContent = 'FIGHT SKIPPED';
    fightSettle(Math.random() < REF_WIN_SKIP);
  }
  if (F.phase === 'intro') { F.phT -= dt; if (F.phT <= 0) { F.phase = 'go'; banner('FIGHT!', true); Snd.cheer(1.4, 2.5); } }
  else if (F.phase === 'go') {
    F.t -= dt;
    if (F.auto && F.t <= FIGHT_T - 1.2 && !F.winner) fightSettle(Math.random() < REF_WIN_CPU); // CPU player: a quick exchange, then one decides it
    if (F.t <= 0 && !F.winner) { F.t = 0; F.winner = A.hp > B.hp ? A : B; F.phase = 'ko'; F.phT = 1.3; banner('TIME'); Snd.buzzer(); } // a tie goes to the ref
  } else if (F.phase === 'ko') {
    F.phT -= dt;
    if (F.phT <= 0) { F.phase = 'done'; const win = F.winner === A; banner(win ? A.name.toUpperCase() + ' STAYS IN!' : 'EJECTED', win); if (win) Snd.cheer(1.6, 3); else Snd.aww(1.4); F.phT = F.auto ? 0.6 : 1.2; }
  } else if (F.phase === 'done') {
    F.phT -= dt;
    if (F.phT <= 0) { endFight(); return; }
  }
  const allow = F.phase === 'go';
  fightStep(A, B, dt, allow); fightStep(B, A, dt, allow);
  // never overlap: shove apart
  const d = B.x - A.x, min = 0.6; if (Math.abs(d) < min) { const push = (min - Math.abs(d)) / 2, s = d >= 0 ? 1 : -1; A.x -= push * s; B.x += push * s; }
  fightPose(A, dt); fightPose(B, dt);
  // camera: side view that slides with the pair and breathes with the action
  F.midx = damp(F.midx, (A.x + B.x) / 2, 5, dt);
  const spread = clamp(Math.abs(A.x - B.x), 1.2, 5), back = 4.0 + spread * 0.5;
  CAMS.shake = Math.max(0, CAMS.shake - dt * 2.2); const sk = CAMS.shake * CAMS.shake;
  setFov(40);
  cam.position.set(F.midx + (Math.random() - 0.5) * sk * 0.4, 1.45 + (Math.random() - 0.5) * sk * 0.3, back);
  cam.lookAt(F.midx, 1.0, 0);
  updateParticles(dt); updateWaves(dt);
  fightHud();
}
function endFight() {
  const F = FIGHT; F.on = false;
  for (const f of [F.A, F.B]) { neutralPose(f.m); f.m.root.position.set(f.x, 0, f.z); f.m.root.rotation.y = FACE_X(f.dir); }
  F.p.x = F.A.x; F.p.z = 0; F.p.face = FACE_X(F.A.dir); F.ref.x = F.B.x; F.ref.z = 0; F.ref.face = FACE_X(F.B.dir);
  $('fight').classList.add('hidden'); setFov(baseFov()); if (typeof ballMesh !== 'undefined') { ballMesh.visible = true; ballShadow.visible = true; }
  const win = F.winner === F.A, cb = F.onDone; F.onDone = null; F.winner = null;
  if (cb) cb(win);
}
