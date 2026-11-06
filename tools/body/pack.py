import base64, json, sys
h = json.load(open('body.json')); b = open('body.bin', 'rb').read()
out = sys.argv[1]
with open(out, 'w') as f:
    f.write('/* athlete bodies baked from the MakeHuman base mesh, targets, skeleton and weights (all CC0, makehumancommunity.org) by tools/body/bake2.py; do not edit by hand */\n')
    f.write('const BODY_HDR = ' + json.dumps(h, separators=(',', ':')) + ';\n')
    f.write("const BODY_B64 = '" + base64.b64encode(b).decode() + "';\n")
print(len(open(out).read()))
