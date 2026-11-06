# Hoop Dreams update 10 · rules, referee, fights, shot stick, cameras, Shoddy

Same pinned link as always: https://claude.ai/artifact/6het48LXY2T1czaEjW949g (version 10). For controllers use `dist/hoop-dreams.html` (now about 20 MB because all the voice clips are inside it).

## Ratings (my own playtests with a simulated controller and CPU self-play)

| Batch | First pass | After improvements |
|---|---|---|
| Rules: referee, fouls, free throws, foul trouble fights, injuries, shot stick, 3 new cameras, first person | 7.5 | 8.5 |
| Fun: net swish, ball trail and focal point, commentary brain, Shoddy | 8.5 | 8.5 |

The first rules pass was under 8, so these ten things went in before I came back:
1. Charge calls: sprint into a set defender and it is an offensive foul.
2. Flagrant fouls on dunkers (count double toward foul trouble, can injure).
3. Foul count on every name tag (PF1, PF2...) so you see foul trouble coming, plus a warning toast one foul before the fight.
4. BONUS shown on the scoreboard when a team is over five team fouls.
5. Free throw counter in the hint (1 OF 2) and CPU free throw skill tied to the shooter's ratings.
6. Closer side camera for the fight, ball hidden during it, markers and names hidden.
7. Foul Out limit also in Settings, not only Setup.
8. Fight waits for free throws to finish (it used to get lost) and play always resumes after a fight (it used to stall).
9. Foul rates tuned with self-play: about 9 fouls, 10 free throws and 1 to 2 fights per 8 minute game; injuries down to about 1 or 2 a game.
10. The shot grade label (PERFECT, GOOD, LATE) was stuck in the corner; it floats over the shooter again. Box score shows FT and PF.

## How the rules work (Play Now only, Blacktop stays street rules)

- A referee in stripes works the sideline every game, a different character each time: Plumber Pete, The Comb-Over, Captain Peg, Ref-Bot 3000, Grandma Ethel, El Luchador, Chef Louie, Sheriff Bob, DJ Whistle, Count Foulula. They are original characters, not Mario or a real person, so nobody's face or name is copied.
- Square reaches for the ball. Reach once and it is usually clean; spam it and the ref whistles a foul. Hack a shooter and he gets free throws (two, three behind the arc, and-one when the shot still drops). Five team fouls in a period puts the other team in the bonus.
- Free throws use the same meter as a jumper (or the shot stick). The CPU shoots them from its ratings.
- Foul Out (Setup or Settings, default 3, the NBA's 6 is an option): at the limit the game stops and the player fights the referee, side view, Cross light, Circle heavy, Square block, Triangle jump, R2 dash, 20 seconds. Win and the fouls are wiped. Lose and he is ejected and a Bench Guy (75 overall) checks in. In Versus the second player controls the referee.
- Injuries come from hard falls, blocks and flagrants. The player keeps playing with a red + on his name, slower and with less lift.
- Shot stick: Settings > Shooting > Shot stick. Pull the right stick down and hold, let go in the green. Square still works. With it on, the step-back cross moves to L2 + flick down.
- Cameras: 2K, FULL COURT, BROADCAST (TV sideline that zooms into the paint), DRONE (straight down), FIRST PERSON (one player only, the stick is relative to where you look). C cycles them.

## Shoddy and the commentary

Settings > Commentator: Studio (the sarcastic New York guy), Shoddy, or Booth (both on the call). Shoddy is an original persona written in the laid-back podcast style you described, calls you Shoddy, and reacts to fouls, fights, free throws, swishes and injuries with his own lines. His voice is a generated neural voice, not Iman Shumpert's real voice. The commentary brain now remembers what it already said in a game and mixes openers, cores and tags, so lines repeat far less.

## Still open

- Your Pinned dropdown only showing Perfect Run: I could not change that from here. Pin the game link from its page menu if it is missing.
- Controllers do not work inside the claude.ai page; use the downloaded hoop-dreams.html for that.
