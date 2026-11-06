# Update 25 (2026-11-06): speed, real inbounds, screen-bug guards

## Speed
- Each athlete now has a low-detail twin (8.8k triangles instead of 28.7k, built by `tools/body/lod.py` into `src/c_bodylod.js`).
  It shares every vertex with the full body and only uses a smaller triangle list, so it costs no extra memory.
  It draws the sun shadows (layer 2, which only the shadow camera sees), the floor reflection, and any player under ~210 px tall on screen
  (back to full detail above 250 px). Close-ups and the player you control stay full detail.
- Face morphs are baked into each player's own positions when he is built. The body shader no longer reads 8 morph attributes per vertex.
- Players are frustum culled (bounding sphere big enough for dunks).
- Auto resolution now aims at 60fps. It steps the pixel ratio down when the average frame is slower than ~55fps for 3/4 s.
  It steps back up after 8 smooth seconds, and never retries a step that proved too slow. Before, it only reacted below ~38fps and never came back up on a 60Hz screen.
- Multisampling is 2x instead of 4x when the pixel ratio is above 1.2, since a sharp screen needs less.
- Test renderer (software, so the ms are relative, not real fps), 1280x720:

  | mode | v24 render | v25 render | v24 triangles | v25 triangles |
  |---|---|---|---|---|
  | Play Now | 855 | 570 | 980,606 | 300,890 |
  | Blacktop | 678 | 493 | 538,770 | 181,278 |
  | Gym | 310 | 281 | 122,862 | 43,422 |
  | Shootout | 586 | 447 | 459,702 | 143,070 |

  Draw calls stay ~190. The game update is ~0.4-0.7 ms per frame, so the CPU side was never the bottleneck.

## Core flow
- Play Now dead balls are real inbounds now (`startInbound` / `inbUpdate` in d_game.js). This covers made baskets, made last free throws, out of bounds, shot clock violations and offensive fouls.
  The inbounder steps out of bounds (baseline under the basket, otherwise the sideline at the spot). A teammate comes to the ball, or your player if you have one, and it is passed in after ~0.8-1.8 s.
  - Game and shot clocks wait until the pass is thrown.
  - Inbound passes are 70% harder to steal.
  - If your own player is the inbounder (co-op with every teammate human), any pass button passes it in, and it goes in by itself after 4 s.
  - Blacktop is unchanged (check ball).
- A missed shot rebounded before it hits the floor now counts as a miss (`missShot` from `tryPickup`). Before, the shooter's hot streak survived those misses.
- Playtest (`scratchpad/gfx/flow.js`, 3 AI games plus 1 idle-human game): every made field goal gave the ball to the other team, except and-one free throws. Every miss ended in a rebound, with no stuck balls and no possession mismatches. 81 of 86 inbounds were caught (2 stolen, 2 ended by the buzzer). Passes completed 90-97%.

## Screen bug guards (dashed lines and white haze, photo from Nutty)
I couldn't reproduce it on the software renderer, so every suspect is guarded:
- Bloom and the final pass drop NaN/Inf pixels and clamp bloom, so one bad pixel can't spread into a haze.
- Point sprites (particles, crowd flashes, ball trail) have capped sizes and can't blow up near the camera.
- The reflection target is cleared every frame and only sampled after it is drawn.
- Net springs reset if they ever go non-finite.
- Morph targets are gone from the body shader, which cuts its vertex attributes from 15 to 7 (some GPUs are near their limit).

## Files
src/c_body.js (bodyGeoP, bodyLodPass, bodyReflect, BODY.live), src/c_bodylod.js (new), src/c_xgfx.js, src/c_world.js (sun shadow camera sees layer 2, particle size cap), src/c_fx.js, src/d_game.js, src/e_play.js, src/e_gym.js, src/f_ui.js, tools/body/lod.py.
