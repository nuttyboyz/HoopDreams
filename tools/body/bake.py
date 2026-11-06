import sys, json, numpy as np
sys.path.insert(0, '.')
from mhlib import *

NB = 13380  # body vertices (helpers follow)
V0, VT, F, FT, G = BASE
EYE = mhclo(os.path.join(D, 'eyes', 'low-poly', 'low-poly.mhclo'))
EV, EVT, EF, EFT, _ = load_obj(os.path.join(D, 'eyes', 'low-poly', 'low-poly.obj'))

def build(muscle, weight, height, race, extra=None):
    H = human(muscle, weight, height, 1.0, race, extra)
    DOWN = [0, -1, 0]
    tg = {}
    for s in 'LR':
        sx = 1 if s == 'L' else -1
        tg['upperarm01.' + s] = ('lowerarm01.' + s, [sx * 0.07, -1, -0.02])
        tg['lowerarm01.' + s] = ('wrist.' + s, [sx * 0.02, -1, 0.04])
        tg['upperleg01.' + s] = ('lowerleg01.' + s, [sx * 0.03, -1, 0.0])
        tg['lowerleg01.' + s] = ('foot.' + s, [0, -1, -0.03])
    nall = len(H)
    P, M = repose(H, tg, nall)
    return H, P

def bodyfaces():
    tris, uvt = [], []
    for f, ft, g in zip(F, FT, G):
        if g != 'body': continue
        tris += [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]
        uvt += [[ft[0], ft[1], ft[2]], [ft[0], ft[2], ft[3]]]
    return np.array(tris), np.array(uvt)

if __name__ == '__main__':
    race = {'african': 1}
    H, P = build(0.8, 0.4, 0.9, race)
    B = P[:NB]
    y0, y1 = B[:, 1].min(), B[:, 1].max()
    s = 1.98 / (y1 - y0)
    hipz = (bone_head(P, 'upperleg01.L')[2] + bone_head(P, 'upperleg01.R')[2]) / 2
    off = np.array([0, -y0, -hipz])
    tris, uvt = bodyfaces()
    # split by (v, vt)
    key = {}; pos = []; uv = []; idx = []
    for t, u in zip(tris, uvt):
        for v, vt in zip(t, u):
            k = (v, vt)
            if k not in key: key[k] = len(pos); pos.append((P[v] + off) * s); uv.append(VT[vt])
            idx.append(key[k])
    # eyes
    for f, ft in zip(EF, EFT):
        for a, b in ((0, 1), (0, 2)):
            pass
    out = {'pos': np.round(np.array(pos), 4).ravel().tolist(), 'uv': np.round(np.array(uv), 4).ravel().tolist(), 'idx': idx}
    J = {}
    for b in ['upperarm01.L', 'upperarm01.R', 'lowerarm01.L', 'lowerarm01.R', 'wrist.L', 'upperleg01.L', 'upperleg01.R', 'lowerleg01.L', 'lowerleg01.R', 'foot.L', 'head', 'neck01', 'spine05']:
        J[b] = ((bone_head(P, b) + off) * s).round(3).tolist()
    out['J'] = J
    print(json.dumps(J, indent=0))
    json.dump(out, open('prev.json', 'w'))
    print(len(pos), len(idx) // 3)
