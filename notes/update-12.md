# Version 12: the fun pass

Nutty asked for this round: play it, have a second bot test it, rate the fun, and if it scored 8.6 or lower, agree on 20 improvements with the bot and build them.

- Ratings before the changes: my playtest gave 7.5, and the reviewer bot gave 6.2.
- Ratings after the changes: see the bottom of this file.

## The 20 improvements

1. **Defense that keeps up.** The man guarding the ball now sprints when the ball handler sprints, at 97% of his speed. A weak-side helper steps into the lane when the ball gets within 6 m of the rim.
2. **Contested dunks can be stopped.** A crowded rim either sends the dunk back or rattles it out. Good dunkers beat traffic more often. Spamming sprint-and-dunk used to score 100% of the time; it now scores about 50-68%.
3. **Smarter CPU shot selection.**
   - The CPU shoots when it's open and swings the ball when a closeout arrives.
   - It catches and shoots on the arc, and drives and kicks out to shooters.
   - It stops driving into a man who's set in front.
4. **Fewer cheap steals.** A pass can't be picked right out of the passer's hands. The catcher's defender only jumps a pass if he fronts the catcher. The reach cooldown is now 1.2 s. In CPU vs CPU games, steals fell from 35-48 a game to about 10-25.
5. **Fire actually happens.** In Play Now the streak only cools after 40 s without a make (it was 16 s; Blacktop stays at 16 s). That's about 1-4 fires a game.
6. **Ankle breakers are earned.** The chance is lower, each defender can only be dropped once every 4 s, and spamming moves stops working. Small stumbles no longer pop a toast. It went from 71 a game to about 7-13.
7. **The meter means something.**
   - The green window is tighter: about 90 ms for an average open shooter.
   - A PERFECT release is now money when you're open (90-98%) and still likely when you're contested.
   - Every jumper shows OPEN, CONTESTED or SMOTHERED.
8. **The free-throw hint stays up** the whole time you're at the line.
9. **Box score fixes.** Ejected players stay in the box score with an EJ badge. At 1280 wide the tables stack instead of overlapping.
10. **Captions and toasts stay out of the way.** Captions sit at the bottom, are capped at 90 characters, and are hidden during fights. Toasts sit below the scoreboard.
11. **Ref fight rework.**
    - Standing still always loses. Mashing wins about 35% of the time, and blocking then countering wins about 77%.
    - CPU fights are a 3 s cut-in.
    - Options skips the fight at slightly worse odds (45%).
12. **Fewer fouls.**
    - A single reach is rarely called; mashing reach still is.
    - Blocking fouls and flagrants are rarer, and charges against the CPU are rarer.
    - The "one more foul" warning now shows for your whole team.
13. **Commentary fits the moment.**
    - No hype after misses or ejections.
    - "Lead" lines only go to the side that's actually ahead.
    - No more "Shorty. Shorty." doubles.
    - No repeats until the whole pool is used.
14. **Menus.** START GAME is the first row, and the duplicate commentator rows are gone.
15. **Difficulty.** All-Star closes out harder and runs hot hands hotter. Teams down by 12 or more get a small catch-up (up to +4%).
16. **Faster pace.**
    - Free-throw setup is 1.0 s, then 0.85 s.
    - The inbound after a make is 1.0-1.25 s.
    - Check ball is 0.8 s.
    - Dead time dropped from 31% to about 7-14%.
17. **Fewer name tags.** Tags show for your players, the ball handler, the two players nearest the ball, and anyone injured, on fire or in foul trouble.
18. **Blacktop.** The arc glows while you have to take it back. The CPU kicks it out to shooters.
19. **Post-game screen.** It shows a player of the game and highlights, and Rematch is the first button.
20. **Camera and stance.**
    - The near hoop fades when the 2K camera swings through it.
    - The stick keeps its direction through camera flips.
    - Defenders crouch with their hands active instead of standing in a T.

## Numbers checks (headless, Pro)

- CPU vs CPU games:
  - about 40-55 points a side
  - 48-52% FG
  - 9-16 three-point attempts a game
  - 6-12 blocks
  - 0-1 fights
- Human-like bot, ±0.14 timing noise:
  - about 7-13 ankle breakers a game
  - PERFECT releases are clearly better than GOOD ones
- Sprint-and-dunk spam bot: about 50-68% on dunks.

## Round 2 (after the reviewer's 6.9)

- **Difficulty now only drives the CPU's team.** Before, All-Star also boosted your own AI teammates, which is why it barely felt harder. Your teammates now always play at Pro.
- **CPU shooting by level:** Rookie 0.92, Pro 1.04, All-Star 1.16. CPU jumpers lose less to contests.
- **Catch-up:** a team trailing by 10+ in Play Now, or 6+ in Blacktop, gets up to +7%.
- **Blacktop:**
  - The CPU only takes deep 2s when it's open, and drives when it's closed out.
  - It reaches less, and dunk stops are softer.
- **Ref fights:**
  - The ref covers up after two clean hits, so mashing gets blocked and punished.
  - Beating the ref leaves you at 1 foul (at a limit of 3) instead of 0.
  - Skipping a fight wins 45%.
- **Shots:** the PERFECT window is a bit narrower, and a GOOD release is a real shot now (a GOOD three goes in about 35-45% of the time when open).
- **Dunks:** driving into a man planted in the lane gets stopped more often.
- **Commentary:**
  - "Shorty" shows up less.
  - No "clutch time" in a blowout.
  - Lines rubbing in a big lead play at most once every 75 s.
- **Screen fixes:**
  - The free-throw text no longer stacks, and the hint updates for the 2nd and 3rd shots.
  - Name tags stack instead of overlapping.
  - The Blacktop scoreboard line no longer wraps.
  - A fight overlay can't stick around into a new match.

## Round 3 (after the reviewer's 7.3)

- **Ref fights:**
  - Mashing now gets covered up and punished. The ref blocks long strings, and the masher is left wide open.
  - Blocking his swing and then punishing the recoil does extra damage. The ref hits a little softer than a player.
  - Bot results: mashing wins about 30%, decent block-and-punish about 75%, sharp play almost always.
- **Real bug fixed:** shooters drifted forward while rising, so most "threes" off the catch were landing as long twos. Shooters now set their feet.
- **CPU threes in Play Now:**
  - The CPU now finds open shooters, uses a real corner-three spot, and catches and shoots.
  - In CPU vs CPU games that's about 9-15 threes a game.
  - Contests ease off sooner: 2 m of space counts as open.
- **Steals:** about 25% fewer again. Pro's CPU shoots a little better.
- **Blacktop:**
  - Losers' ball is now the default (make it take it is still a setting), so one side can't snowball.
  - CPU deep shots have to be earned.
  - The team that's down defends harder, and a team far ahead cools off slightly.
- **Commentary:** fewer "Shorty" tags. Clutch lines play at most once every 25 s, and big-lead lines at most once every 75 s.

## Round 4 (after the reviewer's 7.6)

- **Ref fights:** mashing heavy punches now gets blocked, and the ref jabs a slow heavy wind-up out of the air. Every mash style the reviewer tried now wins 6-31%.
- **Blacktop:** a 14-second possession clock is on the scoreboard, so nobody can hold the ball forever. CPU deep shots have to be cleaner.
- **Shots:** a PERFECT three is money again, about 95% open at the line and about 80% deep.
- **Dunk spam:** it now gets stopped more often and draws charges. My spam bot finished 30% and lost 28-60.
- **Comebacks:** catch-up starts a bit earlier in Play Now.
- **Post-game:** the screen is solid, so the game no longer shows through behind the box score.

## Rounds 5 and 6 (reviewer 7.8 both times)

- **Ref fights:** the ref flashes and clicks about 0.3 s before he swings at you. The on-screen hint says "block when the ref flashes, then punish". A punish after a block hits 1.8x.
  - A bot with human-speed reactions (300 ms) now wins about 55-70% of fights, up from 0-25%.
  - Mashing wins 0-38%.
- **All-Star:**
  - The CPU closes out harder and shoots a little better.
  - Your green window is a bit smaller on All-Star and wider on Rookie.
- **GOOD releases:** a GOOD three is a real shot again (about 40-58% open, depending on the shooter).
- **Blacktop:**
  - Taking it back now counts from the corner too, so you can't get stuck on the sideline.
  - The possession clock is 20 s and waits while you take it back.
  - The CPU takes fewer deep shots instead of bricking them.
- **Fight screen:** name tags and the scoreboard are hidden during fights.

## Final ratings

- My playtest: 7.5 before the changes.
- Reviewer bot: 6.2 → 6.9 → 7.3 → 7.6 → 7.8 → 7.8. The last round's fixes (the ref tell, GOOD threes, Blacktop corner clears) were built after its last rating.
