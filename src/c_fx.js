/* ===== Presentation effects: the net, the swish, the ball trail and the floor glow that keep the eye on the ball =====
   Hooks the game calls: fxNet(hoop) when a hoop is built, fxShot(kind) when a shot leaves the hand, fxRim(hoop, strength) on a rim hit,
   fxSwish(hoop, shot) on a made basket, fxMode(mode) when an arena is built, fxUpdate(dt) once per frame. Everything here is cheap:
   one line draw call per net, one for the trail, two sprites, and no per-frame allocations. CFG.quality 0 skips the trail and the glow. */
const FX = { nets: [], trail: null, trailN: 18, trailPts: null, trailCol: null, trailHead: 0, trailOn: 0, trailFade: 0, glow: null, spot: null, flashes: [], mode: 'play', vig: null, t: 0 };
const NET_STR = 12, NET_LV = 6, NET_DEPTH = 0.44;        // strands around the rim, levels down each strand, net length (m)
const NET_LAND = [1, 0.96, 0.9, 0.82, 0.72, 0.6];         // radius of each level as a share of the rim radius, at rest

// a soft round sprite texture, shared by the ball glow and the floor spot
const fxDot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,230,190,.55)'); r.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); return t; })();

/* ---- the net: strands + rings as one LineSegments; each level carries a radial bulge, a sideways swing and a stretch, all damped springs ---- */
function fxNet(h) {
  const n = { h, b: new Float32Array(NET_LV), bv: new Float32Array(NET_LV), sx: new Float32Array(NET_LV), sxv: new Float32Array(NET_LV), sz: new Float32Array(NET_LV), szv: new Float32Array(NET_LV), st: new Float32Array(NET_LV), stv: new Float32Array(NET_LV), energy: 0, glow: 0, delay: new Float32Array(NET_LV), kick: 0, kickK: 0 };
  const segs = NET_STR * (NET_LV - 1) + NET_STR * (NET_LV - 1);  // strands + rings (ring at the rim is the rim itself)
  const pos = new Float32Array(segs * 2 * 3);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  n.mat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  n.mesh = new T.LineSegments(geo, n.mat); n.mesh.frustumCulled = false; n.mesh.position.set(0, RIM_H, 0); n.pos = pos; n.geo = geo;
  h.rim.add(n.mesh); h.fx = n; FX.nets.push(n);
  fxNetWrite(n); return n;
}
function fxNetPoint(n, s, k, out) { // strand s, level k -> local x y z
  const a = s / NET_STR * Math.PI * 2, r = RIM_R * (NET_LAND[k] + n.b[k]) + 0.012;
  out[0] = Math.cos(a) * r + n.sx[k]; out[2] = Math.sin(a) * r + n.sz[k]; out[1] = -(k / (NET_LV - 1)) * NET_DEPTH * (1 + n.st[k]);
}
const _np = [0, 0, 0], _nq = [0, 0, 0];
function fxNetWrite(n) {
  const p = n.pos; let i = 0;
  for (let s = 0; s < NET_STR; s++) for (let k = 0; k < NET_LV - 1; k++) { fxNetPoint(n, s, k, _np); fxNetPoint(n, s, k + 1, _nq); p[i++] = _np[0]; p[i++] = _np[1]; p[i++] = _np[2]; p[i++] = _nq[0]; p[i++] = _nq[1]; p[i++] = _nq[2]; }
  for (let k = 1; k < NET_LV; k++) for (let s = 0; s < NET_STR; s++) { fxNetPoint(n, s, k, _np); fxNetPoint(n, (s + 1) % NET_STR, k, _nq); p[i++] = _np[0]; p[i++] = _np[1]; p[i++] = _np[2]; p[i++] = _nq[0]; p[i++] = _nq[1]; p[i++] = _nq[2]; }
  n.geo.attributes.position.needsUpdate = true;
}
// a ball passing through: a bulge that travels down the net level by level (delay per level), plus a little stretch
function fxNetSwish(n, k) { for (let l = 0; l < NET_LV; l++) n.delay[l] = l * 0.045; n.kick = k; n.kickK = 1; n.energy = 1.2; n.glow = Math.max(n.glow, 0.5 * k + 0.4); }
// a dunk or a hard rim hit: the whole net whips sideways and snaps
function fxNetWhip(n, k) { const a = Math.random() * 6.28; for (let l = 1; l < NET_LV; l++) { const w = l / (NET_LV - 1); n.sxv[l] += Math.cos(a) * 2.6 * k * w; n.szv[l] += Math.sin(a) * 2.6 * k * w; n.stv[l] += 3.5 * k * w; n.bv[l] += 1.5 * k * w; } n.energy = 1.5; }
function fxNetStep(n, dt) {
  if (n.kickK > 0) { let done = true; for (let l = 0; l < NET_LV; l++) { if (n.delay[l] > 0) { n.delay[l] -= dt; done = false; if (n.delay[l] <= 0) { n.bv[l] += 2.2 * n.kick * (0.5 + 0.5 * l / NET_LV); n.stv[l] += 1.6 * n.kick * l / NET_LV; } } } if (done) n.kickK = 0; }
  const K = 70, D = 7.5, h = Math.min(dt, 1 / 50);
  for (let l = 1; l < NET_LV; l++) {
    n.bv[l] += (-K * n.b[l] - D * n.bv[l]) * h; n.b[l] += n.bv[l] * h;
    n.sxv[l] += (-K * 0.6 * n.sx[l] - D * n.sxv[l]) * h; n.sx[l] += n.sxv[l] * h;
    n.szv[l] += (-K * 0.6 * n.sz[l] - D * n.szv[l]) * h; n.sz[l] += n.szv[l] * h;
    n.stv[l] += (-K * 1.4 * n.st[l] - D * 1.2 * n.stv[l]) * h; n.st[l] += n.stv[l] * h;
    if (n.b[l] < -0.35) { n.b[l] = -0.35; n.bv[l] = Math.abs(n.bv[l]) * 0.3; }
  }
  n.energy = Math.max(0, n.energy - dt); if (n.glow > 0) n.glow = Math.max(0, n.glow - dt * 1.4);
  n.mat.color.setRGB(1, 1 - 0.1 * n.glow, 1 - 0.35 * n.glow); n.mat.opacity = 0.92;
  fxNetWrite(n);
}

/* ---- ball trail, glow and floor spot ---- */
function fxBuild() {
  const N = FX.trailN; FX.trailPts = new Float32Array(N * 3); FX.trailCol = new Float32Array(N * 3);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(FX.trailPts, 3)); g.setAttribute('color', new T.BufferAttribute(FX.trailCol, 3));
  FX.trail = new T.Points(g, new T.PointsMaterial({ map: fxDot, size: 0.34, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); FX.trail.frustumCulled = false; FX.trail.visible = false; FX.trail.renderOrder = 4; scene.add(FX.trail); // point sprites, so the streak has body (GL lines are one pixel)
  FX.glow = new T.Sprite(new T.SpriteMaterial({ map: fxDot, color: 0xffb070, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); FX.glow.scale.set(0.9, 0.9, 1); FX.glow.renderOrder = 4; scene.add(FX.glow);
  FX.spot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: fxDot, color: 0xffd9a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); FX.spot.rotation.x = -Math.PI / 2; FX.spot.position.y = 0.015; FX.spot.renderOrder = 2; scene.add(FX.spot);
  // a soft vignette so the floor and the ball read as the focus, not the stands
  const v = document.createElement('div'); v.id = 'vig'; v.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.28) 100%);z-index:1'; FX.vig = v;
  const gl = document.getElementById('gl'); if (gl && gl.parentNode) gl.parentNode.insertBefore(v, gl.nextSibling);
  for (let i = 0; i < N; i++) { const f = 1 - i / N; FX.trailCol[i * 3] = 1 * f; FX.trailCol[i * 3 + 1] = (0.62 + 0.3 * f) * f; FX.trailCol[i * 3 + 2] = 0.3 * f * f; } // bright at the ball, fading to nothing
  FX.trail.geometry.attributes.color.needsUpdate = true;
}
function fxShot(kind) { if (!FX.trail) fxBuild(); FX.trailOn = 1; FX.trailFade = 1; FX.trailHead = 0; const N = FX.trailN, p = FX.trailPts; for (let i = 0; i < N; i++) { p[i * 3] = B.pos.x; p[i * 3 + 1] = B.pos.y; p[i * 3 + 2] = B.pos.z; } if (FX.trail) { FX.trail.geometry.attributes.position.needsUpdate = true; FX.trail.visible = !!CFG.quality; } }
function fxTrailStep(dt) {
  if (!FX.trail) return;
  const flying = B.state === 'shot' || (FX.trailOn && B.state === 'loose' && B.pos.y > 0.3);
  if (!flying && FX.trailOn) { FX.trailFade -= dt * 2.5; if (FX.trailFade <= 0) { FX.trailOn = 0; FX.trail.visible = false; FX.glow.material.opacity = 0; FX.spot.material.opacity = 0; return; } }
  if (!FX.trailOn) return;
  const N = FX.trailN, p = FX.trailPts;
  if (flying) { for (let i = N - 1; i > 0; i--) { p[i * 3] = p[(i - 1) * 3]; p[i * 3 + 1] = p[(i - 1) * 3 + 1]; p[i * 3 + 2] = p[(i - 1) * 3 + 2]; } p[0] = B.pos.x; p[1] = B.pos.y; p[2] = B.pos.z; FX.trail.geometry.attributes.position.needsUpdate = true; }
  const hi = CFG.quality ? 1 : 0, f = Math.max(0, FX.trailFade);
  FX.trail.visible = hi > 0 && f > 0; FX.trail.material.opacity = 0.85 * f;
  FX.glow.position.copy(B.pos); FX.glow.material.opacity = 0.55 * f * hi; const s = 0.7 + 0.25 * Math.sin(FX.t * 18); FX.glow.scale.set(s, s, 1);
  FX.spot.position.set(B.pos.x, 0.015, B.pos.z); const sp = 1.6 + B.pos.y * 0.35; FX.spot.scale.set(sp, sp, 1); FX.spot.material.opacity = 0.32 * f * hi * clamp(1 - B.pos.y / 9, 0.3, 1);
}

/* ---- the swish and the rim ---- */
function fxSwishSound(clean) {
  if (!Snd.ctx || !Snd.on) return; const c = Snd.ctx, t = c.currentTime, out = Snd.sfx || Snd.master;
  // 'whing': a bright sine that slides down with a quick shimmer on top, then the rope hiss
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(clean ? 2300 : 1500, t); o.frequency.exponentialRampToValueAtTime(clean ? 820 : 640, t + 0.28);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(clean ? 0.22 : 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36);
  const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = 'triangle'; o2.frequency.setValueAtTime(clean ? 4600 : 3000, t); o2.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
  g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(clean ? 0.07 : 0.04, t + 0.015); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 0.22);
  if (Snd.burst) Snd.burst('highpass', 3600, 0.6, 0.3, clean ? 0.3 : 0.18, 0.03);
}
function fxSwish(h, shot) {
  if (!FX.trail) fxBuild(); const n = h.fx; if (!n) return; const clean = !!shot && !shot.touched && !shot.dunk;
  if (shot && shot.dunk) { fxNetWhip(n, shot.fire ? 1.4 : 1); fxNetSwish(n, 1.2); return; }
  fxNetSwish(n, clean ? 1 : 0.7); fxSwishSound(clean);
  if (clean) { shock(h.x, RIM_H + 0.02, 0, 2.6, 0xffffff); burst(h.x, RIM_H, 0, CFG.quality ? 22 : 8, 2.2, 0, [[1, 1, 1], [1, 0.85, 0.5]], 0.6, 0.12, -3); n.glow = 1; if (FX.glow) { FX.glow.material.opacity = 1; } }
  else { shock(h.x, RIM_H + 0.02, 0, 1.6, 0xffc080); burst(h.x, RIM_H, 0, 8, 1.6, 0, [[1, 0.9, 0.6]], 0.5, 0.1, -3); }
}
function fxRim(h, k) { const n = h.fx; if (!n) return; fxNetWhip(n, clamp(k, 0.2, 1) * 0.5); }
function fxMode(mode) { FX.mode = mode; if (FX.vig) FX.vig.style.background = mode === 'black' ? 'radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 52%,rgba(10,4,16,.34) 100%)' : 'radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.28) 100%)'; FX.trailOn = 0; if (FX.trail) { FX.trail.visible = false; FX.glow.material.opacity = 0; FX.spot.material.opacity = 0; } }
function fxUpdate(dt) {
  FX.t += dt; if (!FX.trail) fxBuild();
  for (const n of FX.nets) if (n.energy > 0 || n.kickK > 0 || n.glow > 0) fxNetStep(n, dt);
  fxTrailStep(dt);
}
