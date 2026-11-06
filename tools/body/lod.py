# Builds the low-detail body index (c_bodylod.js): the same vertices as the full athlete body, fewer triangles.
# Used for shadows, the floor reflection and players far from the camera. Needs: pip install pyfqmr numpy
import json, re, base64, sys, numpy as np, pyfqmr
SRC = sys.argv[1] if len(sys.argv) > 1 else 'src/c_bodydata.js'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'src/c_bodylod.js'
t = open(SRC).read()
H = json.loads(re.search(r'const BODY_HDR = (\{.*?\});\n', t, re.S).group(1))
b = base64.b64decode(re.search(r"const BODY_B64 = '([^']*)'", t).group(1))
n, nt = H['n'], H['t']
V = H['var']['W-a']
q = np.frombuffer(b, np.uint16, n * 3, V['pos']).reshape(-1, 3).astype(np.float64)
P = np.array(V['lo']) + q / 65535 * np.array(V['sc'])
I = np.frombuffer(b, np.uint16, nt * 3, H['idx']).reshape(-1, 3).astype(np.int64)
rg = np.frombuffer(b, np.uint8, n, H['rg'])
si = np.frombuffer(b, np.uint8, n * 4, H['si']).reshape(-1, 4); sw = np.frombuffer(b, np.uint8, n * 4, H['sw']).reshape(-1, 4)
dom = si[np.arange(n), sw.argmax(1)]
head = dom == 2
# groups: decimate each surface on its own so garments and skin keep their own vertices
fr = rg[I[:, 0]]; fh = head[I].all(1)
groups = [('eyes', fr == 10, 1.0), ('head', (fr == 0) & fh, 0.45), ('skin', ((fr == 0) | (fr == 9)) & ~fh, 0.24),
          ('jersey', (fr == 1) | (fr == 2), 0.3), ('shorts', (fr == 3) | (fr == 4), 0.3), ('shoes', (fr >= 6) & (fr <= 8), 0.22), ('other', fr == 5, 0.4)]
out = []
for name, m, k in groups:
    F = I[m]
    if not len(F): continue
    if k >= 1: out.append(F); print(name, len(F), '->', len(F)); continue
    vid = np.unique(F); loc = {v: i for i, v in enumerate(vid)}
    lf = np.vectorize(loc.get)(F)
    s = pyfqmr.Simplify(); s.setMesh(P[vid], lf)
    s.simplify_mesh(target_count=int(len(F) * k), aggressiveness=5, preserve_border=True, verbose=False)
    nv, nf, _ = s.getMesh()
    # snap each new vertex to the nearest original vertex of this surface
    snap = np.empty(len(nv), np.int64)
    for a in range(0, len(nv), 512):
        d = ((nv[a:a + 512, None, :] - P[vid][None, :, :]) ** 2).sum(2); snap[a:a + 512] = vid[d.argmin(1)]
    G = snap[nf]
    G = G[(G[:, 0] != G[:, 1]) & (G[:, 1] != G[:, 2]) & (G[:, 0] != G[:, 2])]
    out.append(G); print(name, len(F), '->', len(G))
L = np.concatenate(out).astype(np.uint16)
print('total', nt, '->', len(L))
open(OUT, 'w').write('/* low-detail athlete body: triangle list over the same vertices as c_bodydata.js, built by tools/body/lod.py; do not edit by hand */\n'
                     "const BODY_LOD_B64 = '" + base64.b64encode(L.tobytes()).decode() + "';\n")
