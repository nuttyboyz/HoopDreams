# v22 – graphics upgrade (visuals only; gameplay, controls, rules, modes, bots, scoring, cameras untouched)
Request (Nutty 2026-11-06): look like the Amazon game "Basketball Game 3D: Street Hoops Dunk 2026".
- New `src/c_xgfx.js`: post chain (MSAA half-float scene target, 4-level bloom, anamorphic lens flare + ghosts driven by arena lights/sun, warm grade, vignette, light chromatic aberration, dither), `gfxRender(scene, cam)` replaces `renderer.render` in the frame loop and single-view gym. Split-screen gym (2 lanes) still renders directly.
- Soft PCF shadows (key light, 2048 map) + ShadowMaterial catcher plane; blob shadows kept as contact shadows (half opacity).
- Glossy reflecting floor for Play Now / Blacktop (`gfxFloor`, `gfxReflect`, half-res mirror pass, grain-blurred, Fresnel); court texture 4096 px on High.
- Play Now arena: HDR light panels, truss, 6 sweeping spotlight beams + floor light pools, blurred crowd texture (team colours) with camera-flash sparkles, brighter LED ad boards.
- Blacktop: sunset sky dome (sun disc, clouds, gradient), lower skyline, brick walls with bump maps and procedural graffiti, fence top rails, long low-sun shadows, warm fog.
- Players: smoother/higher-poly bodies, jersey straps/collar/side trim, baggy shorts with stripe and hem, crew socks, detailed sneakers, faces (eyes, brows, nose, lips, ears), muscle shaping. Same rig/joint pivots, same scale.
- Hoop: glass backboard with white frame and orange shooter's square, padded stanchion, metal rim.
- `Graphics: Low` keeps the old fast path (no post, shadows, reflection, beams). `gfxAdapt` auto-drops reflection/shadows/beams, then post, if the frame time stays high at the minimum render scale.
- Tests: g6 (Shootout solo/coop), g3 (2P gym), g4, g5 pass, no page errors. Screens in screenshots/v22/. Draw calls High 437 / 450k tris (play), 378 / 320k (blacktop); Low 139 / 147 calls.

## v22b – gameplay allowed to follow the new animation/physics (Nutty 2026-11-06)
- Movement: speed builds with a little weight (accel x0.8 when speeding up, x1.15 when slowing/planting); top speeds and ratings unchanged. Players lean into acceleration and cuts (visual).
- Jump shots: the player now falls back to the floor under gravity (about 0.29 s) instead of snapping down in 0.1 s; he moves at 15% speed while airborne, 50% for the 0.1 s after touchdown, and bends his knees on landing. Dunks: ballistic fall after the hang, slow drop from 0.95 m.
- Ball: floor bounce restitution 0.74 -> 0.77, rolling friction 0.3 -> 0.5 per second (loose balls roll farther), the ball spins (roll on the floor, backspin off the hand).
- Collisions: unchanged radius (0.62 m) but a big man (role B) gives ground less easily and players lose some closing speed when bodies meet.

# v23 – true crossovers, Timberwolves, shot stick up
- Right stick: UP = the shot (Shot stick, now ON by default and pushed UP, cfgv 13 resets the old saved setting). LEFT/RIGHT = crossover toward that side (`cross`, ball switches hand across the front; if the ball is already on that side `btlx` = between the legs then cross). DOWN = between the legs (`btl`) or behind the back (`btb`, when running faster than 3.6 m/s), leaving off the other hand. Shot stick off: up is the hesi cross as before. L2/R3 variants unchanged.
- Smoothness: the ball hand follows a critically damped spring (no snap), the dribbling arm trades with the guide arm by hand position, ball height and depth follow per-move curves through the legs / behind the back, the burst of speed after a move eases in over ~0.3 s (`burst()`), and moves keep the speed he had.
- 2026-27 Minnesota Timberwolves (team index 9, MIN): LaMelo Ball, Anthony Edwards, McDaniels, Kuminga, Gobert start; Dosunmu, Hyland, Green, Lyles, Shannon are `team.bench` (Blacktop, Gym, Shootout pools). Shai Gilgeous-Alexander added to the pool. Ball 95 (3PT 96), Edwards 96 (dunk 99, finish 96); Curry mid 96/fin 84, Durant 98 (3PT 94), Luka 98 (3PT 94, mid 96), Booker 95 (3PT 93, mid 97).
- New name clips rendered with tools/make_vox.py (1724 clips, 20.5 MB): LaMelo, Edwards, McDaniels, Kuminga, Gobert, Dosunmu, Hyland, Josh, Lyles, Shannon, Shai, Timberwolves.

## v23b – shot stick reverted (Nutty 2026-11-06)
Shot stick is the original again: pull the right stick DOWN and hold, off by default (cfgv 14; the v23 up-stick setting is discarded). With it off, up is the hesi cross; left/right/down stay the new crossovers. With it on, down shoots and the L2 + down step-back applies.
