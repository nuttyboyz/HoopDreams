# Athlete bodies (v24)

The players are a real human body from MakeHuman (base mesh, macro/face targets, default skeleton and weights, all CC0,
https://github.com/makehumancommunity/makehuman), baked into `src/c_bodydata.js` and skinned to the game rig in `src/c_body.js`.

Rebuild:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git <dir>/mh
    (cd <dir>/mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/rigs makehuman/data/targets makehuman/data/eyes)
    copy these scripts to <dir>/bake/ and run there: python3 -I bake2.py && python3 -I pack.py ../../src/c_bodydata.js

`bake2.py`: six bodies (guard / wing / big, two face types), arms and legs reposed into the rig's rest stance, garment shells
(jersey, shorts, sneakers), per-vertex cavity/lips/brows/beard zones, hair-depth map for hair shells, and 8 face morphs.
