/* ---- realistic athletes (v24): a MakeHuman (CC0) human body, baked by tools/bake_body.py into c_bodydata.js,
   skinned to the game's existing rig (body, torso, head, arms, elbows, legs, knees), so every animation still drives it.
   Jersey, shorts and sneakers are real garment shells over the skin; hair and beards are shells grown from the scalp. ---- */
const BODY = { ok: null, H: null, bin: null, geo: {}, hairCache: {} };
function bodyInit() {
  if (BODY.ok !== null) return BODY.ok;
  try {
    const s = atob(BODY_B64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    BODY.bin = u.buffer; BODY.H = BODY_HDR; BODY.ok = true;
  } catch (e) { BODY.ok = false; }
  return BODY.ok;
}
function bodyVariant(o) {
  const build = o.build || (o.hgt >= 2.06 ? 'B' : o.hgt >= 1.98 ? 'W' : 'G');
  const sk = o.skinC !== undefined ? new T.Color(o.skinC).getHSL({}).l : (o.skin === undefined ? 2 : o.skin) / 5 * -0.5 + 0.75;
  return build + '-' + (sk > 0.6 ? 'c' : 'a');
}
function bodyGeo(vn) {
  if (BODY.geo[vn]) return BODY.geo[vn];
  const H = BODY.H, b = BODY.bin, n = H.n, V = H.var[vn];
  const q = new Uint16Array(b, V.pos, n * 3), pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = V.lo[i % 3] + q[i] / 65535 * V.sc[i % 3];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setIndex(new T.BufferAttribute(new Uint16Array(b, H.idx, H.t * 3), 1));
  g.setAttribute('skinIndex', new T.BufferAttribute(new Uint8Array(b, H.si, n * 4), 4));
  g.setAttribute('skinWeight', new T.BufferAttribute(new Uint8Array(b, H.sw, n * 4), 4, true));
  g.setAttribute('rg', new T.BufferAttribute(new Uint8Array(b, H.rg, n), 1));
  g.setAttribute('fx', new T.BufferAttribute(new Uint8Array(b, H.fx, n * 4), 4, true));
  g.computeVertexNormals();
  // weld normals across region seams so the skin shades as one surface
  const wl = new Uint16Array(b, H.weld, n), nr = g.attributes.normal.array, acc = new Float32Array(H.nweld * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) acc[wl[i] * 3 + k] += nr[i * 3 + k];
  for (let i = 0; i < n; i++) { const w = wl[i] * 3, l = Math.hypot(acc[w], acc[w + 1], acc[w + 2]) || 1; for (let k = 0; k < 3; k++) nr[i * 3 + k] = acc[w + k] / l; }
  // face morphs: every player gets his own nose, lips, jaw, cheeks and head shape
  const mU = new Int16Array(b, H.mU, n), mD = new Int8Array(b, H.mD, H.nM * H.nU * 3);
  g.morphAttributes.position = []; g.morphTargetsRelative = true;
  for (let k = 0; k < H.nM; k++) {
    const a = new Float32Array(n * 3), sc = H.mS[k] / 127, o = k * H.nU * 3;
    for (let i = 0; i < n; i++) { const u = mU[i]; if (u >= 0) for (let c = 0; c < 3; c++) a[i * 3 + c] = mD[o + u * 3 + c] * sc; }
    g.morphAttributes.position.push(new T.BufferAttribute(a, 3));
  }
  g.boundingSphere = new T.Sphere(new T.Vector3(0, 1.0, 0), 1.6);
  return BODY.geo[vn] = g;
}
const BODY_VS = [
  ['#include <common>', '#include <common>\nattribute float rg; attribute vec4 fx; varying float vRg; varying vec4 vFx; varying vec3 vB;'],
  ['#include <begin_vertex>', '#include <begin_vertex>\nvRg = rg; vFx = fx; vB = position;'],
];
const BODY_FS = [
  ['#include <common>', `#include <common>
varying float vRg; varying vec4 vFx; varying vec3 vB;
uniform vec3 uSkin, uJer, uTrim, uSho, uShoe, uSock, uHair, uSleeve, uEyeL, uEyeR; uniform vec4 uFlag, uBeard, uReg; uniform sampler2D uNumF, uNumB;
float bRough = 0.6; float bSkin = 0.0;`],
  ['#include <color_fragment>', `#include <color_fragment>
{
  int r = int(vRg + 0.5); vec3 c = uSkin; float ao = vFx.x, ax = abs(vB.x), y = vB.y;
  if (r == 0 || r == 9) {
    c = uSkin * (0.6 + 0.4 * ao); c = max(vec3(0.0), mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 1.22)) * 0.94;
    c = mix(c, uSkin * vec3(0.7, 0.53, 0.52), vFx.y * 0.7);
    c = mix(c, uHair * 0.9, vFx.z * 0.8);
    float bz = vFx.w; if (bz > 0.3 && bz + 0.001 >= uBeard.x) c = mix(c, uHair * 0.95, uBeard.y);
    bRough = 0.64 - vFx.y * 0.22; bSkin = 1.0;
    if (r == 9 && uFlag.x > 0.5) { c = uSleeve; bRough = 0.55; bSkin = 0.0; }
    if (y < uReg.w && y > 0.06 && ax > 0.03) { c = uSock * (0.8 + 0.2 * ao); if (y > uReg.w - 0.022) c *= 0.9 + 0.1 * step(0.5, fract(vB.x * 300.0 + vB.z * 300.0)); bRough = 0.95; bSkin = 0.0; }
  } else if (r == 1 || r == 2) {
    float ny = vB.z > 0.0 ? 1.612 + 11.0 * vB.x * vB.x : 1.66 + 6.0 * vB.x * vB.x;
    float dn = ax < 0.13 ? ny - y : 1.0;
    float ay = 1.43 + 2.2 * max(0.0, 0.205 - ax);
    float da = max(0.142 - ax, ay - y);
    float d = min(dn, da);
    if (d < 0.0 || y < uReg.x - 0.03) discard;
    c = uJer * (0.95 + 0.05 * step(0.5, fract(vB.x * 240.0)) * step(0.5, fract(vB.y * 240.0))); bRough = 0.8;
    if (uFlag.y > 0.5) c = mix(c, vec3(0.06), step(0.62, fract(vB.x * 14.0 + 0.5)));
    if (vB.z > 0.0) { vec2 u = vec2(vB.x / 0.27 + 0.5, (y - 1.235) / 0.27); if (u.x > 0.0 && u.x < 1.0 && u.y > 0.0 && u.y < 1.0) { vec4 t = texture2D(uNumF, u); c = mix(c, t.rgb, t.a); } }
    else { vec2 u = vec2(0.5 - vB.x / 0.3, (y - 1.25) / 0.3); if (u.x > 0.0 && u.x < 1.0 && u.y > 0.0 && u.y < 1.0) { vec4 t = texture2D(uNumB, u); c = mix(c, t.rgb, t.a); } }
    if (d < 0.017) { c = uTrim; bRough = 0.6; }
  } else if (r == 3 || r == 4) {
    if (y < uReg.y || y > uReg.x) discard;
    c = uSho; bRough = 0.5;
    if (y > uReg.x - 0.04 || y < uReg.y + 0.022 || (ax > 0.205 && y < uReg.x - 0.13)) { c = uTrim; bRough = 0.55; }
  } else if (r >= 6 && r <= 8) {
    if (y > uReg.z + 0.035 * clamp(-vB.z / 0.08, 0.0, 1.0)) discard;
    c = uShoe; bRough = 0.38;
    if (y < 0.027) { c = vec3(0.93, 0.92, 0.9); bRough = 0.85; }
    else if (y < 0.033 || (y < 0.085 && y > 0.05 && abs(fract((vB.z * 7.0 - y * 9.0)) - 0.5) < 0.09 && ax > 0.08)) { c = uTrim; bRough = 0.5; }
  } else if (r == 5) { c = uSock; bRough = 0.95; }
  else if (r == 10) {
    vec3 e = vB - (vB.x > 0.0 ? uEyeR : uEyeL); float d = length(e.xy) / 0.0115;
    c = vec3(0.8, 0.78, 0.74) * (1.0 - 0.45 * smoothstep(0.35, 1.0, e.y / 0.0115)); bRough = 0.08;
    if (e.z > 0.0) { if (d < 0.5) c = mix(vec3(0.16, 0.09, 0.05), vec3(0.3, 0.18, 0.08), d * 2.0); if (d < 0.22) c = vec3(0.02); }
  }
  diffuseColor.rgb = c;
}`],
  ['#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = bRough;'],
  ['#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (bSkin > 0.5) totalEmissiveRadiance += diffuseColor.rgb * vec3(0.16, 0.07, 0.04);'],
];
function bodyMaterial(o, vn, J) {
  const m = new T.MeshStandardMaterial({ skinning: true, morphTargets: true, side: T.DoubleSide, roughness: 0.6, metalness: 0 });
  const col = h => new T.Color(h);
  const skin = o.skinC !== undefined ? o.skinC : SKIN[o.skin] || SKIN[2], ex = (o.extra || '').split(' '), has = k => ex.includes(k);
  const trim = o.numColor !== undefined ? o.numColor : 0xffffff;
  const hairC = o.hair === 'bald' && !has('beard') && !has('bigbeard') ? 0x1c1410 : (o.hairC === undefined ? 0x1c1410 : o.hairC);
  const beard = has('bigbeard') || has('beard') || has('graybeard') ? [0.3, 0.92] : has('goatee') ? [0.7, 0.9] : has('stache') ? [0.95, 0.9] : has('stubble') ? [0.3, 0.45] : [9, 0];
  const U = m.userData.u = {
    uSkin: { value: col(skin) }, uJer: { value: col(o.jersey) }, uTrim: { value: col(trimOf(trim === o.jersey ? 0xffffff : trim)) }, uSho: { value: col(o.shorts) },
    uShoe: { value: col(o.shoe) }, uSock: { value: col(o.sock || 0xf2f2f2) }, uHair: { value: col(has('graybeard') ? 0xcfcfcf : hairC) }, uSleeve: { value: col(o.sleeveC || 0xf4f4f6) },
    uEyeL: { value: new T.Vector3().fromArray(BODY.H.var[vn].eye[1]) }, uEyeR: { value: new T.Vector3().fromArray(BODY.H.var[vn].eye[0]) },
    uReg: { value: new T.Vector4(BODY.H.reg.waist, BODY.H.reg.hem, BODY.H.reg.shoe, BODY.H.reg.sock) }, uFlag: { value: new T.Vector4(has('sleeve') ? 1 : 0, o.stripes ? 1 : 0, 0, 0) }, uBeard: { value: new T.Vector4(beard[0], beard[1], 0, 0) },
    uNumF: { value: jerseyTex(trim, o.num === undefined ? '' : o.num, '') }, uNumB: { value: jerseyTex(trim, o.num === undefined ? '' : o.num, o.short || '') },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    for (const [a, b] of BODY_VS) sh.vertexShader = sh.vertexShader.replace(a, b);
    for (const [a, b] of BODY_FS) sh.fragmentShader = sh.fragmentShader.replace(a, b);
  };
  m.customProgramCacheKey = () => 'hdbody3';
  return m;
}
// hair / beard / headband shells grown from the scalp of this body variant, in head-local space
function bodyShell(vn, J, kind, style, color, seed, mi) {
  const H = BODY.H, b = BODY.bin, V = H.var[vn], n = H.nhair;
  const mD = new Int8Array(b, H.mD, H.nM * H.nU * 3), hp = new Uint16Array(b, V.hp, n * 3), hn = new Int8Array(b, V.hn, n * 3), hd = new Int8Array(b, H.hairD, n), hb = new Uint8Array(b, H.hairB, n), hf = new Uint16Array(b, H.hairF, H.nhairF * 4);
  const P = new Float32Array(n * 3), th = new Float32Array(n), C = new Float32Array(n * 3), A = new Float32Array(n), hj = J.head, cl = new T.Color(color);
  const ss = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  let rs = seed || 1; const rnd1 = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const p = [V.lo[0] + hp[i * 3] / 65535 * V.sc[0], V.lo[1] + hp[i * 3 + 1] / 65535 * V.sc[1], V.lo[2] + hp[i * 3 + 2] / 65535 * V.sc[2]];
    if (mi) for (let k = 0; k < H.nM; k++) if (mi[k]) { const o = (k * H.nU + i) * 3, sc = H.mS[k] / 127 * mi[k]; p[0] += mD[o] * sc; p[1] += mD[o + 1] * sc; p[2] += mD[o + 2] * sc; }
    const nx = hn[i * 3] / 127, ny = hn[i * 3 + 1] / 127, nz = hn[i * 3 + 2] / 127, d = hd[i] / 1000, top = Math.max(0, ny);
    let t = 0, up = 0, out = 0;
    if (kind === 'hair') {
      const k = ss(d / 0.012);
      if (style === 'buzz') t = 0.0022 * ss(d / 0.006);
      else if (style === 'short') t = (0.0045 + 0.0035 * top) * k;
      else if (style === 'fade') t = (0.0012 + 0.009 * ss((top - 0.35) / 0.4)) * ss(d / 0.006);
      else if (style === 'afro') { t = (0.028 + 0.012 * top) * ss(d / 0.02); out = 0.006; }
      else if (style === 'hightop') { t = (0.008 + 0.006 * top) * ss(d / 0.008); up = 0.075 * ss((top - 0.45) / 0.35); }
      else if (style === 'curly') t = (0.011 + 0.006 * top) * ss(d / 0.012) * (0.75 + 0.5 * rnd1());
      else if (style === 'braids' || style === 'cornrows') t = 0.0042 * ss(d / 0.006);
      else if (style === 'dreads' || style === 'long' || style === 'manbun' || style === 'slicked') t = (0.008 + 0.004 * top) * ss(d / 0.01);
      else if (style === 'mohawk') t = (0.002 + 0.03 * ss(1 - Math.abs(p[0]) / 0.022) * ss((top - 0.2) / 0.5)) * ss(d / 0.006);
      else t = 0.006 * k;
    } else if (kind === 'beard') {
      const z = hb[i] / 4; if (z >= 0.45) t = style === 'bigbeard' ? 0.006 + 0.02 * ss((1.8 - p[1]) / 0.05) * (z > 0.6 ? 1 : 0.6) : 0.0045;
      if (style === 'bigbeard' && z >= 0.45) up = -0.02 * ss((1.79 - p[1]) / 0.04);
    } else if (kind === 'band') { const y = p[1] - (hj[1] + 0.085); t = Math.abs(y) < 0.012 && d > -0.03 ? 0.011 : 0; }
    th[i] = t;
    A[i] = kind === 'hair' ? 0.5 + (d - (style === 'buzz' || style === 'fade' || style === 'braids' || style === 'cornrows' ? 0.002 : 0.004)) / 0.008 : kind === 'band' ? (t > 0 ? 1 : 0) : (hb[i] / 4 >= 0.45 ? 1 : 0);
    P[i * 3] = p[0] + nx * (t + out) - hj[0]; P[i * 3 + 1] = p[1] + ny * t + up - hj[1]; P[i * 3 + 2] = p[2] + nz * (t + out) - hj[2];
    const j = 0.88 + 0.2 * rnd1(); C[i * 3] = cl.r * j; C[i * 3 + 1] = cl.g * j; C[i * 3 + 2] = cl.b * j;
    if ((style === 'braids' || style === 'cornrows') && kind === 'hair') { const s = Math.abs(Math.sin(p[0] * 190)); const f = 0.55 + 0.45 * s; C[i * 3] *= f; C[i * 3 + 1] *= f; C[i * 3 + 2] *= f; P[i * 3] += nx * 0.002 * s; P[i * 3 + 1] += ny * 0.002 * s; P[i * 3 + 2] += nz * 0.002 * s; }
  }
  const idx = [];
  for (let f = 0; f < H.nhairF; f++) {
    const a = hf[f * 4], b2 = hf[f * 4 + 1], c = hf[f * 4 + 2], d = hf[f * 4 + 3];
    if (Math.max(A[a], A[b2], A[c], A[d]) < 0.5 || th[a] + th[b2] + th[c] + th[d] <= 0) continue;
    idx.push(a, b2, c, a, c, d);
  }
  if (!idx.length) return null;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('ha', new T.BufferAttribute(A, 1)); g.setIndex(idx); g.computeVertexNormals();
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'band' ? 0.7 : 0.88, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ha; varying float vHa;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHa = ha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHa;').replace('#include <color_fragment>', '#include <color_fragment>\nif (vHa < 0.5) discard; diffuseColor.rgb *= 0.8 + 0.2 * clamp((vHa - 0.5) * 2.0, 0.0, 1.0);');
  };
  mat.customProgramCacheKey = () => 'hdhair1';
  const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
const BODY_RIG = ['body', 'torso', 'head', 'armL', 'elbL', 'armR', 'elbR', 'legL', 'kneeL', 'legR', 'kneeR'];
function buildAthlete(o) {
  if (!bodyInit()) return null;
  const vn = bodyVariant(o), V = BODY.H.var[vn], J = V.J;
  const root = new T.Group(), body = new T.Group(), torso = new T.Group(), head = new T.Group();
  root.add(body);
  const sub = (a, b2) => new T.Vector3(a[0] - (b2 ? b2[0] : 0), a[1] - (b2 ? b2[1] : 0), a[2] - (b2 ? b2[2] : 0));
  torso.position.copy(sub(J.torso)); body.add(torso);
  head.position.copy(sub(J.head, J.torso)); torso.add(head);
  const arm = s => { const sh = new T.Group(), el = new T.Group(); sh.position.copy(sub(J['arm' + s], J.torso)); torso.add(sh); el.position.copy(sub(J['elb' + s], J['arm' + s])); sh.add(el); return [sh, el]; };
  const leg = s => { const hp = new T.Group(), kn = new T.Group(); hp.position.copy(sub(J['leg' + s])); body.add(hp); kn.position.copy(sub(J['knee' + s], J['leg' + s])); hp.add(kn); return [hp, kn]; };
  const [armL, elbL] = arm('L'), [armR, elbR] = arm('R'), [legL, kneeL] = leg('L'), [legR, kneeR] = leg('R');
  const R = { root, body, torso, head, armL, armR, elbL, elbR, legL, legR, kneeL, kneeR };
  root.updateMatrixWorld(true);
  const mat = bodyMaterial(o, vn, J);
  const mesh = new T.SkinnedMesh(bodyGeo(vn), mat);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const ex = (o.extra || '').split(' '), has = k => ex.includes(k), hr = o.hair || 'short';
  let seed = 7; for (const ch of String(o.short || '') + (o.num === undefined ? '' : o.num) + o.hgt) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  let rs = seed || 3; const rr = () => (rs = (rs * 16807) % 2147483647) / 2147483647 * 2 - 1;
  const mi = Array.from({ length: BODY.H.nM }, (_, k) => rr() * (k === 7 ? 0.35 : k === 6 ? 0.55 : 0.75));
  mesh.morphTargetInfluences = mi;
  root.add(mesh);
  const skel = new T.Skeleton(BODY_RIG.map(k => R[k]));
  mesh.bind(skel, mesh.matrixWorld);
  // head centre group for hats, braids and other props sized for the old head sphere
  const hc = new T.Group(); hc.position.set(0, 0.065, 0.015); hc.scale.set(0.86, 0.98, 0.98); head.add(hc);
  const hairC = o.hairC === undefined ? 0x1c1410 : o.hairC;
  if (hr !== 'bald') { const h = bodyShell(vn, J, 'hair', hr, hairC, seed, mi); if (h) head.add(h); }
  if (has('beard') || has('bigbeard') || has('graybeard')) { const h = bodyShell(vn, J, 'beard', has('bigbeard') ? 'bigbeard' : 'beard', has('graybeard') ? 0xcfcfcf : hairC, seed + 1, mi); if (h) head.add(h); }
  if (has('band')) { const h = bodyShell(vn, J, 'band', 'band', o.bandC || 0xf4f4f6, seed + 2, mi); if (h) head.add(h); }
  // long styles keep a few props hanging from the head centre
  const prop = [];
  if (hr === 'long') prop.push({ geo: cylG(0.1, 0.085, 0.16, 10), c: hairC, m: mx(0, -0.07, -0.05, 1, 1, 0.8) });
  else if (hr === 'braids') for (let i = -2; i <= 2; i++) prop.push({ geo: cylG(0.011, 0.009, 0.2, 5), c: hairC, m: mx(i * 0.036, -0.09, -0.088, 1, 1, 1, 0.1, 0, 0) });
  else if (hr === 'dreads') for (let i = -3; i <= 3; i++) prop.push({ geo: cylG(0.017, 0.014, 0.27, 6), c: hairC, m: mx(i * 0.03, -0.1, -0.08 - (3 - Math.abs(i)) * 0.004, 1, 1, 1, 0.12, 0, i * 0.06) });
  else if (hr === 'manbun') prop.push({ geo: GEO.sph, c: hairC, m: mx(0, 0.125, -0.05, 0.05, 0.05, 0.05) });
  if (prop.length) { const pm = new T.Mesh(bake(prop), bodyMat); pm.castShadow = true; hc.add(pm); }
  root.scale.setScalar(o.hgt / 1.98);
  return Object.assign(R, { headC: hc, skin: mesh, mat });
}
