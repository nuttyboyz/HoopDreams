# Version 18+: Shootout mode

Nutty asked (2026-10-20): "create a 3 point shootout and around the world and other fun games like that into a single game mode that has play now attributes - gym/crowd/announcers but its more exciting".

New title item **Shootout** (`CFG.mode = 'shoot'`, source `src/e_shoot.js`). It builds the Play Now arena (neutral Hoop / Dreams court, crowd, ads, Snd crowd at full level) and runs five events in turn, alternating baskets:
- 3-Point Shootout: 5 racks of 5 around the arc, last ball of a rack is the money ball (2), 60 s.
- Around the World: 7 spots at 5.1 m, make to advance, score 3 per spot minus misses (+5 for finishing), 60 s.
- Hot Spots: a random lit spot, 2s and 3s, three in a row adds a point, 45 s.
- Free Throw Frenzy: 12 shots from the line, streak multiplies (1, 2, 3, 3...), 40 s.
- Deep Range: six spots farther and farther out, two tries each, worth 3 3 4 5 6 8, 60 s.
Contestants: you (1 or 2 humans, who take turns on their own pad) plus 0 to 3 CPU rivals (top 24 three-point shooters, random). Everyone takes a turn per event; the others wait on the near sideline in their own colors. Placement points per event (N for 1st down to 1), most total points after the last event is the champ (tie: event wins, then summed event scores). A shot only counts from within 1.7 m of the lit spot. Fire/heat works as in Play Now. Setup: Players, Your Player(s), Format (all five or one event), Rivals, Rival Skill (CFG.diff scales the CPU through `p.gymLvl`).
Engine hooks: `S.mode === 'shoot'` in startMatch (arena built as 'play', kits per shooter), update() (`shPlayers`, `shBall`), updateHud (`shHud`: scoreboard, leaderboard panel `#shb`, results table `#shtab`, hint line, spot markers), afterScore (reuses `gymAfterScore`), tryPickup (only the shooter whose turn it is), out of bounds off, `gap` catch-up off, 'over' menu shows `shResultsHtml`. CPU shooters are `gymRole = 'cpu'` so giveBall never hands them to a human. Turn flow: intro, glide (the shooter jogs to the first spot, clock waits), live, between, event table (press ✕ to skip), next event, final, results screen. The booth reuses existing lines (three/two/swish/hot/fire/close/over/win), no new voice clips.
Tests (scratchpad gym/g6.js, bot plays the human): 4 shooters through Free Throw Frenzy and the 3PT event to the champion screen (1 and 2 humans), 2P turn taking, mode switching Play Now / Blacktop / Gym / Shootout clean, menu and setup items. Not covered: playing all five events back to back with real timing, real GPU frame rate.

## v21 – Shootout rebounder + shooter-follow camera
- `CFG.shReb` (setup item "Rebounder", default On): `shAddReb()` adds a big (gymRole 'reb'); `shRebAI` chases loose/shot balls and passes to the current shooter (chest, lob if >9 m) after 0.4 s. Only shooter and rebounder can pick up the ball.
- Ball-boy fallback only after 4.5 s when the rebounder is on.
- Camera: `SH.focusP` = current shooter; behindCam/full cam follow it with kz [0.85,0.75] so the shooter stays in frame (0 of 3600 live frames out of view in test).
