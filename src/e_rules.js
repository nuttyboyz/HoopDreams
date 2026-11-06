/* ===== Rules (Play Now): the referee, fouls, free throws, the bonus, foul trouble, ejections and bench subs, injuries =====
   NBA rules as implemented here: a personal foul on a shooter = 2 free throws (3 behind the arc), and-one if the shot drops; any other
   personal foul = side out, unless the fouling team has 5 team fouls in the period (the bonus) = 2 free throws. Team fouls reset every
   period. CFG.foulLimit personal fouls (3 by default in these short games, the NBA uses 6) = foul trouble: the player fights the referee
   instead of being ejected (e_fight.js); lose and he is ejected and a bench guy checks in. Blacktop keeps its no-fouls street rules. */
const RULES = { on: () => S.mode === 'play' };
const FT_X = 4.19; // free throw line to rim centre (15 ft from the backboard)

/* ---------- the referee: a random character in stripes every game ---------- */
const REF_KINDS = [
  { name: 'Plumber Pete', skin: 1, hair: 'short', hairC: 0x3a2a1c, bits: ['cap', 'stache'] },
  { name: 'The Comb-Over', skin: 0, hair: 'bald', hairC: 0xf2d16b, bits: ['combover', 'tie'] },
  { name: 'Captain Peg', skin: 1, hair: 'bald', hairC: 0x222222, bits: ['bandana', 'patch', 'bigbeard'] },
  { name: 'Ref-Bot 3000', skin: 0, hair: 'bald', hairC: 0x888888, bits: ['antenna', 'visor'] },
  { name: 'Grandma Ethel', skin: 0, hair: 'bald', hairC: 0xe8e8e8, bits: ['bun', 'glasses'] },
  { name: 'El Luchador', skin: 2, hair: 'bald', hairC: 0xd12a1c, bits: ['mask'] },
  { name: 'Chef Louie', skin: 0, hair: 'short', hairC: 0x222222, bits: ['toque', 'stache'] },
  { name: 'Sheriff Bob', skin: 1, hair: 'short', hairC: 0x7a4a24, bits: ['cowboy', 'stache'] },
  { name: 'DJ Whistle', skin: 3, hair: 'fade', hairC: 0x120e0b, bits: ['headphones', 'shades'] },
  { name: 'Count Foulula', skin: 0, hair: 'short', hairC: 0x0a0a0a, bits: ['cape', 'fangs'] },
];
let REF = null;
function buildRef(kind) {
  const m = buildPlayer({ jersey: 0xf4f4f6, shorts: 0x141414, numColor: 0x141414, shoe: 0x141414, skin: kind.skin, hair: kind.hair, hairC: kind.hairC, extra: kind.bits.includes('bigbeard') ? 'bigbeard' : '', num: '', short: '', hgt: 1.86, stripes: true, build: 'W' });
  const add = (parts, par) => { const o = new T.Mesh(bake(parts), bodyMat); par.add(o); return o; };
  const K = 0x141414, W = 0xf4f4f6, dark = 0x241810;
  // stripes: thin black rings around the white shirt
  if (!m.skin) add([0.08, 0.19, 0.3, 0.41, 0.52].map(y => ({ geo: cylG(0.203, 0.198, 0.045, 14), c: K, m: mx(0, y, 0, 1.06, 1, 0.63) })), m.torso);
  const hp = [];
  for (const b of kind.bits) {
    if (b === 'cap') { hp.push({ geo: cylG(0.1, 0.1, 0.075, 12), c: 0xd12a1c, m: mx(0, 0.075, 0, 1, 1, 1.05) }); hp.push({ geo: cylG(0.045, 0.065, 0.012, 10), c: 0xd12a1c, m: mx(0, 0.045, 0.12, 1.6, 1, 1.1) }); }
    if (b === 'stache') hp.push({ geo: GEO.sph, c: kind.hairC === 0xf2d16b ? 0xb08a30 : dark, m: mx(0, -0.035, 0.1, 0.048, 0.014, 0.018) });
    if (b === 'combover') { hp.push({ geo: GEO.sph, c: kind.hairC, m: mx(0, 0.075, -0.01, 0.105, 0.045, 0.11) }); hp.push({ geo: GEO.sph, c: kind.hairC, m: mx(0.02, 0.07, 0.07, 0.09, 0.035, 0.05) }); }
    if (b === 'tie') add([{ geo: cylG(0.012, 0.03, 0.42, 6), c: 0xd12a1c, m: mx(0, 0.35, 0.128, 1, 1, 0.5) }], m.torso);
    if (b === 'bandana') hp.push({ geo: GEO.sph, c: 0xd12a1c, m: mx(0, 0.045, -0.005, 0.1, 0.07, 0.11) });
    if (b === 'patch') { hp.push({ geo: GEO.sph, c: K, m: mx(0.035, 0.02, 0.1, 0.024, 0.024, 0.01) }); hp.push({ geo: cylG(0.105, 0.105, 0.01, 12), c: K, m: mx(0, 0.03, 0, 1, 1, 1.05, 0.35, 0, 0) }); }
    if (b === 'antenna') { hp.push({ geo: cylG(0.006, 0.006, 0.14, 5), c: 0x888888, m: mx(0, 0.17, 0) }); hp.push({ geo: GEO.sph, c: 0xff3030, m: mx(0, 0.25, 0, 0.022, 0.022, 0.022) }); hp.push({ geo: cylG(0.1, 0.1, 0.08, 10), c: 0x9aa3ad, m: mx(0, 0.07, 0) }); }
    if (b === 'visor') hp.push({ geo: cylG(0.1, 0.1, 0.035, 12), c: 0x30d0ff, m: mx(0, 0.02, 0.015, 1, 1, 1.08) });
    if (b === 'bun') { hp.push({ geo: GEO.sph, c: kind.hairC, m: mx(0, 0.04, -0.01, 0.1, 0.085, 0.11) }); hp.push({ geo: GEO.sph, c: kind.hairC, m: mx(0, 0.13, -0.03, 0.05, 0.045, 0.05) }); }
    if (b === 'glasses') { for (const s of [-1, 1]) hp.push({ geo: cylG(0.028, 0.028, 0.008, 10), c: K, m: mx(s * 0.035, 0.02, 0.1, 1, 1, 1, Math.PI / 2, 0, 0) }); }
    if (b === 'mask') { hp.push({ geo: GEO.sph, c: kind.hairC, m: mx(0, 0.01, -0.005, 0.1, 0.122, 0.112) }); hp.push({ geo: GEO.sph, c: 0xffd84a, m: mx(0, 0.055, 0.1, 0.03, 0.03, 0.012) }); }
    if (b === 'toque') { hp.push({ geo: cylG(0.1, 0.11, 0.17, 12), c: W, m: mx(0, 0.12, 0) }); hp.push({ geo: GEO.sph, c: W, m: mx(0, 0.21, 0, 0.11, 0.05, 0.11) }); }
    if (b === 'cowboy') { hp.push({ geo: cylG(0.085, 0.09, 0.1, 10), c: 0x7a4a24, m: mx(0, 0.09, 0) }); hp.push({ geo: cylG(0.19, 0.19, 0.012, 14), c: 0x7a4a24, m: mx(0, 0.045, 0) }); }
    if (b === 'headphones') { hp.push({ geo: cylG(0.105, 0.105, 0.025, 12), c: K, m: mx(0, 0.06, 0, 1, 1, 1, 0, 0, Math.PI / 2) }); for (const s of [-1, 1]) hp.push({ geo: GEO.sph, c: K, m: mx(s * 0.1, 0, 0, 0.03, 0.045, 0.045) }); }
    if (b === 'shades') hp.push({ geo: cylG(0.1, 0.1, 0.03, 12), c: K, m: mx(0, 0.02, 0.012, 1, 1, 1.06) });
    if (b === 'cape') add([{ geo: cylG(0.22, 0.3, 0.6, 12), c: 0x5a0a1a, m: mx(0, 0.32, -0.12, 1, 1, 0.3) }], m.torso);
    if (b === 'fangs') { for (const s of [-1, 1]) hp.push({ geo: GEO.sph, c: W, m: mx(s * 0.02, -0.055, 0.1, 0.007, 0.016, 0.006) }); }
  }
  if (hp.length) add(hp, m.headC || m.head);
  const shadow = makeShadow(1.1); scene.add(m.root); scene.add(shadow);
  return { m, shadow };
}
function newRef(exclude) {
  if (REF) { scene.remove(REF.m.root); scene.remove(REF.shadow); }
  let k = pick(REF_KINDS); if (exclude && REF_KINDS.length > 1) while (k.name === exclude) k = pick(REF_KINDS);
  const r = buildRef(k);
  REF = { kind: k, name: k.name, short: k.name.split(' ')[0] === 'The' ? k.name.split(' ')[1] : k.name.split(' ')[0], m: r.m, shadow: r.shadow, x: 0, z: HALF_W + 1.0, face: 0, phase: 0, sig: '', sigT: 0, speed: 0, hgt: 1.86, sc: 1.86 / 1.98 };
  return REF;
}
function refSignal(kind, t = 1.6) { if (!REF) return; REF.sig = kind; REF.sigT = t; Snd.whistle(); }
function refUpdate(dt) {
  const r = REF; if (!r) return;
  r.m.root.visible = r.shadow.visible = S.state !== 'menu' && S.mode === 'play';
  if (!r.m.root.visible) return;
  // where he wants to be: trailing the ball along the near sideline, by the lane during free throws, at the spot for a call
  let tx = clamp(B.pos.x, -HALF_L + 1.2, HALF_L - 1.2), tz = HALF_W + 1.0;
  if (S.ft) { const H = hoopOf(S.ft.p.team); tx = H.x - H.dir * 2.4; tz = 3.3; }
  if (r.sigT > 0 && r.spot) { tx = r.spot.x; tz = r.spot.z; }
  if (S.state === 'fight') return; // e_fight.js drives him
  const dx = tx - r.x, dz = tz - r.z, d = Math.hypot(dx, dz), sp = Math.min(5.2, d * 2.2);
  if (d > 0.15) { r.x += dx / d * sp * dt; r.z += dz / d * sp * dt; r.speed = damp(r.speed, sp, 6, dt); } else r.speed = damp(r.speed, 0, 8, dt);
  const lookX = B.pos.x, lookZ = B.pos.z;
  const tf = r.speed > 1.2 ? Math.atan2(dx, dz) : Math.atan2(lookX - r.x, lookZ - r.z);
  r.face += angDiff(r.face, tf) * Math.min(1, dt * 7);
  r.sigT -= dt; if (r.sigT <= 0) { r.sig = ''; r.spot = null; }
  // animation: a simple jog, plus the signal (arm straight up for a foul, both arms out for a block, pointing for a side-out)
  const m = r.m, run = Math.min(1, r.speed / 4); r.phase += dt * (2 + r.speed * 1.4); const sw = Math.sin(r.phase) * run;
  m.legL.rotation.set(sw * 0.8, 0, 0); m.legR.rotation.set(-sw * 0.8, 0, 0); m.kneeL.rotation.x = 0.05 + Math.max(0, Math.sin(r.phase + 1.6)) * run; m.kneeR.rotation.x = 0.05 + Math.max(0, -Math.sin(r.phase + 1.6)) * run;
  m.armL.rotation.set(-sw * 0.7, 0, -0.15); m.armR.rotation.set(sw * 0.7, 0, 0.15); m.elbL.rotation.x = m.elbR.rotation.x = -0.4 - 0.5 * run;
  m.torso.rotation.set(0.05 + 0.2 * run, 0, 0); m.body.rotation.set(0, 0, 0); m.body.position.y = Math.abs(Math.sin(r.phase)) * 0.03 * run;
  if (r.sig === 'foul') { m.armR.rotation.set(-3.05, 0, 0.1); m.elbR.rotation.x = -0.1; m.armL.rotation.set(-0.3, 0, -0.5); }
  else if (r.sig === 'shoot') { m.armR.rotation.set(-3.05, 0, 0.1); m.elbR.rotation.x = -0.1; m.armL.rotation.set(-1.5, 0, -0.2); m.elbL.rotation.x = -1.6; }
  else if (r.sig === 'eject') { m.armR.rotation.set(-2.3, 0, 0.8); m.elbR.rotation.x = -0.05; m.torso.rotation.x = 0.1; }
  else if (r.sig === 'ft') { m.armR.rotation.set(-1.4, 0, 0.3); m.elbR.rotation.x = -0.3; m.armL.rotation.set(-1.4, 0, -0.3); m.elbL.rotation.x = -0.3; }
  m.root.position.set(r.x, 0, r.z); m.root.rotation.y = r.face; r.shadow.position.set(r.x, 0.012, r.z);
}

/* ---------- fouls ---------- */
const foulLimit = () => CFG.foulLimit || 3;
function teamFouls(team) { return team.tf || 0; }
function foulOn(by, on, kind, shot) {
  // kind: 'reach' (reach-in / holding), 'shoot' (on a shooter; shot = the shot object or null when the shot is still coming), 'block' (over the back)
  if (!RULES.on() || !S.live || S.ft || by.team === on.team) return false;
  if (window.__foulLog) window.__foulLog.push(kind + (by.ctrl ? ':H' : ':C'));
  by.fouls = (by.fouls || 0) + 1; by.stats.pf = (by.stats.pf || 0) + 1; by.team.tf = (by.team.tf || 0) + 1;
  const charge = kind === 'charge', flagrant = kind === 'flagrant', bonus = by.team.tf >= 5 && !charge, shooting = kind === 'shoot' || flagrant;
  if (flagrant) { by.fouls++; by.stats.pf++; } // a flagrant counts double toward foul trouble
  refSignal(shooting ? 'shoot' : 'foul'); REF && (REF.spot = { x: clamp(by.x + (by.x > 0 ? 1.5 : -1.5), -HALF_L + 1, HALF_L - 1), z: clamp(by.z + 2.2, -HALF_W, HALF_W + 1) });
  S.foulT = 1.2; // the whistle: the play is dead for a moment
  const nth = by.fouls, lim = foulLimit();
  toast((flagrant ? 'FLAGRANT FOUL' : charge ? 'CHARGE · OFFENSIVE FOUL' : shooting ? 'SHOOTING FOUL' : bonus ? 'FOUL · BONUS' : 'FOUL') + ' · ' + by.short.toUpperCase() + ' (' + nth + ')');
  Snd.aww(0.8); CAMS.shake = Math.max(CAMS.shake, 0.2);
  if (charge) Com.say('charge', by.short, 1, 2500); else if (flagrant) Com.say('flagrant', by.short, 2, 2000); else if (shooting) Com.say('sfoul', on.short, 1, 2500); else if (bonus) Com.say('bonus', by.team.info.short, 1, 2500); else Com.say('foul', by.short, 1, 2500);
  if (nth === lim - 1 && S.humans.some(h => h.team === by.team)) toast(by.short.toUpperCase() + ' · ONE MORE FOUL AND HE FIGHTS THE REF');
  const H = hoopOf(on.team);
  const proceed = () => {
    if (charge) { B.owner = null; B.pass = null; B.state = 'dead'; S.deadT = 1.0; S.deadThen = () => { turnoverTo(on.team, clamp(by.x, -HALF_L + 1, HALF_L - 1), by.z > 0 ? HALF_W - 0.3 : -HALF_W + 0.3, ''); }; }
    else if (flagrant) { if (shot && shot.scored) { toast('AND ONE'); Com.say('andone', on.short, 2, 0); startFT(on, 1, true); } else if (shot && !shot.scored && B.state === 'shot') S.ftAfter = { p: on, n: 2 }; else startFT(on, 2, false); }
    else if (shooting) {
      if (shot && shot.scored) { toast('AND ONE'); Com.say('andone', on.short, 2, 0); startFT(on, 1, true); }
      else if (shot && !shot.scored && B.state === 'shot') { S.ftAfter = { p: on, n: shot.three ? 3 : 2 }; } // the shot is still in the air: free throws when it lands (and-one if it drops)
      else startFT(on, (shot ? shot.three : isThree(on.x, on.z, H)) ? 3 : 2, false);
    } else if (bonus) startFT(on, 2, false);
    else { B.owner = null; B.pass = null; B.state = 'dead'; S.deadT = 1.0; S.deadThen = () => { turnoverTo(on.team, clamp(by.x, -HALF_L + 1, HALF_L - 1), by.z > 0 ? HALF_W - 0.3 : -HALF_W + 0.3, ''); }; }
  };
  if (!shooting) { B.owner = null; B.pass = null; B.state = 'dead'; on.act = on.act === 'wind' ? '' : on.act; }
  if (nth >= lim) { S.deadT = 0; foulTrouble(by, proceed); } else proceed();
  return true;
}
// reach-in: a failed steal attempt up close is a foul sometimes, and spamming the button makes it likely
function reachFoulCheck(p, h, d) {
  if (!RULES.on()) return false;
  p.reachN = (p.reachN || 0) * (p.reachAt && S.elapsed - p.reachAt < 2.5 ? 1 : 0) + 1; p.reachAt = S.elapsed;
  const shooting = h.act === 'wind' || h.act === 'layup';
  let ch = shooting ? 0.24 : 0.025 + 0.14 * Math.max(0, p.reachN - 1) + (h.protect ? 0.06 : 0) + (p.sprint ? 0.04 : 0); // one poke is almost free, mashing it is a foul
  if (!p.ctrl) ch *= 0.7; // the CPU is a little more careful than a human mashing the button
  if (d > 1.0) ch *= 0.5;
  if (Math.random() < ch) { foulOn(p, h, shooting ? 'shoot' : 'reach', null); return true; }
  return false;
}
// a block attempt that got body instead of ball
function blockFoulCheck(q, sh, shot) { if (!RULES.on() || sh.fire) return false; const dunk = shot && shot.dunk; if (Math.random() < (dunk ? 0.09 : 0.08)) { foulOn(q, sh, dunk && Math.random() < 0.2 ? 'flagrant' : 'shoot', shot); if (dunk) maybeInjure(sh, 0.25); return true; } return false; }
// the charge: a sprinting ball handler runs over a defender who is set in his path
function chargeCheck(dt) {
  const p = B.owner; if (!p || !S.live || S.ft || S.deadT > 0 || B.state !== 'held') return;
  if (p.chargeT > 0) { p.chargeT -= dt; return; }
  const spd = Math.hypot(p.vx, p.vz); if (spd < 5.0 || p.act || !p.sprint) return; // only a full sprint into a set man
  const H = hoopOf(p.team);
  for (const q of opp(p.team).players) {
    if (q.act || q.y > 0.05 || Math.hypot(q.vx, q.vz) > 0.5) continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > 0.62 * (p.sc + q.sc)) continue;
    if ((dx * p.vx + dz * p.vz) / (d * spd + 1e-6) < 0.75) continue; // he has to be in the path
    p.chargeT = 8; if (Math.random() < (q.ctrl ? 0.3 : p.ctrl ? 0.2 : 0.1)) { p.vx = p.vz = 0; q.stun = 0.5; foulOn(p, q, 'charge', null); }
    return;
  }
}

/* ---------- free throws ---------- */
function ftHint() { const f = S.ft; if (!f || !f.p.ctrl) return; hint('<b>FREE THROW ' + (f.total - f.left + 1) + ' OF ' + f.total + '</b> · ' + (CFG.shotStick ? 'pull the right stick down and let go in the green' : 'hold □ and release in the green')); }
function startFT(p, n, andOne) {
  const H = hoopOf(p.team), dir = H.dir, team = p.team, o = opp(team);
  S.ft = { p, left: n, total: n, phase: 'setup', t: 1.0, andOne: !!andOne };
  S.poss = team.idx; S.shotClock = 24; B.owner = null; B.pass = null; B.shot = null; B.state = 'dead'; B.lock = 0; B.pos.set(H.x - dir * FT_X - dir * 0.8, 1.0, 2.4);
  // line everybody up: the shooter at the line, the rebounders along the lane (defence has the inside spots), the rest behind the arc
  p.x = H.x - dir * FT_X; p.z = 0; p.vx = p.vz = 0; p.act = ''; p.face = dir > 0 ? Math.PI / 2 : -Math.PI / 2; p.y = 0;
  const lane = [[1.0, 1.5], [1.0, -1.5], [2.1, 1.5], [2.1, -1.5], [3.2, 1.5], [3.2, -1.5]];
  const oth = team.players.filter(q => q !== p), def = o.players.slice();
  let li = 0; const put = (q, spot) => { q.x = H.x - dir * spot[0]; q.z = spot[1]; q.vx = q.vz = 0; q.act = ''; q.y = 0; q.face = p.face; q.hold = 0.2; };
  put(def[0], lane[li++]); put(def[1], lane[li++]); if (oth[0]) put(oth[0], lane[li++]); if (oth[1]) put(oth[1], lane[li++]); if (def[2]) put(def[2], lane[li++]); if (oth[2]) put(oth[2], lane[li++]);
  for (const q of def.slice(3)) put(q, [FT_X + 2.8, q.z > 0 ? 3.5 : -3.5]);
  for (const q of oth.slice(3)) put(q, [FT_X + 1.6, q.z > 0 ? -5.5 : 5.5]);
  refSignal('ft', 1.4);
  for (const h of S.humans) if (h.txt) h.txt.className = 'mtt'; // clear the last shot's grade so the line reads clean
  toast((andOne ? 'AND ONE · ' : '') + p.short.toUpperCase() + ' · ' + n + ' FREE THROW' + (n > 1 ? 'S' : ''));
  if (!andOne) Com.say('ft', p.short, 1, 3000);
  ftHint();
}
function ftUpdate(dt) {
  const f = S.ft; if (!f) return;
  const p = f.p, H = hoopOf(p.team);
  if (f.phase === 'setup') {
    f.t -= dt; for (const q of S.players) if (q !== p) { q.wx = q.wz = 0; q.hold = 0.2; }
    p.wx = p.wz = 0; p.x = H.x - H.dir * FT_X; p.z = 0; p.vx = p.vz = 0;
    // the referee bounces it over
    if (f.t < 0.9 && f.t > 0) { B.pos.x = damp(B.pos.x, p.x, 6, dt); B.pos.z = damp(B.pos.z, p.z + 0.3, 6, dt); B.pos.y = 0.3 + Math.abs(Math.sin(f.t * 9)) * 0.8; }
    if (f.t <= 0) { giveBall(p, 'ft'); S.poss = p.team.idx; f.phase = 'ready'; f.t = 0; S.live = true; ftHint(); if (!p.ctrl) f.cpuT = rnd(0.7, 1.4); }
  } else if (f.phase === 'ready') {
    for (const q of S.players) if (q !== p) { q.wx = q.wz = 0; q.hold = 0.2; }
    p.wx = p.wz = 0; p.vx = p.vz = 0; p.x = H.x - H.dir * FT_X; p.z = 0;
    if (!p.ctrl && p.act === '') { f.cpuT -= dt; if (f.cpuT <= 0) startJump(p); }
    if (p.act === 'wind') f.phase = 'wind';
  } else if (f.phase === 'wind') {
    for (const q of S.players) if (q !== p) { q.wx = q.wz = 0; q.hold = 0.2; }
    p.wx = p.wz = 0; if (p.act !== 'wind') { f.phase = 'flight'; }
  } else if (f.phase === 'flight') {
    if (f.left > 1) for (const q of S.players) if (q !== p) { q.wx = q.wz = 0; q.hold = 0.2; }
    const sh = B.shot;
    if (!sh || B.state !== 'shot' || sh.missed || sh.scored || (sh.touched && B.pos.y < RIM_H - 0.3 && B.vel.y < 0)) {
      if (sh && sh.scored) { if (f.left > 1) { f.left--; nextFT(); } else endFT(true); }
      else if (f.left > 1) { f.left--; nextFT(); } else endFT(false);
    }
  }
}
function nextFT() { const f = S.ft; const p = f.p, H = hoopOf(p.team); B.owner = null; B.state = 'dead'; B.shot = null; B.pass = null; B.pos.set(H.x - H.dir * FT_X - H.dir * 0.8, 1.0, 2.4); f.phase = 'setup'; f.t = 0.85; p.act = ''; p.y = 0; refSignal('ft', 0.8); ftHint(); }
function endFT(made) {
  const f = S.ft; S.ft = null; hint('');
  if (made) { /* scoreBasket already queued the inbound through S.dead / afterScore */ }
  else { for (const q of S.players) q.hold = 0; S.live = true; }
  if (S.pendingFight) { const pf = S.pendingFight; S.pendingFight = null; pf(); }
}

/* ---------- foul trouble: fight the referee ---------- */
function foulTrouble(p, after) {
  if (S.ft || S.state !== 'play') { S.pendingFight = () => foulTrouble(p, after); return; } // let the free throws finish first
  banner(p.short.toUpperCase() + ' · FOUL TROUBLE', true); Com.say('foulout', p.short, 2, 0); refSignal('eject', 3);
  const go = () => {
    S.state = 'fight'; S.live = false;
    // clear the stage: everyone else walks off to the sidelines
    for (const q of S.players) if (q !== p) { q.x = clamp(q.x, -HALF_L + 1, HALF_L - 1); q.z = q.team.idx === 0 ? -HALF_W - 0.9 : -HALF_W - 1.8; q.vx = q.vz = 0; q.act = ''; q.y = 0; q.wx = q.wz = 0; }
    const done = (win) => {
      S.state = 'play';
      if (win) { p.fouls = Math.max(0, foulLimit() - 2); toast(p.short.toUpperCase() + ' BEAT THE REF · HE STAYS IN · ' + p.fouls + ' PF'); Com.say('fightwin', p.short, 2, 0); Snd.cheer(1.4, 3); }
      else { toast(p.short.toUpperCase() + ' LOST · EJECTED'); Com.say('fightlose', p.short, 2, 0); Snd.aww(1.4); ejectPlayer(p); }
      newRef(REF ? REF.name : ''); REF.x = 0; REF.z = HALF_W + 1; // a fresh referee jogs in either way
      // everyone back on the floor for whatever the foul called for
      for (const t of S.teams) formation(t, false);
      S.deadT = 1.2; S.deadThen = null; after();
      const prev = S.deadThen; S.deadT = Math.max(S.deadT, 1.2); S.deadThen = () => { if (prev) prev(); if (!S.ft) S.live = true; }; // play resumes after the whistle (free throws set it themselves)
    };
    if (typeof startFight === 'function') startFight(p, REF, done);
    else { setTimeout(() => done(Math.random() < 0.5), 1500); }
  };
  S.deadT = 2.0; S.deadThen = go; B.owner = null; B.pass = null; B.state = 'dead';
}
const BENCH = { id: 'bench', name: 'Bench Guy', role: 'W', hgt: 1.98, ovr: 75, t3: 72, mid: 74, fin: 74, dnk: 62, spd: 70, def: 70, reb: 62, skin: 2, hair: 'short', hairC: 0x120e0b, extra: '', num: 50 };
function ejectPlayer(p) {
  const team = p.team, i = team.players.indexOf(p), gi = S.players.indexOf(p);
  const pl = Object.assign({}, BENCH, { role: p.role, hgt: p.hgt, skin: (Math.random() * 6) | 0, num: 50 + i, id: 'bench' + team.idx });
  const q = makePlayer(team, i, pl); q.x = p.x; q.z = p.z; q.face = p.face;
  scene.remove(p.m.root); scene.remove(p.shadow); if (p.tag) p.tag.remove();
  team.players[i] = q; if (gi >= 0) S.players[gi] = q;
  if (p.ctrl) { const h = p.ctrl; p.ctrl = null; h.p = null; setCtrl2(h, q); }
  if (B.owner === p) B.owner = null; if (B.last === p) B.last = q; if (S.lastScorer === p) S.lastScorer = q;
  p.ejected = true; q.subFor = p;
  const d = document.createElement('div'); d.className = 'tag'; d.innerHTML = '<i style="background:' + css(team.kit.jersey === 0xf1f3f8 ? team.kit.shorts : team.kit.jersey) + '"></i>' + q.short + ' <b>' + q.ovr + '</b>'; $('hud').appendChild(d); q.tag = d;
  Com.say('sub', q.short, 1, 0);
  return q;
}

/* ---------- injuries: a bad landing, a hard block or a broken ankle can leave a player limping for the rest of the game ---------- */
function maybeInjure(p, chance) {
  if (!RULES.on() || p.inj || p.fire) return;
  if (Math.random() >= chance) return;
  p.inj = rnd(0.3, 0.6); p.rat.spd *= 1 - 0.3 * p.inj; p.rat.dunk *= 1 - 0.8 * p.inj; p.rat.inside *= 1 - 0.2 * p.inj;
  toast(p.short.toUpperCase() + ' IS HURT · PLAYING THROUGH IT'); Com.say('injury', p.short, 1, 0); Snd.aww(1.2);
  if (p.tag) p.tag.classList.add('inj');
}

/* ---------- per-frame ---------- */
function rulesUpdate(dt) {
  if (!RULES.on()) { if (REF && REF.m.root.visible) { REF.m.root.visible = false; REF.shadow.visible = false; } return; }
  if (S.foulT > 0) S.foulT -= dt;
  if (S.deadT > 0) { S.deadT -= dt; if (S.deadT <= 0) { const f = S.deadThen; S.deadThen = null; if (f) f(); } }
  // a shooting foul called while the shot was in the air: free throws once it lands
  if (S.ftAfter && (!B.shot || B.state !== 'shot' || B.shot.scored || B.shot.missed)) {
    const a = S.ftAfter; S.ftAfter = null;
    if (B.shot && B.shot.scored) { toast('AND ONE'); Com.say('andone', a.p.short, 2, 0); S.dead = 0; B.lock = 0; startFT(a.p, 1, true); }
    else { B.lock = 0; startFT(a.p, a.n, false); }
  }
  chargeCheck(dt);
  if (S.pendingFight && !S.ft && S.deadT <= 0 && S.state === 'play') { const pf = S.pendingFight; S.pendingFight = null; pf(); }
  ftUpdate(dt);
  refUpdate(dt);
}
