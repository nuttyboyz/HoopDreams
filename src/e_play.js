/* ===== Gameplay: actions, shots, passes, AI, ball physics ===== */
// difficulty only drives the CPU's team: a human's AI teammates always play at Pro, so All-Star is harder, not just faster
const dif = p => p && p.gymLvl !== undefined ? Math.min(p.gymLvl, 2) : p && p.team && p.team.humans && p.team.humans.length ? 1 : CFG.diff;
const oppDif = p => { if (S.mode === 'gym') { const L = GYM.lanes[p.lane]; return L && L.npc ? dif(L.npc) : 1; } return dif(opp(p.team).players[0]); };
function nearestOpp(p) { let bd = 1e9, bq = null; for (const q of opp(p.team).players) { const d = d2(p.x, p.z, q.x, q.z); if (d < bd) { bd = d; bq = q; } } return { d: bd, q: bq }; }
function contestOf(p) { const r = nearestOpp(p); if (!r.q) return 0; let c = clamp(1 - (r.d - 0.6) / 1.6, 0, 1); if (r.q.blockT > 0) c = Math.min(1, c + 0.3); if (p.sepT > 0) c *= 0.55; if (!r.q.ctrl && dif(r.q) === 2) c = Math.min(1, c * 1.3 + (p.ctrl ? 0.06 : 0)); return c * (0.7 + 0.3 * r.q.rat.def); }
function laneClear(a, b) { // lowest distance from any opponent to the a->b segment
  const o = opp(a.team); let m = 9; const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
  for (const q of o.players) { const t = clamp(((q.x - a.x) * dx + (q.z - a.z) * dz) / L, 0, 1); m = Math.min(m, d2(q.x, q.z, a.x + dx * t, a.z + dz * t)); }
  return m;
}
function moveTo(p, x, z, sprint) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.3) { p.wx = p.wz = 0; return d; } const k = Math.min(1, d / 1.2); p.wx = dx / d * k; p.wz = dz / d * k; if (sprint || d > 5) p.sprint = true; return d; }

/* ---------- shooting ---------- */
const METER_T = 0.8, METER_TIME = 0.55;
/* Range. Every jump shot is scaled by how far it is from the rim: short twos are the easiest, a long two is a little harder,
   a three right at the line is the sweet spot of the deep game, and every metre behind the line costs about 17 points.
   Corner threes count as on the line. NBA reference: short mid about 42%, long two 40%, threes 36-43%, 28+ ft under 30%. */
function rangeK(d, three) { const e = three ? Math.max(d, ARC) : d; return e <= ARC ? 1 - 0.1 * clamp((e - 3) / (ARC - 3), 0, 1) : clamp(0.88 - 0.17 * (e - ARC), 0.2, 0.88); }
function meterW(p) { if (p.fire) return 0.5; const H = hoopOf(p.team), d = d2(p.x, p.z, H.x, 0), three = isThree(p.x, p.z, H), r = three ? p.rat.three : p.rat.shoot; return (0.024 + 0.045 * r + 0.015 * (1 - contestOf(p))) * (0.55 + 0.45 * rangeK(d, three)) * (p.ctrl ? [1.2, 1, 0.82][oppDif(p)] : 1); } // Rookie widens your green window, All-Star tightens it // the green window shrinks the deeper the shot
function shotP(p, d, three, contest, grade, kind) {
  let tb = S.mode === 'play' ? (91 - p.team.info.ovr) * 0.004 + (p.team.info.edge || 0) : 0; // franchise games lean slightly toward the underdog so every team stays in it
  const rt = three ? p.rat.three : p.rat.shoot, k = kind === 'layup' ? 1 : rangeK(d, three);
  let base = kind === 'layup' ? 0.42 + 0.3 * p.rat.inside : three ? 0.2 + 0.34 * p.rat.three : 0.28 + 0.28 * p.rat.shoot + (d < 4 ? 0.07 : 0);
  const gap = S.mode === 'gym' || S.mode === 'shoot' ? 0 : opp(p.team).score - p.team.score; const th = S.mode === 'play' ? 8 : 6; tb += gap >= th ? Math.min(0.08, (gap - th + 2) * 0.01) : gap <= -th - 2 ? -Math.min(0.06, (-gap - th) * 0.01) : 0; // runs happen, blowouts tighten up // a little catch-up when you are down big
  if (!p.ctrl && dif(p) === 2 && p.streak >= 1) tb += 0.03 * Math.min(2, p.streak); // All-Star: hot hands run twice as hot
  base = base * k + tb;
  if (!p.ctrl) { const df = [0.92, 1.08, 1.22][dif(p)], kc = three ? k / 0.88 : k; base = base - tb; base = base * (kc / k) + (S.mode === 'black' && three ? Math.min(tb, 0) - 0.14 : tb); return clamp((base - (kind === 'layup' ? 0.4 : 0.25) * contest) * df + (kind === 'layup' ? 0.06 : (three ? 0.12 : 0.08) * kc), 0.05, 0.92); } // the CPU already picks its threes, so the line itself costs it nothing, only the steps behind it
  if (kind === 'layup') return clamp(base + 0.16 - 0.4 * contest, 0.12, 0.96);
  switch (grade) {
    case 'perfect': return clamp((0.9 + 0.08 * rt) * Math.min(1, 0.25 + 0.75 * k / 0.88) - 0.14 * contest + tb, 0.25, 0.97); // a green release is money when open, still likely when contested
    case 'good': return clamp(base + 0.18 * k - 0.25 * contest, 0.12, 0.8); // a good release is a real shot, just not money
    case 'slight': return clamp(base * 0.6 - 0.2 * contest, 0.04, 0.5);
    default: return 0.05;
  }
}
function startJump(p) { p.act = 'wind'; p.actT = 0; p.fill = 0; p.vx *= 0.15; p.vz *= 0.15; // set your feet: no drifting inside the arc mid-shot
   p.cpuRel = rnd(0.72, 0.9); Snd.grunt(p.role === 'B' ? 0.7 : 1); }
function startLayup(p, H) { p.act = 'layup'; p.actT = 0; p.dur = 0.64; p.start = { x: p.x, z: p.z }; p.layDone = false; p.alley = false; Snd.grunt(0.9); }
function startDunk(p, H, alley) {
  const d = d2(p.x, p.z, H.x, 0);
  p.act = 'dunk'; p.actT = 0; p.start = { x: p.x, z: p.z }; p.slammed = false; p.alley = !!alley; p.dunkC = dunkContest(p, H);
  p.end = { x: H.x - H.dir * 0.5, z: clamp(p.z * 0.2, -0.5, 0.5) };
  p.variant = p.fire ? pick(['TOMAHAWK JAM', 'WINDMILL SLAM', '360 SLAM', 'REVERSE JAM']) : '';
  p.dur = p.fire ? 0.9 + d * 0.06 : 0.5 + d * 0.07; p.jh = p.fire ? 1.35 : 0.95; p.spin = 0;
  Snd.grunt(0.7); if (p.fire) Snd.whoosh(); callOut(p, 'dunk');
}
// how crowded the last 3 m to the rim are: 0 = nobody home, 1 = a big man standing on the rim
function dunkContest(p, H) {
  let c = 0, who = null; const ax = p.x, az = p.z, bx = H.x - H.dir * 0.4, bz = 0, dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  for (const q of opp(p.team).players) {
    if (q.stun > 0) continue; const t = clamp(((q.x - ax) * dx + (q.z - az) * dz) / L, 0, 1), px = ax + dx * t, pz = az + dz * t;
    if (d2(px, pz, bx, bz) > 3) continue; const off = d2(q.x, q.z, px, pz); if (off > 1.5) continue;
    const set = Math.hypot(q.vx, q.vz) < 1.2 && off < 0.8 ? 1.35 : 1; // a man planted in the lane is a wall
    const v = (1 - off / 1.5) * clamp(q.hgt / p.hgt, 0.85, 1.2) * (0.7 + 0.4 * q.rat.def) * set; if (v > c) { c = v; who = q; }
  }
  p.dunkBy = who; return clamp(c, 0, 1.3);
}
function findBlocker(sh, range) {
  for (const q of opp(sh.team).players) if (q.blockT > 0 && d2(q.x, q.z, sh.x, sh.z) < range + (q.role === 'B' ? 0.35 : 0)) return q;
  return null;
}
function doBlock(sh, q) {
  q.stats.blk++; B.owner = null; B.state = 'loose'; B.shot = null; B.pass = null; B.lock = 0.35; sh.act = ''; sh.hold = 0.4;
  maybeInjure(sh, 0.02);
  const H = hoopOf(sh.team), ux = -H.dir; B.pos.set(sh.x + (q.x - sh.x) * 0.5, Math.max(2.2, sh.y + 2.2), sh.z + (q.z - sh.z) * 0.5);
  B.vel.set(ux * rnd(2, 5), rnd(1, 3), rnd(-4, 4)); Snd.smack(); Snd.cheer(1, 2);
  banner('BLOCKED!'); Com.say('block', q.short, 1, 3000); sh.streak = sh.fire ? sh.streak : 0; callOut(q, 'dunk');
  burst(B.pos.x, B.pos.y, B.pos.z, 14, 3, 1, [[1, 1, 1]], 0.5, 0.15, -4);
}
function releaseShot(p, kind) {
  const H = hoopOf(p.team), ft = !!(S.ft && S.ft.p === p && S.ft.phase !== 'setup'), d = ft ? FT_X : d2(p.x, p.z, H.x, 0), three = kind === 'jump' && !ft && isThree(p.x, p.z, H);
  const contest = ft ? 0 : contestOf(p);
  let grade = 'cpu', pm;
  if (ft && !p.ctrl) { pm = 0.42 + 0.45 * (0.6 * p.rat.shoot + 0.4 * p.rat.three); p.stats.fta++; const made = Math.random() < pm; launchShot(p, H, made, d, false, 'jump', 'cpu'); B.shot.ft = true; return; }
  if (ft) p.stats.fta++;
  if (p.fire && !ft) { grade = 'perfect'; pm = 1; }
  else if (p.ctrl && kind === 'jump') {
    const e = p.fill - METER_T, w = meterW(p);
    grade = Math.abs(e) < w ? 'perfect' : Math.abs(e) < w * 2.6 ? 'good' : Math.abs(e) < 0.3 ? 'slight' : 'bad';
    p.relE = e; pm = shotP(p, d, three, contest, grade, 'jump'); if (grade === 'perfect') p.stats.perf++;
    p.lastC = contest; showGrade(p, grade, e);
  } else if (p.ctrl) { pm = shotP(p, d, three, contest, 'good', 'layup'); }
  else { pm = shotP(p, d, three, contest, 'cpu', kind); const nd = nearestOpp(p).q; if (nd && nd.ctrl && kind === 'jump' && nd.ctrl.txt && !ft) { const h = nd.ctrl, l = contestLabel(contest); h.txt.textContent = l[0]; h.txt.style.color = l[1]; h.txt.className = 'mtt'; void h.txt.offsetWidth; h.txt.className = 'mtt show'; h.txtP = nd; } }
  // blocks: a clean one sends it back, a late one is a shooting foul
  let late = null;
  if (!p.fire && !ft) { const q = findBlocker(p, kind === 'layup' ? 1.5 : 1.2); if (q && Math.random() < (kind === 'layup' ? 0.18 : 0.1) * (0.6 + q.rat.def * 0.6) * clamp(q.hgt / p.hgt, 0.85, 1.15)) { doBlock(p, q); return; } late = q; }
  const made = Math.random() < pm;
  launchShot(p, H, made, d, three, kind, grade);
  if (ft) B.shot.ft = true; else if (typeof fxShot === 'function') fxShot(kind);
  if (late) blockFoulCheck(late, p, B.shot);
}
function launchShot(p, H, made, d, three, kind, grade) {
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  const sx = p.x + fx * 0.2, sy = p.y + (kind === 'layup' ? 2.45 : 2.3) * p.sc, sz = p.z + fz * 0.2;
  let tx = H.x, tz = 0;
  if (made) { const n = p.fire ? 0 : (grade === 'perfect' ? 0.012 : 0.05); tx += rnd(-n, n); tz += rnd(-n, n); }
  else { const air = grade === 'bad' || Math.random() < 0.1; const a = rnd(0, 6.28), m = air ? rnd(0.55, 0.95) : rnd(0.14, 0.36); tx += Math.cos(a) * m + (Math.random() < 0.25 ? H.dir * 0.3 : 0); tz += Math.sin(a) * m; }
  const Tf = kind === 'layup' ? 0.56 + d * 0.03 : Math.sqrt((Math.tan(clamp(0.95 - d * 0.04, 0.62, 0.85)) * d + (RIM_H + 0.02 - sy)) / (0.5 * G)); // steep entry so the ball clears the rim
  B.owner = null; B.state = 'shot'; B.pass = null; B.lock = 0.25; B.last = p; B.lastTeam = p.team.idx;
  B.pos.set(sx, sy, sz); B.vel.set((tx - sx) / Tf, (RIM_H + 0.02 - sy + 0.5 * G * Tf * Tf) / Tf, (tz - sz) / Tf);
  B.shot = { by: p, team: p.team, H, three, dunk: false, layup: kind === 'layup', scored: false, made, touched: false, special: false, fire: p.fire, missed: false };
  if (window.__shotLog) window.__shotLog.push({ n: p.short, tm: p.team.info.abbr, t: p.team.idx, kind, three, d: +d.toFixed(1), made, grade, fire: p.fire, sh: B.shot, why: p.whyShot });
  p.stats.fga++; p.catchLock = 0.5; p.act = p.act === 'wind' ? 'land' : p.act; if (p.act === 'land') { p.actT = 0; p.vy = 0; p.landT = undefined; }
  Snd.whoosh(); if (!p.fire) S.shotClock = Math.max(S.shotClock, 0);
  if (p.fire) { for (let i = 0; i < 18; i++) emit(sx, sy, sz, rnd(-1, 1), rnd(0, 2), rnd(-1, 1), 0.5, 0.5, 1, 0.6, 0.2, 0, 2); B.fireT = 2.2; }
}
const contestLabel = c => c < 0.25 ? ['OPEN', '#35e0a1'] : c < 0.65 ? ['CONTESTED', '#ffb040'] : ['SMOTHERED', '#ff4d5e'];
function showGrade(p, grade, e) {
  const h = p.ctrl; if (!h || !h.txt) return;
  const t = { perfect: ['PERFECT!', '#35e0a1'], good: ['GOOD', '#7fd2ff'], slight: [e < 0 ? 'EARLY' : 'LATE', '#ffb040'], bad: [e < 0 ? 'WAY EARLY' : 'WAY LATE', '#ff4d5e'] }[grade];
  h.txt.textContent = t[0] + (p.fire ? '' : ' · ' + contestLabel(p.lastC || 0)[0]); h.txt.style.color = t[1]; h.txt.className = 'mtt'; void h.txt.offsetWidth; h.txt.className = 'mtt show'; h.txtP = p;
}
function slam(p) {
  const H = hoopOf(p.team), fire = p.fire || p.alleyFire;
  p.slammed = true;
  const bq = fire ? null : findBlocker(p, 1.6);
  // a crowded rim stops some dunks: half get sent back, half rattle out. Great dunkers beat it more often
  const stop = fire || p.alley ? 0 : clamp((p.dunkC || 0) * (0.78 - 0.35 * p.rat.dunk) + (bq ? 0.1 : 0), 0, 0.68) * (S.mode === 'black' ? 0.85 : 1) * (p.ctrl ? 1.12 : 1), q0 = bq || p.dunkBy;
  if (q0 && Math.random() < stop) {
    if (window.__shotLog) window.__shotLog.push({ n: p.short, tm: p.team.info.abbr, t: p.team.idx, kind: 'dunk', three: false, d: 0, made: false, fire: false });
    if (Math.random() < 0.5) { p.stats.fga++; doBlock(p, q0); p.act = 'land'; p.actT = 0; p.slammed = true; return; }
    p.stats.fga++; B.owner = null; B.state = 'loose'; B.shot = null; B.pass = null; B.lock = 0.3; B.last = p; B.lastTeam = p.team.idx;
    B.pos.set(H.x - H.dir * 0.2, RIM_H + 0.25, rnd(-0.2, 0.2)); B.vel.set(-H.dir * rnd(2.5, 4.5), rnd(3, 5), rnd(-2.5, 2.5));
    H.shake = 1.0; Snd.slam(); Snd.aww(1); toast('RIMMED OUT'); p.streak = 0; p.act = 'dunkEnd'; p.actT = 0; p.hang = 0.2; return;
  }
  B.owner = null; B.state = 'shot'; B.pass = null; B.pos.set(H.x - H.dir * 0.03, RIM_H + 0.32, 0); B.vel.set(-H.dir * 0.4, -5.5, 0); B.lock = 0.5; B.last = p; B.lastTeam = p.team.idx;
  B.shot = { by: p, team: p.team, H, three: false, dunk: true, layup: false, scored: false, made: true, touched: true, special: !!fire, alley: p.alley, fire: p.fire, missed: false };
  if (window.__shotLog) window.__shotLog.push({ n: p.short, tm: p.team.info.abbr, t: p.team.idx, kind: 'dunk', three: false, d: 0, made: true, fire: p.fire });
  p.stats.fga++; p.act = 'dunkEnd'; p.actT = 0; p.hang = fire ? 0.7 : 0.38;
  if (bq) blockFoulCheck(bq, p, B.shot); // hacked on the way up: and-one when it drops
  H.shake = fire ? 1.4 : 0.9; Snd.slam(); CAMS.shake = Math.max(CAMS.shake, fire ? 1.1 : 0.45);
  burst(H.x, RIM_H, 0, fire ? 50 : 16, fire ? 6 : 3, 0, null, 0.7, 0.55, 1);
  if (fire) {
    shock(H.x, 0.05, 0, 9, 0xffa030); shock(H.x, RIM_H, 0, 4, 0xffffff);
    burst(H.x, RIM_H, 0, 46, 8, 1, [[1, 1, 1], [0.7, 0.9, 1]], 1.1, 0.14, -9);
    banner(p.variant || 'FIRE DUNK!', true); Snd.cheer(1.8, 3.5); S.slowT = 0.55;
    const fl = document.getElementById('flash'); if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
  } else Snd.cheer(1, 2.2);
}
function finishLayupShot(p) { releaseShot(p, 'layup'); p.layDone = true; }

/* ---------- passing ---------- */
function pickPassHuman(p, I, slot) {
  const mates = p.team.players.filter(q => q !== p);
  if (!mates.length) return null;
  if (slot >= 0 && mates[slot]) return mates[slot];
  const sm = Math.hypot(I.wx, I.wz); let best = null, bs = -9;
  for (const q of mates) {
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1; let s = -d * 0.04 + Math.min(laneClear(p, q), 2.5) * 0.35;
    if (sm > 0.3) { const c = (dx * I.wx + dz * I.wz) / (d * sm); if (c < 0) s -= 4; s += c * 3; } else s += (q.x - p.x) * hoopOf(p.team).dir * 0.05 + nearestOpp(q).d * 0.3;
    if (s > bs) { bs = s; best = q; }
  }
  return best;
}
function pickPassAI(p) {
  let best = null, bs = -9; const H = hoopOf(p.team);
  for (const q of p.team.players) {
    if (q === p || q.stun > 0 || q.act !== '') continue;
    const d = d2(p.x, p.z, q.x, q.z); if (d < 2.2) continue; const lc = laneClear(p, q);
    const s = nearestOpp(q).d * 1.0 + Math.min(lc, 2) * 1.2 - (lc < 0.6 ? 2 : 0) - d * 0.06 + (d2(p.x, p.z, H.x, 0) - d2(q.x, q.z, H.x, 0)) * 0.06 + (q.ctrl ? 0.6 : 0) + (q.cutting > 0 ? 1.5 : 0) + (q.ovr - 85) * 0.05 + (q.fire ? 1.5 : 0) + q.streak * 0.25 + (isThree(q.x, q.z, H) && nearestOpp(q).d > 1.1 ? (S.mode === 'black' ? 1.2 : 3.0) * q.rat.three : 0); // find the open shooter on the arc
    if (s > bs) { bs = s; best = q; }
  }
  return best;
}
function doPass(p, tgt, kind) {
  if (!tgt || B.owner !== p) return false; const H = hoopOf(p.team);
  let alley = false;
  if (kind === 'lob') { const dh = d2(tgt.x, tgt.z, H.x, 0); alley = dh < 5.4 && (H.x - tgt.x) * H.dir > 0 && tgt.act === ''; }
  const dist = d2(p.x, p.z, tgt.x, tgt.z), speed = kind === 'chest' ? 17 : kind === 'bounce' ? 14 : 11.5;
  B.owner = null; B.state = 'pass'; B.lock = 0; B.shot = null;
  B.pass = { from: B.pos.clone(), tgt, u: 0, dur: Math.max(alley ? 0.85 : 0.24, dist / speed), kind, oop: alley, by: p, hit: [], bounced: false };
  p.catchLock = 0.3; p.act = p.act === 'wind' ? '' : p.act;
  if (alley) { tgt.act = 'oop'; tgt.oopU = 0; tgt.alleyFire = tgt.fire; Snd.whoosh(); callOut(tgt, 'open'); }
  Snd.burst('bandpass', 700, 1, 0.1, 0.18, 0, 1500);
  return true;
}
function updatePass(dt) {
  const ps = B.pass, q = ps.tgt, H = hoopOf(q.team); ps.u += dt / ps.dur;
  let ex, ez, ey;
  if (ps.oop) { ex = H.x - H.dir * 0.3; ez = 0; ey = 3.05; } else { ex = q.x + q.vx * 0.12; ez = q.z + q.vz * 0.12; ey = 1.3; }
  const u = Math.min(ps.u, 1);
  B.pos.x = lerp(ps.from.x, ex, u); B.pos.z = lerp(ps.from.z, ez, u);
  let y;
  if (ps.kind === 'bounce') { y = u < 0.55 ? lerp(ps.from.y, 0.13, u / 0.55) : lerp(0.13, ey, (u - 0.55) / 0.45); if (!ps.bounced && u >= 0.55) { ps.bounced = true; Snd.dribble(1.1); } }
  else if (ps.kind === 'lob') y = lerp(ps.from.y, ey, u) + Math.sin(u * Math.PI) * (ps.oop ? 2.1 : 1.7);
  else y = lerp(ps.from.y, ey, u);
  B.pos.y = y;
  for (const dd of opp(q.team).players) {
    if (ps.u < 0.18 || ps.hit.includes(dd) || y > 2.25 || y < 0.15 || d2(dd.x, dd.z, B.pos.x, B.pos.z) > 0.62) continue;
    ps.hit.push(dd);
    let ch = (ps.kind === 'bounce' ? 0.045 : 0.09) + 0.12 * (dd.rat.def - 0.6) + (dd.protect ? 0.05 : 0) + dif(dd) * 0.02;
    if (ps.inb) ch *= 0.3; // an inbound pass is thrown to the open side
    if (u > 0.7 && d2(dd.x, dd.z, q.x, q.z) < 1.1) ch *= (dd.x - q.x) * (ps.from.x - q.x) > 0 ? 0.6 : 0.2; // the man guarding the catcher only jumps it if he fronts him
    if (Math.random() < ch) { dd.stats.stl++; if (ps.oop && q.act === 'oop') q.act = ''; giveBall(dd, 'steal'); toast('STOLEN'); Com.say('steal', dd.short, 1, 4000); Snd.cheer(0.7, 1.4); return; }
  }
  if (u >= 1 || (!ps.oop && u > 0.8 && d2(q.x, q.z, B.pos.x, B.pos.z) < 0.75)) {
    if (ps.oop) { B.pass = null; q.x = H.x - H.dir * 0.5; q.z = 0; q.alley = true; q.act = 'dunk'; q.p0 = 1; slam(q); if (q.act === 'dunk') q.act = 'dunkEnd'; return; }
    if (q.act === '' || q.act === 'land') { giveBall(q, 'pass'); Snd.catch_(); }
    else { B.state = 'loose'; B.pass = null; B.vel.set(rnd(-1, 1), 1, rnd(-1, 1)); B.lock = 0.2; }
  }
}

/* ---------- steals / blocks / dribble ---------- */
function startReach(p) { if (p.stealCd > 0 || p.reachT > 0) return; p.reachT = 0.34; p.reachDone = false; p.stealCd = 1.2; Snd.burst('bandpass', 900, 1, 0.1, 0.1, 0, 2000); }
function resolveReach(p) {
  const h = B.owner; if (!h || h.team === p.team || S.ft) return;
  const d = d2(p.x, p.z, h.x, h.z), rng = p.protect ? 1.5 : 1.25;
  if (d > rng) return;
  if (h.act !== '' && h.act !== 'land') { if (h.act === 'wind' || h.act === 'layup') reachFoulCheck(p, h, d); return; } // hitting a shooter's arm
  let ch = 0.06 + 0.2 * p.rat.def - 0.14 * h.rat.handle - (h.protect ? 0.12 : 0) - (h.sprint ? 0.03 : 0) + dif(p) * 0.025; if (S.mode === 'black') ch *= 0.55; if (S.mode !== 'gym' && opp(p.team).score - p.team.score >= (S.mode === 'play' ? 10 : 6)) ch += 0.05; if (h.mvT > 0 && h.mv === 'spin') ch *= 0.15; else if (h.mvT > 0 && GUARDED[h.mv]) ch *= 0.6; if (S.checkT > 0) ch = 0;
  if (Math.random() < ch) { p.stats.stl++; h.stun = 0.4; giveBall(p, 'steal'); Snd.smack(); Snd.cheer(0.9, 1.6); toast('STEAL!'); Com.say('steal', p.short, 1, 3500); callOut(p, 'dunk'); S.live = true; }
  else reachFoulCheck(p, h, d);
}
/* Dribble moves, laid out like the 2K pro stick. "Forward" is the basket being attacked (up the screen in 2K).
   The left stick only moves. Right stick flick, four directions = four different crossovers:
   up = HESI CROSS (hitch, then cross toward the basket), left = DOUBLE CROSS (sell the other way, snap back), right = KILLER CROSS (low, instant,
   through the legs), down = STEP-BACK CROSS (jump back, ball behind the body, slide across for space to shoot).
   Hold L2 for hop step (up), spin move (sideways) and step back (down). Hold R3 and push for the second set of patterns: up = HESITATION,
   left = BETWEEN THE LEGS, right = BEHIND THE BACK, down = IN-AND-OUT. A quick R3 tap with the sticks centred = size-up.
   The keyboard dribble key + a held direction does the same flick. t1 = the first half of a two-part move (hitch / fake / retreat). */
const MOVES = {
  cross: { name: 'CROSSOVER', dur: 0.5, sp: 1.45, ch: 0.5, stun: 0.55, rng: 1.8 },
  btl: { name: 'BETWEEN THE LEGS', dur: 0.56, sp: 1.35, ch: 0.45, stun: 0.5, rng: 1.8 },
  btb: { name: 'BEHIND THE BACK', dur: 0.6, sp: 1.35, ch: 0.5, stun: 0.6, rng: 1.8 },
  btlx: { name: 'LEGS-CROSS COMBO', dur: 0.76, t1: 0.3, sp: 1.7, ch: 0.6, stun: 0.65, rng: 2.2 },
  hop: { name: 'HOP STEP', dur: 0.42, sp: 1.5, ch: 0.22, stun: 0.4, rng: 1.5 },
  hesi: { name: 'HESITATION', dur: 0.66, t1: 0.26, sp: 1.55, ch: 0.62, stun: 0.7, rng: 2.3 },
  spin: { name: 'SPIN MOVE', dur: 0.6, sp: 1.3, ch: 0.45, stun: 0.5, rng: 1.6 },
  step: { name: 'STEP BACK', dur: 0.5, sp: 1.8, ch: 0.2, stun: 0.45, rng: 1.5 },
  size: { name: 'SIZE UP', dur: 0.85, sp: 0, ch: 0.5, stun: 0.6, rng: 2.0 },
  xhesi: { name: 'HESI CROSS', dur: 0.64, t1: 0.2, sp: 1.65, ch: 0.62, stun: 0.7, rng: 2.3 },
  xdbl: { name: 'DOUBLE CROSS', dur: 0.66, t1: 0.2, sp: 1.6, ch: 0.62, stun: 0.7, rng: 2.2 },
  xlow: { name: 'KILLER CROSS', dur: 0.5, sp: 1.95, ch: 0.58, stun: 0.65, rng: 1.9 },
  xstep: { name: 'STEP-BACK CROSS', dur: 0.66, t1: 0.22, sp: 1.35, ch: 0.4, stun: 0.55, rng: 1.9 },
  inout: { name: 'IN-AND-OUT', dur: 0.6, t1: 0.22, sp: 1.7, ch: 0.56, stun: 0.6, rng: 2.1 },
};
const STAGED = { hesi: 1, xhesi: 1, xdbl: 1, xstep: 1, inout: 1, btlx: 1 }; // a first beat (hitch, fake, retreat), then the burst
const FREEZES = { hesi: 1, xhesi: 1, xdbl: 1, inout: 1, btlx: 1 };            // only freezes a defender who is in front of him
const GUARDED = { hesi: 1, xhesi: 1, xdbl: 1, xlow: 1, xstep: 1, inout: 1, btlx: 1, cross: 1, btl: 1, btb: 1 }; // the ball is hard to poke away mid-move
const sideOf = (p, dx, dz) => (dx * Math.cos(p.face) - dz * Math.sin(p.face)) >= 0 ? 1 : -1; // which hand a move toward (dx, dz) ends in
// v23: the same, read against the way he is travelling (the basket when he is standing), so left and right on the stick always mean his own left and right hand
function travelFrame(p) { const sp = Math.hypot(p.vx, p.vz); return sp > 1.5 ? [p.vx / sp, p.vz / sp] : [Math.sin(p.face), Math.cos(p.face)]; }
function latSide(p, dx, dz) {
  const n = Math.hypot(dx, dz) || 1, f = travelFrame(p); let l = (dx * f[1] - dz * f[0]) / n;
  if (Math.abs(l) < 0.35) l = -dz / n * hoopOf(p.team).dir; // pushing along his line of travel: read it against the basket instead
  return l >= 0 ? 1 : -1;
}
function burst(p, vx, vz, T) { p.bx = vx; p.bz = vz; p.bT = (T || 0.2) + 0.1; } // v23: a move's burst of speed is eased in over a moment instead of set in one frame
// Right stick flick -> move. The stick is read on screen (up the screen in 2K is toward the basket), so the four directions are
// forward / left / right / back of the basket being attacked. Each one is a different crossover. Hold L2 for hop step, spin and step back instead.
function classifyMove(p, fx, fy, mod, mod2) {
  const d = hoopOf(p.team).dir, ang = Math.atan2(Math.abs(fy), fx * d) * 57.2958, side = fy >= 0 ? 1 : -1;
  const open = (ax, az) => Math.abs(fy) > 0.3 ? side : (sideOf(p, ax, az) === -p.hand ? 1 : -1); // lean to the stick's side, else cross to the empty hand
  if (mod2) { // R3 held: the second set of patterns
    if (ang < 45) return { kind: 'hesi', dx: d, dz: 0.2 * side };
    if (ang < 135) return side * d > 0 ? { kind: 'btb', dx: 0.5 * d, dz: 0.87 * side } : { kind: 'btl', dx: 0.7 * d, dz: 0.7 * side };
    return { kind: 'inout', dx: 0.9 * d, dz: 0.45 * open(0.9 * d, 0.45) };
  }
  if (ang < 45) { if (mod) return { kind: 'hop', dx: d, dz: 0.3 * side }; const s = open(0.83 * d, 0.55); return { kind: 'xhesi', dx: 0.83 * d, dz: 0.55 * s }; }
  if (ang < 135) {
    if (mod) return { kind: 'spin', dx: 0.45 * d, dz: 0.9 * side };
    // v23: a true crossover toward the stick side. The ball swings across the body to that hand; if it is already on that side it goes through the legs first, then crosses
    const cdx = 0.5 * d, cdz = 0.87 * side;
    return latSide(p, cdx, cdz) !== p.hand ? { kind: 'cross', dx: cdx, dz: cdz } : { kind: 'btlx', dx: cdx, dz: cdz };
  }
  if (mod) { const s = open(-0.55 * d, 0.83); return { kind: 'step', dx: -d, dz: s * 0.5 }; }
  // v23: stick down = between the legs, or behind the back at a run, and you leave off the other hand
  const e = -p.hand, tf = travelFrame(p), lx = tf[1] * e, lz = -tf[0] * e;
  return { kind: Math.hypot(p.vx, p.vz) > 3.6 ? 'btb' : 'btl', dx: 0.72 * d + 0.55 * lx, dz: 0.55 * lz };
}
function shakeDefender(p, kind) {
  const mv = MOVES[kind], o = nearestOpp(p), H = hoopOf(p.team); if (!o.q || o.d > mv.rng) return false;
  if (FREEZES[kind] && (o.q.x - p.x) * H.dir < -0.3) return false; // only freezes someone who is in front of him
  if ((o.q.ankleAt || -9) > S.elapsed - 4) return false; // the same man can't get dropped twice in a row
  const spam = S.elapsed - (p.mvAt || -9) < 2.2 ? 0.45 : 1; p.mvAt = S.elapsed; // chained moves set it up, but spamming the stick stops working
  const prox = clamp(1 - (o.d - 0.6) / 1.6, 0.25, 1), ch = (0.02 + 0.15 * mv.ch + 0.3 * (p.rat.handle - o.q.rat.def)) * prox * spam;
  if (!(Math.random() < clamp(ch, 0.03, 0.4))) { o.q.stun = Math.max(o.q.stun, 0.12); return false; } // he still has to slide
  o.q.ankleAt = S.elapsed; o.q.stun = Math.max(o.q.stun, mv.stun);
  if (mv.stun < 0.5) return true; // a stumble, not a highlight
  Snd.cheer(0.6, 1.2); Com.say('ankle', p.short, 1, 7000); maybeInjure(o.q, 0.012);
  if (p.ctrl) toast((p.mvLabel || mv.name) + ' · ANKLE BREAKER'); else if (o.q.ctrl) toast('ANKLES BROKEN'); return true;
}
function dribbleMove(p, kind, dx, dz, label) {
  if (p.flickT > 0 || p.act !== '' || p.stun > 0) return false;
  const mv = MOVES[kind]; p.mv = kind; p.mvLabel = label || mv.name; p.mvDur = mv.dur; p.mvT = mv.dur; p.flickT = mv.dur * 0.8; p.boostT = 0.22; Snd.squeak();
  const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
  p.mvSide = latSide(p, dx, dz);
  if (STAGED[kind]) {
    const D = hoopOf(p.team).dir, sg = dz >= 0 ? 1 : -1;
    p.hesiT = mv.t1; p.hesiK = kind; p.hesiDir = { x: dx, z: dz };
    if (kind === 'xdbl') { burst(p, 0.2 * D * p.rat.spd, -sg * p.rat.spd * 1.1, 0.2); p.hand = -p.mvSide; } // sell the other way first
    else if (kind === 'xstep') { burst(p, -D * p.rat.spd * 1.5, -sg * p.rat.spd * 0.25, 0.2); } // jump back off the dribble
    else if (kind === 'inout') { burst(p, 0.35 * D * p.rat.spd, -sg * p.rat.spd * 0.5, 0.2); } // sell the cross, keep the ball, go
    else if (kind === 'btlx') { burst(p, p.vx * 0.6, p.vz * 0.6, 0.25); p.hand = -p.mvSide; } // first beat: through the legs to the other hand, carrying the speed
    else { burst(p, p.vx * 0.2, p.vz * 0.2, 0.2); }
  }
  else if (kind === 'size') { p.vx *= 0.3; p.vz *= 0.3; shakeDefender(p, kind); }
  else { burst(p, dx * p.rat.spd * mv.sp, dz * p.rat.spd * mv.sp, 0.22); // v23: the old speed carries into the cross and eases to the new line, no instant turn
    if (kind === 'btl' || kind === 'btb') { p.hand = p.hand > 0 ? -1 : 1; p.mvSide = p.hand; } else if (kind === 'cross' || kind === 'spin' || kind === 'xlow') p.hand = p.mvSide; if (kind === 'step') p.sepT = 1.1; shakeDefender(p, kind); }
  if (p.ctrl && !p.fire && kind !== 'size') { const h = p.ctrl; if (h.txt) { h.txt.textContent = p.mvLabel; h.txt.style.color = '#cfd8ff'; h.txt.className = 'mtt'; void h.txt.offsetWidth; h.txt.className = 'mtt show'; h.txtP = p; } }
  return true;
}
function aiMove(p) {
  const d = hoopOf(p.team).dir, r = Math.random(), s = Math.random() < 0.5 ? 1 : -1;
  if (r < 0.16) dribbleMove(p, 'cross', 0.35 * d, s); else if (r < 0.26) dribbleMove(p, 'btb', 0.5 * d, 0.87 * s); else if (r < 0.36) dribbleMove(p, 'spin', 0.45 * d, 0.9 * s);
  else if (r < 0.46) dribbleMove(p, 'hesi', d, 0); else if (r < 0.58) dribbleMove(p, 'xhesi', 0.83 * d, 0.55 * s); else if (r < 0.7) dribbleMove(p, 'xdbl', 0.45 * d, 0.89 * s);
  else if (r < 0.8) dribbleMove(p, 'xlow', 0.4 * d, 0.92 * s); else if (r < 0.88) dribbleMove(p, 'xstep', -0.3 * d, 0.95 * s); else if (r < 0.95) dribbleMove(p, 'inout', 0.9 * d, 0.45 * s); else dribbleMove(p, Math.random() < 0.5 ? 'btl' : 'btlx', 0.7 * d, 0.7 * s);
}

/* ---------- human input -> actions ---------- */
function humanUpdate(h, dt) {
  const p = h.p, I = INP[h.id]; if (!p) return;
  if (p.stun > 0 || p.act === 'dunkEnd' || p.act === 'dunk' || p.act === 'oop' || p.act === 'layup') { if (p.act === '') return; }
  p.wx = I.wx; p.wz = I.wz; p.sprint = I.sprint; p.protect = I.protect;
  const team = p.team, has = B.owner === p, off = S.poss === team.idx;
  if (!S.live || S.countT > 0) { p.wx = p.wz = 0; return; }
  if (p.act === 'wind') { if (has && (I.shootR || !I.shoot || p.fill >= 1.1)) { if (p.actT < 0.08 && !I.shootR && I.shoot) return; releaseShot(p, 'jump'); } return; }
  if (S.ft) { p.wx = p.wz = 0; if (S.ft.p === p && S.ft.phase === 'ready' && has && I.shootP && p.act === '') startJump(p); return; } // free throws: the shooter shoots, everyone else waits
  if (p.act !== '' || p.stun > 0) return;
  const slot = I.l1 ? (I.xP ? 0 : I.oP ? 1 : I.shootP ? 2 : I.tP ? 3 : -1) : -1; // L1 + a face button = that teammate (the button under him)
  if (!has && slot >= 0) { const t = p.team.players.filter(q => q !== p)[slot]; if (t && !t.ctrl && !t.gymRole) { setCtrl(h, t); return; } } // without the ball it takes control of him
  if (has && S.inb && S.inb.ib === p) { if (I.xP || I.oP || I.tP || I.shootP || slot >= 0) { if (doPass(p, pickPassHuman(p, I, slot) || S.inb.rc, I.oP ? 'bounce' : I.tP ? 'lob' : 'chest')) B.pass.inb = true; } return; } // inbounding: any pass button passes it in
  if (has) {
    if (I.shootP && slot < 0) tryShoot(p, I);
    else if (slot >= 0) { const t = pickPassHuman(p, I, slot); if (t) doPass(p, t, 'chest'); }
    else if (I.xP) doPass(p, pickPassHuman(p, I, -1), 'chest');
    else if (I.oP) doPass(p, pickPassHuman(p, I, -1), 'bounce');
    else if (I.tP) doPass(p, pickPassHuman(p, I, -1), 'lob');
    else if (I.flick === 3) dribbleMove(p, 'size', 0, 0);
    else if (I.flick) { const mvv = classifyMove(p, I.fx, I.fy, I.fmod, I.fmod2); dribbleMove(p, mvv.kind, mvv.dx, mvv.dz, mvv.label); }
  } else if (off && (B.state === 'held' || B.state === 'pass')) {
    if (I.xP || I.oP || I.tP || I.shootP) { callOut(p, 'open'); S.callFor = p; S.callT = 1.5; }
  } else if (!off && (B.state === 'held' || B.state === 'pass')) {
    if (I.shootP) startReach(p);
    if (I.tP && p.blockT <= 0) { p.blockT = 0.5; }
    if (I.oP) switchPlayer(h); if (I.xP) callOut(p, 'help');
  } else {
    if (I.tP && p.jumpT <= 0) p.jumpT = 0.5;
    if (I.oP) switchPlayer(h);
  }
}
function tryShoot(p, I) {
  const H = hoopOf(p.team), d = d2(p.x, p.z, H.x, 0);
  if (S.ft) { startJump(p); return; }
  if (S.checkT > 0) { toast('CHECK BALL'); return; }
  if (S.mode === 'black' && S.clear[p.team.idx] && d < ARC + 0.25) { toast('TAKE IT BACK'); callOut(p, 'clear'); return; }
  const spd = Math.hypot(p.vx, p.vz), toward = (p.vx * (H.x - p.x) - p.vz * p.z) / (spd * d + 1e-6);
  if ((d < 2.4 || (I.sprint && d < 3.7 && spd > 3 && toward > 0.45)) && (p.rat.dunk > 0.28 || p.fire) || (p.fire && d < 5.6)) startDunk(p, H, false);
  else if (d < 4.5 && ((spd > 2.2 && toward > 0.25) || d < 3.1)) startLayup(p, H);
  else startJump(p);
}
function switchPlayer(h) {
  const team = h.team; let best = null, bd = 1e9;
  const tx = B.owner ? B.owner.x : B.pos.x, tz = B.owner ? B.owner.z : B.pos.z;
  for (const q of team.players) { if (q === h.p || (q.ctrl && q.ctrl !== h) || q.gymRole) continue; const d = d2(q.x, q.z, tx, tz); if (d < bd) { bd = d; best = q; } }
  if (best) { setCtrl2(h, best); Snd.tick(); }
}

/* ---------- CPU brains ---------- */
function aiUpdate(p, dt) {
  if (S.ft) { p.wx = p.wz = 0; return; }
  p.sprint = false; p.protect = false; const team = p.team, H = hoopOf(team);
  if (!S.live || S.countT > 0 || p.hold > 0 || p.stun > 0) { p.wx = p.wz = 0; return; }
  if (p.act !== '') return;
  p.aiT -= dt; if (p.cutting > 0) p.cutting -= dt;
  const offense = S.poss === team.idx && (B.state === 'held' || B.state === 'pass');
  p.lookX = offense ? H.x : B.pos.x; p.lookZ = offense ? 0 : B.pos.z;
  if (B.shot && B.shot.scored && !B.owner && !B.pass && S.mode === 'play') return aiAfterMake(p, dt);
  if (B.state === 'loose' || B.state === 'shot' || (!B.owner && B.state !== 'pass')) return aiLoose(p, dt);
  if (offense) return B.owner === p ? aiHandler(p, dt) : aiOffBall(p, dt);
  return aiDefense(p, dt);
}
// right after a make (Play Now): the scorers sprint back on defense, the nearest free man on the other team fetches the ball
// under the net for the inbound, and everyone else on that team leaks out to their spots, so nobody stands at the rim
function aiAfterMake(p, dt) {
  const sc = B.shot.team, H = hoopOf(sc);
  if (p.team === sc) { const k = sc.players.indexOf(p), D = hoopOf(opp(sc)); moveTo(p, D.x - D.dir * (3.2 + (k % 3) * 2.1), (k - (S.n - 1) / 2) * 1.8, true); p.lookX = B.pos.x; p.lookZ = B.pos.z; return; }
  let fetch = null, bd = 1e9; for (const q of p.team.players) { if (q.ctrl) continue; const d = d2(q.x, q.z, H.x, 0); if (d < bd) { bd = d; fetch = q; } }
  if (p === fetch) { moveTo(p, H.x + H.dir * 1.1, B.pos.z > 0 ? 1.4 : -1.4, true); p.lookX = B.pos.x; p.lookZ = B.pos.z; return; }
  aiOffBall(p, dt);
}
function aiOffBall(p, dt) {
  const team = p.team, H = hoopOf(team), dir = H.dir, hand = B.owner || (B.pass && B.pass.tgt);
  if (B.pass && B.pass.oop && B.pass.tgt === p) return;
  let k = 0; for (const q of team.players) { if (q === hand) continue; if (q === p) break; k++; }
  const sp = spotList(S.n)[Math.min(k + 1, S.n - 1)];
  let tx = H.x - dir * sp[0], tz = sp[1];
  p.cutT -= dt; if (p.cutT <= 0) { p.cutT = rnd(4, 8); p.cutting = 1.4; }
  if (p.cutting > 0 && S.n > 2) { tx = H.x - dir * 1.7; tz = (p.z > 0 ? -1 : 1) * 1.5; p.sprint = true; }
  if (S.mode === 'black' && S.clear[team.idx]) { const hd = hand ? d2(hand.x, hand.z, H.x, 0) : 0; if (hd < ARC) { tx = H.x - dir * (ARC + 1.2); tz = p.z > 0 ? 4.5 : -4.5; } }
  moveTo(p, tx + Math.sin(S.elapsed * 1.3 + p.idx) * 0.3, tz + Math.cos(S.elapsed * 1.1 + p.idx) * 0.3, false);
  if (hand) { p.lookX = hand.x; p.lookZ = hand.z; }
  if (p.cutting > 0 && B.owner && Math.random() < dt * 1.5 && B.owner.ctrl === null) S.callFor = p;
}
const sh0 = (p, d) => d > ARC - 0.3 ? p.rat.three : p.rat.shoot;
function aiHandler(p, dt) {
  const team = p.team, H = hoopOf(team), dir = H.dir, d = d2(p.x, p.z, H.x, 0), nr = nearestOpp(p), dd = nr.d;
  if (S.checkT > 0) { p.wx = p.wz = 0; return; }
  S.stallT += dt;
  const front = S.mode === 'black' || p.x * dir > 0.4;
  if (S.mode === 'black' && S.clear[team.idx] && !cleared(p.x, p.z, H)) {
    moveTo(p, H.x - dir * (ARC + 1.5), clamp(p.z, -4, 4), dd < 2);
    if (dd < 1 && p.aiT <= 0) { const t = pickPassAI(p); if (t) doPass(p, t, 'chest'); p.aiT = 0.8; } return;
  }
  if (!front) {
    moveTo(p, H.x - dir * 8.2, p.z * 0.5, true);
    if (p.aiT <= 0) { p.aiT = rnd(0.6, 1.1); const t = pickPassAI(p); if (t && (t.x - p.x) * dir > 4 && laneClear(p, t) > 1.6 && Math.random() < 0.35) doPass(p, t, 'chest'); }
    return;
  }
  if (S.callFor && S.callFor.team === team && S.callFor !== p && S.callT > 0 && Math.random() < dt * 1.6) { const t = S.callFor; S.callFor = null; if (laneClear(p, t) > 0.9) { doPass(p, t, t.cutting > 0 && d2(t.x, t.z, H.x, 0) < 5 ? 'lob' : 'chest'); return; } }
  if (S.shotClock < 3.5 && p.aiMode !== 'shoot') { p.aiMode = 'shoot'; p.aiT = 0.5; p.whyShot = 'clock'; }
  // catch and shoot: an open man on the perimeter who just caught a pass lets it fly
  if (p.gotHow === 'pass' && S.elapsed - p.gotAt < 0.9 && p.aiMode !== 'shoot' && d > 4.6 && d < ARC + 1.8 && dd > (S.mode === 'black' ? 2.2 : 1.1) && !(S.mode === 'black' && S.clear[team.idx]) && Math.random() < dt * 9 * (0.35 + 0.65 * Math.max(sh0(p, d), 0.3))) { p.aiMode = 'shoot'; p.aiT = Math.max(p.aiT, 0.6); p.gotHow = ''; p.whyShot = 'cs'; }
  if (p.aiT <= 0) {
    const star = p.ovr >= 90 ? 1.25 : 1, sl = Math.max(p.rat.dunk, p.rat.inside * 0.8), sh = Math.max(p.rat.three * (d > ARC - 0.3 ? 1 : 0.6), p.rat.shoot);
    const w = { drive: (d > 5.5 ? 0.4 : 0.8) * (0.45 + 0.9 * sl), shoot: 0, pass: 0.55, iso: 0.2 };
    const open = clamp((dd - 0.6) / 1.0, 0.15, 1), wall = nr.q && (nr.q.x - p.x) * dir > 0.2 && dd < 1.4; // a man square in front walls off the drive
    if (wall) w.drive *= 0.45;
    const bk = S.mode === 'black' && d > ARC - 0.3 ? 0.15 * open * open : 1; // in Blacktop a deep one is a 2: take it only when it's clean
    if (d > 4.4 && d < ARC + 1.8) w.shoot = (0.3 + 0.9 * sh) * open * 1.6 * bk * (d > ARC + 0.5 ? clamp((ARC + 1.8 - d) / 1.3, 0.1, 1) : 1) * star * [0.8, 1, 1.2][dif(p)] * (d > ARC - 0.3 ? 0.9 + 1.1 * p.rat.three : 0.65);
    if (d < 5) w.shoot += 0.25 * open; if (dd < 1.2) w.pass += 0.9; if (d < 3.2) w.drive = 3;
    let tot = w.drive + w.shoot + w.pass + w.iso, r = Math.random() * tot, m = 'drive';
    for (const k of ['drive', 'shoot', 'pass', 'iso']) { r -= w[k]; if (r <= 0) { m = k; break; } }
    p.aiMode = m; p.whyShot = 'pick'; p.aiT = rnd(0.7, 1.5) / [0.8, 1, 1.25][dif(p)];
  }
  p.lookX = H.x; p.lookZ = 0;
  switch (p.aiMode) {
    case 'shoot':
      p.wx = p.wz = 0; if (d < 4.4) { p.aiMode = 'drive'; break; }
      if (dd < 1.0 && S.shotClock > 3 && Math.random() < 0.6) { p.aiMode = 'pass'; break; }
      if (S.mode === 'black' && d > ARC - 0.3 && dd < 1.6 && Math.random() < 0.7) { p.aiMode = 'drive'; p.aiT = 0.8; break; } // the closeout got there: swing it
      if (S.mode === 'black' && S.clear[team.idx]) { p.aiMode = 'iso'; break; }
      startJump(p); p.aiMode = ''; p.aiT = 1.2; break;
    case 'pass': { const t = pickPassAI(p); if (t) { const tl = t.cutting > 0 && d2(t.x, t.z, H.x, 0) < 5 && Math.random() < 0.5; doPass(p, t, tl ? 'lob' : (Math.random() < 0.2 ? 'bounce' : 'chest')); } p.aiMode = ''; p.aiT = 0.9; break; }
    case 'iso': moveTo(p, p.x + Math.sin(S.elapsed * 2 + p.idx) * 2, p.z + Math.cos(S.elapsed * 1.7) * 2, false); break;
    default: { // drive
      if (p.rat.three > 0.6 && d > ARC - 0.1 && d < ARC + 1.6 && dd > (S.mode === 'black' ? 2.4 : 1.1) && !(S.mode === 'black' && S.clear[team.idx]) && Math.random() < dt * 3.2 * p.rat.three * (p.ovr >= 90 ? 1.2 : 1)) { p.aiMode = 'shoot'; p.whyShot = 'pu'; break; } // shooters pull up from deep
      moveTo(p, H.x - dir * 1.0, clamp(p.z * 0.5, -1.4, 1.4), true);
      if (S.mode === 'black' && S.clear[team.idx]) break;
      if (d < 5 && dd < 1.1 && p.aiT > 0.3 && Math.random() < dt * 2.5) { const t = kickOut(p); if (t) { doPass(p, t, 'chest'); p.aiMode = ''; p.aiT = 0.9; break; } } // drive and kick
      if (d < 2.5) { if (Math.random() > p.rat.dunk * 0.45) startLayup(p, H); else startDunk(p, H, false); }
      else if (d < 4.1 && Math.random() < dt * 3) startLayup(p, H);
      if (dd < 1.0 && p.flickT <= 0 && Math.random() < dt * 1.2) aiMove(p);
    }
  }
}
// an open shooter on the perimeter with a clean lane, for drive-and-kick
function kickOut(p) {
  const H = hoopOf(p.team); let best = null, bs = 0;
  for (const q of p.team.players) { if (q === p || q.ctrl && S.callFor !== q) continue; const qd = d2(q.x, q.z, H.x, 0); if (qd < ARC - 0.6) continue; const lc = laneClear(p, q), od = nearestOpp(q).d; if (lc < 1.5 || od < 2) continue; const s = od + q.rat.three * 2; if (s > bs) { bs = s; best = q; } }
  return best;
}
function aiDefense(p, dt) {
  const team = p.team, o = opp(team), own = ownHoop(team), man = o.players[p.idx % o.players.length];
  const holder = B.owner || (B.pass && B.pass.tgt) || man;
  let tx, tz, sprint = false;
  if (man === holder) {
    const vx = own.x - man.x, vz = -man.z, n = Math.hypot(vx, vz) || 1; tx = man.x + vx / n * 0.85 + man.vx * 0.12; tz = man.z + vz / n * 0.85 + man.vz * 0.12;
    const dist = d2(p.x, p.z, man.x, man.z);
    sprint = B.owner === man && ((man.sprint && dist < 6) || dist > 2.2); p.onBall = true; // he matches the handler's burst, a step slower (a closeout on a pass in the air is a jog, so a good swing gets a shot)
    if (B.owner === man && dist < 1.25 && p.stealCd <= 0 && man.act === '' && S.checkT <= 0 && Math.random() < dt * 0.32 * (S.mode === 'black' ? 0.5 : 1) * [0.5, 1, 1.5][dif(p)]) startReach(p);
  } else if (holder && B.owner === holder && helperOf(team) === p && d2(holder.x, holder.z, own.x, 0) < 6) {
    p.onBall = false; const vx = own.x - holder.x, vz = -holder.z, n = Math.hypot(vx, vz) || 1; tx = holder.x + vx / n * 1.1; tz = holder.z + vz / n * 1.1; sprint = true; // help: step into the driving lane
  } else {
    p.onBall = false; const vx = own.x - man.x, vz = -man.z, n = Math.hypot(vx, vz) || 1; tx = man.x + vx / n * 1.3; tz = man.z + vz / n * 1.3;
    const hd = holder ? d2(holder.x, holder.z, own.x, 0) : 99; const sag = hd < 8 ? 0.45 : 0.2;
    tx = lerp(tx, own.x - own.dir * 2.0, sag); tz = lerp(tz, 0, sag);
    if (p.role === 'B' && hd < 7) { tx = lerp(tx, own.x - own.dir * 1.5, 0.6); tz = lerp(tz, 0, 0.6); }
  }
  moveTo(p, tx, tz, sprint); if (S.mode === 'play' && Math.abs(p.x - tx) > 4) p.sprint = true;
  p.lookX = holder.x; p.lookZ = holder.z; p.protect = false;
  for (const q of o.players) if ((q.act === 'wind' || q.act === 'layup' || q.act === 'dunk') && p.blockT <= 0 && d2(p.x, p.z, q.x, q.z) < 1.9 && Math.random() < dt * 3.2 * [0.7, 1, 1.3][dif(p)]) { p.blockT = 0.5; }
}
// the weak-side helper: the closest defender to the rim who is not guarding the ball (only with 3+ a side)
function helperOf(team) {
  if (S.n < 3) return null; const own = ownHoop(team), o = opp(team), hold = B.owner; let best = null, bd = 1e9;
  for (const q of team.players) { if (q.ctrl || o.players[q.idx % o.players.length] === hold) continue; const d = d2(q.x, q.z, own.x, 0); if (d < bd) { bd = d; best = q; } }
  return best;
}
function aiLoose(p, dt) {
  const team = p.team, mates = team.players.filter(q => !q.ctrl).sort((a, b) => d2(a.x, a.z, B.pos.x + B.vel.x * 0.3, B.pos.z + B.vel.z * 0.3) - d2(b.x, b.z, B.pos.x + B.vel.x * 0.3, B.pos.z + B.vel.z * 0.3));
  const rank = mates.indexOf(p), H = B.shot ? B.shot.team : team;
  if (rank >= 0 && rank < 2 || B.state === 'dead') {
    if (B.shot && B.shot.scored) { p.wx = p.wz = 0; return; }
    let tx = B.pos.x + B.vel.x * 0.35, tz = B.pos.z + B.vel.z * 0.35;
    if (B.state === 'shot' && !B.shot.touched) { const hh = hoopOf(B.shot.team); tx = hh.x - hh.dir * 0.9; tz = 0; }
    moveTo(p, tx, tz, true); if (rank === 0 && B.pos.y < 3.2 && d2(p.x, p.z, B.pos.x, B.pos.z) < 2.2 && p.jumpT <= 0 && B.pos.y > 1.8) p.jumpT = 0.5;
  } else aiOffBall(p, dt);
}

/* ---------- movement + animation ---------- */
function movePlayer(p, dt) {
  const a = p.act, H = hoopOf(p.team);
  p.stealCd -= dt; p.blockT -= dt; p.reachT -= dt; p.jumpT -= dt; p.catchLock -= dt; p.flickT -= dt; p.quiet += dt; p.hold -= dt; p.mvT -= dt; p.boostT -= dt; p.sepT -= dt;
  if (p.hesiT > 0) { p.hesiT -= dt; p.wx = p.wz = 0; if (p.hesiT <= 0 && p.hesiDir) { const hk = p.hesiK || 'hesi', sp0 = p.rat.spd * MOVES[hk].sp; burst(p, p.hesiDir.x * sp0, p.hesiDir.z * sp0, 0.2); p.boostT = 0.25; if (hk !== 'hesi' && hk !== 'inout') p.hand = p.mvSide; if (hk === 'xstep') p.sepT = 1.1; shakeDefender(p, hk); } }
  if (p.mv === 'size' && p.mvT > 0) { p.wx = p.wz = 0; }
  if (!p.fire && p.streak > 0 && p.quiet > (S.mode === 'black' ? 16 : 40)) { p.streak = 0; } // a hot hand cools if he goes quiet for a while
  if (p.stun > 0) { p.stun -= dt; p.wx = p.wz = 0; }
  if (p.hold > 0) { p.wx = p.wz = 0; }
  if (p.reachT > 0 && !p.reachDone && p.reachT < 0.22) { p.reachDone = true; resolveReach(p); }
  if (p.reachT <= 0 && p.reachDone === false) p.reachDone = true;
  if (a === 'dunk') {
    p.actT += dt; const u = Math.min(1, p.actT / p.dur), e = u * u * (3 - 2 * u);
    p.x = lerp(p.start.x, p.end.x, e); p.z = lerp(p.start.z, p.end.z, e); p.y = p.jh * Math.sin(Math.PI / 2 * Math.min(1, u / 0.78));
    p.face = Math.atan2(H.x - p.x, -p.z * 0.2 + 1e-4) + (p.variant === 'REVERSE JAM' ? Math.PI : 0); p.vx = (p.end.x - p.start.x) / p.dur; p.vz = 0;
    if (p.fire) { if (p.variant === '360 SLAM') p.spin = u * Math.PI * 2; p.vx *= 0.3; fireTrail(p, dt, 2); }
    if (u >= 0.78 && !p.slammed) slam(p);
    return;
  }
  if (a === 'dunkEnd') {
    p.actT += dt; if (p.actT < p.hang) { p.y = Math.max(p.y, 0.6) - 0.1 * dt; p.vy = 0; } else { p.vy = (p.vy || 0) - 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); }
    p.vx = p.vz = 0; if (p.actT > p.hang && p.y <= 0.02) { p.y = 0; p.act = ''; p.spin = 0; p.catchLock = 0.3; maybeInjure(p, 0.012); } return;
  }
  if (a === 'oop') {
    const ps = B.pass; if (!ps || ps.tgt !== p) { p.act = ''; p.y = 0; return; }
    const sx = H.x - H.dir * 0.6; const dx = sx - p.x, dz = 0 - p.z, d = Math.hypot(dx, dz);
    if (d > 0.1) { const sp = Math.min(8, d / Math.max(0.05, (1 - ps.u) * ps.dur) + 1); p.x += dx / d * Math.min(sp * dt, d); p.z += dz / d * Math.min(sp * dt, d); p.vx = dx / d * sp; p.vz = dz / d * sp; }
    p.face = Math.atan2(H.x - p.x, -p.z + 1e-4); p.y = ps.u > 0.4 ? 1.05 * Math.sin(Math.PI / 2 * Math.min(1, (ps.u - 0.4) / 0.6)) : 0;
    if (p.fire) fireTrail(p, dt, 2); return;
  }
  if (a === 'layup') {
    p.actT += dt; const u = Math.min(1, p.actT / p.dur);
    const dx = H.x - H.dir * 0.8 - p.x, dz = -p.z * 0.8, d = Math.hypot(dx, dz);
    if (d > 0.15) { const sp = Math.min(7.5, Math.max(3.4, d / 0.35)); p.vx = dx / d * sp; p.vz = dz / d * sp; } else p.vx = p.vz = 0;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y = 0.62 * Math.sin(Math.PI * Math.min(1, u * 0.9));
    p.face = Math.atan2(H.x - p.x, -p.z + 1e-4);
    if (p.actT >= 0.34 && !p.layDone && B.owner === p) finishLayupShot(p);
    if (u >= 1) { p.act = ''; p.y = 0; } return;
  }
  if (a === 'wind') {
    p.actT += dt; p.fill = p.actT / METER_TIME; const u = Math.min(1, p.fill / METER_T);
    p.y = (p.role === 'B' ? 0.5 : 0.58) * Math.sin(Math.PI / 2 * u) * (p.actT > 0.06 ? 1 : p.actT / 0.06);
    if (!p.ctrl && B.owner === p && p.fill >= p.cpuRel) releaseShot(p, 'jump');
    else if (B.owner !== p) { p.act = ''; p.y = 0; }
  } else if (a === 'land') {
    p.actT += dt; if (p.y > 0.001) { p.vy = (p.vy || 0) - 15 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y <= 0.001) { p.y = 0; p.vy = 0; p.landT = p.actT; } } else if (p.landT === undefined) p.landT = p.actT; if (p.y <= 0.001 && p.actT > (p.landT || 0) + 0.1 || p.actT > 0.6) { p.act = ''; p.y = 0; p.vy = 0; p.landT = undefined; }
  } else {
    if (p.blockT > 0) p.y = 0.62 * Math.sin(Math.PI * clamp(1 - p.blockT / 0.5, 0, 1)); else if (p.jumpT > 0) p.y = 0.55 * Math.sin(Math.PI * clamp(1 - p.jumpT / 0.5, 0, 1)); else if (p.mv === 'hop' && p.mvT > 0) p.y = 0.22 * Math.sin(Math.PI * clamp(1 - p.mvT / p.mvDur, 0, 1)); else p.y = Math.max(0, p.y - 6 * dt);
  }
  let sp = p.sprint ? p.rat.spd : p.rat.spd * 0.66;
  if (B.owner === p) sp *= 0.94; else if (p.onBall && p.sprint && !p.ctrl && S.poss !== p.team.idx) sp *= 0.97; if (p.protect) sp *= 0.72; if (a === 'wind' || (a === 'land' && p.y > 0.02)) sp *= 0.15; else if (a === 'land') sp *= 0.5; if (p.reachT > 0) sp *= 0.55; if (p.boostT > 0) sp *= 1.2; if (p.mv === 'spin' && p.mvT > 0) sp *= 0.85;
  const m = Math.hypot(p.wx, p.wz); let tx = 0, tz = 0; if (m > 0.02) { const k = Math.min(1, m); tx = p.wx / m * sp * k; tz = p.wz / m * sp * k; }
  const csp = Math.hypot(p.vx, p.vz), acc = (a === '' ? (p.mvT > 0 && p.mv !== 'size' ? 7 : 12) * (Math.hypot(tx, tz) > csp + 0.2 ? 0.8 : 1.15) : 5), pvx = p.vx, pvz = p.vz; // v22: speed builds with weight, planting and stopping bites a little harder
   p.vx += (tx - p.vx) * Math.min(1, acc * dt); p.vz += (tz - p.vz) * Math.min(1, acc * dt);
  if (p.bT > 0) { p.bT -= dt; const kb = Math.min(1, dt * 10); p.vx += (p.bx - p.vx) * kb; p.vz += (p.bz - p.vz) * kb; }
  p.ax = (p.vx - pvx) / Math.max(dt, 1e-4); p.az = (p.vz - pvz) / Math.max(dt, 1e-4);
  p.x += p.vx * dt; p.z += p.vz * dt;
  const gym = S.mode === 'gym', minX = gym ? -GYM_PX : S.mode === 'black' ? 0.5 : -HALF_L + 0.35; p.x = clamp(p.x, minX, gym ? GYM_PX : HALF_L - 0.35); p.z = clamp(p.z, gym ? -GYM_PZ : -HALF_W + 0.3, gym ? GYM_PZ : HALF_W - 0.3);
  const spd = Math.hypot(p.vx, p.vz);
  const fp = CFG.cam === 'fp' && p.ctrl && S.humans[0] && p.ctrl === S.humans[0]; // first person: he faces the basket he attacks (the ball on defence), the stick strafes
  if (fp) { const off = S.poss === p.team.idx; p.lookX = off ? H.x : B.pos.x; p.lookZ = off ? 0 : B.pos.z; }
  const tf = spd > 0.8 && !fp ? Math.atan2(p.vx, p.vz) : Math.atan2(p.lookX - p.x, p.lookZ - p.z);
  p.face += angDiff(p.face, tf) * Math.min(1, dt * (spd > 0.8 && !fp ? 12 : 6));
  if (p.fire && spd > 3) fireTrail(p, dt, 1);
  if (spd > 3.5 && Math.random() < dt * (gym ? 4 : 2.2)) Snd.squeak(gym ? 1.5 : 1);
  if (gym && p.y <= 0.001 && a === '' && spd > 0.9 && Math.hypot(p.vx - pvx, p.vz - pvz) > 10 * dt && Math.random() < dt * 14) Snd.squeak(1.9); // a varnished floor sings on every hard cut and stop
}
function fireTrail(p, dt, k) { const n = Math.ceil(dt * 90 * k); for (let i = 0; i < n; i++) emit(p.x + rnd(-0.2, 0.2), p.y + rnd(0.1, 1.2), p.z + rnd(-0.2, 0.2), -p.vx * 0.15 + rnd(-0.3, 0.3), rnd(0.8, 2), -p.vz * 0.15 + rnd(-0.3, 0.3), rnd(0.35, 0.65), rnd(0.35, 0.6), 1, 0.7, 0.2, 0, 2.5); }
function emberFx(p, dt) {
  const hot = p.streak >= 2 && !p.fire;
  if (p.fire) { const n = Math.ceil(dt * 70); for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), r = rnd(0.1, 0.38); emit(p.x + Math.cos(a) * r, p.y + rnd(0.05, 1.9), p.z + Math.sin(a) * r, rnd(-0.3, 0.3), rnd(1.2, 3), rnd(-0.3, 0.3), rnd(0.45, 0.8), rnd(0.35, 0.7), 1, 0.7, 0.2, 0, 2); } p.aura.visible = true; p.aura.material.opacity = 0.16 + 0.08 * Math.sin(performance.now() * 0.03); }
  else { p.aura.visible = hot; if (hot) { p.aura.material.opacity = 0.07 + 0.04 * Math.sin(performance.now() * 0.012); if (Math.random() < dt * 14) emit(p.x + rnd(-0.3, 0.3), p.y + rnd(0.3, 1.8), p.z + rnd(-0.3, 0.3), 0, rnd(0.6, 1.4), 0, 0.5, 0.22, 1, 0.5, 0.1, 0, 1.5); } }
}
function animatePlayer(p, dt) {
  const m = p.m, spd = Math.hypot(p.vx, p.vz), a = p.act, hasB = B.owner === p, run = Math.min(1, spd / 4.8);
  p.phase += dt * (2.2 + spd * 1.35);
  const ph = p.phase, sw = Math.sin(ph) * run;
  const defending = B.owner && B.owner.team !== p.team, near = defending && d2(p.x, p.z, B.owner.x, B.owner.z) < 4.5;
  let crouch = 0, lean = 0.08 + 0.3 * run, spin = 0;
  // locomotion baseline
  m.legL.rotation.set(sw * 0.95, 0, 0); m.legR.rotation.set(-sw * 0.95, 0, 0);
  if (p.inj) { m.legR.rotation.x *= 0.35; m.body.rotation.z = -0.1 * p.inj * Math.max(0, Math.sin(ph)); } // the limp
  m.kneeL.rotation.x = 0.06 + Math.max(0, Math.sin(ph + 1.6)) * 1.15 * run; m.kneeR.rotation.x = 0.06 + Math.max(0, -Math.sin(ph + 1.6)) * 1.15 * run;
  m.armL.rotation.set(-sw * 0.85, 0, -0.1); m.armR.rotation.set(sw * 0.85, 0, 0.1);
  m.elbL.rotation.x = -0.35 - 0.7 * run; m.elbR.rotation.x = -0.35 - 0.7 * run;
  m.torso.rotation.set(lean, Math.sin(ph) * 0.12 * run, 0); m.head.rotation.set(-lean * 0.7, 0, 0);
  m.body.rotation.set(0, 0, 0); m.body.position.y = Math.abs(Math.sin(ph)) * 0.035 * run;
  if (a === 'wind' || a === 'land') {
    const k = a === 'wind' ? clamp(p.actT / 0.3, 0, 1) : 1;
    m.armR.rotation.set(lerp(-1.4, -2.95, k), 0, 0.05); m.elbR.rotation.x = lerp(-1.7, -0.08, a === 'land' ? 1 : k);
    m.armL.rotation.set(lerp(-1.2, -2.3, k), 0, -0.1); m.elbL.rotation.x = lerp(-1.5, -1.0, k);
    m.legL.rotation.x = m.legR.rotation.x = a === 'wind' ? -0.15 : 0; m.kneeL.rotation.x = m.kneeR.rotation.x = a === 'wind' ? (p.y > 0.05 ? 0.5 : 0.3) : 0.15;
    m.torso.rotation.x = -0.08; m.head.rotation.x = -0.25; if (a === 'land') m.armR.rotation.x = -2.6 + p.actT * 4;
  } else if (a === 'layup') {
    m.armR.rotation.set(-2.95, 0, 0.1); m.elbR.rotation.x = -0.15; m.armL.rotation.set(-1.7, 0, -0.1); m.elbL.rotation.x = -1.3;
    m.legL.rotation.x = -1.25; m.kneeL.rotation.x = 1.5; m.legR.rotation.x = 0.2; m.kneeR.rotation.x = 0.2; m.torso.rotation.x = -0.05;
  } else if (a === 'dunk' || a === 'dunkEnd' || a === 'oop') {
    const u = Math.min(1, p.actT / (p.dur || 1));
    m.armR.rotation.set(-3.05, 0, 0.1); m.elbR.rotation.x = -0.12; m.armL.rotation.set(-2.5, 0, -0.5); m.elbL.rotation.x = -0.4;
    m.legL.rotation.x = -0.7; m.kneeL.rotation.x = 1.1; m.legR.rotation.x = 0.45; m.kneeR.rotation.x = 0.7; m.torso.rotation.x = -0.1;
    if (p.fire && a === 'dunk') {
      if (p.variant === 'WINDMILL SLAM') { m.armR.rotation.x = -u * Math.PI * 4; m.elbR.rotation.x = -0.1; m.armL.rotation.x = -u * Math.PI * 4 + 3; }
      else if (p.variant === 'TOMAHAWK JAM') { m.armR.rotation.x = -3.0 - Math.sin(u * 6) * 0.7; m.torso.rotation.x = -0.35; }
      else if (p.variant === '360 SLAM') spin = p.spin;
    }
    if (a === 'dunkEnd') { m.armR.rotation.set(-3.1, 0, 0.1); m.armL.rotation.set(-3.0, 0, -0.4); m.legL.rotation.x = m.legR.rotation.x = -0.2; m.kneeL.rotation.x = m.kneeR.rotation.x = 0.9; }
  } else if (p.blockT > 0 || p.jumpT > 0) {
    m.armL.rotation.set(-3.0, 0, -0.15); m.armR.rotation.set(-3.0, 0, 0.15); m.elbL.rotation.x = m.elbR.rotation.x = -0.1; m.kneeL.rotation.x = m.kneeR.rotation.x = 0.6; m.legL.rotation.x = m.legR.rotation.x = -0.15;
  } else if (p.reachT > 0) {
    m.armR.rotation.set(-1.55, 0, 0.1); m.elbR.rotation.x = -0.1; m.armL.rotation.set(-0.5, 0, -0.9); crouch = 0.35; lean = 0.3;
  } else if (hasB) {
    const c = Math.abs(Math.cos(B.dPhase * Math.PI));
    const wR = 0.5 + 0.5 * clamp(p.handV, -1, 1), wL = 1 - wR, dr = -0.35 - 1.05 * c; // v23: the hand on the ball dribbles, the other guides, and they trade smoothly as the ball crosses
    m.armR.rotation.set(lerp(-0.8, -0.55 - 0.2 * run, wR), 0, lerp(0.35, 0.32, wR)); m.elbR.rotation.x = lerp(-1.1, dr, wR);
    m.armL.rotation.set(lerp(-0.8, -0.55 - 0.2 * run, wL), 0, lerp(-0.35, -0.32, wL)); m.elbL.rotation.x = lerp(-1.1, dr, wL); crouch = 0.16 + 0.12 * run;
  } else if (defending || near) {
    const wv = Math.sin(S.elapsed * 5 + p.idx) * 0.12; m.armL.rotation.set(-0.75 + wv, 0, -0.55); m.armR.rotation.set(-0.75 - wv, 0, 0.55); m.elbL.rotation.x = m.elbR.rotation.x = -0.7; crouch = 0.34 - 0.14 * run; m.legL.rotation.x *= 0.5; m.legR.rotation.x *= 0.5; lean = 0.18 + 0.1 * run;
  }
  if (a === 'land' && p.y <= 0.001) crouch = Math.max(crouch, 0.38 * Math.max(0, 1 - (p.actT - (p.landT || 0)) / 0.1));
  if (a === '' && p.y <= 0.001 && !p.stun) { const fx = Math.sin(p.face), fz = Math.cos(p.face), af = ((p.ax || 0) * fx + (p.az || 0) * fz), as = ((p.ax || 0) * fz - (p.az || 0) * fx); lean = clamp(lean + af * 0.012, -0.15, 0.7); m.body.rotation.z += clamp(as * 0.006, -0.18, 0.18); }
  if (p.mvT > 0 && a === '') {
    const u = 1 - p.mvT / p.mvDur, s = Math.sin(Math.PI * u), sd = p.mvSide;
    switch (p.mv) {
      case 'cross': m.body.rotation.z = -sd * 0.3 * s; m.torso.rotation.y = sd * 0.45 * s; crouch = Math.max(crouch, 0.3 * s); m.legL.rotation.z = -0.15 * s; m.legR.rotation.z = 0.15 * s; break;
      case 'btlx': { const t = MOVES.btlx.t1 / MOVES.btlx.dur, a1 = u < t ? Math.sin(Math.PI * u / t) : 0, a2 = u >= t ? Math.sin(Math.PI * (u - t) / (1 - t)) : 0;
        crouch = Math.max(crouch, 0.42 * a1 + 0.32 * a2); m.legL.rotation.z = -0.3 * a1; m.legR.rotation.z = 0.3 * a1; m.torso.rotation.y = sd * (0.5 * a2 - 0.25 * a1); m.body.rotation.z = -sd * (0.28 * a2 - 0.1 * a1); break; }
      case 'btl': crouch = Math.max(crouch, 0.45 * s); m.legL.rotation.z = -0.3 * s; m.legR.rotation.z = 0.3 * s; m.body.rotation.z = -sd * 0.12 * s; break;
      case 'btb': { m.torso.rotation.y = sd * 0.8 * s; const st = p.hand < 0 ? m.armR : m.armL, ot = p.hand < 0 ? m.armL : m.armR; st.rotation.x = 0.5 * s - 0.5; ot.rotation.x = -0.6 - 0.8 * s; m.body.rotation.z = -sd * 0.18 * s; break; }
      case 'hop': m.kneeL.rotation.x = 1.3 * s; m.kneeR.rotation.x = 0.4 * s; m.legL.rotation.x = -0.9 * s; m.armL.rotation.x = -1.0 * s; lean = 0.25; break;
      case 'hesi': crouch = Math.max(crouch, 0.52 * s * (u < 0.5 ? 1 : 0.6)); lean = lean - 0.34 * s; break;
      case 'spin': spin = sd * u * u * (3 - 2 * u) * Math.PI * 2; crouch = Math.max(crouch, 0.22 * s); break;
      case 'step': lean = -0.4 * s; crouch = Math.max(crouch, 0.05); m.legL.rotation.x += 0.5 * s; m.legR.rotation.x -= 0.2 * s; m.body.rotation.x = -0.12 * s; break;
      case 'xhesi': { const hu = Math.min(1, u / 0.32), hs = u < 0.32 ? Math.sin(Math.PI * hu) : 0, cs = u >= 0.32 ? Math.sin(Math.PI * (u - 0.32) / 0.68) : 0;
        crouch = Math.max(crouch, 0.5 * hs + 0.3 * cs); lean = lean - 0.3 * hs; m.torso.rotation.y = sd * 0.5 * cs; m.body.rotation.z = -sd * 0.3 * cs; break; }
      case 'xdbl': { const t = MOVES.xdbl.t1 / MOVES.xdbl.dur, a1 = u < t ? Math.sin(Math.PI * u / t) : 0, a2 = u >= t ? Math.sin(Math.PI * (u - t) / (1 - t)) : 0;
        crouch = Math.max(crouch, 0.3 * a1 + 0.34 * a2); m.torso.rotation.y = sd * (0.62 * a2 - 0.5 * a1); m.body.rotation.z = -sd * (0.3 * a2 - 0.26 * a1); lean = lean - 0.1 * a2; break; }
      case 'xlow': crouch = Math.max(crouch, 0.8 * s); lean = lean + 0.14 * s; m.legL.rotation.z = -0.5 * s; m.legR.rotation.z = 0.5 * s; m.torso.rotation.y = sd * 0.35 * s; m.body.rotation.z = -sd * 0.2 * s; break;
      case 'inout': { const t = MOVES.inout.t1 / MOVES.inout.dur, a1 = u < t ? Math.sin(Math.PI * u / t) : 0, a2 = u >= t ? Math.sin(Math.PI * (u - t) / (1 - t)) : 0;
        crouch = Math.max(crouch, 0.3 * a1 + 0.2 * a2); m.body.rotation.z = sd * 0.22 * a1 - sd * 0.18 * a2; m.torso.rotation.y = -sd * 0.35 * a1; lean = lean + 0.2 * a2; break; }
      case 'xstep': { const t = MOVES.xstep.t1 / MOVES.xstep.dur, a1 = u < t ? Math.sin(Math.PI * u / t) : 0, a2 = u >= t ? Math.sin(Math.PI * (u - t) / (1 - t)) : 0;
        lean = lean - 0.42 * a1; crouch = Math.max(crouch, 0.14 * a1 + 0.3 * a2); m.legL.rotation.x += 0.45 * a1; m.torso.rotation.y = sd * 0.6 * a2; m.body.rotation.z = -sd * 0.26 * a2; break; }
      case 'size': crouch = Math.max(crouch, 0.5); m.body.rotation.y = Math.sin(u * 22) * 0.4; m.armR.rotation.x = -0.6 + Math.sin(u * 44) * 0.25; break;
    }
  } else m.legL.rotation.z = m.legR.rotation.z = 0;
  p.spinV = spin;
  if (crouch > 0) { m.legL.rotation.x -= crouch; m.legR.rotation.x -= crouch; m.kneeL.rotation.x += crouch * 2; m.kneeR.rotation.x += crouch * 2; m.body.position.y -= 0.86 * (1 - Math.cos(crouch)); m.torso.rotation.x = lean; m.head.rotation.x = -lean * 0.6; }
  if (p.stun > 0) { m.body.rotation.x = -0.6; m.armL.rotation.set(-0.9, 0, -0.9); m.armR.rotation.set(-0.9, 0, 0.9); m.kneeL.rotation.x = m.kneeR.rotation.x = 0.6; }
  m.root.position.set(p.x, p.y, p.z); m.root.rotation.y = p.face + spin;
  p.shadow.position.set(p.x, 0.012, p.z); const ss = 1.25 * (1 - Math.min(0.5, p.y * 0.25)); p.shadow.scale.set(ss, ss, 1);
}

/* ---------- ball ---------- */
function updateBall(dt) {
  if (B.lock > 0 && B.lock < 90) B.lock -= dt; if (B.fireT > 0) B.fireT -= dt;
  if (B.state === 'held' && B.owner && S.inb && S.inb.ib === B.owner) { const p = B.owner; B.pos.set(p.x + Math.sin(p.face) * 0.32, p.y + 1.22 * p.sc, p.z + Math.cos(p.face) * 0.32); return; } // held in both hands to inbound
  if (B.state === 'held' && B.owner) {
    const p = B.owner, a = p.act, fx = Math.sin(p.face), fz = Math.cos(p.face), hx = Math.cos(p.face), hz = -Math.sin(p.face);
    if (a === 'wind' || a === 'layup' || a === 'dunk' || a === 'oop') {
      const k = a === 'wind' ? clamp(p.actT / 0.4, 0, 1) : 1;
      B.pos.set(p.x + fx * 0.2 + hx * 0.12 * (1 - k), p.y + lerp(1.2, 2.45, k) * p.sc, p.z + fz * 0.2 + hz * 0.12 * (1 - k));
    } else {
      const spd = Math.hypot(p.vx, p.vz), mk = p.mvT > 0 ? p.mv : '', mu = mk ? 1 - p.mvT / p.mvDur : 0;
      B.dPhase += dt * (3.2 + spd * 0.55 + (mk === 'size' ? 3.5 : 0)); { const w = mk ? 15 : 10; p.hvv = (p.hvv || 0) + ((p.hand - p.handV) * w * w - 2 * w * (p.hvv || 0)) * Math.min(dt, 0.04); p.handV = clamp(p.handV + p.hvv * Math.min(dt, 0.04), -1.2, 1.2); } // v23: the ball swings across on a critically damped spring, so a hand switch eases in and out instead of snapping
      const fa = p.face + (mk === 'spin' ? p.spinV : 0), ffx = Math.sin(fa), ffz = Math.cos(fa), hhx = Math.cos(fa), hhz = -Math.sin(fa);
      let lat = 0.3 * p.handV, fw = 0.32, top = 0.88;
      const sm = Math.sin(Math.PI * mu);
      if (mk === 'cross') { fw = 0.32 + 0.12 * sm; top = 0.88 - 0.38 * sm; } else if (mk === 'btl') { fw = 0.32 - 0.28 * sm; top = 0.88 - 0.46 * sm; }
      else if (mk === 'btlx') { const t = MOVES.btlx.t1 / MOVES.btlx.dur; if (mu < t) { const s1 = Math.sin(Math.PI * mu / t); fw = 0.32 - 0.28 * s1; top = 0.88 - 0.46 * s1; } else { const s2 = Math.sin(Math.PI * (mu - t) / (1 - t)); fw = 0.32 + 0.12 * s2; top = 0.88 - 0.38 * s2; } }
      else if (mk === 'btb') { fw = 0.32 - 0.74 * sm; top = 0.88 - 0.12 * sm; } else if (mk === 'xstep') { lat = 0.36 * p.handV; if (mu > 0.33) fw = 0.32 - 0.75 * Math.sin(Math.PI * (mu - 0.33) / 0.67); } else if (mk === 'xdbl') lat = 0.42 * p.handV; else if (mk === 'inout') { const t = MOVES.inout.t1 / MOVES.inout.dur; lat = 0.3 * p.handV * (mu < t ? Math.cos(Math.PI * mu / t) : 1); fw = 0.36; } else if (mk === 'xlow') { lat = 0.12 * p.handV; fw = 0.08; top = 0.56; } else if (mk === 'spin') { lat *= 0.55; fw = 0.2; } else if (mk === 'size') lat = 0.32 * Math.sin(mu * 20);
      const c = Math.cos(B.dPhase * Math.PI); B.pos.set(p.x + hhx * lat + ffx * fw, 0.12 + top * Math.abs(c), p.z + hhz * lat + ffz * fw);
      if (!B.dBounced && Math.abs(c) < 0.06) { B.dBounced = true; Snd.dribble(0.6); } else if (Math.abs(c) > 0.5) B.dBounced = false;
      if (S.mode === 'black' && S.clear[p.team.idx] && cleared(p.x, p.z, hoopOf(p.team))) { S.clear[p.team.idx] = false; toast('CLEARED'); }
    }
    return;
  }
  if (B.state === 'pass') return updatePass(dt);
  const sub = 3, h = dt / sub;
  for (let s = 0; s < sub; s++) {
    const prevY = B.pos.y; B.vel.y -= G * h; B.pos.addScaledVector(B.vel, h);
    if (B.pos.y < BALL_R) {
      B.pos.y = BALL_R;
      if (B.vel.y < 0) { const vy = -B.vel.y; B.vel.y = vy * 0.77; if (B.vel.y < 0.9) B.vel.y = 0; B.vel.x *= 0.92; B.vel.z *= 0.92; if (vy > 1.2) Snd.dribble(Math.min(1, vy / 6)); if (B.state === 'shot' && B.shot && !B.shot.scored) { B.state = 'loose'; missShot(B.shot); } }
      if (B.vel.y === 0) { const f = Math.pow(0.5, h); B.vel.x *= f; B.vel.z *= f; }
    }
    for (const hp of hoops) {
      const dx = B.pos.x - hp.x, dz = B.pos.z; let dh = Math.hypot(dx, dz); const nx = dh > 1e-4 ? dx / dh : 1, nz = dh > 1e-4 ? dz / dh : 0;
      // rim ring collision
      if (Math.abs(B.pos.y - RIM_H) < 0.2 && Math.abs(dh - RIM_R) < 0.2 && !(B.state === 'shot' && B.shot && B.shot.made && !B.shot.scored)) {
        const px = hp.x + nx * RIM_R, pz = nz * RIM_R, ex = B.pos.x - px, ey = B.pos.y - RIM_H, ez = B.pos.z - pz, el = Math.hypot(ex, ey, ez);
        if (el < BALL_R + 0.02 && el > 1e-5) {
          const ux = ex / el, uy = ey / el, uz = ez / el; B.pos.set(px + ux * (BALL_R + 0.02), RIM_H + uy * (BALL_R + 0.02), pz + uz * (BALL_R + 0.02));
          const vn = B.vel.x * ux + B.vel.y * uy + B.vel.z * uz;
          if (vn < 0) { B.vel.x -= 1.55 * vn * ux; B.vel.y -= 1.55 * vn * uy; B.vel.z -= 1.55 * vn * uz; B.vel.multiplyScalar(0.94); if (-vn > 1) { Snd.rim(); hp.shake = Math.min(1.2, hp.shake + -vn / 6); if (typeof fxRim === 'function') fxRim(hp, Math.min(1, -vn / 6)); } if (B.shot) B.shot.touched = true; }
        }
      }
      // backboard
      const bx = (B.pos.x - hp.x) * hp.dir;
      if (bx > 0.575 - BALL_R && bx < 0.7 && Math.abs(B.pos.z) < 0.95 && B.pos.y > 2.85 && B.pos.y < 4.0 && B.vel.x * hp.dir > 0) {
        B.pos.x = hp.x + hp.dir * (0.575 - BALL_R); B.vel.x *= -0.52; B.vel.y *= 0.92; B.vel.z *= 0.92; hp.shake = Math.min(1.2, hp.shake + 0.4); if (B.shot) B.shot.touched = true; Snd.board();
      }
      // scoring
      if (B.shot && !B.shot.scored && B.state === 'shot' && prevY > RIM_H && B.pos.y <= RIM_H && B.vel.y < 0 && dh < RIM_R - 0.015 && hp.dir === (B.shot.H || hoopOf(B.shot.team)).dir) scoreBasket(B.shot, hp);
      // net drag
      if (B.shot && B.shot.scored && dh < RIM_R + 0.05 && B.pos.y < RIM_H && B.pos.y > RIM_H - 0.5) { B.vel.x *= 0.9; B.vel.z *= 0.9; if (B.vel.y < -3.5) B.vel.y = -3.5; }
    }
  }
  if (B.fireT > 0 && Math.random() < 0.9) emit(B.pos.x, B.pos.y, B.pos.z, rnd(-0.3, 0.3), rnd(0, 0.8), rnd(-0.3, 0.3), 0.4, 0.4, 1, 0.7, 0.2, 0, 1);
  // out of bounds (ball on the floor outside the lines)
  if (S.mode === 'gym') { // the gym has walls, not sidelines
    if (B.state === 'loose' || B.state === 'shot') { const bx = GYM_W - 0.4, bz = GYM_H - 0.4; if (B.pos.x > bx) { B.pos.x = bx; if (B.vel.x > 0) { B.vel.x *= -0.5; Snd.thud(Math.min(1, Math.abs(B.vel.x) / 4)); } } else if (B.pos.x < -bx) { B.pos.x = -bx; if (B.vel.x < 0) { B.vel.x *= -0.5; Snd.thud(Math.min(1, Math.abs(B.vel.x) / 4)); } } if (B.pos.z > bz) { B.pos.z = bz; if (B.vel.z > 0) { B.vel.z *= -0.5; Snd.thud(0.6); } } else if (B.pos.z < -bz) { B.pos.z = -bz; if (B.vel.z < 0) { B.vel.z *= -0.5; Snd.thud(0.6); } } }
  } else if (B.state === 'loose' && B.lock <= 0 && S.mode !== 'shoot') {
    const minX = S.mode === 'black' ? -0.2 : -HALF_L - 0.3;
    if (B.pos.x > HALF_L + 0.4 || B.pos.x < minX || Math.abs(B.pos.z) > HALF_W + 0.3) {
      const t = B.lastTeam === 0 ? S.teams[1] : S.teams[0]; Snd.whistle(); turnoverTo(t, B.pos.x, B.pos.z, 'OUT OF BOUNDS'); Com.say('out', '', 1, 8000);
    }
  }
  if (B.state === 'shot' && B.shot && B.shot.scored && B.pos.y < 0.6) B.state = 'loose';
  if (B.state === 'shot' && (Math.abs(B.pos.x) > HALF_L + 6 || Math.abs(B.pos.z) > HALF_W + 6)) B.state = 'loose';
  tryPickup();
}
function tryPickup() {
  if ((B.state !== 'loose' && B.state !== 'shot') || B.lock > 0) return;
  if (S.ft && S.ft.left > 1) return; // nobody touches a free throw that is not the last one
  if (B.state === 'shot' && B.shot && (!B.shot.touched || B.shot.scored)) return;
  if (B.shot && B.shot.scored) return;
  for (const H of S.hoops) if (B.state === 'shot' && B.pos.y > RIM_H - 0.2 && d2(B.pos.x, B.pos.z, H.x, 0) < 0.6) return; // no goaltending over the rim
  let best = null, bs = 1e9;
  for (const p of S.players) {
    if (S.mode === 'gym' && p.lane !== GYM.cur) continue;
    if (S.mode === 'shoot' && !(SH.cur && SH.cur.p === p) && p !== SH.reb) continue;
    if (p.catchLock > 0 || p.stun > 0 || p.act === 'dunk' || p.act === 'dunkEnd' || p.act === 'oop') continue;
    const r = 0.72 + 0.18 * p.rat.reb + (p.jumpT > 0 ? 0.45 : 0), reach = 2.1 + (p.hgt - 1.98) + (p.jumpT > 0 ? 1.0 : 0.45) + p.y;
    if (B.pos.y > reach) continue; const d = d2(p.x, p.z, B.pos.x, B.pos.z); if (d > r) continue;
    const s = d / (0.5 + 0.5 * p.rat.reb) + rnd(0, 0.18); if (s < bs) { bs = s; best = p; }
  }
  if (best) {
    const wasShot = B.shot; const off = best.team.idx === S.poss;
    if (wasShot && !wasShot.scored && !wasShot.missed) missShot(wasShot); // a miss rebounded before it lands is still a miss (ends the hot streak)
    giveBall(best, wasShot ? (off ? 'oreb' : 'reb') : (off ? 'pick' : 'steal')); best.jumpT = 0.3;
    if (wasShot && S.mode !== 'gym' && S.mode !== 'shoot') { Com.say('rebound', best.short, 1, 12000); if (!off && S.mode === 'black') {} callOut(best, 'nice'); }
    S.live = true;
  }
}
