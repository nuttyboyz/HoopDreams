'use strict';
/* ===== Hoop Dreams : core data + audio ===== */
const T = THREE;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// court metres (NBA)
const HALF_L = 14.32, HALF_W = 7.62, RIM_X = 12.745, RIM_H = 3.05, RIM_R = 0.2286, BALL_R = 0.12;
const ARC = 7.24, CORNER = 6.7, G = 9.8;

// Hoop Dreams roster: the five winningest NBA franchises, plus Gilbert Arenas's Wizards, Iman Shumpert's Cavaliers, Jalen Brunson's Knicks and Carmelo Anthony's Nuggets, all stocked with known shooters and legends at their best.
// Ratings are approximate gameplay values (0-99), not official 2K numbers.
// [name, role, height m, ovr, 3PT, MID, FIN(inside), DNK, SPD, DEF, REB, skin 0-5, hair, hairColor, extras, jersey #]
const RAW = {
  curry:    ['Stephen Curry', 'G', 1.88, 99, 99, 96, 84, 45, 90, 70, 40, 3, 'short', 0x1a1410, '', 30],
  klay:     ['Klay Thompson', 'W', 1.98, 90, 96, 90, 74, 62, 78, 80, 52, 1, 'fade', 0x1c140e, '', 11],
  durant:   ['Kevin Durant', 'W', 2.11, 98, 94, 98, 92, 88, 82, 82, 68, 3, 'short', 0x120e0b, '', 35],
  draymond: ['Draymond Green', 'B', 1.98, 84, 62, 66, 70, 60, 70, 96, 82, 3, 'short', 0x120e0b, '', 23],
  butler:   ['Jimmy Butler', 'W', 2.01, 90, 62, 90, 92, 76, 76, 92, 58, 3, 'short', 0x120e0b, '', 10],
  kobe:     ['Kobe Bryant', 'W', 1.98, 99, 88, 96, 94, 92, 88, 90, 55, 3, 'fade', 0x0e0b09, 'band', 24],
  lebron:   ['LeBron James', 'W', 2.06, 98, 86, 90, 96, 97, 90, 86, 78, 3, 'bald', 0x0e0b09, 'beard', 23],
  luka:     ['Luka Dončić', 'G', 2.01, 98, 94, 96, 88, 70, 72, 70, 70, 0, 'long', 0x2a1c12, 'beard', 77],
  reaves:   ['Austin Reaves', 'G', 1.96, 85, 88, 84, 76, 60, 80, 72, 44, 0, 'short', 0x7a4a24, '', 15],
  davis:    ['Anthony Davis', 'B', 2.08, 94, 68, 82, 92, 95, 82, 95, 94, 4, 'fade', 0x0e0b09, 'brow', 3],
  bird:     ['Larry Bird', 'W', 2.06, 98, 96, 95, 88, 62, 62, 80, 82, 0, 'short', 0xe4e4e4, '', 33],
  ray:      ['Ray Allen', 'G', 1.96, 93, 99, 94, 76, 70, 82, 74, 48, 3, 'short', 0x120e0b, '', 20],
  tatum:    ['Jayson Tatum', 'W', 2.03, 95, 90, 92, 90, 90, 84, 84, 70, 3, 'short', 0x120e0b, '', 0],
  brown:    ['Jaylen Brown', 'W', 1.98, 90, 82, 84, 88, 92, 88, 86, 58, 3, 'short', 0x120e0b, '', 7],
  kg:       ['Kevin Garnett', 'B', 2.11, 95, 70, 88, 88, 86, 80, 97, 96, 4, 'bald', 0x120e0b, '', 5],
  jordan:   ['Michael Jordan', 'G', 1.98, 99, 80, 97, 97, 98, 92, 97, 62, 3, 'bald', 0x120e0b, '', 23],
  pippen:   ['Scottie Pippen', 'W', 2.03, 94, 75, 82, 88, 90, 88, 97, 74, 3, 'short', 0x120e0b, '', 33],
  kerr:     ['Steve Kerr', 'G', 1.9, 84, 99, 90, 60, 35, 70, 62, 36, 0, 'short', 0xa9a39b, '', 25],
  rodman:   ['Dennis Rodman', 'B', 2.01, 82, 34, 40, 62, 72, 82, 94, 99, 1, 'short', 0xff5a2a, '', 91],
  kukoc:    ['Toni Kukoc', 'W', 2.11, 84, 82, 82, 80, 68, 70, 72, 62, 0, 'short', 0x3a2a1c, '', 7],
  duncan:   ['Tim Duncan', 'B', 2.11, 97, 44, 86, 96, 86, 66, 97, 96, 3, 'bald', 0x120e0b, '', 21],
  manu:     ['Manu Ginóbili', 'W', 1.98, 91, 86, 88, 88, 72, 86, 82, 50, 1, 'bald', 0x2a1c12, '', 20],
  parker:   ['Tony Parker', 'G', 1.88, 88, 62, 90, 90, 40, 94, 66, 40, 1, 'short', 0x120e0b, '', 9],
  kawhi:    ['Kawhi Leonard', 'W', 2.01, 96, 88, 94, 90, 84, 86, 98, 80, 3, 'braids', 0x120e0b, '', 2],
  wemby:    ['Victor Wembanyama', 'B', 2.24, 93, 82, 80, 90, 96, 76, 97, 92, 3, 'short', 0x120e0b, '', 1],
  kyrie:    ['Kyrie Irving', 'G', 1.88, 95, 90, 96, 94, 52, 92, 62, 40, 2, 'short', 0x120e0b, 'goatee', 11],
  dame:     ['Damian Lillard', 'G', 1.88, 93, 96, 90, 84, 62, 88, 66, 40, 3, 'fade', 0x120e0b, '', 0],
  harden:   ['James Harden', 'G', 1.96, 91, 92, 88, 88, 62, 80, 66, 56, 3, 'fade', 0x120e0b, 'bigbeard', 13],
  booker:   ['Devin Booker', 'G', 1.96, 95, 93, 97, 88, 62, 84, 72, 44, 3, 'short', 0x120e0b, '', 1],
  reggie:   ['Reggie Miller', 'G', 2.01, 90, 98, 92, 70, 40, 74, 72, 40, 3, 'short', 0x120e0b, '', 31],
  // Gilbert Arenas, Iman Shumpert and the shooters that fill their teams (best-ever ratings)
  love:     ['Kevin Love', 'B', 2.08, 91, 90, 88, 84, 60, 60, 62, 96, 0, 'short', 0xc9a24a, '', 0],
  jr:       ['J.R. Smith', 'W', 1.98, 84, 92, 82, 78, 88, 84, 66, 40, 3, 'braids', 0x120e0b, '', 5],
  shump:    ['Iman Shumpert', 'G', 1.96, 82, 84, 70, 74, 80, 84, 90, 50, 3, 'fade', 0x120e0b, '', 4],
  arenas:   ['Gilbert Arenas', 'G', 1.91, 93, 94, 92, 86, 62, 90, 64, 38, 3, 'short', 0x120e0b, 'beard', 0],
  beal:     ['Bradley Beal', 'G', 1.93, 88, 90, 90, 84, 58, 84, 64, 42, 3, 'short', 0x120e0b, '', 3],
  caron:    ['Caron Butler', 'W', 2.01, 87, 80, 90, 84, 80, 80, 80, 56, 3, 'fade', 0x120e0b, '', 4],
  jamison:  ['Antawn Jamison', 'B', 2.03, 88, 78, 90, 90, 70, 70, 66, 80, 3, 'short', 0x120e0b, '', 4],
  rip:      ['Rip Hamilton', 'G', 2.01, 88, 86, 96, 80, 58, 86, 80, 44, 3, 'short', 0x120e0b, '', 32],
  dirk:     ['Dirk Nowitzki', 'B', 2.13, 97, 92, 98, 90, 60, 60, 74, 82, 0, 'short', 0xb8a074, '', 41],
  // Jalen Brunson's Knicks and Carmelo Anthony's Nuggets, filled with good 3 and 2 point shooters (best-ever ratings)
  brunson:  ['Jalen Brunson', 'G', 1.88, 92, 86, 95, 90, 40, 82, 62, 36, 3, 'short', 0x120e0b, '', 11],
  towns:    ['Karl-Anthony Towns', 'B', 2.13, 92, 90, 88, 90, 80, 68, 72, 94, 3, 'short', 0x120e0b, 'beard', 32],
  bridges:  ['Mikal Bridges', 'W', 1.98, 86, 86, 86, 82, 76, 84, 88, 46, 3, 'short', 0x120e0b, '', 25],
  houston:  ['Allan Houston', 'G', 1.98, 88, 92, 94, 78, 60, 80, 66, 40, 3, 'bald', 0x120e0b, '', 20],
  donte:    ['Donte DiVincenzo', 'G', 1.93, 83, 92, 80, 76, 62, 82, 74, 44, 0, 'short', 0x7a4a24, '', 0],
  melo:     ['Carmelo Anthony', 'W', 2.03, 96, 88, 97, 90, 78, 80, 70, 64, 3, 'braids', 0x120e0b, 'band', 15],
  murray:   ['Jamal Murray', 'G', 1.93, 90, 88, 92, 86, 58, 84, 66, 40, 2, 'short', 0x120e0b, '', 27],
  jokic:    ['Nikola Jokić', 'B', 2.11, 98, 84, 94, 96, 50, 60, 76, 98, 0, 'short', 0x3a2a1c, 'beard', 15],
  mpj:      ['Michael Porter Jr.', 'W', 2.08, 85, 92, 84, 80, 74, 76, 66, 60, 3, 'short', 0x120e0b, '', 1],
  billups:  ['Chauncey Billups', 'G', 1.91, 88, 90, 88, 78, 50, 76, 80, 40, 3, 'bald', 0x120e0b, '', 7],
  // The 2026-27 Minnesota Timberwolves (Nutty's roster). Ratings are approximate. Heights and numbers are best guesses for a team that is still being built.
  lamelo:   ['LaMelo Ball', 'G', 2.01, 95, 96, 93, 84, 70, 86, 70, 56, 3, 'curly', 0xd7c36a, '', 1],
  edwards:  ['Anthony Edwards', 'G', 1.93, 96, 92, 94, 96, 99, 94, 82, 54, 4, 'short', 0x0e0b09, 'stubble', 5],
  mcdaniels: ['Jaden McDaniels', 'W', 2.06, 84, 74, 78, 82, 78, 84, 94, 54, 4, 'short', 0x0e0b09, '', 3],
  kuminga:  ['Jonathan Kuminga', 'W', 2.01, 85, 74, 80, 90, 92, 88, 80, 62, 4, 'short', 0x0e0b09, '', 0],
  gobert:   ['Rudy Gobert', 'B', 2.16, 86, 12, 38, 82, 90, 56, 98, 99, 4, 'bald', 0x0e0b09, 'beard', 27],
  dosunmu:  ['Ayo Dosunmu', 'G', 1.93, 80, 84, 80, 80, 60, 84, 74, 46, 3, 'short', 0x0e0b09, '', 11],
  hyland:   ['Bones Hyland', 'G', 1.91, 80, 90, 82, 76, 52, 88, 56, 38, 3, 'braids', 0x0e0b09, '', 8],
  green:    ['Josh Green', 'W', 1.96, 78, 82, 72, 76, 74, 82, 80, 50, 2, 'short', 0x1a1410, '', 4],
  lyles:    ['Trey Lyles', 'B', 2.06, 78, 84, 78, 74, 60, 62, 64, 74, 3, 'short', 0x0e0b09, 'beard', 41],
  shannon:  ['Terrence Shannon Jr.', 'W', 1.98, 80, 80, 82, 84, 90, 88, 72, 50, 3, 'short', 0x0e0b09, '', 2],
  // another elite scorer to stand beside them
  sga:      ['Shai Gilgeous-Alexander', 'G', 1.98, 98, 90, 98, 96, 62, 92, 88, 48, 4, 'short', 0x0e0b09, '', 2],
};
const PLAYERS = [];
for (const k in RAW) { const r = RAW[k]; PLAYERS.push({ id: k, name: r[0], role: r[1], hgt: r[2], ovr: r[3], t3: r[4], mid: r[5], fin: r[6], dnk: r[7], spd: r[8], def: r[9], reb: r[10], skin: r[11], hair: r[12], hairC: r[13], extra: r[14], num: r[15] }); }
const PBY = {}; PLAYERS.forEach(p => PBY[p.id] = p);
const mkTeam = (id, abbr, name, short, home, trim, hex, away, ids, edge) => ({ id, abbr, name, short, home, away: away || 0xf1f3f8, trim, hex, roster: ids, edge: edge || 0, ovr: Math.round(ids.reduce((s, i) => s + PBY[i].ovr, 0) / ids.length) });
const TEAMS = [
  mkTeam('GSW', 'GSW', 'Golden State Warriors', 'Warriors', 0x1d4fa8, 0xffc72c, '#1d4fa8', 0, ['curry', 'durant', 'klay', 'draymond', 'butler'], 0.025), // edge: small balance bonus, the Warriors' ball movement and spacing
  mkTeam('LAL', 'LAL', 'Los Angeles Lakers', 'Lakers', 0x5b2a8c, 0xfdb927, '#5b2a8c', 0, ['kobe', 'lebron', 'luka', 'davis', 'reaves']),
  mkTeam('BOS', 'BOS', 'Boston Celtics', 'Celtics', 0x0a8a45, 0xf1f3f8, '#0a8a45', 0, ['bird', 'tatum', 'ray', 'kg', 'brown']),
  mkTeam('CHI', 'CHI', 'Chicago Bulls', 'Bulls', 0xce1141, 0x141414, '#ce1141', 0, ['jordan', 'pippen', 'kerr', 'rodman', 'kukoc']),
  mkTeam('SAS', 'SAS', 'San Antonio Spurs', 'Spurs', 0x1c1c22, 0xc4ced4, '#8d99a3', 0, ['duncan', 'kawhi', 'manu', 'wemby', 'parker']),
  // Iman Shumpert's and Gilbert Arenas's teams, filled with good 3 and 2 point shooters
  mkTeam('C16', '16 CLE', "2016 Cleveland Cavaliers", "'16 Cavaliers", 0x6f263d, 0xffb81c, '#6f263d', 0, ['lebron', 'kyrie', 'love', 'jr', 'shump']),
  mkTeam('WAS', 'WAS', "Washington Wizards (All-Time)", "Wizards", 0x0b2a5b, 0xe31837, '#0b2a5b', 0, ['arenas', 'beal', 'caron', 'jamison', 'rip']),
  // Jalen Brunson's and Carmelo Anthony's teams, the same way
  mkTeam('NYK', 'NYK', "New York Knicks (All-Time)", "Knicks", 0x006bb6, 0xf58426, '#006bb6', 0, ['brunson', 'towns', 'bridges', 'houston', 'donte']),
  mkTeam('DEN', 'DEN', "Denver Nuggets (All-Time)", "Nuggets", 0x0e2240, 0xfec524, '#0e2240', 0, ['melo', 'murray', 'jokic', 'mpj', 'billups']),
  // Nutty's 2026-27 Timberwolves: the starting five plays, the bench is in the Blacktop, Gym and Shootout pools
  mkTeam('MIN', 'MIN', "2026-27 Minnesota Timberwolves", "Timberwolves", 0x0c2340, 0x78be20, '#236192', 0, ['lamelo', 'edwards', 'mcdaniels', 'kuminga', 'gobert']),
];
TEAMS[TEAMS.length - 1].bench = ['dosunmu', 'hyland', 'green', 'lyles', 'shannon'];
TEAMS[TEAMS.length - 1].shortsC = 0x0c2340; // navy shorts, lime numbers
// Blacktop character list: everyone, grouped by franchise, then the free agents
const POOL = []; for (const i of [...TEAMS.flatMap(t => t.roster.concat(t.bench || [])), 'dame', 'harden', 'booker', 'reggie', 'dirk', 'sga']) if (!POOL.includes(PBY[i])) POOL.push(PBY[i]);
const SKIN = [0xf3d2b4, 0xe0b48a, 0xc08a5c, 0x93603a, 0x6b4128, 0x4a2c1a];

/* ===== AUDIO : effects and crowd are synthesised, voices are neural text-to-speech clips baked into vox.js (tools/make_vox.py) ===== */
const STUDIO = ['Michael', 'Fenrir', 'Puck']; // studio commentator voices in vox.js (0-2); vox 3 = all three taking turns, 4 = a voice from the device. Shorty is always clip voice 3 (Onyx).
const Snd = {
  ctx: null, master: null, sfx: null, crowd: null, noise: null, on: true, vol: 0.8, talk: true,
  crowdLvl: 0, crowdT: 0, nextClap: 0, lastSay: 0, lastCall: 0, voices: null, speaking: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const c = this.ctx = new C();
      this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      // crowd bed: two bands of looping noise, level driven by crowdLvl
      this.crowd = c.createGain(); this.crowd.gain.value = 0; this.crowd.connect(this.master);
      this.voxBus = c.createGain(); this.voxBus.gain.value = 0.95; this.voxBus.connect(this.master);
      for (const [f, q, g] of [[480, 0.6, 1], [1250, 0.8, 0.7], [2600, 1.2, 0.25]]) {
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const gg = c.createGain(); gg.gain.value = g; s.connect(bp); bp.connect(gg); gg.connect(this.crowd); s.start();
      }
      if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = () => { this.voices = null; }; }
    } catch (e) { this.ctx = null; }
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? this.vol : 0; if (!v) { this.stopVox(); if (window.speechSynthesis) speechSynthesis.cancel(); } },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.004, vol, dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  burst(type, freq, q, dur, vol, delay = 0, f1 = 0) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loopStart = 0; s.playbackRate.value = 1;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); this.env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  dribble(v = 1) { this.tone('sine', 150, 55, 0.11, 0.55 * v); this.burst('bandpass', 900, 2, 0.04, 0.12 * v); },
  squeak(v = 1) { const f = rnd(1800, 3200); this.burst('bandpass', f, 12, 0.07, 0.07 * v); this.burst('bandpass', f * 1.3, 12, 0.05, 0.05 * v, 0.06); },
  thud(v = 1) { this.tone('sine', 150, 60, 0.14, 0.3 * v); this.burst('lowpass', 500, 1, 0.1, 0.22 * v); },
  swish() { this.burst('highpass', 3200, 0.7, 0.32, 0.38); this.burst('bandpass', 5200, 1, 0.25, 0.14, 0.02); },
  rim() { for (const f of [510, 790, 1260, 2050]) this.tone('triangle', f, f * 0.96, 0.5, 0.18); this.burst('bandpass', 1800, 2, 0.08, 0.2); },
  board() { this.tone('sine', 210, 120, 0.2, 0.5); this.burst('lowpass', 700, 1, 0.12, 0.35); },
  slam() { this.tone('sine', 120, 38, 0.5, 0.95); this.burst('lowpass', 500, 1, 0.3, 0.7); for (const f of [330, 620, 980]) this.tone('triangle', f, f * 0.9, 0.7, 0.12, 0.03); },
  smack() { this.burst('bandpass', 1700, 1.5, 0.09, 0.8); this.tone('sine', 300, 120, 0.1, 0.5); },
  catch_() { this.burst('bandpass', 1100, 1.5, 0.05, 0.3); this.tone('sine', 190, 100, 0.06, 0.25); },
  whoosh() { this.burst('bandpass', 400, 1.2, 0.35, 0.25, 0, 3000); },
  fireUp() { this.burst('bandpass', 300, 0.8, 1.1, 0.5, 0, 4200); this.tone('sawtooth', 110, 440, 0.9, 0.18); this.tone('square', 220, 880, 0.9, 0.08, 0.05); },
  buzzer() { this.tone('square', 196, 196, 0.9, 0.3); this.tone('sawtooth', 98, 98, 0.9, 0.3); },
  whistle() { if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(); o.type = 'sine'; o.frequency.value = 3000; l.frequency.value = 26; lg.gain.value = 140; l.connect(lg); lg.connect(o.frequency); this.env(g, t, 0.01, 0.2, 0.45); o.connect(g); g.connect(this.sfx); o.start(t); l.start(t); o.stop(t + 0.5); l.stop(t + 0.5); },
  grunt(low = 1) { const f = (rnd(120, 190)) * low; this.tone('sawtooth', f * 1.4, f * 0.8, 0.16, 0.12); this.burst('bandpass', f * 5, 2, 0.12, 0.1); },
  tick() { this.tone('square', 1400, 1400, 0.05, 0.12); },
  cheer(level = 1, dur = 2.2) { if (typeof S !== 'undefined' && S.mode === 'gym') level *= 0.3; this.crowdLvl = Math.max(this.crowdLvl, 0.28 * level); this.crowdT = Math.max(this.crowdT, dur * (0.7 + level * 0.3)); if (level > 0.6) this.nextClap = 0; },
  aww(dur = 1.4) { if (!this.ctx || !this.on) return; this.burst('bandpass', 760, 1.1, dur, 0.28, 0, 330); this.burst('bandpass', 1400, 1.1, dur * 0.8, 0.12, 0, 600); },
  ooh(dur = 1.2) { if (!this.ctx || !this.on) return; this.burst('bandpass', 420, 1.4, dur, 0.26, 0, 900); },
  update(dt) {
    if (!this.ctx) return;
    if (this.crowdT > 0) this.crowdT -= dt;
    const base = S && S.mode === 'gym' ? 0.012 : S && S.live ? 0.05 + (S.mode === 'play' || S.mode === 'shoot' ? 0.03 : 0.01) : 0.03; // an empty gym only hums
    const tgt = base + (this.crowdT > 0 ? this.crowdLvl : 0);
    this.crowd.gain.value = damp(this.crowd.gain.value, tgt, this.crowdT > 0 ? 9 : 2.2, dt);
    if (this.crowdT <= 0) this.crowdLvl = 0;
    if (this.crowdT > 0 && this.crowdLvl > 0.2) { // applause crackle
      this.nextClap -= dt; if (this.nextClap <= 0) { this.nextClap = rnd(0.012, 0.05); this.burst('bandpass', rnd(1800, 4200), 2, 0.025, 0.06 * this.crowdLvl * 3); }
    }
  },
  // speech: commentator (prio 1/2) and player call-outs (prio 0). Browsers only expose the voices the system has, so we rank them:
  // human-sounding (neural / natural) American male voices first, robotic novelty voices never.
  // ---- studio voices: short clips decoded the first time they are needed, played back to back so names can drop into a line ----
  vox: {}, voxEnd: 0, voxCur: null, voxToken: 0, boothLast: -1,
  hasVox() { return typeof VOX !== 'undefined' && !!this.ctx; },
  studioIdx() { // 0..2 = that studio voice, -1 = use a voice from the device
    const k = typeof CFG !== 'undefined' ? CFG.vox : 0; if (!this.hasVox() || k >= 4) return -1;
    if (k < 3) return k; let i = (Math.random() * 3) | 0; if (i === this.boothLast) i = (i + 1 + ((Math.random() * 2) | 0)) % 3; return this.boothLast = i;
  },
  voxBuf(id) {
    let p = this.vox[id]; if (p) return p;
    if (!VOX[id]) return Promise.resolve(null); // not loaded yet (the artifact loads the clips in two parts): never cache a miss
    p = this.vox[id] = new Promise(res => {
      try {
        const bin = atob(VOX[id]), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
        const r = this.ctx.decodeAudioData(u.buffer, res, () => res(null)); if (r && r.then) r.then(res, () => res(null));
      } catch (e) { res(null); }
    });
    return p;
  },
  // ids: clips to play in order. A prio 0 call-out never talks over anyone and is rate limited, prio 1 waits its turn, prio 2 cuts in.
  playVox(ids, o) {
    if (!this.hasVox() || !this.on || (o.prio && !this.talk)) return false;
    if (!ids.every(id => VOX[id])) return false; // a clip is missing: let the caller fall back to the device voice instead of a silent subtitle
    const c = this.ctx, now = c.currentTime, busy = this.voxEnd > now + 0.05, t = performance.now();
    if (o.prio === 0) { if (busy || t - this.lastCall < 2200) return false; this.lastCall = t; }
    else { if (busy && o.prio < 2) return false; this.lastSay = t; }
    if (o.prio === 2) this.stopVox();
    const tok = ++this.voxToken;
    this.voxEnd = now + 4; // hold the floor while the clips decode
    Promise.all(ids.map(id => this.voxBuf(id))).then(bufs => {
      if (tok !== this.voxToken || !bufs.every(b => b)) { if (tok === this.voxToken) this.voxEnd = 0; return; }
      const g = c.createGain(), rate = o.rate || 1; g.gain.value = (o.vol || 1) * (1 + 0.1 * (o.excite || 0)); g.connect(this.voxBus);
      let at = c.currentTime + 0.03; const srcs = [];
      for (const b of bufs) { const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.connect(g); s.start(at); srcs.push(s); at += b.duration / rate - 0.012; }
      this.voxEnd = at + 0.1; this.voxCur = { g, srcs };
    });
    return true;
  },
  stopVox() {
    this.voxToken++; this.voxEnd = 0; const cur = this.voxCur; this.voxCur = null; if (!cur) return;
    try { cur.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015); for (const s of cur.srcs) s.stop(this.ctx.currentTime + 0.1); } catch (e) { }
  },
  voiceFor(pi) { if (!this.hasVox()) return -1; if (pi === 1) return VOX['l.3.demo'] ? 3 : -1; if (typeof CFG !== 'undefined' && CFG.vox >= 4) return -1; return this.studioIdx(); }, // clip voice for a persona (-1 = device voice). Shorty always has his own voice; the voice setting picks the studio guy's // clip voice for a persona (-1 = device voice)
  voxBusy() { return !!this.ctx && this.voxEnd > this.ctx.currentTime + 0.05; },
  // a player shouting a call-out; the voice is picked per player, bigger players are pitched down a little
  callClip(text, o) {
    if (!this.hasVox() || (typeof CFG !== 'undefined' && CFG.vox >= 4)) return null;
    const id = 'c' + ((o.voice || 0) % 8) + '.' + text.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!VOX[id]) return null;
    return this.playVox([id], { prio: 0, vol: (o.vol || 1) * 0.9, rate: clamp(1 + ((o.pitch || 0.85) - 0.85) * 0.35, 0.9, 1.08) });
  },
  demoVoice() {
    const pi = typeof CFG !== 'undefined' && CFG.persona === 1 ? 1 : 0, v = this.voiceFor(pi);
    if (v >= 0) this.playVox([`l.${v}.demo`], { prio: 2, excite: 0.5 });
    else if (window.speechSynthesis) { speechSynthesis.cancel(); this.say(pi ? 'Yo, we live. Lock in wit’ me, Shorty.' : 'Ayyy, welcome to da show, kid. Try not to embarrass yourself.', { prio: 2, excite: 0.5 }); }
  },
  voiceScore(v) {
    const n = v.name || '';
    if (/zarvox|trinoids|whisper|bubbles|bells|boing|cellos|organ|wobble|jester|bahh|bad news|good news|deranged|hysterical|superstar|albert|fred|ralph|junior|kathy|princess|agnes|vicki|bruce|espeak/i.test(n)) return -999;
    let s = 0;
    if (/\b(aria|jenny|michelle|ana|emma|sonia|libby|jane|zira|hazel|susan|samantha|allison|ava|karen|moira|tessa|fiona|kate|serena|catherine|nicky|shelley|flo|sandy|joanna|salli|ivy|kendra|kimberly|amy|zoe|nora|veena|sara|natasha|clara|molly|olivia|sophia|emily|female|woman|girl)\b/i.test(n)) s -= 80;
    if (/\b(guy|christopher|eric|roger|steffan|andrew|brian|davis|tony|jason|ryan|mark|david|james|george|daniel|alex|aaron|evan|gordon|lee|oliver|arthur|rishi|thomas|tom|eddy|reed|rocko|matthew|nathan|liam|william|henry|noah|ethan|jack|ben|male|man)\b/i.test(n)) s += 40;
    if (/natural|neural|online|enhanced|premium|studio|wavenet|journey/i.test(n)) s += 45;
    if (/^google/i.test(n)) s += 12;
    const l = (v.lang || '').replace('_', '-').toLowerCase();
    s += l === 'en-us' ? 14 : l === 'en-gb' ? 5 : /^en-(ca|au|ie)/.test(l) ? 4 : l.startsWith('en') ? 0 : -50;
    if (v.localService === false) s += 6;
    return s;
  },
  isHuman(v) { return !!v && /natural|neural|online|enhanced|premium|studio|wavenet|journey|siri/i.test(v.name); },
  getVoices() { if (!this.voices && window.speechSynthesis) { const v = speechSynthesis.getVoices(); if (v.length) this.voices = v.filter(x => /^en/i.test(x.lang) && this.voiceScore(x) > -500).sort((a, b) => this.voiceScore(b) - this.voiceScore(a)); } return this.voices || []; },
  // 0 = automatic (best match), 1.. = the ranked list the menu lets you step through
  comVoice() { const vs = this.getVoices(); if (!vs.length) return null; const k = (typeof CFG !== 'undefined' && CFG.voice) || 0; return vs[k > 0 ? Math.min(k, vs.length) - 1 : 0]; },
  maleVoices() { return this.getVoices().filter(v => this.voiceScore(v) >= 40); },
  say(text, o = {}) {
    if (o.prio === 0 && this.callClip(text, o)) return true;
    if (!window.speechSynthesis || !this.on || !this.talk && o.prio) return false;
    const t = performance.now();
    if (o.prio === undefined) o.prio = 0;
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if (o.prio === 0) { if (busy || t - this.lastCall < 2200) return false; this.lastCall = t; }
    else { if (busy && o.prio < 2) return false; if (busy) speechSynthesis.cancel(); this.lastSay = t; }
    try {
      const vs = this.getVoices(), ms = this.maleVoices();
      let voice = null;
      if (o.prio) voice = this.comVoice();
      else if (vs.length) { const pool = ms.length ? ms : vs; voice = pool[(o.voice || 0) % pool.length]; }
      const human = this.isHuman(voice), ex = o.excite || 0;
      if (!o.prio) { const u = new SpeechSynthesisUtterance(text); u.volume = (o.vol || 1) * this.vol; u.rate = o.rate || 1; u.pitch = o.pitch || 1; if (voice) { u.voice = voice; u.lang = voice.lang; } speechSynthesis.speak(u); return true; }
      // commentator: short phrases with their own pitch and pace so it sounds like a guy talking, not one long read
      const parts = text.match(/[^.!?…]+[.!?…]*/g) || [text];
      const phrases = []; for (const p of parts) { const q = p.trim(); if (!q) continue; if (q.length > 70 && /,/.test(q)) { const k = q.indexOf(',', 28); if (k > 0 && k < q.length - 14) { phrases.push(q.slice(0, k + 1)); phrases.push(q.slice(k + 1).trim()); continue; } } phrases.push(q); }
      phrases.forEach((ph, i) => {
        const u = new SpeechSynthesisUtterance(ph), last = i === phrases.length - 1, excl = /!$/.test(ph), ask = /\?$/.test(ph);
        const base = human ? 1 : 0.86;                              // synthetic voices sound less like a robot a bit lower
        u.pitch = base + (excl ? 0.07 : 0) + (ask ? 0.1 : 0) - (last && !excl ? 0.05 : 0) + ex * 0.06 + (Math.random() - 0.5) * 0.06;
        u.rate = (human ? 1.04 : 0.98) + ex * 0.09 + (excl ? 0.04 : 0) - (last ? 0.03 : 0) + (Math.random() - 0.5) * 0.05;
        u.volume = this.vol; if (voice) { u.voice = voice; u.lang = voice.lang; }
        speechSynthesis.speak(u);
      });
      return true;
    } catch (e) { return false; }
  }
};
