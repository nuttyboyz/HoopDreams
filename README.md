# Hoop Dreams

3D arcade basketball in the browser (Three.js). Local co-op, PlayStation 2K-style controls.

- Play: https://nuttyboyz.github.io/HoopDreams/
- Offline single file (works with controllers, no internet): [download/hoop-dreams.html](download/hoop-dreams.html)

Player bodies are built from the MakeHuman base mesh, targets and rig (CC0, makehumancommunity.org); see tools/body/README.md.
Voice clips are generated with Kokoro TTS (Apache-2.0). three.js r128 (MIT) is bundled as three.min.js.

Build: `bash build.sh` rebuilds `dist/` from `src/`; the site is `index.html` + `three.min.js` + `vox.js` + `vox2.js` at the repo root.

---

3D local co-op arcade basketball in the browser (Three.js, no build step, no assets).

- `dist/hoop-dreams.html` is the standalone game (three.js inlined). Open it in Chrome or Edge with one or two controllers plugged in.
- `dist/artifact.html` is the same game loading three.js from a CDN, with the voice clips (`src/vox.js`) loading in the background so it starts instantly. It is published with vox.js beside it as the claude.ai Artifact.
- `src/` holds the source. `bash build.sh` rebuilds both files from `src/` and `three.min.js` (three.js r128).

Modes
- Play Now: 5v5 full court, quarters, shot clock. Pick from nine teams: the five franchises (Warriors, Lakers, Celtics, Bulls, Spurs) plus Iman Shumpert's '16 Cavaliers, Gilbert Arenas's Wizards, Jalen Brunson's Knicks and Carmelo Anthony's Nuggets. Every squad is five known 3 and 2 point shooters and legends at their best.
- Blacktop: half court, 1s and 2s, play to 11/15/21, losers' ball (make it take it is a setting), clear it past the arc. No teams: you pick individual characters (everyone from all nine teams) for your side and the other side.
- The Gym: a free-roam practice gym with no clock, both baskets live, a varnished floor that mirrors the room and squeaks on every cut. Walk into a ball rack to grab a ball, walk over any ball on the floor to pick it up. The red pad spawns a defender (Rookie, Pro, All-Star, Legend; he scores on you if he gets the ball) or a rebounder who feeds you. The green pad runs the challenges: 3PT Contest (money balls, 60 s), Around the World (7 spots, fewest shots), Hot Spots (45 s). Records save on the device. One or two players (one ball, pass it around). With two players the screen splits: each player gets their own balls, defender, rebounder, challenges and camera, and the camera swings smoothly between the courts instead of snapping.
- Shootout: a tournament of shooting games in the Play Now arena with the crowd and the booth: 3-Point Shootout, Around the World, Hot Spots, Free Throw Frenzy and Deep Range. 1 or 2 players take turns against up to 3 CPU shooters, each event pays points by placing, most points wins. Source in src/e_shoot.js.

Players and stats
- Every player has 3PT, MID, INS, DNK, SPD, DEF and REB ratings plus an overall. The setup screens show a stat card for the highlighted team or player.
- Ratings drive shot odds, finishing, speed, defense and rebounding. They are squeezed toward the middle a little so a star helps but never decides the game alone. Ratings are approximate gameplay values, not official 2K numbers.

Shot meter: the fill takes about 0.45 seconds to reach the green zone. Better shooters get a wider green zone and tight defense shrinks it.
On fire: three makes in a row set a player on fire. The next shot is guaranteed, then the player goes back to normal and heat builds up again from zero.

Controls follow the PlayStation 2K layout and are listed in the in-game Controls screen. The left stick only moves. Flick the right stick for four different crossovers, read from the basket you attack: up = hesi cross (hitch, then cross toward the basket), left = double cross (sell the other way, snap back), right = killer cross (low and instant through the legs), down = step-back cross (jump back, cross, space to shoot). Hold L2 and flick for hop step, spin move and step back. Hold R3 and push for a second set: hesitation (up), between the legs (left), behind the back (right), in-and-out (down). Tap R3 alone for a size-up. On the keyboard the dribble key (Space / Enter) plus a held direction does the same.

Rules (Play Now): a referee works every game, a different original character each time (a plumber, a comb-over in a red tie, a pirate, a robot, a grandma, a luchador, a chef, a sheriff, a DJ, a vampire), in stripes on the sideline. Reaching (Square) knocks the ball loose, but reach over and over and it is a foul; a hack on a shooter is free throws, with an and-one when the shot drops; five team fouls in a period put the other side in the bonus; a late block is a foul, a hard foul on a dunker is a flagrant (counts double), and a ball handler who sprints over a set defender is a charge. Free throws use the shot meter (or the shot stick). At the foul limit (Setup, default 3) a player is in foul trouble and fights the referee in a side-view Street Fighter style bout (Cross light, Circle heavy, Square block, Triangle jump, R2 dash, 12 seconds; mashing gets covered up and punished, block his swing then punish the recoil; Options skips it at slightly worse odds): win and he stays in with his fouls cut to two under the limit, lose and he is ejected and a bench guy checks in. Hard falls and dunk fouls can injure a player; he plays on, slower and with less lift (a red + on his name). Blacktop stays street rules: no referee, no fouls.

Shot stick: Settings > Shot stick shoots with the right stick like 2K (pull down and hold, release in the green). Square still works. With the shot stick on, the step-back cross moves to L2 + flick down.

Camera: 2K is a behind-the-back camera like NBA 2K's "2K" cam (high, behind the ball handler, looking at the basket he attacks; it flips when the ball changes ends and the stick follows it). FULL COURT is the original sideline view the game started with. BROADCAST is a TV camera on the sideline that zooms into the paint, DRONE looks straight down from above, and FIRST PERSON (one player only) plays through your player's eyes with the stick relative to where he looks. C switches; all modes have them.

Voices: the commentator and the players' call-outs are neural text-to-speech clips (Kokoro, Apache-2.0) baked into src/vox.js by tools/make_vox.py. Pick Michael, Fenrir, Puck or the booth (all three) in Settings, or a voice from the device. Settings also picks the commentator persona: Shorty (the default, an original laid-back retired-hooper podcast persona who calls everybody Shorty, with his own generated voice), the Studio guy, or the Booth with both. Everybody Says Shorty (on by default) puts a Shorty in the players' call-outs and the studio guy's lines too. They sound human, but they are generated voices, not recordings of a real person, and they speak General American; the New York / Boston flavour comes from the script.

## Classic version
The game as it was before the 3D graphics overhaul (v21): https://nuttyboyz.github.io/HoopDreams/classic/
