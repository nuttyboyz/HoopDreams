"""Load the MakeHuman (CC0) base mesh, apply macro targets, compute joints and weights."""
import json, os, numpy as np
D = os.path.join(os.path.dirname(__file__), '..', 'mh', 'makehuman', 'data')

def load_obj(p):
    V, VT, F, FT, G = [], [], [], [], []
    g = None
    for ln in open(p):
        if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('vt '): VT.append([float(x) for x in ln.split()[1:3]])
        elif ln.startswith('g '): g = ln.split()[1]
        elif ln.startswith('f '):
            a = [x.split('/') for x in ln.split()[1:]]
            F.append([int(x[0]) - 1 for x in a]); FT.append([int(x[1]) - 1 if len(x) > 1 and x[1] else -1 for x in a]); G.append(g)
    return np.array(V), np.array(VT) if VT else None, F, FT, G

BASE = load_obj(os.path.join(D, '3dobjs', 'base.obj'))
_tcache = {}
def target(rel):
    if rel in _tcache: return _tcache[rel]
    idx, d = [], []
    for ln in open(os.path.join(D, 'targets', rel)):
        if ln[0] in '#\n': continue
        s = ln.split(); idx.append(int(s[0])); d.append([float(x) for x in s[1:4]])
    _tcache[rel] = (np.array(idx, dtype=int), np.array(d).reshape(-1, 3)); return _tcache[rel]

def tri(v, names):
    """value 0..1 -> weights for (min, average, max) like MakeHuman"""
    if v < 0.5: return {names[0]: 1 - 2 * v, names[1]: 2 * v}
    return {names[1]: 2 - 2 * v, names[2]: 2 * v - 1}

def human(muscle=0.75, weight=0.45, height=0.9, prop=1.0, race=None, extra=None):
    """male, young. race: dict african/asian/caucasian -> weight (sum 1)."""
    V = BASE[0].copy()
    race = race or {'caucasian': 1}
    mw = tri(muscle, ['minmuscle', 'averagemuscle', 'maxmuscle'])
    ww = tri(weight, ['minweight', 'averageweight', 'maxweight'])
    def add(rel, w):
        if w <= 1e-4: return
        i, d = target(rel); V[i] += d * w
    for m, a in mw.items():
        for wn, b in ww.items():
            add('macrodetails/universal-male-young-%s-%s.target' % (m, wn), a * b)
            if height > 0.5: add('macrodetails/height/male-young-%s-%s-maxheight.target' % (m, wn), a * b * (height - 0.5) * 2)
            else: add('macrodetails/height/male-young-%s-%s-minheight.target' % (m, wn), a * b * (0.5 - height) * 2)
            add('macrodetails/proportions/male-young-%s-%s-idealproportions.target' % (m, wn), a * b * prop)
    for r, w in race.items(): add('macrodetails/%s-male-young.target' % r, w)
    for rel, w in (extra or {}).items(): add(rel, w)
    return V

SKEL = json.load(open(os.path.join(D, 'rigs', 'default.mhskel')))
def joint(V, name):
    return V[SKEL['joints'][name]].mean(0)
def bone_head(V, b): return joint(V, SKEL['bones'][b]['head'])
def bone_tail(V, b): return joint(V, SKEL['bones'][b]['tail'])

def weights():
    W = json.load(open(os.path.join(D, 'rigs', 'default_weights.mhw')))['weights']
    return W  # bone -> [[vi, w], ...]

def mhclo(p):
    refs = []; on = False
    for ln in open(p):
        if ln.startswith('verts'): on = True; continue
        if on and ln.strip() and ln[0].isdigit():
            s = ln.split()
            if len(s) == 1: refs.append(([int(s[0])], [1.0], [0, 0, 0]))
            else: refs.append(([int(x) for x in s[:3]], [float(x) for x in s[3:6]], [float(x) for x in s[6:9]]))
    return refs

def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b))
    if c < -0.9999: return -np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)

def rotx(a):
    c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

_W = None
def repose(V, targets, nverts):
    """targets: bone -> desired world direction of (tail - head) [or callable(Rpar, h, t) -> R].
    Linear-blend repose using the MakeHuman skeleton/weights. Returns new V (first nverts)."""
    global _W
    if _W is None: _W = weights()
    bones = SKEL['bones']; order = []
    def visit(b):
        for c, bd in bones.items():
            if bd['parent'] == b: order.append(c); visit(c)
    visit(None)
    M = {}  # bone -> (R, tvec): x' = R x + t
    for b in order:
        p = bones[b]['parent']
        Rp, tp = M[p] if p else (np.eye(3), np.zeros(3))
        if b in targets:
            h, t = bone_head(V, b), bone_tail(V, b)
            spec = targets[b]
            if isinstance(spec, tuple): t = bone_head(V, spec[0]); spec = spec[1]
            if callable(spec): R = spec(Rp, h, t)
            else: R = rot_between(Rp @ (t - h), np.array(spec)) @ Rp
            hn = Rp @ h + tp
            M[b] = (R, hn - R @ h)
        else: M[b] = (Rp, tp)
    out = np.zeros((nverts, 3)); ws = np.zeros(nverts)
    for b, lst in _W.items():
        if b not in M: continue
        R, t = M[b]
        a = np.array(lst); idx = a[:, 0].astype(int); w = a[:, 1]
        m = idx < nverts; idx, w = idx[m], w[m]
        out[idx] += w[:, None] * (V[idx] @ R.T + t); ws[idx] += w
    miss = ws < 1e-6
    out[~miss] /= ws[~miss, None]; out[miss] = V[:nverts][miss]
    return out, M
