/* ===== Commentator ===== */
const Com = {
  last: {}, react: 0,
  // Lines come from the TALK grammar in b_talk.js (two personas, hundreds of combinations per event, per-game memory).
  say(key, name, prio = 1, cd = 4500) {
    const now = performance.now(); if (this.last[key] && now - this.last[key] < cd) return;
    if (!TALK.personas[0].cores[key]) return;
    this.last[key] = now; if (!Snd.talk) return;
    const pi = Talk.personaFor(key); if (!this.speak(pi, key, name, prio)) return;
    // booth: Shorty reacts to the big plays once the studio call is done
    if ((CFG.persona || 0) === 2 && pi === 0 && (EXC[key] || 0.3) >= 0.6 && Math.random() < 0.7) {
      const tok = ++this.react; let tries = 0;
      const go = () => { if (tok !== this.react || S.state !== 'play') return; if (Snd.voxBusy() && tries++ < 6) { setTimeout(go, 600); return; } this.speak(1, key, name, 1); };
      setTimeout(go, 1800);
    }
  },
  speak(pi, key, name, prio) {
    // the neural clips are the voice; a line only goes up as a subtitle when it is actually spoken, and the device voice never talks over a clip
    const v = Snd.voiceFor(pi), clips = v >= 0 || (pi === 1 && Snd.on); // Shorty never falls back to the device voice
    if (clips && prio < 2 && Snd.voxBusy()) return false;
    const line = Talk.compose(pi, key, name); if (!line) return false;
    const txt = Talk.fill(line, name), ex = EXC[key] || 0.3;
    let ok = false;
    if (v >= 0) ok = Snd.playVox(Talk.ids(line, v, name), { prio, excite: ex, rate: (pi === 1 ? 0.98 : 1) + 0.035 * ex });
    if (!ok && !(pi === 1 && v < 0 && typeof VOX === 'undefined' && Snd.on)) ok = Snd.say(txt, { prio, excite: ex }) !== false;
    if (!ok && v >= 0) return false;
    const el = $('caption'); el.innerHTML = '<b>' + line.persona.name + '</b>' + txt; el.classList.add('on'); clearTimeout(this.ct); this.ct = setTimeout(() => el.classList.remove('on'), 1000 + txt.length * 62);
    return true;
  },
  clear() { $('caption').classList.remove('on'); Talk.reset(); this.last = {}; this.react++; }
};
// short player call-outs (speech + visual), rate limited by Snd
const CALLS = {
  open: ['Open!', 'I’m open!', 'Right here!', 'Ball!'],
  help: ['Help!', 'Got him!', 'Switch!', 'Watch the cut!'],
  nice: ['Yeah!', 'Let’s go!', 'Buckets!', 'That’s it!', 'Ooh!'],
  dunk: ['Yeah!', 'Get outta here!', 'Boom!'],
  bad: ['Come on!', 'My bad!', 'Next one!'],
  clear: ['Check!', 'Take it back!'],
  screen: ['Screen!', 'Pick!'],
  // 'Everybody says Shorty' (Settings): the same calls with a Shorty on them
  openS: ['I’m open, Shorty!', 'Right here, Shorty!', 'Ball, Shorty!'], helpS: ['Help, Shorty!', 'I got him, Shorty!', 'Switch, Shorty!'], niceS: ['Let’s go, Shorty!', 'Buckets, Shorty!', 'Dat’s it, Shorty!'], dunkS: ['Get outta here, Shorty!', 'Boom, Shorty!'], badS: ['My bad, Shorty!', 'Next one, Shorty!'], clearS: ['Check it, Shorty!', 'Take it back, Shorty!'], screenS: ['Screen, Shorty!', 'Pick, Shorty!'],
};
function callOut(p, kind) {
  if (!p) return; const arr = (CFG.shortyAll && Math.random() < 0.6 && CALLS[kind + 'S']) || CALLS[kind]; if (!arr) return;
  const big = p.role === 'B';
  Snd.say(pick(arr), { prio: 0, pitch: big ? 0.6 : p.role === 'W' ? 0.85 : 1.05, rate: 1.25, voice: p.idx + p.team.idx, vol: 0.9 });
}

/* ===== Input: gamepads (standard mapping = PlayStation layout) + keyboard ===== */
const STICK = { h: 0 };
const KEYS = {};
const Pad = {
  // PS standard mapping: 0 Cross 1 Circle 2 Square 3 Triangle 4 L1 5 R1 6 L2 7 R2 8 Share 9 Options 10 L3 11 R3 12-15 dpad
  list() { let a = []; try { a = (navigator.getGamepads && navigator.getGamepads()) || []; } catch (e) { Pad.blocked = true; } const o = []; for (const g of a) if (g && g.connected) o.push(g); return o; },
  blocked: false,
  embedded() { try { return window.top !== window && !!document.featurePolicy && !document.featurePolicy.allowsFeature('gamepad'); } catch (e) { return false; } },
};
const MAP = {
  1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sq: 'KeyJ', x: 'KeyK', o: 'KeyL', t: 'KeyI', r2: 'ShiftLeft', l2: 'KeyQ', l1: 'KeyE', rs: 'Space', pause: 'KeyP' },
  2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', sq: 'Period', x: 'Comma', o: 'Slash', t: 'Semicolon', r2: 'ShiftRight', l2: 'Quote', l1: 'BracketRight', rs: 'Enter', pause: 'Backslash' },
};
function newInp() { return { mx: 0, my: 0, wx: 0, wz: 0, sprint: false, shoot: false, shootP: false, shootR: false, xP: false, oP: false, tP: false, switchP: false, protect: false, l1: false, rsx: 0, rsy: 0, flick: 0, fx: 0, fy: 0, fmod: false, fmod2: false, kbRS: false, r3T: 0, r3Used: false, pShoot: false, pauseP: false, any: false, b: new Array(17).fill(false), pb: new Array(17).fill(false) }; }
const INP = [newInp(), newInp()];
let padActive = [null, null];
const dz = v => Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8;
function pollInput(dt) {
  const pads = Pad.list();
  // P1 = first pad, P2 = second pad. Keyboards always work: WASD for P1, arrows for P2.
  for (let h = 0; h < 2; h++) {
    const I = INP[h], g = pads[h], km = MAP[h + 1];
    const b = I.b, pb = I.pb;
    for (let i = 0; i < 17; i++) pb[i] = b[i];
    I.pauseP = false; let mx = 0, my = 0, rsx = 0, rsy = 0;
    const bt = new Array(17).fill(false);
    if (g) {
      mx = dz(g.axes[0] || 0); my = dz(g.axes[1] || 0); rsx = dz(g.axes[2] || 0); rsy = dz(g.axes[3] || 0);
      for (let i = 0; i < 17; i++) { const B = g.buttons[i]; bt[i] = !!B && (B.pressed || B.value > 0.5); }
      if (bt[14]) mx = -1; if (bt[15]) mx = 1; if (bt[12]) my = -1; if (bt[13]) my = 1;
      padActive[h] = g;
    } else padActive[h] = null;
    const K = k => !!KEYS[k];
    if (K(km.left)) mx = -1; if (K(km.right)) mx = 1; if (K(km.up)) my = -1; if (K(km.down)) my = 1;
    if (K(km.sq)) bt[2] = true; if (K(km.x)) bt[0] = true; if (K(km.o)) bt[1] = true; if (K(km.t)) bt[3] = true;
    if (K(km.r2)) bt[7] = true; if (K(km.l2)) bt[6] = true; if (K(km.l1)) bt[4] = true; if (K(km.pause)) bt[9] = true;
    if (K(km.rs)) bt[11] = true;
    for (let i = 0; i < 17; i++) b[i] = bt[i];
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    STICK.h = h; I.mx = mx; I.my = my; const wm = stickToWorld(mx, my); I.wx = wm.x; I.wz = wm.z; // mx/my = raw stick (menus), wx/wz = world direction (gameplay)
    I.sprint = b[7]; I.protect = b[6]; I.l1 = b[4];
    // shot stick (Settings): pull the right stick straight down and hold = the shot, let go = the release. Square always works too.
    const stickShot = !!CFG.shotStick && rsy > 0.62 && Math.abs(rsx) < rsy, sh = b[2] || stickShot;
    I.shootP = sh && !I.pShoot; I.shootR = !sh && I.pShoot; I.pShoot = sh; I.shoot = sh;
    I.xP = b[0] && !pb[0]; I.oP = b[1] && !pb[1]; I.tP = b[3] && !pb[3];
    I.pauseP = b[9] && !pb[9];
    // right stick flick = dribble move (the keyboard has no right stick: its dribble key + a held direction does the same flick)
    const prev = Math.hypot(I.rsx, I.rsy), cur = Math.hypot(rsx, rsy);
    // flick = 1 (world direction in fx/fy; fmod = L2 held for spin / step back / hop step, fmod2 = R3 held for the second set of dribble patterns),
    // 3 = size-up: a quick R3 tap with the sticks centred (on release, so holding R3 and pushing the stick is not a size-up), or the keyboard dribble key alone
    I.flick = 0; I.fmod = b[6]; I.kbRS = K(km.rs); I.fmod2 = b[11] && !I.kbRS;
    const lm = Math.hypot(I.wx, I.wz);
    if (cur > 0.8 && prev < 0.5 && !stickShot) { const fw = stickToWorld(rsx / cur, rsy / cur, true); I.flick = 1; I.fx = fw.x; I.fy = fw.z; I.r3Used = true; }
    else if (b[11] && !pb[11] && I.kbRS) { if (lm > 0.3) { I.flick = 1; I.fx = I.wx / lm; I.fy = I.wz / lm; } else I.flick = 3; }
    if (b[11] && !I.kbRS) { if (!pb[11]) { I.r3T = 0; I.r3Used = cur > 0.5; } I.r3T += dt; }
    else if (pb[11] && !I.kbRS && !I.r3Used && I.r3T < 0.45 && lm <= 0.3) I.flick = 3;
    I.rsx = rsx; I.rsy = rsy;
    I.any = bt.some(Boolean);
  }
}
addEventListener('keydown', e => { KEYS[e.code] = true; Snd.init(); if (/^(Arrow|Space|Slash|Quote|Period|Comma|Semicolon|Bracket|Backslash)/.test(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { KEYS[e.code] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
addEventListener('pointerdown', () => Snd.init());
