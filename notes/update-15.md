# Version 15: the Fight mode is gone

Nutty asked (2026-10-19, right after v14): "delete that entire fighting mode".

- Removed `src/e_fightmode.js` (the v13 3D and v14 cartoon 2D fighting game), the Fight item on the title menu, the Fight setup, Move List, fight pause and fight results screens, the fighter card, the fight branches in the frame loop, the Escape and controller handlers, and the fight CSS in head.html.
- Kept: everything else. The referee fight at the foul limit in Play Now (`src/e_fight.js`, a Play Now rule from v10) is untouched, since that is a rule of the basketball game, not the Fight mode.
- Checked headless: the game boots with no errors, the title menu is Play Now, Blacktop, Controls, Settings, Fullscreen; a Play Now game and a Blacktop game run, pause and resume, quit to menu; no fight globals or elements remain.
- The v14 source is kept in the session scratchpad only (not in the project), in case he wants it back.
