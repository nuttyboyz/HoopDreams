/* ===== Shootout: a tournament of shooting games in the Play Now arena, with the crowd and the booth. You (and a friend) against CPU shooters take turns on the same
   events: 3-Point Shootout, Around the World, Hot Spots, Free Throw Frenzy and Deep Range. Placements earn points, most points after the last event is the champ.
   Hooks the rest of the game calls: shStart from startMatch, shPlayers / shBall from update(), shHud from updateHud, shStop from disposeMatch. ===== */
const SH = { reb: null, focusP: null, on: false, cons: [], evs: [], ei: -1, ci: -1, cur: null, T: null, phase: '', t: 0, dir: 1, rings: null, ring2: null, label: null, money: false, panel: null, tab: null, key: '', tabKey: '', sT: 0, refT: 0, glideT: 0, table: null };
const SH_EV = {
  tp: { name: '3-POINT SHOOTOUT', short: '3PT', limit: 60, intro: '5 RACKS · 5 BALLS · THE LAST BALL IS WORTH 2' },
  atw: { name: 'AROUND THE WORLD', short: 'ATW', limit: 60, intro: '7 SPOTS · MAKE IT TO MOVE ON · MISSES COST YOU' },
  hot: { name: 'HOT SPOTS', short: 'HOT', limit: 45, intro: 'HIT THE LIT SPOT · THREE IN A ROW ADDS A POINT' },
  ft: { name: 'FREE THROW FRENZY', short: 'FT', limit: 40, intro: '12 SHOTS · EVERY MAKE IN A ROW IS WORTH MORE' },
  deep: { name: 'DEEP RANGE', short: 'DEEP', limit: 60, intro: 'EVERY SPOT IS FARTHER · TWO TRIES AT EACH' },
};
const SH_ALL = ['tp', 'atw', 'hot', 'ft', 'deep'];
const SH_KITS = [[0xff7a1a, 0xf1f3f8], [0x35c98e, 0x15171c], [0x3b7bff, 0xf1f3f8], [0xb04bff, 0xf1f3f8], [0xffc533, 0x15171c]];
const SH_COURT = [{ short: 'Hoop', home: 0xff7a1a, away: 0xf1f3f8, trim: 0xffc533 }, { short: 'Dreams', home: 0x2a3d8f, away: 0xf1f3f8, trim: 0xf1f3f8 }];
const SH_DEEP = [3, 3, 4, 5, 6, 8];
const shCss = c => '#' + ('000000' + c.toString(16)).slice(-6);

/* ---- session ---- */
function shStart() {
  shStop(); SH.on = true; S.live = true; S.countT = 0; S.dead = 0; S.finish = false; S.poss = 0; S.shotClock = 24; SH.money = false;
  const t0 = S.teams[0]; SH.evs = CFG.shEv === 'all' || !SH_EV[CFG.shEv] ? SH_ALL.slice() : [CFG.shEv];
  SH.cons = t0.players.map((p, i) => { const h = S.humans[i] && S.humans[i].p === p ? S.humans[i] : null; p.shi = i; if (!h) { p.gymRole = 'cpu'; p.gymLvl = clamp(CFG.diff | 0, 0, 2); } return { p, h, i, name: p.short.toUpperCase(), total: 0, score: 0, detail: '', col: SH_KITS[i % SH_KITS.length][0], plc: [], sum: 0 }; });
  SH.cons.forEach((c, i) => { const s = shBench(i); c.p.x = s[0]; c.p.z = s[1]; c.p.face = Math.PI; c.p.vx = c.p.vz = 0; c.p.y = 0; c.p.act = ''; });
  SH.reb = null; if (CFG.shReb) shAddReb();
  shBuildFx(); shBuildHud();
  const chipA = $('tmA').querySelector('.chip'), chipB = $('tmB').querySelector('.chip'); chipA.style.background = shCss(SH.cons[0].col); chipB.style.background = shCss(SH.cons[1] ? SH.cons[1].col : 0x3b4a5c);
  SH.ei = -1; shNextEvent(); Snd.whistle(); Snd.cheer(1.3, 3);
}
function shStop() {
  if (!SH.on && !SH.panel) return; SH.on = false; SH.cur = null; SH.T = null; SH.phase = ''; SH.reb = null; SH.focusP = null;
  for (const e of [SH.panel, SH.tab]) if (e) e.remove(); SH.panel = SH.tab = null; SH.key = SH.tabKey = '';
  for (const o of [SH.ring, SH.ring2, SH.label]) if (o && o.parent) o.parent.remove(o); SH.ring = SH.ring2 = SH.label = null;
}
function shBench(i) { return [-5.2 + i * 2.4, HALF_W - 0.35]; }
function shBuildFx() {
  const mk = (r0, r1, col) => { const m = new T.Mesh(new T.RingGeometry(r0, r1, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; m.visible = false; arena.add(m); return m; };
  SH.ring = mk(0.7, 0.9, 0xffc533); SH.ring2 = mk(0.75, 0.82, 0xffffff); SH.label = gymLabel('', '#ffc533', 2.4); SH.label.visible = false; arena.add(SH.label);
}
function shBuildHud() {
  const hud = $('hud'), p = document.createElement('div'); p.id = 'shb'; hud.appendChild(p); SH.panel = p;
  const t = document.createElement('div'); t.id = 'shtab'; t.className = 'hidden'; hud.appendChild(t); SH.tab = t;
}

/* ---- the rebounder: a big man under the basket who chases every miss and passes it back to whoever is shooting ---- */
function shAddReb() {
  const used = new Set(S.players.map(p => p.pl.id)), pool = POOL.filter(q => !used.has(q.id) && q.role === 'B'), pl = pick(pool.length ? pool : POOL), t0 = S.teams[0];
  const p = makePlayer(t0, t0.players.length, pl); p.gymRole = 'reb'; p.rebT = 0; p.rat.spd = Math.max(p.rat.spd, 6.4); t0.players.push(p); S.players.push(p); makeTag(p, 'REB'); SH.reb = p;
  p.x = 0; p.z = -HALF_W + 0.5; p.vx = p.vz = 0; p.y = 0; p.act = '';
}
function shRebAI(p, dt) {
  p.sprint = false; p.protect = false; if (p.act !== '' || p.stun > 0) { p.wx = p.wz = 0; return; }
  const H = hoopOf(S.teams[0]), c = SH.cur, hum = c && SH.phase === 'live' ? c.p : null;
  if (B.owner === p) {
    p.rebT += dt; p.wx = p.wz = 0; if (hum) { p.lookX = hum.x; p.lookZ = hum.z; }
    if (hum && p.rebT > 0.4 && (hum.act === '' || hum.act === 'land') && hum.catchLock <= 0) { const d = d2(p.x, p.z, hum.x, hum.z); if (d > 1.4) { doPass(p, hum, d > 9 ? 'lob' : 'chest'); callOut(p, 'nice'); } p.rebT = 0.1; }
    return;
  }
  p.rebT = 0;
  if (!B.owner && B.state !== 'pass' && B.state !== 'dead' && (B.state === 'loose' || B.state === 'shot') && !(B.shot && B.shot.scored && B.lock > 90)) {
    if (B.state === 'shot' && B.shot && !B.shot.touched && !B.shot.missed && !B.shot.scored) moveTo(p, H.x - H.dir * 1.3, (p.z >= 0 ? 1 : -1) * 1.5, true);
    else { const tx = B.pos.x + B.vel.x * 0.35, tz = B.pos.z + B.vel.z * 0.35; const d = moveTo(p, tx, tz, true); if (B.pos.y > 1.8 && B.pos.y < 3.4 && d < 2.0 && p.jumpT <= 0) p.jumpT = 0.5; }
    p.lookX = B.pos.x; p.lookZ = B.pos.z; return;
  }
  const side = hum && hum.z >= 0 ? -1 : 1; moveTo(p, H.x - H.dir * 1.1, side * 1.7, false); p.lookX = hum ? hum.x : 0; p.lookZ = hum ? hum.z : 0;
}

/* ---- events and turns ---- */
function shNextEvent() {
  SH.ei++;
  if (SH.ei >= SH.evs.length) return shFinal();
  const ev = SH.evs[SH.ei], E = SH_EV[ev]; SH.dir = SH.ei % 2 ? -1 : 1; S.teams[0].atk = SH.dir; S.teams[1].atk = -SH.dir; SH.ci = -1;
  for (const c of SH.cons) { c.score = 0; c.detail = ''; }
  SH.phase = 'intro'; SH.t = 3.2; SH.cur = null; SH.T = null; B.owner = null; B.state = 'dead'; B.shot = null; B.pos.set(0, -9, 0); B.vel.set(0, 0, 0);
  banner(E.name, true); toast('EVENT ' + (SH.ei + 1) + ' OF ' + SH.evs.length + ' · ' + E.intro); Snd.whistle(); Snd.cheer(0.9, 2.6);
  if (SH.tab) SH.tab.classList.add('hidden');
}
function shSpotsFor(ev, H) {
  if (ev === 'tp') { const a = 0.82, c = Math.sqrt(ARC * ARC - CORNER * CORNER) - 0.35; return [[H.x - H.dir * c, -CORNER - 0.3], gymSpot(H, ARC + 0.35, -a), gymSpot(H, ARC + 0.35, 0), gymSpot(H, ARC + 0.35, a), [H.x - H.dir * c, CORNER + 0.3]]; }
  if (ev === 'atw') { const o = []; for (let i = 0; i < 7; i++) o.push(gymSpot(H, 5.1, -1.25 + i * 2.5 / 6)); return o; }
  if (ev === 'ft') return [[H.x - H.dir * FT_X, 0]];
  if (ev === 'deep') return [7.9, 9.0, 10.2, 11.4, 12.6, 13.8].map((d, i) => gymSpot(H, d, i % 2 ? 0.22 : -0.22));
  const pool = []; for (const a of [-1.05, -0.35, 0.35, 1.05]) pool.push(gymSpot(H, 4.9, a)); for (const a of [-1.15, -0.6, 0, 0.6, 1.15]) pool.push(gymSpot(H, ARC + 0.3, a)); return pool;
}
function shBegin() {
  const ev = SH.evs[SH.ei], E = SH_EV[ev], c = SH.cons[SH.ci], p = c.p, H = hoopOf(S.teams[0]);
  SH.cur = c; const sp = shSpotsFor(ev, H);
  const T_ = { ev, E, H, spots: ev === 'hot' ? [] : sp, pool: ev === 'hot' ? sp : null, t: 0, score: 0, shots: 0, made: 0, i: 0, ballN: 0, balls: ev === 'tp' ? 25 : ev === 'ft' ? 12 : 99, tries: 0, streak: 0, miss: 0, cur: ev === 'hot' ? pick(sp) : null, pending: null, last: null, ok: false, over: false, done: false, aiT: 0.6, refT: 0, sT: 0 };
  SH.T = T_; p.act = ''; p.y = 0; B.pos.set(p.x, 1, p.z); giveBall(p, 'rack'); B.lock = 0; S.poss = 0; S.teams[0].atk = SH.dir; S.teams[1].atk = -SH.dir;
  SH.phase = 'glide'; SH.glideT = 0; SH.money = false;
  banner(c.name, !!c.h); toast(E.name + (c.h ? ' · YOUR TURN' : ''));
  Snd.cheer(0.5, 1.6);
}
function shSpot() { const T_ = SH.T; if (!T_) return null; if (T_.ev === 'hot') return T_.cur; return T_.spots[Math.min(T_.i, T_.spots.length - 1)]; }
function shTurnEnd() {
  const T_ = SH.T, c = SH.cur; if (!T_ || T_.over) return; T_.over = true;
  c.score = T_.score; c.detail = shDetail(T_);
  banner(T_.done ? 'PERFECT!' : 'TIME!', T_.score >= 20 && T_.ev !== 'ft' || T_.done); toast(c.name + ' · ' + T_.score + ' PTS');
  Snd.buzzer(); Snd.cheer(clamp(0.5 + T_.score * 0.04, 0.5, 1.6), 2.6);
  if (c.h && T_.score >= 14) Com.say('fire', c.p.short, 1, 3000);
  SH.money = false; SH.phase = 'between'; SH.t = 2.0; SH.T = null;
  B.owner = null; B.state = 'dead'; B.shot = null; B.pos.set(0, -9, 0); B.vel.set(0, 0, 0); p_idle(c.p);
}
function p_idle(p) { p.act = ''; p.wx = p.wz = 0; }
function shDetail(T_) {
  if (T_.ev === 'tp' || T_.ev === 'hot' || T_.ev === 'ft') return T_.made + ' OF ' + T_.shots;
  if (T_.ev === 'atw') return T_.i + ' OF 7 SPOTS · ' + T_.miss + ' MISSES';
  return T_.i + ' OF 6 SPOTS';
}
function shRank() {
  const o = SH.cons.slice().sort((a, b) => b.score - a.score), n = o.length; let r = 0;
  o.forEach((c, i) => { if (i > 0 && o[i].score < o[i - 1].score) r = i; c.rank = r; c.gain = n - r; });
  return o;
}
function shEventEnd() {
  const o = shRank(); for (const c of o) { c.total += c.gain; c.sum += c.score; c.plc.push(c.rank + 1); }
  SH.table = o.map(c => ({ c, rank: c.rank, score: c.score, detail: c.detail, gain: c.gain })); SH.phase = 'table'; SH.t = 7; SH.cur = null;
  const w = o[0], tie = o.length > 1 && o[1].score === w.score;
  banner(tie ? 'DEAD HEAT!' : w.name + ' WINS IT', true); Snd.cheer(1.4, 4); Snd.whistle();
  if (o.length > 1 && Math.abs(o[0].total - o[1].total) <= 1) Com.say('close', '', 1, 8000);
  if (w.h) Com.say('hot', w.p.short, 1, 2000);
  shTabBuild(false);
}
function shFinal() {
  const o = SH.cons.slice().sort((a, b) => b.total - a.total || b.plc.filter(x => x === 1).length - a.plc.filter(x => x === 1).length || b.sum - a.sum), w = o[0];
  SH.phase = 'final'; SH.t = 4.5; SH.cur = null; SH.final = o;
  banner(w.name + ' IS THE CHAMP', true); toast(w.total + ' POINTS'); Snd.cheer(1.8, 6); Snd.buzzer(); Com.say('over', '', 2, 0); setTimeout(() => Com.say('win', w.p.short, 2, 0), 3000);
  for (let i = 0; i < 4; i++) setTimeout(() => { if (SH.on) burst(w.p.x + rnd(-2, 2), 1.5, w.p.z, 70, 6, 1.2, [[1, 0.85, 0.3], [1, 1, 1], [1, 0.4, 0.2]], 1.1, 0.7, 2); }, i * 450);
  if (SH.tab) SH.tab.classList.add('hidden');
}
function shTabBuild(final) {
  if (!SH.tab) return;
  const rows = (final ? SH.final.map((c, i) => ({ c, rank: i, score: c.total, detail: c.plc.join(' · '), gain: 0 })) : SH.table);
  const head = final ? 'FINAL STANDINGS' : SH_EV[SH.evs[SH.ei]].name;
  SH.tab.innerHTML = '<h3>' + head + '</h3>' + rows.map(r => '<div class="r' + (r.c.h ? ' me' : '') + '"><i style="background:' + shCss(r.c.col) + '"></i><b>' + (r.rank + 1) + '</b><span>' + r.c.name + '</span><em>' + r.detail + '</em><u>' + (final ? r.score + ' PTS' : r.score + ' · +' + r.gain) + '</u></div>').join('') + '<p>' + (final ? '' : 'PRESS ✕ TO CONTINUE') + '</p>';
  SH.tab.classList.remove('hidden');
}

/* ---- per frame ---- */
function shPlayers(dt) {
  SH.t -= dt; const ph = SH.phase, cur = SH.cur, T_ = SH.T, skip = SH.cons.some(c => c.h && INP[c.h.id].xP);
  for (const c of SH.cons) { const I = c.h && INP[c.h.id]; if (I && c !== cur) { I.xP = I.oP = I.tP = I.shootP = false; I.shoot = false; } }
  if (ph === 'intro' && SH.t <= 0) { SH.ci = 0; shBegin(); }
  else if (ph === 'between' && SH.t <= 0) { SH.ci++; if (SH.ci >= SH.cons.length) shEventEnd(); else shBegin(); }
  else if (ph === 'table') { if (SH.t <= 0 || (skip && SH.t < 6.2)) shNextEvent(); }
  else if (ph === 'final' && SH.t <= 0) { shTabBuild(true); SH.phase = 'done'; SH.t = 3.5; }
  else if (ph === 'done' && SH.t <= 0) { if (SH.tab) SH.tab.classList.add('hidden'); SH.phase = 'over'; shGameOver(); }
  const sp = SH.phase === 'glide' || SH.phase === 'live' ? shSpot() : null, H = T_ ? T_.H : null;
  for (const c of SH.cons) {
    const p = c.p; p.hold = 0;
    if (c === SH.cur && (SH.phase === 'glide' || SH.phase === 'live')) {
      if (SH.phase === 'glide') {
        SH.glideT += dt; const dx = sp[0] - p.x, dz = sp[1] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.4 || SH.glideT > 4.5) { SH.phase = 'live'; T_.t = 0; p.wx = p.wz = 0; p.sprint = false; if (H) { p.face = Math.atan2(H.x - p.x, -p.z); p.lookX = H.x; p.lookZ = 0; } }
        else { const k = Math.min(1, d / 1.6); p.wx = dx / d * k; p.wz = dz / d * k; p.sprint = d > 3; p.lookX = H ? H.x : p.lookX; p.lookZ = 0; }
      } else if (c.h) { const I = INP[c.h.id]; I.xP = I.oP = I.tP = false; I.l1 = false; humanUpdate(c.h, dt); }
      else shCpu(c, dt);
    } else if (c !== SH.cur || !(SH.phase === 'glide' || SH.phase === 'live')) {
      const s = shBench(c.i), d = moveTo(p, s[0], s[1], false); p.sprint = d > 6; if (d < 0.5) { p.lookX = 0; p.lookZ = 0; }
    }
  }
  if (SH.cur) SH.focusP = SH.cur.p; else if (!SH.focusP && SH.cons[0]) SH.focusP = SH.cons[0].p;
  if (SH.reb) shRebAI(SH.reb, dt);
  for (const p of S.players) movePlayer(p, dt);
}
function shCpu(c, dt) {
  const p = c.p, T_ = SH.T, sp = shSpot(), d = d2(p.x, p.z, sp[0], sp[1]);
  p.lookX = T_.H.x; p.lookZ = 0;
  if (d > 0.4 && p.act === '') { moveTo(p, sp[0], sp[1], d > 3); return; }
  p.wx = p.wz = 0; p.sprint = false;
  if (B.owner === p && p.act === '') { T_.aiT -= dt; if (T_.aiT <= 0) { p.face = Math.atan2(T_.H.x - p.x, -p.z); startJump(p); T_.aiT = rnd(0.25, 0.6); } }
}
function shBall(dt) {
  const T_ = SH.T, c = SH.cur; if (SH.phase !== 'live' || !T_ || T_.over) return;
  const p = c.p, sp = shSpot(), H = T_.H;
  T_.t += dt; if (T_.E.limit && T_.t >= T_.E.limit) { shTurnEnd(); return; }
  if (B.shot && B.shot.scored) { T_.sT += dt; if (T_.sT > 0.9 && B.state !== 'held') { if (B.state === 'shot') B.state = 'loose'; B.shot = null; B.lock = 0; T_.sT = 0; } } else T_.sT = 0;
  if (!T_.pending && B.state === 'shot' && B.shot && B.shot.by === p && B.shot !== T_.last) {
    T_.pending = B.shot; T_.last = B.shot; T_.ok = d2(p.x, p.z, sp[0], sp[1]) < 1.7 && H.dir === hoopOf(p.team).dir; T_.age = 0;
  }
  if (T_.pending) {
    T_.age += dt; const pd = T_.pending;
    if (pd.scored || pd.missed || B.shot !== pd || T_.age > 4) { const made = !!pd.scored; T_.pending = null; T_.refT = 0; if (T_.ok) shShot(c, made); else { toast('SHOOT FROM THE SPOT'); if (made) { Snd.tick(); } } if (T_.over) return; }
  }
  // the ball boy: a fresh ball is in your hands a beat after the last one is settled
  if (!T_.pending && gymCanTake() && B.owner !== p && (p.act === '' || p.act === 'land') && d2(p.x, p.z, sp[0], sp[1]) < 1.7 && T_.balls > 0) {
    T_.refT += dt; if (T_.refT > (SH.reb ? 4.5 : 0.55)) { T_.refT = 0; B.pos.set(p.x, 1, p.z); B.vel.set(0, 0, 0); giveBall(p, 'rack'); B.lock = 0; B.shot = null; B.pass = null; p.catchLock = 0; S.poss = 0; Snd.catch_(); }
  } else if (!T_.pending && B.owner === p) T_.refT = 0;
  const moneyNow = T_.ev === 'tp' && T_.ballN === 4; if (SH.money !== moneyNow) SH.money = moneyNow;
}
function shShot(c, made) {
  const T_ = SH.T, p = c.p; T_.shots++; if (made) T_.made++;
  const ev = T_.ev;
  if (ev === 'tp') {
    T_.ballN++; T_.balls--; const money = T_.ballN === 5;
    if (made) { T_.score += money ? 2 : 1; toast(money ? 'MONEY BALL · +2' : '+1 · ' + T_.score); if (money) Snd.cheer(0.9, 2.2); } else if (money) toast('MONEY BALL MISSED');
    if (T_.ballN >= 5) { T_.ballN = 0; T_.i++; if (T_.i >= 5) { shTurnEnd(); return; } toast('NEXT RACK'); Snd.tick(); }
  } else if (ev === 'atw') {
    if (made) { T_.i++; if (T_.i >= 7) { T_.done = true; T_.score = Math.max(0, T_.i * 3 - T_.miss + 5); shTurnEnd(); return; } toast('SPOT ' + (T_.i + 1) + ' OF 7'); Snd.tick(); } else { T_.miss++; toast('STAY ON IT'); }
    T_.score = Math.max(0, T_.i * 3 - T_.miss);
  } else if (ev === 'hot') {
    const three = isThree(T_.cur[0], T_.cur[1], T_.H);
    if (made) { let pts = three ? 3 : 2; T_.streak++; if (T_.streak >= 3) { pts += 1; toast('HEAT CHECK · +' + pts); } else toast('+' + pts + ' · ' + (T_.score + pts)); T_.score += pts; } else T_.streak = 0;
    let n = T_.cur; while (n === T_.cur) n = pick(T_.pool); T_.cur = n; Snd.tick();
  } else if (ev === 'ft') {
    T_.balls--;
    if (made) { T_.streak++; const pts = Math.min(3, T_.streak); T_.score += pts; toast('+' + pts + (T_.streak >= 3 ? ' · MAX STREAK' : '')); } else { T_.streak = 0; }
    if (T_.balls <= 0) { shTurnEnd(); return; }
  } else {
    if (made) { T_.score += SH_DEEP[T_.i]; toast('+' + SH_DEEP[T_.i] + ' · SPOT ' + (T_.i + 1) + ' OF 6'); T_.i++; T_.tries = 0; Snd.cheer(0.5 + T_.i * 0.15, 2); if (T_.i >= 6) { T_.done = true; shTurnEnd(); return; } }
    else { T_.tries++; if (T_.tries >= 2) { toast('OUT OF RANGE'); shTurnEnd(); return; } toast('ONE MORE TRY'); }
  }
}
function shGameOver() {
  S.live = false; S.over = true; S.state = 'over'; setTimeout(() => showMenu('over'), 600);
}
function shAfterScore() { B.lock = 0; B.shot = null; }

/* ---- hud: scoreboard, the board of shooters, per-turn hint, spot markers ---- */
function shHud() {
  if (!SH.on) return; const T_ = SH.T, c = SH.cur, ev = SH.evs[SH.ei] && SH_EV[SH.evs[SH.ei]];
  const a = $('tmA').querySelector('.pts'), b = $('tmB').querySelector('.pts'), ab = $('tmA').querySelector('.abbr'), bb = $('tmB').querySelector('.abbr');
  const lead = SH.cons.slice().sort((x, y) => y.total - x.total)[0], me = SH.cons[0], rival = c && c !== me ? c : (SH.cons.find(x => x !== me) || me);
  const na = me.name.slice(0, 7), nb = (rival || me).name.slice(0, 7); const pa = String(c === me && T_ ? T_.score : me.score), pb = String(rival === c && T_ ? T_.score : (rival || me).score);
  if (ab.textContent !== na) ab.textContent = na; if (bb.textContent !== nb) bb.textContent = nb; if (a.textContent !== pa) a.textContent = pa; if (b.textContent !== pb) b.textContent = pb;
  const clk = document.querySelector('#score .clk'), sub = document.querySelector('#score .sub');
  const t = T_ && T_.E.limit && SH.phase === 'live' ? gymClock(T_.E.limit - T_.t) : T_ && T_.E.limit ? gymClock(T_.E.limit) : '-:--';
  if (clk.textContent !== t) clk.textContent = t;
  const l = ev ? 'EVENT ' + (SH.ei + 1) + '/' + SH.evs.length + ' · ' + ev.short + (c ? ' · ' + c.name : '') : 'SHOOTOUT'; if (_hc.sub !== l) { _hc.sub = l; sub.textContent = l; } sub.style.fontSize = '';
  // the board
  if (SH.panel) {
    const rows = SH.cons.map(x => '<div class="r' + (x === c ? ' on' : '') + (x.h ? ' me' : '') + '"><i style="background:' + shCss(x.col) + '"></i><span>' + x.name + '</span><em>' + (x === c && T_ ? T_.score : x.score) + '</em><u>' + x.total + '</u></div>').join('');
    const k = rows + (ev ? ev.short : ''); if (k !== SH.key) { SH.key = k; SH.panel.innerHTML = '<h4><span>SHOOTOUT</span><em>EVENT</em><u>TOTAL</u></h4>' + rows; }
  }
  // the hint under the scoreboard
  let ht = '';
  if (SH.phase === 'glide' && c && c.h) ht = 'GET TO THE LIT SPOT';
  else if (SH.phase === 'live' && T_ && c) {
    const sp = shSpot(), far = c.h && d2(c.p.x, c.p.z, sp[0], sp[1]) > 1.7, pre = far ? 'GET TO THE LIT SPOT · ' : '';
    if (T_.ev === 'tp') ht = pre + 'RACK ' + (T_.i + 1) + ' OF 5 · BALL ' + (T_.ballN + 1) + (T_.ballN === 4 ? ' · MONEY BALL' : '') + ' · ' + T_.score + ' PTS';
    else if (T_.ev === 'atw') ht = pre + 'SPOT ' + (T_.i + 1) + ' OF 7 · ' + T_.shots + ' SHOTS · ' + T_.score + ' PTS';
    else if (T_.ev === 'hot') ht = pre + T_.score + ' PTS' + (T_.streak >= 2 ? ' · ' + T_.streak + ' IN A ROW' : '');
    else if (T_.ev === 'ft') ht = 'SHOT ' + (T_.shots + 1) + ' OF 12 · STREAK ' + T_.streak + ' · ' + T_.score + ' PTS';
    else ht = pre + 'SPOT ' + (T_.i + 1) + ' OF 6 · ' + (2 - T_.tries) + (2 - T_.tries === 1 ? ' TRY' : ' TRIES') + ' LEFT · ' + T_.score + ' PTS';
  }
  hint(ht);
  if (SH.ring) {
    const tt = performance.now() * 0.001, sp = SH.phase === 'glide' || SH.phase === 'live' ? shSpot() : null;
    SH.ring.visible = SH.label.visible = !!sp; SH.ring2.visible = false;
    if (sp && T_) {
      SH.ring.position.set(sp[0], 0.03, sp[1]); SH.ring.scale.setScalar(1 + 0.08 * Math.sin(tt * 6)); SH.ring.material.opacity = 0.7 + 0.3 * Math.sin(tt * 6); SH.ring.material.color.setHex(SH.money ? 0xffe14a : 0xffc533);
      const nx = (T_.ev === 'tp' && T_.i < 4) || (T_.ev === 'atw' && T_.i < 6) || (T_.ev === 'deep' && T_.i < 5) ? T_.spots[T_.i + 1] : null;
      SH.ring2.visible = !!nx; if (nx) { SH.ring2.position.set(nx[0], 0.03, nx[1]); SH.ring2.material.opacity = 0.35; }
      SH.label.position.set(sp[0], 1.9 + Math.sin(tt * 2) * 0.05, sp[1]);
      gymLabelSet(SH.label, T_.ev === 'tp' ? (5 - T_.ballN) + (5 - T_.ballN === 1 ? ' BALL · MONEY' : ' BALLS') : T_.ev === 'atw' ? 'SPOT ' + (T_.i + 1) + ' OF 7' : T_.ev === 'hot' ? (isThree(sp[0], sp[1], T_.H) ? '3 POINTS' : '2 POINTS') : T_.ev === 'ft' ? 'FREE THROW LINE' : '+' + SH_DEEP[Math.min(T_.i, 5)] + ' PTS');
    }
  }
}

/* ---- the results screen ---- */
function shResultsHtml() {
  const o = SH.final || SH.cons.slice().sort((a, b) => b.total - a.total), w = o[0], evs = SH.evs.map(e => SH_EV[e].short);
  const th = '<tr><th>SHOOTER</th>' + evs.map(e => '<th>' + e + '</th>').join('') + '<th>TOTAL</th></tr>';
  const tr = o.map((c, i) => '<tr' + (c.h ? '' : ' class="ej"') + '><td>' + (i + 1) + '. ' + c.p.name + '</td>' + evs.map((e, k) => '<td>' + (c.plc[k] ? '#' + c.plc[k] : '-') + '</td>').join('') + '<td><b>' + c.total + '</b></td></tr>').join('');
  return '<h2 class="logo" style="font-size:clamp(34px,7vw,64px)">' + w.p.name.split(' ').pop() + '<br><em>Shootout Champ</em></h2><p class="note" style="text-align:center">' + (SH.cons.length > 1 ? w.total + ' points · ' + w.plc.filter(x => x === 1).length + ' event win' + (w.plc.filter(x => x === 1).length === 1 ? '' : 's') : 'You scored ' + w.total + ' points') + '</p><table class="bx">' + th + tr + '</table>';
}
