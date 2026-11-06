# Version 24 – real athlete bodies (2026-11-06)

Nutty: "these still look like clay ... change the stick figure look to actual basketball players".

* Every player (and the refs, gym NPCs, Shootout rivals) is now one skinned human body built from the MakeHuman
  base mesh (real scanned-style anatomy: face, ears, hands with fingers, muscles), CC0 licensed. `src/c_body.js` builds it,
  `src/c_bodydata.js` holds the baked data (tools/body/ rebuilds it).
* Six bodies: guard / wing / big man build, two face types, picked from role and skin tone. 8 face morphs give every
  player his own nose, lips, jaw, chin, cheeks and head shape (stable per player).
* Real garments: tank-top jersey shell with trim and the number/name printed on it, loose shorts tucked over the jersey
  with waistband/hem/side stripe in the team trim, crew socks, sneakers with white soles and a side stripe.
* Hair and beards grow from the scalp (buzz, short, fade, afro, high top, curly, braids/cornrows, dreads, long, man bun,
  mohawk; beard, big beard, goatee, stache, stubble), headbands and the shooting sleeve still work.
* The bodies are skinned to the existing rig, so every animation (crossovers, shots, dunks, defense) drives them unchanged.
  Gameplay is unchanged.
* Settings → Players: Realistic athletes (default) / Classic (fastest) brings back the old look on slow devices.
* Cost: about 15k vertices per player, ~200 draw calls instead of ~440 (fewer meshes), the page grows by ~1.8 MB.

Not done / honest limits: no photo skin textures (skin is shaded, not photographed), hair is a sculpted shell rather than
strands, faces are varied but not likenesses of the real players.
