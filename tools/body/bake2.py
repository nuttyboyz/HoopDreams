"""Bake Hoop Dreams athlete bodies from the MakeHuman CC0 base mesh.
Output: ../../../../ (src) c_bodydata.js with a base64 pack + header."""
import sys, json, base64, struct, numpy as np
sys.path.insert(0, '.')
from mhlib import *
from bake import build, NB, EYE, EF, BASE

V0, VT, F, FT, G = BASE
RIG = ['body', 'torso', 'head', 'armL', 'elbL', 'armR', 'elbR', 'legL', 'kneeL', 'legR', 'kneeR']
RI = {n: i for i, n in enumerate(RIG)}

# ---------- MakeHuman bone -> rig bone(s) ----------
def rigmap(b):
    side = None
    if b.endswith('.L'): side = 'R'   # MakeHuman .L sits at +x, the game's armR/legR sit at +x
    if b.endswith('.R'): side = 'L'
    n = b.split('.')[0]
    if n in ('root', 'pelvis'): return {'body': 1}
    if n.startswith('spine') or n in ('breast', 'clavicle', 'neck01'): return {'torso': 1}
    if n == 'shoulder01': return {'torso': 0.35, 'arm' + side: 0.65}
    if n == 'neck02': return {'torso': 0.5, 'head': 0.5}
    if n.startswith('upperarm'): return {'arm' + side: 1}
    if n.startswith(('lowerarm', 'wrist', 'metacarpal', 'finger')): return {'elb' + side: 1}
    if n.startswith('upperleg'): return {'leg' + side: 1}
    if n.startswith(('lowerleg', 'foot', 'toe')): return {'knee' + side: 1}
    return {'head': 1}

MHW = weights()
NV = len(V0)
RW = np.zeros((NV, len(RIG)))
for b, lst in MHW.items():
    a = np.array(lst); idx = a[:, 0].astype(int); w = a[:, 1]
    for rb, f in rigmap(b).items(): np.add.at(RW[:, RI[rb]], idx, w * f)
RW /= np.maximum(RW.sum(1, keepdims=True), 1e-9)
DOM = RW.argmax(1)

# ---------- topology ----------
BF = np.array([f for f, g in zip(F, G) if g == 'body'])        # quads
nbr = [set() for _ in range(NB)]
for q in BF:
    for i in range(4): nbr[q[i]].add(q[(i + 1) % 4]); nbr[q[(i + 1) % 4]].add(q[i])
nbr = [np.array(sorted(n)) for n in nbr]

def finger_curl(H):
    tg = {}
    for s in 'LR':
        sx = 1 if s == 'L' else -1
        tg['upperarm01.' + s] = ('lowerarm01.' + s, [sx * 0.07, -1, -0.02])
        tg['lowerarm01.' + s] = ('wrist.' + s, [sx * 0.02, -1, 0.04])
        tg['upperleg01.' + s] = ('lowerleg01.' + s, [sx * 0.03, -1, 0.0])
        tg['lowerleg01.' + s] = ('foot.' + s, [0, -1, -0.03])
        lat = bone_head(H, 'finger5-1.' + s) - bone_head(H, 'finger2-1.' + s); lat /= np.linalg.norm(lat)
        for fi, ang in ((2, (0.25, 0.45, 0.35)), (3, (0.3, 0.5, 0.35)), (4, (0.35, 0.55, 0.4)), (5, (0.4, 0.6, 0.4))):
            for k in range(3):
                def spec(Rp, h, t, a=ang[k], lat=lat, sx=sx):
                    ax = Rp @ lat * sx
                    c, s_ = np.cos(a), np.sin(a); K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
                    return (np.eye(3) + s_ * K + (1 - c) * K @ K) @ Rp
                tg['finger%d-%d.%s' % (fi, k + 1, s)] = spec
    return tg

def make(muscle, weight, race, extra=None, curl_sign=1):
    ex = {'torso/torso-vshape-incr.target': 0.55, 'torso/torso-muscle-dorsi-incr.target': 0.5, 'torso/torso-muscle-pectoral-incr.target': 0.35}
    for s_ in 'lr':
        ex['armslegs/%s-upperarm-muscle-incr.target' % s_] = 0.55; ex['armslegs/%s-upperarm-shoulder-muscle-incr.target' % s_] = 0.6
        ex['armslegs/%s-lowerarm-muscle-incr.target' % s_] = 0.45; ex['armslegs/%s-upperleg-muscle-incr.target' % s_] = 0.35; ex['armslegs/%s-lowerleg-muscle-incr.target' % s_] = 0.45
    for k_, v_ in (extra or {}).items(): ex[k_] = v_
    H = human(muscle, weight, 0.9, 1.0, race, ex)
    tg = finger_curl(H)
    P, M = repose(H, tg, len(H))
    B = P[:NB]; y0, y1 = B[:, 1].min(), B[:, 1].max(); s = 1.98 / (y1 - y0)
    hipz = (bone_head(P, 'upperleg01.L')[2] + bone_head(P, 'upperleg01.R')[2]) / 2
    off = np.array([0, -y0, -hipz])
    X = (P + off) * s
    J = lambda b: (bone_head(P, b) + off) * s
    joints = {
        'torso': (J('upperleg01.L') + J('upperleg01.R')) / 2 * [0, 1, 0],
        'head': J('head'),
        'armL': J('upperarm01.R'), 'armR': J('upperarm01.L'),
        'elbL': J('lowerarm01.R'), 'elbR': J('lowerarm01.L'),
        'legL': J('upperleg01.R'), 'legR': J('upperleg01.L'),
        'kneeL': J('lowerleg01.R'), 'kneeR': J('lowerleg01.L'),
        'wristL': J('wrist.R'), 'wristR': J('wrist.L'),
        'headTop': J('head') * [1, 0, 1] + [0, X[:NB, 1].max(), 0],
    }
    return X, joints

# ---------- reference body for regions ----------
X, JR = make(0.9, 0.5, {'african': 1})
hipY = JR['legL'][1]; kneeY = JR['kneeL'][1]
waistY = hipY + 0.085; hemY = kneeY + 0.075; shoeY = 0.135; sockY = 0.30
shY = JR['armL'][1]
cen = X[BF].mean(1)                     # face centroids
fdom = np.array([np.bincount(DOM[q], minlength=11).argmax() for q in BF])
# vertex normals (reference)
def vnormals(X):
    n = np.zeros((NB, 3))
    for q in BF:
        a, b, c, d = X[q]
        fn = np.cross(c - a, d - b); n[q] += fn
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
NR = vnormals(X)

ARM = {RI['armL'], RI['elbL'], RI['armR'], RI['elbR']}
LEGS = {RI['legL'], RI['legR'], RI['kneeL'], RI['kneeR']}
KNEES = {RI['kneeL'], RI['kneeR']}
REG = np.zeros(len(BF), int)   # 0 skin
SKIN, JER, JTRIM, SHO, STRIM, SOCK, SHOE, SOLE, SACC, SLEEVE, EYE_R = range(11)
x, y, z = cen[:, 0], cen[:, 1], cen[:, 2]
ax_ = np.abs(x)
isArm = np.isin(fdom, list(ARM)); isHead = fdom == RI['head']
# shoes / socks
foot = np.isin(fdom, list(KNEES))
REG[foot & (y < shoeY + 0.03)] = SHOE
# shorts
sh = (~isArm) & (~isHead) & (y < waistY + 0.03) & (y > hemY) & (fdom != RI['torso']) | ((fdom == RI['torso']) & (y < waistY + 0.03) & ~isArm)
sh &= (y > hemY - 0.06)
REG[sh] = SHO
# jersey (tank top)
tor = np.isin(fdom, [RI['torso'], RI['body']]) & ~isArm & (y >= waistY - 0.07)
front = z > 0.0
neck_y = np.where(front, 1.612 + 11.0 * x ** 2, 1.66 + 6.0 * x ** 2)
neckcut = (y > neck_y + 0.03) & (ax_ < 0.13)
arm_y = 1.43 + 2.2 * np.maximum(0, 0.205 - ax_)
armcut = (ax_ > 0.167) & (y > arm_y + 0.025)
jer = tor & ~neckcut & ~armcut & (y < 1.76)
REG[jer & (REG != SHO)] = JER
REG[jer & (y < waistY + 0.03) & (REG == SHO)] = SHO
# sleeve zone: right arm (game armR, +x) from below the armpit to the wrist
REG[np.isin(fdom, [RI['armR'], RI['elbR']]) & (y < shY - 0.12) & (y > JR['wristR'][1] + 0.03)] = SLEEVE

# face adjacency for trims
from collections import defaultdict
e2f = defaultdict(list)
for fi, q in enumerate(BF):
    for i in range(4): e2f[tuple(sorted((q[i], q[(i + 1) % 4])))].append(fi)
fadj = [[] for _ in BF]
for fs in e2f.values():
    for a in fs:
        for b in fs:
            if a != b: fadj[a].append(b)
def ring(mask_from, within, n):
    """faces of `within` that are within n rings of a face not in `within`"""
    d = np.full(len(BF), 99); fr = [i for i in range(len(BF)) if within[i] and any(not within[j] for j in fadj[i])]
    for i in fr: d[i] = 0
    cur = fr
    for k in range(1, n):
        nx = []
        for i in cur:
            for j in fadj[i]:
                if within[j] and d[j] > k: d[j] = k; nx.append(j)
        cur = nx
    return (d < n) & mask_from
jerset = (REG == JER)
shoset = REG == SHO
# side stripes on shorts: outer side of each thigh
nf = NR[BF].mean(1)
shoe = REG == SHOE
REG[shoe & (y < 0.03)] = SOLE
REG[shoe & (y >= 0.045) & (y < 0.085) & (np.abs(nf[:, 0]) > 0.75) & (z < 0.12) & (z > -0.04)] = SACC

# ---------- per-vertex fx: ao, lips, brows, beard zone ----------
def cavity(Xv):
    c = np.zeros(NB)
    P = Xv[:NB]
    for sc in range(3):
        avg = np.array([P[n].mean(0) for n in nbr])
        c += np.einsum('ij,ij->i', avg - P, NR) * (40.0 / (sc + 1))
        P = avg
    return c
cav = cavity(X)
ao = np.clip(1 - np.maximum(cav, 0) * 6.0, 0.35, 1)
V = X[:NB]
lx, ly, lz = V[:, 0], V[:, 1], V[:, 2]
front = lz > 0.12
lips = np.clip(1.25 - ((lx / 0.025) ** 2 + ((ly - 1.8055) / 0.0105) ** 2) * 1.25, 0, 1) * (lz > 0.148)
brow = np.zeros(NB)
for sx in (-1, 1):
    bx = (np.abs(lx) - 0.034) / 0.023; byc = 1.893 + 0.006 * (1 - bx ** 2) - 0.004 * bx
    brow = np.maximum(brow, np.clip(1.3 - (bx ** 2 + ((ly - byc) / 0.0055) ** 2), 0, 1) * (lz > 0.13) * (np.abs(lx) > 0.008))
ear_front = lz > 0.045
bz = np.zeros(NB)
headv = DOM[:NB] == RI['head']
jaw = headv & ear_front & (ly < 1.845 - 0.25 * np.maximum(0, 0.06 - np.abs(lx))) & (ly > 1.715) & (lips < 0.3)
bz[jaw] = 0.5
bz[headv & (np.abs(lx) < 0.032) & (ly < 1.797) & (ly > 1.735) & (lz > 0.11) & (lips < 0.3)] = 0.75
bz[headv & (np.abs(lx) < 0.03) & (ly > 1.812) & (ly < 1.83) & (lz > 0.15) & (lips < 0.5)] = 1.0
# hair depth (m above the hairline), head vertices only
hc = np.array([0, 1.9, 0.035])
th = np.arctan2(lx, lz - hc[2])
a = np.abs(th)
hl = np.interp(a, [0, 0.6, 1.05, 1.5, 1.9, 2.4, np.pi], [1.94, 1.935, 1.905, 1.893, 1.875, 1.845, 1.83])
hd = np.where(headv, ly - hl, -0.2)

# ---------- eyes ----------
E_IDX = [r[0][0] for r in EYE]
eyeF = np.array([[f[0], f[1], f[2]] for f in EF] + [[f[0], f[2], f[3]] for f in EF if len(f) == 4])

# ---------- assemble the mesh: body (by region) + shells + eyes ----------
OUT_V = []      # (orig vertex, kind) kind 0 body, 1 jersey shell, 2 shorts shell, 3 shoe shell, 4 eye
OUT_R = []      # region per out vertex
key = {}
def vid(v, kind, reg):
    k = (v, kind, reg)
    if k not in key: key[k] = len(OUT_V); OUT_V.append((v, kind)); OUT_R.append(reg)
    return key[k]
tris = []
# hide skin under clothes, keeping a border of skin under the garment edges
covered = np.isin(REG, [JER, SHO, STRIM, SHOE, SOLE, SACC])
keep_edge = ring(covered, covered, 5)
for fi, q in enumerate(BF):
    r = REG[fi]
    if r in (SHOE, SOLE, SACC):
        body_r = None if not keep_edge[fi] or y[fi] < 0.09 else SKIN
    elif r in (JER, SHO, STRIM): body_r = SKIN if keep_edge[fi] else None
    elif r == JTRIM: body_r = SKIN
    else: body_r = r
    if body_r is not None:
        ids = [vid(v, 0, body_r) for v in q]
        tris += [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]]
SHELL = {JER: 1, JTRIM: 1, SHO: 2, STRIM: 2, SHOE: 3, SOLE: 3, SACC: 3}
for fi, q in enumerate(BF):
    r = REG[fi]
    if r in SHELL:
        ids = [vid(v, SHELL[r], r) for v in q]
        tris += [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]]
# tuck the jersey into the shorts: the jersey shell continues under the waistband
tuck = (REG == SHO) & np.isin(fdom, [RI['torso'], RI['body']]) & (y >= waistY - 0.06) & ~isArm
for fi in np.where(tuck)[0]:
    q = BF[fi]; ids = [vid(v, 1, JER) for v in q]
    tris += [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]]
for t in eyeF:
    tris.append([vid(E_IDX[i], 4, EYE_R) for i in t])
OUT_V = np.array(OUT_V); OUT_R = np.array(OUT_R, np.uint8); tris = np.array(tris, np.uint32)
print('verts', len(OUT_V), 'tris', len(tris))

# shell vertex sets for smoothing
def shell_pos(Xv, NRv, kind, J):
    """positions for every out vertex"""
    P = np.zeros((len(OUT_V), 3))
    for k in range(5):
        m = OUT_V[:, 1] == k
        P[m] = Xv[OUT_V[m, 0]]
    # offsets per shell kind on the original vertex ids
    for kind, smooth in ((1, 3), (2, 10), (3, 8)):
        m = np.where(OUT_V[:, 1] == kind)[0]
        vs = np.unique(OUT_V[m, 0])
        loc = {v: i for i, v in enumerate(vs)}
        Q = Xv[vs].copy(); n = NRv[vs]
        yy = Q[:, 1]
        if kind == 1:
            off = 0.007 + 0.016 * np.clip((1.40 - yy) / 0.22, 0, 1) + 0.004 * np.clip((yy - 1.5) / 0.1, 0, 1)
            off = np.where(yy < waistY + 0.06, off + (0.006 - off) * np.clip((waistY + 0.06 - yy) / 0.06, 0, 1), off)
            Q += n * off[:, None]
        elif kind == 2:
            Q += n * (0.016 + 0.006 * np.clip((yy - waistY + 0.1) / 0.05, 0, 1) + 0.012 * np.clip(1 - np.abs(Q[:, 0]) / 0.07, 0, 1) * np.clip((J['legL'][1] + 0.02 - yy) / 0.08, 0, 1) * (Q[:, 2] > -0.02))[:, None]
            crotch = J['legL'][1] - 0.07
            for leg in ('L', 'R'):
                hj, kj = J['leg' + leg], J['knee' + leg]
                sel = (np.sign(Q[:, 0]) == np.sign(hj[0])) & (yy < crotch + 0.04)
                ax = (kj - hj) / np.linalg.norm(kj - hj)
                rel = Q[sel] - hj; along = rel @ ax; radial = rel - along[:, None] * ax
                rn = radial / np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-6)
                fl = 0.016 + 0.042 * np.clip((crotch + 0.04 - yy[sel]) / (crotch + 0.04 - hemY), 0, 1)
                Q[sel] += rn * fl[:, None]
        else:
            Q += n * 0.016
        # Laplacian smoothing inside the shell (only between shell vertices)
        nb = [[loc[w] for w in nbr[v] if w in loc] for v in vs]
        if kind == 3:   # Taubin smoothing: removes the toes without shrinking the shoe
            for it in range(24):
                for lam in (0.6, -0.63):
                    avg = np.array([Q[l].mean(0) if l else Q[i] for i, l in enumerate(nb)])
                    Q = Q + lam * (avg - Q)
            smooth = 0
        for it in range(smooth):
            for lam in (0.55, -0.58):
                avg = np.array([Q[l].mean(0) if l else Q[i] for i, l in enumerate(nb)])
                Q = Q + lam * (avg - Q)
        if kind == 2:   # bridge the crotch: flatten the front and back panels between the legs
            crotch = J['legL'][1] - 0.04
            band = np.round(Q[:, 1] / 0.01)
            for bnd in np.unique(band):
                sel = band == bnd
                if Q[sel, 1].mean() > crotch + 0.07: continue
                zf, zb = Q[sel, 2].max(), Q[sel, 2].min()
                w = np.clip(1 - np.abs(Q[sel, 0]) / 0.1, 0, 1) ** 0.7 * np.clip((crotch + 0.07 - Q[sel, 1]) / 0.06, 0, 1)
                zz = Q[sel, 2]
                Q[sel, 2] = np.where(zz > 0.0, zz + (zf - 0.012 - zz).clip(0) * w, zz - (zz - zb - 0.015).clip(0) * w)
        if kind == 3:
            # flat sole, a little longer and wider than the foot
            for leg in ('L', 'R'):
                sel = np.sign(Q[:, 0]) == np.sign(J['leg' + leg][0])
                cx = Q[sel, 0].mean(); cz = Q[sel, 2].mean()
                Q[sel, 0] = cx + (Q[sel, 0] - cx) * 1.06; Q[sel, 2] = cz + (Q[sel, 2] - cz) * 1.07 + 0.006
            Q[:, 1] = np.where(Q[:, 1] < 0.035, Q[:, 1] * 0.25, Q[:, 1])
            Q[:, 1] = np.maximum(Q[:, 1], 0.0)
        if kind == 2:
            pass
        idx = np.array([loc[v] for v in OUT_V[m, 0]])
        P[m] = Q[idx]
    return P

def full_normals(Xv):
    n = np.zeros((len(Xv), 3))
    for q in BF:
        a, b, c, d = Xv[q]
        n[q] += np.cross(c - a, d - b)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)

# rig weights per out vertex (top 4)
W = RW[OUT_V[:, 0]]
order = np.argsort(-W, 1)[:, :4]
SI = order.astype(np.uint8)
SW = np.take_along_axis(W, order, 1); SW /= SW.sum(1, keepdims=True)
SWq = np.round(SW * 255).astype(int); SWq[:, 0] += 255 - SWq.sum(1); SWq = SWq.astype(np.uint8)
# fx per out vertex
FX = np.zeros((len(OUT_V), 4))
bm = OUT_V[:, 1] == 0
ov = OUT_V[bm, 0]
FX[bm, 0] = ao[ov]; FX[bm, 1] = lips[ov]; FX[bm, 2] = brow[ov]; FX[bm, 3] = bz[ov]
FX[~bm, 0] = 1
# eyes: local xy of each eye vertex around its eye centre (computed per variant in JS is not needed: fixed)
em = OUT_V[:, 1] == 4
FXq = np.clip(np.round(FX * 255), 0, 255).astype(np.uint8)
WELD = np.array([v * 8 + k for v, k in OUT_V])
_, WELDI = np.unique(WELD, return_inverse=True)

VARIANTS = [
    ('G-a', 0.85, 0.36, {'african': 1}), ('W-a', 0.95, 0.5, {'african': 1}), ('B-a', 1.0, 0.68, {'african': 1}),
    ('G-c', 0.85, 0.36, {'caucasian': 1}), ('W-c', 0.95, 0.5, {'caucasian': 1}), ('B-c', 1.0, 0.68, {'caucasian': 1}),
]
blobs = []; header = {'n': int(len(OUT_V)), 't': int(len(tris)), 'rig': RIG, 'var': {}}
def add(arr):
    b = arr.tobytes(); off = sum(len(x) for x in blobs)
    pad = (-off) % 4
    if pad: blobs.append(b'\0' * pad); off += pad
    blobs.append(b); return off
header['idx'] = add(tris.astype(np.uint16 if len(OUT_V) < 65536 else np.uint32).ravel())
header['si'] = add(SI.ravel()); header['sw'] = add(SWq.ravel()); header['rg'] = add(OUT_R); header['fx'] = add(FXq.ravel())
header['weld'] = add(WELDI.astype(np.uint16)); header['nweld'] = int(WELDI.max() + 1)
# hair / beard source: body out-vertices of kind 0 on the head, with hair depth
headF = [fi for fi, q in enumerate(BF) if fdom[fi] == RI['head']]
hv = sorted({v for fi in headF for v in BF[fi]})
hvl = {v: i for i, v in enumerate(hv)}
header['hairV'] = add(np.array(hv, np.uint16)); header['nhair'] = len(hv)
header['hairF'] = add(np.array([[hvl[v] for v in BF[fi]] for fi in headF], np.uint16).ravel()); header['nhairF'] = len(headF)
header['hairD'] = add(np.clip(np.round(hd[hv] * 1000), -127, 127).astype(np.int8))
header['reg'] = {'waist': float(waistY), 'hem': float(hemY), 'shoe': shoeY, 'sock': sockY}
header['hairB'] = add(np.round(bz[hv] * 4).astype(np.uint8))
for name, mu, we, race in VARIANTS:
    Xv, Jv = make(mu, we, race)
    NRv = full_normals(Xv)
    P = shell_pos(Xv, NRv, None, Jv)
    # eye local coords
    lo = P.min(0); sc = (P.max(0) - lo)
    q = np.round((P - lo) / sc * 65535).astype(np.uint16)
    hp = np.round((Xv[hv] - lo) / sc * 65535).astype(np.uint16)
    hn = np.round(NRv[hv] * 127).astype(np.int8)
    header['var'][name] = {'pos': add(q.ravel()), 'lo': lo.round(5).tolist(), 'sc': sc.round(5).tolist(),
                           'hp': add(hp.ravel()), 'hn': add(hn.ravel()),
                           'J': {k: np.round(v, 4).tolist() for k, v in Jv.items()},
                           'eye': [np.round(Xv[[r[0][0] for r in EYE[:48]]].mean(0), 4).tolist(), np.round(Xv[[r[0][0] for r in EYE[48:]]].mean(0), 4).tolist()]}
    print(name, {k: np.round(v, 3).tolist() for k, v in Jv.items() if k in ('head', 'armR', 'legR', 'kneeR', 'headTop')})
data = b''.join(blobs)
print('bytes', len(data))
open('body.bin', 'wb').write(data)
json.dump(header, open('body.json', 'w'))

# ---------- face morphs (per-player variety), deltas on head + eye vertices, in rig units ----------
MORPHS = [
    {'nose/nose-scale-horiz-incr': 1, 'nose/nose-scale-horiz-decr': -1, 'nose/nose-flaring-incr': 0.6, 'nose/nose-flaring-decr': -0.6},
    {'nose/nose-hump-incr': 0.7, 'nose/nose-hump-decr': -0.7, 'nose/nose-scale-vert-incr': 0.6, 'nose/nose-scale-vert-decr': -0.6},
    {'mouth/mouth-upperlip-volume-incr': 1, 'mouth/mouth-upperlip-volume-decr': -1, 'mouth/mouth-lowerlip-volume-incr': 1, 'mouth/mouth-lowerlip-volume-decr': -1},
    {'chin/chin-width-incr': 1, 'chin/chin-width-decr': -1, 'chin/chin-bones-incr': 0.8, 'chin/chin-bones-decr': -0.8},
    {'chin/chin-prominent-incr': 1, 'chin/chin-prominent-decr': -1, 'chin/chin-height-incr': 0.6, 'chin/chin-height-decr': -0.6},
    {'cheek/l-cheek-bones-incr': 1, 'cheek/l-cheek-bones-decr': -1, 'cheek/r-cheek-bones-incr': 1, 'cheek/r-cheek-bones-decr': -1},
    {'head/head-scale-horiz-incr': 0.7, 'head/head-scale-horiz-decr': -0.7, 'head/head-fat-incr': 0.4, 'head/head-fat-decr': -0.4},
    {'mouth/mouth-scale-horiz-incr': 1, 'mouth/mouth-scale-horiz-decr': -1, 'forehead/forehead-nubian-incr': 0.5, 'forehead/forehead-nubian-decr': -0.5},
]
Hs = human(0.95, 0.5, 0.9, 1.0, {'african': 1})
s_ref = 1.98 / (Hs[:NB, 1].max() - Hs[:NB, 1].min())
U = list(hv) + sorted(set(E_IDX))
Ul = {v: i for i, v in enumerate(U)}
Ua = np.array(U)
md = []
for M_ in MORPHS:
    d = np.zeros((NV, 3))
    for rel, w in M_.items():
        if not os.path.exists(os.path.join(D, 'targets', rel + '.target')): print('missing', rel); continue
        i, dd = target(rel + '.target'); d[i] += dd * w
    md.append(d[Ua] * s_ref)
md = np.array(md)                           # K x |U| x 3
msc = np.abs(md).reshape(len(MORPHS), -1).max(1) + 1e-9
mq = np.clip(np.round(md / msc[:, None, None] * 127), -127, 127).astype(np.int8)
mapU = np.array([Ul.get(v, -1) if k in (0, 4) else -1 for v, k in OUT_V], np.int16)
blobs2 = blobs
header['mU'] = add(mapU); header['nU'] = len(U); header['mD'] = add(mq.ravel()); header['mS'] = msc.round(6).tolist(); header['nM'] = len(MORPHS)
print('morph max (m)', msc.round(4))
data = b''.join(blobs)
open('body.bin', 'wb').write(data)
json.dump(header, open('body.json', 'w'))
print('bytes', len(data))
