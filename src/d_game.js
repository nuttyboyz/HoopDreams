/* ===== Game state, match setup, possession, scoring, heat / on-fire ===== */
const CFG = { bodies: 'real', mode: 'play', players: 'solo', t0: 0, t1: 1, sq0: ['curry', 'durant', 'klay'], sq1: ['jordan', 'kobe', 'lebron'], qlen: 120, diff: 1, size: 3, target: 21, scoring: '12', mit: false, quality: 1, sound: true, talk: true, cam: '2k', vox: 0, voice: 0, shotStick: 0, foulLimit: 3, persona: 1, shortyAll: true, gymLvl: 1, shEv: 'all', shRiv: 3, shReb: true };
// settings that stick between visits (storage can be blocked inside embeds, so every access is wrapped)
const SAVED = { bodies: v => v === 'real' || v === 'classic', shotStick: v => v === 0 || v === 1, persona: v => v === 0 || v === 1 || v === 2, shortyAll: v => typeof v === 'boolean', cfgv: v => v === 11 || v === 12 || v === 13 || v === 14, cam: v => ['2k', 'full', 'tv', 'drone', 'fp'].includes(v), voice: v => Number.isInteger(v) && v >= 0 && v < 40, vox: v => Number.isInteger(v) && v >= 0 && v <= 4, sound: v => typeof v === 'boolean', talk: v => typeof v === 'boolean' };
try { const o = JSON.parse(localStorage.getItem('hoopdreams.cfg') || '{}'); if (![11, 12, 13, 14].includes(o.cfgv)) { delete o.persona; delete o.shortyAll; } if (o.cfgv !== 12 && o.cfgv !== 13 && o.cfgv !== 14) delete o.mit; if (o.cfgv === 13) delete o.shotStick; for (const k in SAVED) if (k in o && SAVED[k](o[k])) CFG[k] = o[k]; } catch (e) { } // settings saved before version 11 keep everything but the commentator, so Shorty is on by default
CFG.cfgv = 14; // 14: shot stick back to the original (pull down, off by default); 12: make it take it is off by default (losers' ball keeps Blacktop games close)
function saveCfg() { try { const o = {}; for (const k in SAVED) o[k] = CFG[k]; localStorage.setItem('hoopdreams.cfg', JSON.stringify(o)); } catch (e) { } }
const S = {
  state: 'menu', mode: 'play', live: false, teams: [], players: [], humans: [], hoops: [], poss: 0, shotClock: 24,
  clock: 0, period: 1, over: false, dead: 0, checkT: 0, clear: [false, false], countT: 0, ts: 1, slowT: 0, stallT: 0, n: 5,
  hotName: '', lastScorer: null, otPeriods: 0, elapsed: 0, timeout: 0,
  ft: null, ftAfter: null, foulT: 0, deadT: 0, deadThen: null, pendingFight: null // rules (e_rules.js)
};
const B = { pos: new T.Vector3(0, 1, 0), vel: new T.Vector3(), state: 'dead', owner: null, last: null, lastTeam: 0, shot: null, pass: null, lock: 0, dPhase: 0, fireT: 0 };
const LAST = { 'Luka Don\u010di\u0107': 'Luka', 'Manu Gin\u00f3bili': 'Manu', 'Victor Wembanyama': 'Wemby', 'Shai Gilgeous-Alexander': 'Shai', 'Magic Johnson': 'Magic', 'Dennis Johnson': 'DJ', 'Caron Butler': 'Caron', 'Kareem Abdul-Jabbar': 'Kareem', 'J.R. Smith': 'JR', 'Rip Hamilton': 'Rip', 'Carmelo Anthony': 'Carmelo', 'Michael Porter Jr.': 'Porter', 'Bench Guy': 'Bench', 'LaMelo Ball': 'LaMelo', 'Josh Green': 'Josh', 'Terrence Shannon Jr.': 'Shannon' };
const lastName = n => LAST[n] || n.split(' ').slice(-1)[0];
const hoopOf = team => S.hoops.find(h => h.dir === team.atk) || S.hoops[0];
const ownHoop = team => S.hoops.find(h => h.dir === -team.atk) || S.hoops[0];
const opp = team => S.teams[1 - team.idx];
const d2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const cleared = (x, z, H) => Math.hypot(x - H.x, z) >= ARC + 0.3 || Math.abs(z) >= CORNER; // Blacktop take-it-back: past the arc, or out in the corner
const isThree = (x, z, H) => Math.hypot(x - H.x, z) >= ARC - 0.02 || Math.abs(z) >= CORNER;

const RATING_SQUEEZE = 0.72;
function ratings(pl) {
  const sq = v => 72 + (v - 72) * RATING_SQUEEZE; // keeps a 99 ahead of a 80 without letting one star decide the game
  const r = (v, lo = 30, hi = 70) => clamp((sq(v) - lo) / hi, 0.05, 1);
  const rb = { G: 0.9, W: 0.75, B: 0.55 }[pl.role];
  return { spd: 6.0 + (sq(pl.spd) - 55) / 45 * 1.9, three: r(pl.t3), shoot: r(pl.mid), inside: r(pl.fin), dunk: r(pl.dnk), def: clamp((sq(pl.def) - 30) / 70, 0.1, 1), reb: 0.4 + clamp((sq(pl.reb) - 30) / 70, 0, 1) * 0.8, handle: clamp(0.45 * rb + 0.55 * (sq(pl.ovr) - 60) / 40, 0.2, 1) };
}

function makePlayer(team, idx, pl) {
  const kit = team.kit;
  const m = buildPlayer({ build: pl.role, jersey: kit.jersey, shorts: kit.shorts, numColor: kit.num, shoe: idx % 2 ? 0x141414 : kit.shorts, skin: pl.skin, skinC: pl.skinC, hair: pl.hair, hairC: pl.hairC, extra: pl.extra, bandC: pl.bandC, sleeveC: pl.sleeveC, num: pl.num, short: lastName(pl.name), hgt: pl.hgt });
  const shadow = makeShadow(1.25);
  const aura = new T.Mesh(sphG, new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false }));
  aura.scale.set(0.6, 1.1, 0.6); aura.position.y = 1.0; aura.visible = false; m.root.add(aura);
  scene.add(m.root); scene.add(shadow);
  return { team, idx, pl, name: pl.name, short: lastName(pl.name), role: pl.role, ovr: pl.ovr, hgt: pl.hgt, sc: pl.hgt / 1.98, rat: ratings(pl), m, shadow, aura,
    x: 0, z: 0, y: 0, vx: 0, vz: 0, face: 0, wx: 0, wz: 0, sprint: false, protect: false, lookX: 0, lookZ: 0,
    act: '', actT: 0, fill: 0, ctrl: null, fire: false, heat: 0, streak: 0, heatShow: 0, quiet: 0,
    blockT: 0, reachT: 0, stealCd: 0, stun: 0, catchLock: 0, aiT: rnd(0.2, 1), aiMode: '', cutT: rnd(2, 6), cutting: 0, hold: 0, jumpT: 0, phase: rnd(0, 6), flick: 0, flickT: 0, mv: '', mvT: 0, mvDur: 1, mvSide: 1, hand: 1, handV: 1, boostT: 0, hesiT: 0, hesiK: '', mvLabel: '', hesiDir: null, sepT: 0, spinV: 0,
    stats: { pts: 0, fg: 0, fga: 0, tp: 0, dk: 0, blk: 0, stl: 0, perf: 0, best: 0, pf: 0, ft: 0, fta: 0 }, fouls: 0, inj: 0, spin: 0, variant: '', end: null, start: null, dur: 1, oopU: 0, relAt: 0 };
}

function disposeMatch() { S.inb = null;
  if (GYM.on) gymStop();
  if (SH.on) shStop();
  for (const p of S.players) { scene.remove(p.m.root); scene.remove(p.shadow); }
  for (const h of S.humans) { if (h.ring) scene.remove(h.ring); if (h.arrow) scene.remove(h.arrow); h.ring = h.arrow = null; } // else the last game's markers stay on the floor
  S.players = []; S.teams = []; S.humans = [];
}

function startMatch() {
  if (typeof FIGHT !== 'undefined' && FIGHT.on) { FIGHT.on = false; FIGHT.onDone = null; const fd = document.getElementById('fight'); if (fd) fd.classList.add('hidden'); } // a match started from a fight's pause menu
  disposeMatch(); CAMS.snap = true; CAMS.dir = 1; CAMS.yaw = 0; CAMS.flipT = 0;
  Snd.init(); Snd.on = CFG.sound; Snd.talk = CFG.talk; if (Snd.master) Snd.master.gain.value = CFG.sound ? Snd.vol : 0;
  S.mode = CFG.mode; S.over = false; S.period = 1; S.otPeriods = 0; S.elapsed = 0; S.clear = [false, false];
  S.ft = null; S.ftAfter = null; S.foulT = 0; S.deadT = 0; S.deadThen = null; S.pendingFight = null; hint('');
  const tA = TEAMS[CFG.t0], tB = TEAMS[CFG.t1], gym = S.mode === 'gym', shoot = S.mode === 'shoot'; if ((gym || shoot) && CFG.players === 'vs') CFG.players = 'coop'; // the gym is one side: you (and a friend) against the stations
  buildArena(shoot ? 'play' : S.mode, shoot ? SH_COURT[0] : tA, shoot ? SH_COURT[1] : tB); S.hoops = hoops; if (typeof fxMode === 'function') fxMode(shoot ? 'play' : S.mode);
  if (S.mode === 'play') newRef(); else if (REF) { REF.m.root.visible = REF.shadow.visible = false; }
  S.n = S.mode === 'play' ? 5 : gym ? 1 : CFG.size;
  let shPicks = [];
  if (shoot) { const mine = CFG.sq0.slice(0, CFG.players === 'coop' ? 2 : 1), pool = POOL.filter(q => !mine.includes(q.id)).sort((a, b) => b.t3 - a.t3).slice(0, 24); shPicks = mine.map(i => PBY[i]); while (shPicks.length < mine.length + clamp(CFG.shRiv | 0, 0, 3) && pool.length) shPicks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); S.n = shPicks.length; }
  S.clock = CFG.qlen;
  for (let ti = 0; ti < 2; ti++) {
    let info, kit, lineup;
    if (S.mode === 'play') {
      info = ti ? tB : tA; lineup = info.roster.map(i => PBY[i]);
      kit = ti ? { jersey: info.away, shorts: info.home, num: info.home } : { jersey: info.home, shorts: info.shortsC || info.trim, num: info.trim };
    } else if (shoot) { // everyone who shoots is on one side; each gets their own colors
      lineup = ti ? [] : shPicks; info = { id: 'SH' + ti, abbr: ti ? 'SHOOT' : 'YOU', name: 'Shootout', short: 'Shootout', hex: ti ? '#3b4a5c' : '#ff7a1a', ovr: ti ? 70 : lineup[0].ovr };
      kit = ti ? { jersey: 0x1c2233, shorts: 0x15171c, num: 0xffc533 } : { jersey: 0xff7a1a, shorts: 0xf1f3f8, num: 0xf1f3f8 };
    } else if (gym) { // your baller(s) in practice whites; the other side starts empty and fills from the defender pad
      lineup = ti ? [] : CFG.sq0.slice(0, CFG.players === 'coop' ? 2 : 1).map(i => PBY[i]); const lead = ti ? 'Gym' : lastName(lineup[0].name);
      info = { id: 'GYM' + ti, abbr: ti ? 'GYM' : lead.toUpperCase().slice(0, 7), name: ti ? 'The Gym' : lead, short: ti ? 'Gym' : lead, hex: ti ? '#3b4a5c' : '#ff7a1a', ovr: ti ? 70 : lineup[0].ovr };
      kit = ti ? { jersey: 0x1c2233, shorts: 0x15171c, num: 0xffc533 } : { jersey: 0xf1f3f8, shorts: 0xff7a1a, num: 0xff7a1a };
    } else {
      lineup = (ti ? CFG.sq1 : CFG.sq0).slice(0, S.n).map(i => PBY[i]); const lead = lastName(lineup[0].name);
      info = { id: 'ST' + ti, abbr: lead.toUpperCase().slice(0, 7), name: lead + (S.n > 1 ? ' & Co' : ''), short: lead + (S.n > 1 ? ' & Co' : ''), hex: ti ? '#f1f3f8' : '#d9473a', ovr: Math.round(lineup.reduce((s, p) => s + p.ovr, 0) / lineup.length) };
      kit = ti ? { jersey: 0xf1f3f8, shorts: 0x2a3d8f, num: 0x2a3d8f } : { jersey: 0xd9473a, shorts: 0x15171c, num: 0xffffff };
    }
    const team = { idx: ti, info, kit, lineup, players: [], score: 0, atk: ti === 0 ? 1 : -1, humans: [], tf: 0 };
    if (S.mode === 'black') team.atk = 1;
    S.teams.push(team);
  }
  for (const team of S.teams) for (let i = 0; i < (gym || shoot ? team.lineup.length : S.n); i++) { const k0 = team.kit; if (shoot && team.idx === 0) team.kit = { jersey: SH_KITS[i % SH_KITS.length][0], shorts: SH_KITS[i % SH_KITS.length][1], num: SH_KITS[i % SH_KITS.length][1] }; const p = makePlayer(team, i, team.lineup[i]); team.kit = k0; team.players.push(p); S.players.push(p); }
  // humans
  S.humans = [];
  const mk = (id, team) => { const h = { id, team, p: null, meter: null, ring: null, label: 'P' + (id + 1), onFire: false }; S.humans.push(h); team.humans.push(h); return h; };
  mk(0, S.teams[0]);
  if (CFG.players === 'coop') mk(1, S.teams[0]); else if (CFG.players === 'vs') mk(1, S.teams[1]);
  for (const h of S.humans) setCtrl(h, h.team.players[h.team.humans.indexOf(h)]);
  buildHumanFx();
  // hud
  $('tmA').querySelector('.abbr').textContent = S.teams[0].info.abbr; $('tmB').querySelector('.abbr').textContent = S.teams[1].info.abbr;
  const kc = t => css(t.kit.jersey === 0xf1f3f8 ? t.kit.shorts : t.kit.jersey); $('tmA').querySelector('.chip').style.background = kc(S.teams[0]); $('tmB').querySelector('.chip').style.background = kc(S.teams[1]);
  $('heat2').classList.toggle('hidden', S.humans.length < 2);
  $('hud').classList.remove('hidden'); $('menu').classList.add('hidden');
  S.state = 'play'; S.live = false; S.ts = 1;
  Com.clear();
  if (gym) { gymStart(); return; }
  if (shoot) { shStart(); return; }
  tipOff(0, true);
  Com.say(S.mode === 'play' ? 'start' : 'startB', '', 2, 0);
  Snd.cheer(1.2, 3);
}

function setCtrl(h, p) {
  if (!p || (p.ctrl && p.ctrl !== h)) return false;
  if (h.p) h.p.ctrl = null; p.ctrl = h; h.p = p; return true;
}

/* positions and possession ---------------------------------------------------- */
function formation(team, offense) {
  const n = S.n, atk = team.atk;
  team.players.forEach((p, i) => {
    p.vx = p.vz = 0; p.y = 0; p.act = ''; p.stun = 0; p.reachT = 0; p.blockT = 0; p.hold = 0;
    if (S.mode === 'black') { return; }
    p.x = -atk * (2.0 + i * 1.8); p.z = (i % 2 ? 1 : -1) * (1.3 + (i >> 1) * 1.9); p.face = atk > 0 ? Math.PI / 2 : -Math.PI / 2;
  });
}
function tipOff(teamIdx, first) {
  for (const t of S.teams) formation(t, false);
  const team = S.teams[teamIdx];
  if (S.mode === 'black') { checkBall(team); S.countT = 3.2; S.live = false; return; }
  const h = team.players[0]; h.x = -team.atk * 0.8; h.z = 0;
  giveBall(h, 'tip'); S.poss = teamIdx; S.shotClock = 24;
  S.countT = first ? 3.2 : 2.2; S.live = false;
  for (const hu of S.humans) if (hu.p.team !== team && S.teams.length) assignDefenders(hu.team);
}
function checkBall(team) {
  const H = hoopOf(team), o = opp(team), dir = H.dir, n = S.n;
  const spots = spotList(n);
  team.players.forEach((p, i) => { const s = spots[i]; p.x = H.x - dir * s[0]; p.z = s[1]; p.vx = p.vz = 0; p.y = 0; p.act = ''; p.face = dir > 0 ? Math.PI / 2 : -Math.PI / 2; p.stun = 0; p.reachT = p.blockT = 0; p.hold = 0; });
  const handler = team.players[0]; handler.x = H.x - dir * 7.6; handler.z = 0;
  o.players.forEach((p, i) => { const m = team.players[i % n]; p.x = m.x + dir * 1.0; p.z = m.z * 0.9; p.vx = p.vz = 0; p.y = 0; p.act = ''; p.face = -(dir > 0 ? Math.PI / 2 : -Math.PI / 2); p.stun = 0; p.reachT = p.blockT = 0; p.hold = 0; });
  giveBall(handler, 'check'); S.poss = team.idx; S.clear[team.idx] = false; S.clear[1 - team.idx] = false; S.checkT = 0.8;
  for (const hu of S.humans) { if (hu.team === team) { if (!team.players.includes(hu.p) || hu.p !== handler && hu.team.humans.length === 1) setCtrl2(hu, handler); } else assignDefenders(hu.team); }
}
function setCtrl2(h, p) { if (h.p) h.p.ctrl = null; if (p.ctrl && p.ctrl !== h) p.ctrl.p = null; p.ctrl = h; h.p = p; }
function spotList(n) {
  if (n <= 1) return [[7.6, 0]]; if (n === 2) return [[7.6, 0], [5.6, 5.0]];
  if (n === 3) return [[7.8, 0], [6.5, 4.9], [6.5, -4.9]];
  if (n === 4) return [[7.8, 0], [6.6, 4.9], [6.6, -4.9], [2.0, -2.2]];
  return [[7.8, 0], [6.6, 4.9], [6.6, -4.9], [1.0, 6.9], [2.0, -2.4]]; // the fourth man spaces the corner three, the fifth works the dunker spot
}

function giveBall(p, reason) {
  const prevTeam = B.owner ? B.owner.team : S.teams[S.poss];
  B.owner = p; B.state = 'held'; B.last = p; B.lastTeam = p.team.idx; B.shot = null; B.pass = null; B.lock = 0; B.vel.set(0, 0, 0); B.dPhase = 0; p.gotAt = S.elapsed; p.gotHow = reason;
  if (p.team.idx !== S.poss || reason === 'steal' || reason === 'reb' || reason === 'tip' || reason === 'oreb') {
    const changed = p.team.idx !== S.poss;
    S.poss = p.team.idx; S.shotClock = reason === 'oreb' ? 14 : 24; S.stallT = 0;
    if (changed && S.mode === 'black' && reason !== 'check') { S.clear[p.team.idx] = true; Com.say('clear', '', 1, 9000); }
    if (changed) for (const hu of S.humans) if (hu.team !== p.team) assignDefenders(hu.team);
  }
  // control follows the ball for the nearest human of that team
  const hs = p.team.humans; if (hs.length && !p.gymRole && !(reason === 'inbound' && S.inb && S.inb.ib === p)) { // a gym rebounder is never yours to control; an inbound passer neither (it comes to you)
    if (!hs.some(h => h.p === p)) { let best = null, bd = 1e9; for (const h of hs) { if (h.p && h.p === B.last) continue; const d = d2(h.p.x, h.p.z, p.x, p.z); if (d < bd && !(hs.length > 1 && h.p === B.owner)) { bd = d; best = h; } } if (best) setCtrl2(best, p); }
  }
  if (S.mode === 'black' && S.clear[p.team.idx] && cleared(p.x, p.z, hoopOf(p.team))) S.clear[p.team.idx] = false;
}
// Play Now restarts with a real inbound: a player steps out of bounds at the spot, a teammate comes to the ball and it is passed in;
// both clocks wait until the pass is made (see inbUpdate, called every frame between the brains and the movement)
function startInbound(team, x, z, why) {
  const base = Math.abs(x) > HALF_L - 1.2 && Math.abs(z) < HALF_W - 0.9; // under a basket: from the baseline, else from the sideline
  let ix, iz, rx, rz;
  if (base) { const sx = Math.sign(x) || -team.atk; ix = sx * (HALF_L + 0.35); iz = clamp(z, -HALF_W + 1.2, HALF_W - 1.2); if (Math.abs(iz) < 1.4) iz = (iz >= 0 ? 1 : -1) * 1.4; rx = ix - sx * 3.6; rz = iz * 0.4; }
  else { const sz = z >= 0 ? 1 : -1; ix = clamp(x, -HALF_L + 1, HALF_L - 1); iz = sz * (HALF_W + 0.35); rx = clamp(ix + team.atk * 1.2, -HALF_L + 1.5, HALF_L - 1.5); rz = iz - sz * 3.4; }
  const free = team.players.filter(q => !q.ctrl && !q.gymRole), pool = free.length ? free : team.players;
  const ib = pool.slice().sort((a, b) => d2(a.x, a.z, ix, iz) - d2(b.x, b.z, ix, iz))[0];
  const hu = team.humans.map(h => h.p).find(q => q && q !== ib);
  const rc = hu || (team.players[0] !== ib ? team.players[0] : team.players.filter(q => q !== ib).sort((a, b) => d2(a.x, a.z, rx, rz) - d2(b.x, b.z, rx, rz))[0]);
  ib.x = ix; ib.z = iz; ib.vx = ib.vz = 0; ib.y = 0; ib.act = ''; ib.stun = 0; ib.reachT = ib.blockT = 0; ib.hold = 99; ib.face = Math.atan2(rx - ix, rz - iz);
  S.inb = { ib, rc, rx, rz, t: 0 };
  giveBall(ib, 'inbound'); S.shotClock = 24; if (why) toast(why);
}
function inbUpdate(dt) {
  const I = S.inb; if (!I) return;
  const ib = I.ib, rc = I.rc;
  if (B.owner !== ib || S.mode !== 'play' || !S.players.includes(ib) || !S.players.includes(rc)) { ib.hold = Math.min(ib.hold, 0.2); S.inb = null; return; }
  if (!S.live) return;
  I.t += dt; ib.hold = 0.25; ib.wx = ib.wz = 0; ib.vx = ib.vz = 0;
  if (!rc.ctrl) moveTo(rc, I.rx, I.rz, false);
  ib.face = Math.atan2(rc.x - ib.x, rc.z - ib.z);
  const ready = ib.ctrl ? I.t > 4 : rc.ctrl ? I.t > 0.9 : I.t > 0.75 && (d2(rc.x, rc.z, I.rx, I.rz) < 1.6 || I.t > 1.8);
  if (!ready) return;
  let tgt = rc; if (laneClear(ib, rc) < 0.45) { const alt = pickPassAI(ib); if (alt) tgt = alt; }
  if (doPass(ib, tgt, laneClear(ib, tgt) < 0.7 ? 'bounce' : 'chest')) B.pass.inb = true;
}
function assignDefenders(team) {
  const hs = team.humans; if (!hs.length) return; const used = new Set();
  const bx = B.owner ? B.owner.x : B.pos.x, bz = B.owner ? B.owner.z : B.pos.z;
  const sorted = team.players.filter(q => !q.gymRole).sort((a, b) => d2(a.x, a.z, bx, bz) - d2(b.x, b.z, bx, bz));
  hs.forEach(h => { const c = sorted.find(q => !used.has(q) && (!q.ctrl || q.ctrl === h)) || sorted.find(q => !used.has(q)); if (c) { used.add(c); setCtrl2(h, c); } });
}

/* scoring, heat, fire ----------------------------------------------------------- */
function ptsFor(three, dunk, ft) { if (ft) return 1; if (S.mode === 'play' || S.mode === 'gym' || S.mode === 'shoot') return three ? 3 : 2; return CFG.scoring === '12' ? (three ? 2 : 1) : (three ? 3 : 2); }
const gymEl = n => { if (S.mode === 'gym' && GYM.split && GYM.cur >= 0) { const L = GYM.lanes[GYM.cur]; if (L && L.el) return L.el[n]; } return $(n); };
function banner(txt, fire, ms) {
  const el = gymEl('banner'); el.textContent = txt; el.className = ''; void el.offsetWidth; el.className = 'show' + (fire ? ' fire' : '');
}
function toast(txt) { const el = gymEl('toast'); el.textContent = txt; el.className = ''; void el.offsetWidth; el.className = 'show'; }
function hint(txt) { const el = gymEl('hint'); if (el.innerHTML !== txt) el.innerHTML = txt; }

function scoreBasket(shot, h) {
  const p = shot.by, team = shot.team, pts = ptsFor(shot.three, shot.dunk, shot.ft);
  shot.scored = true; team.score += pts; p.stats.pts += pts; if (typeof fxSwish === 'function') fxSwish(h, shot);
  if (shot.ft) { // a free throw: one point, no heat, the next one (or the inbound after the last one) is handled by ftUpdate / afterScore
    p.stats.ft++; h.netT = 0.5; S.lastScorer = p; Snd.swish(); Snd.cheer(0.5, 1.4); toast('FREE THROW · +1');
    if (S.ft && S.ft.left > 1) { B.lock = 99; S.live = true; } else { S.dead = 0.9; B.lock = 99; S.live = true; }
    Com.say('ftmake', p.short, 1, 6000); return;
  }
  p.stats.fg++; if (shot.three) p.stats.tp++; if (shot.dunk) p.stats.dk++;
  h.netT = 0.5; S.lastScorer = p; S.dead = shot.dunk || shot.three ? 1.25 : 1.0; B.lock = 99; S.live = true; // a beat to enjoy a big one, then inbound
  Snd.swish(); if (!shot.dunk) Snd.cheer(shot.three ? 1.2 : 0.8, shot.three ? 3 : 2.2);
  if (!shot.dunk && !shot.layup && !shot.touched) Com.say('swish', p.short, 1, 9000);
  // heat: three makes in a row = ON FIRE = the next shot is guaranteed, then everything resets and builds up again
  const usedFire = !!shot.fire;
  if (usedFire) { extinguish(p, true); }
  else {
    p.streak++; p.quiet = 0; p.heat = Math.min(100, p.streak * 34); p.stats.best = Math.max(p.stats.best, p.streak);
    if (p.streak === 2) { if (p.ctrl) toast('HEATING UP'); Com.say('hot', p.short, 1, 8000); }
    if (p.streak >= 3 && !p.fire) ignite(p);
  }
  const tag = shot.dunk ? (usedFire ? '' : 'DUNK') : shot.three ? (S.mode === 'black' ? '+' + pts + ' DEEP' : '3 POINTER') : '';
  if (tag && !shot.special) toast(tag + (S.mode === 'black' ? '' : ' +' + pts));
  else if (!shot.special) toast('+' + pts);
  if (S.mode === 'black') Snd.cheer(0.5, 1.4);
  if (shot.alley) Com.say('oop', p.short, 1, 6000);
  else if (shot.dunk && shot.special) Com.say('fireDunk', p.short, 2, 3000);
  else if (shot.dunk) Com.say('dunk', p.short, 1, 5000);
  else if (shot.layup) Com.say('layup', p.short, 1, 8000);
  else if (shot.three) Com.say('three', p.short, 1, 5000);
  else Com.say('two', p.short, 1, 9000);
  if (S.mode === 'black' && S.teams.some(t => t.score >= CFG.target)) { S.dead = 1.6; S.finish = true; }
}
function missShot(shot) {
  const p = shot.by; if (shot.missed) return; shot.missed = true;
  if (shot.ft) { Snd.aww(0.7); Com.say('ftmiss', p.short, 1, 6000); return; }
  if (!p.fire) { p.streak = 0; }
  Snd.aww(1.1);
}
function ignite(p) {
  p.fire = true; p.heat = 100; Snd.fireUp(); Snd.cheer(1.4, 3);
  banner(p.short.toUpperCase() + (p.ctrl ? ' IS ON FIRE!' : ' ON FIRE!'), true); if (p.ctrl) toast('NEXT SHOT IS GOOD');
  Com.say('fire', p.short, 2, 5000); callOut(p, 'nice');
  burst(p.x, 1.0, p.z, 70, 5, 0, null, 0.9, 0.9, 3); shock(p.x, 0.05, p.z, 5, 0xff7a1a); CAMS.shake = Math.max(CAMS.shake, 0.4);
}
function extinguish(p, used) {
  p.fire = false; p.streak = 0; p.heat = 0; p.quiet = 0;
  if (used) { if (p.ctrl) toast('BACK TO NORMAL'); Com.say('spent', p.short, 1, 8000); }
}

/* shot clock / periods ----------------------------------------------------------- */
function endPeriod() {
  S.live = false;
  const a = S.teams[0].score, b = S.teams[1].score;
  Snd.buzzer(); Snd.cheer(0.9, 2);
  if (S.period >= 4 && a !== b) { gameOver(); return; }
  if (S.period >= 4) { S.otPeriods++; banner('OVERTIME', true); Com.say('close', '', 1, 0); } else { banner(S.period === 2 ? 'HALFTIME' : 'END OF Q' + S.period); Com.say(S.period === 2 ? 'half' : (Math.abs(a - b) > 15 ? 'blowout' : Math.abs(a - b) < 5 ? 'close' : 'quarter'), '', 1, 0); }
  S.period++; S.clock = S.period > 4 ? 60 : CFG.qlen; S.dead = 0; for (const t of S.teams) t.tf = 0; S.ft = null; S.ftAfter = null; hint('');
  if (S.period === 3) { for (const t of S.teams) t.atk = -t.atk; }
  B.owner = null; B.state = 'dead';
  S.nextT = 2.4; S.nextTeam = S.period % 2 ? 1 : 0;
}
function gameOver() {
  S.live = false; S.over = true; S.state = 'over'; Snd.buzzer(); Snd.cheer(1.5, 4);
  const a = S.teams[0], b = S.teams[1], w = a.score > b.score ? a : b;
  Com.say('over', '', 2, 0); setTimeout(() => Com.say('win', w.info.short, 2, 0), 3600);
  setTimeout(() => showMenu('over'), 1800);
}
function turnoverTo(team, x, z, why) {
  // ball dead: give possession to `team` at a spot (sideline / baseline inbound)
  if (S.mode === 'play' && team.players.length >= 2) return startInbound(team, x, z, why);
  const q = team.players.filter(p => !p.ctrl || true).sort((a, b) => d2(a.x, a.z, x, z) - d2(b.x, b.z, x, z))[0];
  const lx = S.mode === 'black' ? clamp(x, 0.4, HALF_L - 0.3) : clamp(x, -HALF_L + 0.3, HALF_L - 0.3);
  q.x = lx; q.z = clamp(z, -HALF_W + 0.3, HALF_W - 0.3); q.vx = q.vz = 0; q.y = 0; q.act = ''; q.hold = 0.7;
  if (S.mode === 'black') { const H = hoopOf(team); if (Math.hypot(q.x - H.x, q.z) < ARC + 0.3) { /* needs clearing */ } }
  const ch = S.poss !== team.idx; giveBall(q, 'inbound'); if (ch && S.mode === 'black') { S.clear[team.idx] = !cleared(q.x, q.z, hoopOf(team)); }
  S.shotClock = 24; if (why) toast(why);
}
