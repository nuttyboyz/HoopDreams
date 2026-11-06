/* ===== Commentary module: personas, line engine and the voice settings UI (see b_input.js Com for the legacy line table) ===== */

/* The two commentators are generated characters. The Studio guy is a tired, sarcastic New York lifer. Shorty is an original persona in the
   lane of a laid-back ex-player on a podcast: first person takes, "if that's me...", every line lands on "Shorty". Both are built from a grammar
   (opener + core + tag) so the same event can be called hundreds of different ways, and a per-game memory keeps lines from coming back
   until the pool is used up. The pieces are separate voice clips (vox.js) stitched at run time; tools/dump_vox_text.js walks TALK the same
   way make_vox.py does, so keep the shape: openers [string], tags [string | {t, when}], cores {key: [template]} with ${n} / ${t} name slots.
   A core may be {t, when} too. `when`: lead (big lead), close (one-possession game), late (last minute of a period), hot (shooter is heating up),
   black (Blacktop), play (Play Now), ot (overtime). Contextual tags are only picked when their condition holds. */
const TALK = {
  personas: [
    {
      name: 'Commentator', voices: [0, 1, 2], speed: 1.0,
      openers: ['Ayyy.', 'Oh, come on.', 'Look at dis.', 'Here we go.', 'Fuhgeddaboudit.', 'Ohhh!', 'Yeah, yeah.', 'Folks.', 'Listen.', 'Wow.', 'Okay, okay.', 'Oh boy.', 'Ha!', 'Now dat,', 'Lemme tell ya.', 'Madone.'],
      tags: ['Beautiful.', 'I’m not even mad.', 'Write dat down.', 'Dat’s basketball, kid.', 'Somebody tell da coach.', 'Tremendous.', 'Wicked.', 'I need a coffee.', 'My cousin coulda done dat.', 'Don’t look at me.', 'Unbelievable.', 'Allegedly.', 'I’ll allow it.', 'Dat’s da game, folks.', 'Fuhgeddaboudit.', 'Nobody asked me.',
        { t: 'And it’s a one possession game.', when: 'close' }, { t: 'Dis one is tight, folks.', when: 'close' }, { t: 'Not dat it matters, look at da score.', when: 'lead' }, { t: 'Da lead is embarrassin’ at dis point.', when: 'lead' }, { t: 'Under a minute to go.', when: 'late' }, { t: 'Clock’s runnin’ out, kid.', when: 'late' }, { t: 'He’s warmin’ up, folks.', when: 'hot' }, { t: 'Da kid is feelin’ it.', when: 'hot' }, { t: 'Overtime basketball, baby.', when: 'ot' }, { t: 'Street rules. No refs, no mercy.', when: 'black' }],
      cores: {
        start: ['Good evenin’, everybody! Two teams, one ball, and nobody in dis buildin’ who asked for a zone defense.', 'Welcome to tonight’s game, folks. Defense is a rumor and every guy out dere is a future Hall of Famer. Allegedly.', 'Tip-off, kid. Let’s all pretend dis is gonna be close.', 'We got a referee tonight, folks. Real calls. Real consequences. Real complainin’.', 'Both teams are here, da ball is here, and I am here against my will. Let’s play.'],
        startB: ['Blacktop rules, baby. No refs, no rules, no feelins’. My favorite.', 'Welcome to da park, where every foul is a conversation and every shot is wide open to opinions.', 'Concrete, chain nets and no refs. Dis is where legends get hurt.'],
        three: ['${n} from downtown! Which is a fancy way of sayin’ nobody bothered to guard him.', 'Three points! Da defense is filin’ a missin’ persons report.', '${n} fires from deep. Statistically a bad idea. Spiritually? A masterpiece, kid.', 'Bang! ${n} from downtown. Coaches everywhere just aged five years.', 'Wicked three from ${n}. And I don’t use wicked lightly. I use it constantly.', '${n} from way out dere. Dat shot had a passport.', 'Splash. ${n} saw a defender and took it personal.', 'Three ball, ${n}. Da scouting report said leave him open. Da scouting report is fired.', '${n} lets it fly, and it’s good. Rent is due and he just paid it from thirty feet.', 'Dat’s a three for ${n}. Somebody in da front row just dropped a hot dog.'],
        two: ['${n} scores. Revolutionary. Nobody’s ever done dat before tonight.', 'Two for ${n}. Da defense watched respectfully, like it was a museum.', '${n} with da bucket. Applause. Polite applause.', 'Dat’s a bucket. I’d say it’s routine, but I’m contractually obligated to be excited.', '${n} knocks it down. Mid-range, baby. Da shot ya grandfather loved.', 'Two points, ${n}. Simple. Clean. Nobody argued.', '${n} pulls up and hits. Da defender is still sayin’ hello to his momma in da stands.', 'Bucket for ${n}. I’ve seen worse. I’ve seen a lot worse.'],
        layup: ['Layup. Very fancy. Almost looked like he planned it.', '${n} takes it to da rack. Easy as walkin’. Slow walkin’.', '${n} lays it in. Da rim barely noticed.', 'Finger roll from ${n}. Soft as a pillow, hard to watch for da defense.', '${n} gets to da basket. Nobody in a jersey was in da neighborhood.'],
        dunk: ['Dunk! ${n} just reminded da rim who pays da bills!', 'Ohhh, dat’s a dunk! Da rim would like a word wit’ its lawyer.', '${n} throws it down! Somebody check da backboard’s pulse.', 'Posterized! I hope da defender’s mother wasn’t watchin’.', '${n} hammers it! Da rim is pressin’ charges.', 'Slam! ${n} with two hands and zero manners.', 'Oh, ${n} just put him on a poster. Frame it, kid.', 'Flush! ${n} went up and da defense went home.'],
        fireDunk: ['Okay, dat dunk was illegal in several states. Includin’ dis one.', 'Somebody call da fire department! Oh wait, dey’re busy gettin’ dunked on.', 'Dat’s not a dunk, dat’s a crime scene wit’ a net!', 'Da rim is on fire, da floor is on fire, my eyebrows are on fire.', 'Dat dunk needs a permit. He didn’t get one.'],
        oop: ['Alley-oop! Dey practiced dat. In a dream. A very vivid dream.', 'Lob city! Gravity just filed a complaint.', 'Throw it up, catch it, slam it. Da easy way, if ya can fly.', 'Alley-oop! Somebody up dere likes him.'],
        fire: ['${n} is on fire! Stand back, folks. And maybe stop guardin’ him, it’s clearly not workin’.', 'He’s heatin’ up! Somebody get ${n} a fire extinguisher. Or a defender. Either one.', '${n} is on fire! Next shot goes in, guaranteed. Fuhgeddaboudit!', '${n} is cookin’! Three in a row and da arena smells like smoke.', 'Fire! ${n} can’t miss, and da defense can’t watch.'],
        hot: ['${n} is heatin’ up. Two in a row. Da scoutin’ report is now just a sad poem.', 'Two straight for ${n}. One more and we call da fire marshal.', '${n} is feelin’ it. Da defense is feelin’ somethin’ else.'],
        spent: ['And just like dat, da fire is spent. Back to bein’ mortal.', 'He cashed in da heat. Now da defense can exhale.', 'Fire used. Receipt printed. Come again, kid.', 'Da hot hand is gone. He’s a regular guy again, which is still pretty good.'],
        cooled: ['And da fire is out. Thoughts and prayers.', 'He cooled off. Was fun while it lasted. For everybody except da defense.', 'Fire’s out. Back to work, kid.'],
        miss: ['Brick. Absolute brick. Da rim sends its regards.', '${n} misses. Don’t worry, da ball’s been through worse.', 'Missed it. Bold of him to shoot dat.', 'Dat shot had da accuracy of my weather forecast.', 'He pahked it in da cheap seats. Wicked bad.', 'Off da rim. ${n} and da basket are not speakin’ right now.', 'No good. ${n} shot it like he owed it money.', 'Clank. Dat one woke up da people in da nosebleeds.', '${n} misses. Da basket was right dere. It’s been dere all night.', 'Short. Way short. Somebody buy ${n} a sandwich.'],
        airball: ['Airball! ${n} just threw a very expensive pass to nobody.', 'Airball. Da ball didn’t even say goodbye.', 'Airball! ${n} missed da rim, da net, and da point.', 'Nothin’ but air. Da rim is filin’ a missin’ persons report on dat one.'],
        block: ['Rejected! Not in my house. Well, technically not my house. But still!', 'Blocked! ${n} sends dat back where it came from. Customer service.', 'Get dat outta here! Da ball’s been shipped to row twelve.', '${n} with da block! Dat shot got returned to sender, no postage.', 'Swatted! ${n} said no, and he said it loud.', 'Denied! ${n} put a lid on da basket.'],
        steal: ['${n} picks his pocket. Shameful, honestly.', 'Stolen! Dat ball was only borrowed. Now it’s a gift.', 'Turnover. Somebody tell him dribblin’ is optional but holdin’ on is not.', '${n} takes it away. Dat’s larceny, and I love it.', 'Steal! ${n} read dat like a bedtime story.', '${n} rips it. Da ball handler is still lookin’ for it.'],
        ankle: ['Ankles! Gone! Somebody call a medic. Or a lawyer.', '${n} just broke dat defender. Please put da ankles down gently.', 'Ohhh! He sat him down. Sit down, son, you’re done.', 'Dat’s a crossover, kid. Da defender is still lookin’ for his legs.', '${n} with da shake! Da defender needs a map and a hug.', 'Crossover! Dat man fell down in front of his whole family.'],
        clock: ['Shot clock violation. Twenty-four seconds and nothin’ to show but regret.', 'Da shot clock expired. It’s a clock, not a suggestion.', 'Shot clock. Dey had twenty-four seconds and used ’em all thinkin’.'],
        out: ['Out of bounds. Da lines were right dere. Dey’re painted on and everything.', 'Dat ball left da court. It had places to be.', 'Out of bounds. Da ball wanted a better seat.'],
        clear: ['Take it back. Da blacktop council has spoken.', 'Clear it, or don’t score. Dose are da rules. I just made ’em up, but still.', 'Gotta clear it past da arc, kid. Dat’s street law.'],
        stall: ['He’s been dribblin’ for a while now. Is dis a strategy or a hobby?', 'Da ball handler is thinkin’. We’ll check back next week.', 'Still dribblin’. I’ve had shorter relationships.'],
        rebound: ['Rebound. Somebody had to.', '${n} grabs it. Nobody argued.', '${n} with da board. Elbows out, feelins’ hurt.', 'Board, ${n}. Da big fella eats.'],
        close: ['Tight game. My blood pressure and da scoreboard are both risin’.', 'Everything’s on da line, and it’s still just a game. Wild.', 'Dis one’s a coin flip, folks. Somebody hide my wallet.'],
        blowout: ['Dis is gettin’ ugly. Da comeback is currently in a different time zone.', 'Da scoreboard is just rubbin’ it in now.', 'It’s a blowout, folks. Da bench is checkin’ dinner reservations.'],
        quarter: ['End of da quarter. Time for a break from all da excitement.', 'Dat’s da quarter. Da defense will now go back to hidin’.', 'Quarter’s over. Everybody take a breath. Especially da refs.'],
        half: ['Halftime. Coaches will now say things like “be more aggressive.” Groundbreakin’.', 'Halftime, folks. Go get a pretzel, I’ll be here complainin’.'],
        over: ['Final buzzer. We came, we saw, we sat through all of it.', 'And dat’s da game. Please applaud like ya meant it.', 'Dat’s it, dat’s da ballgame. Drive home safe, tip ya ushers.'],
        win: ['${t} win. Their reward is braggin’ rights, and I hear dose are basically free.', '${t} take it. Somebody get dem a trophy, or a sandwich.', '${t} win da game. Da other guys get a long bus ride.'],
        foul: ['Foul on ${n}. Da ref saw it, I saw it, his mother saw it.', '${n} with da reach. Dat’s a foul, kid. Dat’s always a foul.', 'Whistle! ${n} grabbed everything but da ball.', 'Foul, ${n}. He’s guardin’ wit’ his hands like it’s a wedding.', 'Dat’s a foul on ${n}. Swipin’ like dat, ya gonna get a ticket.', 'Reach-in on ${n}. Da ref has a whistle and he knows how to use it.'],
        sfoul: ['Shooting foul! ${n} got hit on da arm, da shoulder, and his feelins’.', 'Foul on da shot. ${n} is goin’ to da line.', 'Whistle, shooting foul. ${n} got fouled harder than my taxes.', 'Dey hacked ${n} on da way up. Free throws comin’.'],
        andone: ['And one! ${n} scores through da contact and gets a free throw for his trouble.', 'Bucket and a foul! ${n} is goin’ to da line wit’ a smile.', 'And one! Count it, kid. Da defense fouled him and it still went in.'],
        ft: ['${n} to da line. Quietest moment in sports, except for me.', 'Free throws for ${n}. Nobody guardin’ him, and he can still miss. Dat’s basketball.', '${n} steps up to da stripe. Deep breath, everybody.'],
        ftmiss: ['${n} misses da free throw. It’s free, kid. It’s in da name.', 'Off da rim from da line. ${n} will hear about dat at practice.', 'Missed free throw. Fifteen feet, nobody guardin’ him. Madone.'],
        ftmake: ['${n} knocks it down from da line. Like he’s supposed to.', 'Free throw is good. Easy money for ${n}.', 'Swish from da stripe. ${n} does his job.'],
        bonus: ['Dey’re in da bonus now. Every foul is a trip to da line.', 'Bonus time, folks. Touch him and he shoots free throws.', 'Team fouls are pilin’ up. Welcome to da bonus.'],
        foulout: ['${n} is in foul trouble! And instead of leavin’, he wants to fight da referee. Dis is why I love dis league.', 'Dat’s too many fouls for ${n}. He’s got a choice: sit down, or square up wit’ da ref.', '${n} fouled out, and he does not accept it. Da ref is takin’ off his glasses.'],
        fightwin: ['${n} beat up da referee and he stays in da game! Dis is da worst sport ever and I never wanna leave.', 'Da ref is down! ${n} wins and his fouls are gone. Somebody call a new ref.', '${n} wins da fight! Somebody get dat ref an ice pack and a new job.'],
        fightlose: ['Da referee wins! ${n} is ejected, and humiliated, in dat order.', '${n} lost to da referee. Ya can’t make dis up, folks. He’s gone.', 'Ejected! ${n} got beat by a guy wit’ a whistle. Go sit in da car.'],
        sub: ['${n} checks in. Nobody knows who he is, includin’ his teammates.', 'Here comes ${n} off da bench. Stretch, kid, ya got work.', '${n} is in da game. Da scouting report on him is a blank page.'],
        injury: ['${n} is hurt, but he’s stayin’ in. Tough kid. Dumb kid, but tough.', '${n} is limpin’. He’ll play through it, because dis is a video game.', 'Ouch. ${n} is bangin’ up but he waved off da trainer.'],
        swish: ['Nothin’ but net. Dat whing sound is why we watch, folks.', 'Swish! Didn’t touch a thing. Clean as my record.', 'Pure. All net. Da rim never got a say.'],
        charge: ['Offensive foul on ${n}. He ran over dat man like he owed him money.', 'Charge! ${n} lowered da shoulder and da defender sold it. Great acting, honestly.', '${n} plowed right through him. Dat’s a charge, and dat’s a turnover.', 'Dat’s a player control foul on ${n}. He had da whole floor and picked da one spot wit’ a body in it.', 'Charge. ${n} bulldozed a guy who was just standin’ dere. Ball goes da other way.', 'Oh, ${n} put him on da floor, but da ref says dat’s on da offense. Tough beat.'],
        flagrant: ['Flagrant foul on ${n}! Dat was a takedown, not a basketball play.', 'Whoa! ${n} clotheslined him at da rim. Dat’s a flagrant, and it counts double.', '${n} just wrapped him up in midair. Dat’s dirty, dat’s flagrant, and dat’s two fouls on his line.', 'Hard foul by ${n}! Da ref didn’t like it one bit. Flagrant, and he’s in foul trouble now.', 'Nobody dunks on ${n}, apparently. He took da man down, and he’s payin’ for it. Flagrant.', '${n} with da hack of da night. Flagrant foul. Dat one goes on his permanent record.'],
      },
    },
    {
      name: 'Shorty', voices: [3], speed: 0.93, shortyRate: 0.45,
      openers: ['Shorty.', 'Yo, Shorty.', 'Shorty, listen.', 'Shorty, I can’t believe what I’m seein’ right now.', 'Yo.', 'Nah, nah, nah.', 'Listen.', 'Yo, hold on.', 'See, dat’s what I’m talkin’ about.', 'Man, listen.', 'Woo!', 'Ayo.', 'Come on, man.', 'Look.', 'Okay.', 'Yo, yo, yo.', 'Bro.', 'Real talk.', 'My guy.'],
      tags: ['Shorty.', 'Dat’s crazy work, Shorty.', 'Yo, I can’t believe he would’ve did dat, Shorty.', 'If it was me, I would’ve played defense, Shorty.', 'I can’t believe da things he doin’ on dis court right now, Shorty.', 'Dese guys really doin’ it to dem, Shorty.', 'He cookin’ dem, Shorty.', 'Dat’s light work, Shorty.', 'Somebody gotta guard him, Shorty.', 'Dat’s nasty, Shorty.', 'I can’t believe he did dat, Shorty.', 'You gotta respect it, Shorty.', 'If dat’s me, I’m playin’ defense, Shorty.', 'Shoutout to him, Shorty.', 'Dat’s a hooper, Shorty.', 'Hoop dreams, Shorty.', 'Dat’s tough, Shorty.', 'Lock in, Shorty.', 'I been sayin’ dat, Shorty.', 'Ain’t no way, Shorty.', 'He different, Shorty.', 'We seen it, Shorty.',
        { t: 'And it’s a one possession game, Shorty.', when: 'close' }, { t: 'Dis is a dogfight right now, Shorty.', when: 'close' }, { t: 'Game’s over, dey just ain’t tell him yet, Shorty.', when: 'lead' }, { t: 'Dat lead is disrespectful, Shorty.', when: 'lead' }, { t: 'Under a minute, Shorty.', when: 'late' }, { t: 'Clutch time, Shorty.', when: 'late' }, { t: 'He heatin’ up, Shorty.', when: 'hot' }, { t: 'Give him da rock again, Shorty.', when: 'hot' }, { t: 'Overtime, Shorty. Dis is what we do it for.', when: 'ot' }, { t: 'Dat’s park ball, Shorty. Call your own fouls.', when: 'black' }],
      cores: {
        start: ['We live, Shorty. Two squads, one rock, and I’m right here talkin’ my talk.', 'Game time. I’m lockin’ in and I need y’all to lock in wit’ me, Shorty.', 'Tip-off, man. Let’s see who really a hooper tonight, Shorty.', 'We got a ref tonight, Shorty. Dat means somebody finna complain all game.'],
        startB: ['Park ball, Shorty. No refs, call your own fouls, and don’t be soft.', 'Dis is da blacktop. Where I learned everything, Shorty. Mostly how to lose.', 'Chain nets and concrete. Can’t fake it out here, Shorty.'],
        three: ['${n} from three! Dat’s a confident man right dere.', '${n} let it go from deep and never even looked, Shorty.', 'Three ball, ${n}. Dat boy got range, Shorty.', 'Yo, ${n} just hit dat in his face. In his face, Shorty.', '${n} knocks down da three. If dat’s me, I’m closin’ out harder, Shorty.', '${n} from downtown! Ain’t nobody rotatin’. Dat’s a coachin’ problem.', 'Bang, ${n}. Dat’s a cash shot, Shorty.', '${n} is lettin’ it fly, man. Somebody put a hand up, Shorty.', 'Wet. ${n} from three and he walkin’ back like it’s nothin’.'],
        two: ['${n} wit’ da bucket. Smooth, Shorty.', '${n} scores. Easy work right dere.', 'Mid-range, ${n}. Dat’s a lost art, Shorty.', '${n} pulls up and hits. Nobody contested, man.', 'Two for ${n}. He was due, Shorty.', '${n} gets to his spot and knocks it down. Dat’s a pro move.', 'Bucket, ${n}. Dat defense was a suggestion, Shorty.'],
        layup: ['${n} to da rim, easy. Dey just let him walk in, Shorty.', 'Layup for ${n}. Where was da help?', '${n} finishes. Dat lane was wide open, man.', 'Finger roll, ${n}. Soft touch, Shorty.'],
        dunk: ['Oh! ${n} just dunked on dat man! On his head, Shorty!', '${n} flushed it! Somebody check on da defender, Shorty.', 'Yo, ${n} went up and did not come down nice. Dat’s a poster.', '${n} hammers it. Dat’s disrespectful, I love it.', 'Dunk, ${n}! If dat’s me I’m not even jumpin’, Shorty, I’m takin’ da foul.', '${n} wit’ da slam! Da rim shook and so did I.', 'Two hands, ${n}! Dat man got dunked on in front of his people, Shorty.'],
        fireDunk: ['Dat dunk was illegal, Shorty! Dat boy is on fire for real!', 'Nah, dat ain’t a dunk, dat’s a felony, Shorty.', '${n} on fire and dunkin’ like dat? Game over, man.', 'Yo, da whole gym just stood up. Dat’s a fire dunk, Shorty.'],
        oop: ['Alley-oop! Dey been workin’ on dat, Shorty.', 'Lob! Caught it, finished it, no questions.', 'Oop! Dat connection is crazy, Shorty.'],
        fire: ['${n} is on fire! Man, ain’t nobody stoppin’ him right now, Shorty.', '${n} cookin’! Three straight. Don’t even guard him, just pray.', 'He on fire, Shorty. Next one is goin’ in, I promise you dat.', '${n} is lit right now. Dat’s a problem for everybody.'],
        hot: ['${n} is heatin’ up. Two in a row, Shorty.', 'Yo, ${n} is gettin’ warm. Somebody get a body on him.', '${n} got two straight. One more and it’s over for da defense, Shorty.'],
        spent: ['Fire’s gone. He used it, Shorty. Back to regular.', 'He cashed dat heat in. Now it’s a fair fight again.', 'Dat was da fire shot. Now he gotta earn it again, Shorty.'],
        cooled: ['And he cooled off. It happens, Shorty.', 'Fire’s out. He was feelin’ it for a minute dere.', 'He cooled down. Back to normal hoopin’, Shorty.'],
        miss: ['${n} missed. Dat was a bad shot, man.', 'Brick, Shorty. Dat one hurt my eyes.', '${n} off da rim. If dat’s me, I’m drivin’ dat, Shorty.', 'No good. He rushed it, man.', '${n} misses. Dat’s a heat check gone wrong, Shorty.', 'Clank. Somebody tell him to shoot it in rhythm.', '${n} short. Legs gone, Shorty.', 'Miss. Dat defense actually did somethin’ for once.', 'Nah, ${n}, dat ain’t your shot, Shorty.'],
        airball: ['Airball! Yo, ${n}, what was dat, Shorty?', 'Airball, man. Didn’t touch nothin’.', '${n} airballed it. Dat’s embarrassin’, Shorty. Da crowd gonna chant.'],
        block: ['${n} wit’ da block! Get dat outta here!', 'Blocked! ${n} said not today, Shorty.', '${n} sent it back! Dat’s what defense look like, Shorty.', 'Rejected! ${n} timed dat perfect, man.', 'Swat! Don’t bring dat weak stuff in here, Shorty.'],
        steal: ['${n} picked him clean. Dat’s active hands, Shorty.', 'Steal! ${n} was in da passin’ lane all day.', '${n} takes it! Ball handler got lazy, man.', 'Yo, ${n} just took dat like it was his. Dat’s defense, Shorty.', 'Stolen! If dat’s me I’m protectin’ da rock better, Shorty.'],
        ankle: ['Oh! ${n} broke his ankles, Shorty! Dat man fell down!', '${n} crossed him up! Somebody help dat defender up.', 'Ankles! ${n} shook him outta his shoes, Shorty.', 'Yo, ${n} just made him sit down. Dat’s a crossover, man.', 'He got crossed! Dat defender is on da floor, Shorty, on da floor!'],
        clock: ['Shot clock violation. Dey was too slow, Shorty.', 'Twenty-four seconds and nothin’. Dat’s bad offense, man.', 'Shot clock. Somebody gotta want to shoot it, Shorty.'],
        out: ['Out of bounds. Sloppy, man.', 'Dat ball went out. Gotta be stronger wit’ it, Shorty.', 'Out of bounds. Careless, Shorty.'],
        clear: ['Take it back, Shorty. Dem da rules out here.', 'Clear it, man. Ya gotta clear it.', 'Gotta take it back past da line. Park rules, Shorty.'],
        stall: ['He dribblin’ too much, man. Make a move, Shorty.', 'Yo, pass da ball. We all watchin’ him dribble.', 'He stallin’. Dat ain’t it, Shorty.'],
        rebound: ['${n} wit’ da board. Dat’s effort, Shorty.', 'Rebound, ${n}. Boxed out and got it.', '${n} grabs it. Want it more, dat’s all, Shorty.'],
        close: ['Dis one is close, Shorty. Every possession matter now.', 'Tight game, man. Dis is where hoopers get made.', 'It’s a dogfight, Shorty. I love it.'],
        blowout: ['It’s a blowout, Shorty. Somebody call da bus.', 'Dey gettin’ cooked right now. Dat’s ugly, man.', 'Game over, Shorty. Dey just playin’ out da clock.'],
        quarter: ['End of da quarter. Regroup, Shorty.', 'Dat’s da quarter. Coaches got some talkin’ to do.', 'Quarter over. Adjustments, Shorty, adjustments.'],
        half: ['Halftime. Go fix it in da locker room, Shorty.', 'Half. Dat second half gonna tell da story, man.'],
        over: ['Dat’s da game, Shorty. Good hoop.', 'Final. We seen some things tonight, man.', 'It’s over, Shorty. Handshake line, let’s go.'],
        win: ['${t} get da W. Dat’s a good win, Shorty.', '${t} win it. Respect, man.', '${t} take dis one. Dey earned it, Shorty.'],
        foul: ['Foul on ${n}. Yo, keep your hands to yourself, Shorty.', '${n} reachin’. Move your feet, man, don’t reach.', 'Dat’s a foul, ${n}. Da ref saw dat clear as day.', '${n} wit’ da reach-in. If dat’s me, I’m slidin’ my feet, Shorty.', 'Whistle. ${n} fouled him. Dat’s lazy defense, man.'],
        sfoul: ['Shootin’ foul. Dey hit ${n} on da arm, Shorty.', '${n} got fouled on da shot. Free throws, man.', 'Foul on da shooter. ${n} is goin’ to da line, Shorty.'],
        andone: ['And one! ${n} finished through da contact, Shorty!', 'Bucket plus da foul. ${n} is strong, man.', 'And one! Dat’s a tough finish, Shorty.'],
        ft: ['${n} at da line. Knock dese down, Shorty.', 'Free throws for ${n}. Easy points if you focus, man.', '${n} shootin’ free throws. Breathe, Shorty.'],
        ftmiss: ['${n} missed da free throw. Come on, man, dat’s free.', 'Missed from da line. Dat’s practice stuff, Shorty.', '${n} bricks da freebie. Can’t do dat late, man.'],
        ftmake: ['${n} knocks down da free throw. Easy, Shorty.', 'Free throw good. Dat’s money, man.', '${n} from da line, good. Dat’s routine, Shorty.'],
        bonus: ['Dey in da bonus now, Shorty. Every foul is free throws.', 'Bonus, man. Attack da rim and get to da line.', 'Team fouls addin’ up. Dey in da bonus, Shorty.'],
        foulout: ['${n} in foul trouble, and he wanna fight da ref, Shorty! Dis is wild!', 'Yo, ${n} got too many fouls and he squarin’ up wit’ da referee. I can’t believe it, Shorty.', '${n} ain’t leavin’ quietly. He gonna fight da ref, man. Dis is crazy work.'],
        fightwin: ['${n} beat da ref! He stayin’ in da game, Shorty! Dat’s crazy work!', 'Yo, ${n} won da fight! Da ref is down and he back in da game, Shorty.', '${n} dropped da referee. Fouls reset, man. Ain’t no way.'],
        fightlose: ['Da ref won! ${n} is gone, Shorty. Ejected, man.', 'Yo, ${n} lost to da ref. Dat’s embarrassin’, Shorty. Go sit down.', 'Ref got hands! ${n} is outta here, man.'],
        sub: ['${n} checkin’ in. Bench guy, man, go do your job, Shorty.', 'Here come ${n} off da bench. Give him a chance, Shorty.', '${n} is in. Dat’s da next man up, man.'],
        injury: ['${n} is hurt, Shorty. He stayin’ in though. Dat’s heart, man.', 'Yo, ${n} is limpin’. Tough as nails to keep playin’, Shorty.', '${n} got banged up. He gonna play through it, man.'],
        swish: ['Swish! Nothin’ but net, Shorty. Dat sound right dere.', 'Yo, dat was pure. Didn’t touch da rim, man.', 'All net. Dat’s a shooter’s shot, Shorty.'],
        charge: ['Charge on ${n}, Shorty. He ran through dat man, bro.', 'Yo, ${n} just trucked him. Dat’s offensive, man. Turnover.', 'Nah, ${n} gotta see dat defender set. Dat’s a charge, Shorty.', 'He took da charge on ${n}! Dat’s a real one, Shorty. Sacrificin’ da body.', '${n} put his shoulder in him. Refs callin’ dat every time, man.', 'Dat’s a charge, Shorty. ${n} had space and went right at da chest.'],
        flagrant: ['Yo! ${n} just took him out da air! Dat’s flagrant, Shorty.', 'Nah, nah, ${n} can’t do dat. Dat’s a flagrant, man. Dat counts double.', '${n} wrapped him up on da dunk. Dat ain’t basketball, Shorty. Flagrant.', 'Whoa, ${n} went for da neck, man. Flagrant. He in foul trouble now, Shorty.', 'Dat’s a hard foul by ${n}, Shorty. Refs ain’t lettin’ dat slide. Two on him.', '${n} said nobody dunkin’ on me today. Dat’s a flagrant, bro. Ugly.'],
      },
    },
  ],
};
const EXC = { three: 0.8, dunk: 0.8, fireDunk: 1, oop: 0.85, fire: 1, hot: 0.6, block: 0.8, steal: 0.6, ankle: 0.9, layup: 0.4, two: 0.35, start: 0.5, startB: 0.5, over: 0.5, miss: 0.1, airball: 0.4, foulout: 0.9, fightwin: 1, fightlose: 0.8, andone: 0.7, sfoul: 0.5, swish: 0.6, injury: 0.4, charge: 0.4, flagrant: 0.7 };
// which contextual conditions hold right now (S is defined later, in d_game.js, so this is read at call time only)
function talkCtx() {
  const c = {}; if (typeof S === 'undefined' || !S.teams || S.teams.length < 2) return c;
  const d = Math.abs(S.teams[0].score - S.teams[1].score);
  c.d = d; c.close = d <= 3 && S.elapsed > 20; c.lead = d >= 15; c.late = S.mode === 'play' && S.clock < 60 && S.clock > 0 && S.period >= 4; c.ot = S.period > 4;
  c.black = S.mode === 'black'; c.play = S.mode === 'play';
  const ls = S.lastScorer; c.hot = !!ls && ls.streak >= 2 && !ls.fire;
  return c;
}
/* What a tag may follow. Each plain tag has a type, each event key a class, and a class allows some types, so endings fit the play:
   no hype after a routine free throw or a miss, nothing light-hearted after an ejection or an injury. Indexes are clip ids, so the
   tables point at tags by index and the tag lists themselves never change order. */
const TAG_TYPE = [
  ['hype', 'respect', 'respect', 'neutral', 'negative', 'hype', 'hype', 'bored', 'light', 'negative', 'hype', 'sarcastic', 'respect', 'gameover', 'hype', 'neutral'],
  ['plain', 'hype', 'react', 'score', 'hype', 'hype', 'score', 'light', 'score', 'hype', 'react', 'respect', 'score', 'respect', 'respect', 'neutral', 'tough', 'lockin', 'neutral', 'react', 'respect', 'neutral'],
];
const OPEN_GRAVE_NO = [[0, 4, 6, 12], [8, 10]]; // openers that read as celebrating (Ayyy, Fuhgeddaboudit, Yeah yeah, Ha / See dat's what I'm talkin' about, Woo)
const KEY_CLASS = {}; // key -> class
for (const [cl, keys] of Object.entries({
  score: 'three dunk fireDunk oop fire hot swish andone', play: 'block steal ankle', routine: 'two layup', small: 'ftmake rebound',
  miss: 'miss airball ftmiss spent cooled', foul: 'foul sfoul charge flagrant bonus', grave: 'foulout fightlose injury', fightwin: 'fightwin',
  calm: 'ft sub clock out clear stall close blowout quarter half start startB', final: 'over win',
})) for (const k of keys.split(' ')) KEY_CLASS[k] = cl;
const CLASS_TYPES = {
  score: 'plain hype react score light respect neutral tough', play: 'plain hype react respect neutral tough', routine: 'plain react score light respect neutral bored',
  small: 'plain light respect neutral bored', miss: 'plain react lockin negative neutral tough bored sarcastic', foul: 'plain react negative sarcastic neutral lockin tough',
  grave: 'plain react neutral tough negative', fightwin: 'plain hype react respect neutral', calm: 'plain neutral bored sarcastic lockin negative', final: 'plain respect neutral react gameover',
};
const SCORE_KEYS = ['three', 'two', 'layup', 'dunk', 'fireDunk', 'oop', 'fire', 'swish', 'andone'];
// the team a line is about, from the name it calls: a player's short name, or a team's short name (the 'win' line)
function talkSide(name) {
  if (!name || typeof S === 'undefined' || !S.teams) return null; const nm = name.replace(/ & Co$/, '');
  for (const t of S.teams) { if (t.info && (t.info.short === nm || t.info.name === nm)) return t; if ((t.players || []).some(q => q.short === nm)) return t; }
  const q = (S.players || []).find(q => q.short === nm); return q ? q.team : null;
}
// may tag i of persona pi end a `key` line about `name` right now?
function talkTagOk(pi, i, key, name, ctx, coreTxt) {
  const t = TALK.personas[pi].tags[i], cl = KEY_CLASS[key] || 'calm';
  if (typeof t === 'string') {
    const ty = TAG_TYPE[pi][i] || 'neutral';
    if (ty === 'plain' && /Shorty\.$/.test(coreTxt.trim())) return false; // never "... Shorty. Shorty."
    if (ty === 'gameover') { const side = talkSide(name), other = side && S.teams.find(x => x !== side); return cl === 'final' || key === 'blowout' || (ctx.late && ctx.lead && !!side && side.score > other.score && SCORE_KEYS.includes(key)); }
    return CLASS_TYPES[cl].split(' ').includes(ty);
  }
  if (!ctx[t.when] || cl === 'grave') return false;
  if (t.when === 'late' && ctx.d > 8) return false; // no "clutch time" in a blowout
  if ((t.when === 'lead' || t.when === 'late') && typeof Talk !== 'undefined' && Talk.mem && S.elapsed - ((Talk.mem.ctxAt || {})[t.when] || -999) < (t.when === 'lead' ? 75 : 25)) return false; // rub it in, or call it clutch, once in a while, not every bucket
  if (t.when === 'lead') { // only for the team that is ahead, and only on its good plays (or a neutral line with no name)
    const side = talkSide(name); if (!side) return !name && ['blowout', 'quarter', 'half', 'over'].includes(key);
    const other = S.teams.find(x => x !== side); return side.score > other.score && ['score', 'play', 'routine', 'small', 'final'].includes(cl);
  }
  if (t.when === 'hot') return SCORE_KEYS.includes(key) && key !== 'fire' && !!S.lastScorer && S.lastScorer.short === (name || '').replace(/ & Co$/, '');
  return true;
}
const slugName = x => x.toLowerCase().replace(/[^a-z0-9]+/g, '');
/* The engine: Com.say(key, name, prio, cd) keeps its signature. Per game it remembers which core / opener / tag it used (Com.mem), picks the
   least recently used core for that key, and dresses it with an opener and a tag some of the time so the same core still reads differently. */
const Talk = {
  mem: null, seed: 0,
  reset() { this.mem = { core: {}, op: [[], []], tag: [[], []], n: 0 }; try { this.seed = (+(localStorage.getItem('hoopdreams.talk') || 0) + 1) % 1000; localStorage.setItem('hoopdreams.talk', String(this.seed)); } catch (e) { this.seed = (Math.random() * 1000) | 0; } },
  // pick among `allowed` indexes: one not used yet this game if any, else the one used longest ago; `used` keeps use order
  pickFresh(allowed, used) {
    if (!allowed.length) return -1; const fresh = allowed.filter(i => !used.includes(i));
    const i = fresh.length ? fresh[(Math.random() * fresh.length + this.seed) % fresh.length | 0] : allowed.reduce((a, b) => used.indexOf(b) < used.indexOf(a) ? b : a);
    const k = used.indexOf(i); if (k >= 0) used.splice(k, 1); used.push(i); return i;
  },
  // least recently used pick among `n` items with memory list `used` (indexes in use order); a fresh item wins, else the oldest
  lru(n, used) {
    if (n <= 0) return -1; const fresh = []; for (let i = 0; i < n; i++) if (!used.includes(i)) fresh.push(i);
    const i = fresh.length ? fresh[(Math.random() * fresh.length + this.seed) % fresh.length | 0] : used.shift(); used.push(i); return i;
  },
  personaFor(key) {
    const k = typeof CFG !== 'undefined' ? CFG.persona || 0 : 0; if (k < 2) return k;
    // booth: the studio guy calls the play, Shorty takes the quiet moments and reacts after big plays (see say)
    if (['start', 'startB', 'over', 'win', 'quarter', 'half'].includes(key)) return 0;
    return (EXC[key] || 0.3) >= 0.6 ? 0 : (this.mem && this.mem.n++ % 2 ? 1 : 0);
  },
  compose(pi, key, name) {
    if (!this.mem) this.reset(); const P = TALK.personas[pi], arr = P.cores[key]; if (!arr) return null;
    const ctx = talkCtx(), ok = x => typeof x === 'string' || !x.when || ctx[x.when], txt = x => typeof x === 'string' ? x : x.t;
    const used = this.mem.core[pi + key] = this.mem.core[pi + key] || [];
    const cands = []; arr.forEach((c, i) => { if (ok(c)) cands.push(i); }); if (!cands.length) return null;
    const freshC = cands.filter(i => !used.includes(i)); const ci = freshC.length ? freshC[(Math.random() * freshC.length) | 0] : cands[(Math.random() * cands.length) | 0];
    used.push(ci); if (used.length > arr.length - 1) used.shift();
    const segs = [{ kind: 'core', i: ci, t: txt(arr[ci]) }];
    const big = (EXC[key] || 0.3) >= 0.6, r = Math.random();
    if (r < (big ? 0.55 : 0.35) && P.openers.length) {
      const no = KEY_CLASS[key] === 'grave' ? OPEN_GRAVE_NO[pi] || [] : [], ops = []; P.openers.forEach((o, i) => { if (!no.includes(i)) ops.push(i); });
      const oi = this.pickFresh(ops, this.mem.op[pi]); if (oi >= 0) segs.unshift({ kind: 'op', i: oi, t: P.openers[oi] });
    }
    // tags: a contextual one some of the time, else a plain one; only those that fit the play, the score and the core, fresh first
    const coreTxt = segs[segs.length - 1].t, fits = []; P.tags.forEach((t, i) => { if (talkTagOk(pi, i, key, name, ctx, coreTxt)) fits.push(i); });
    const ctxTags = fits.filter(i => typeof P.tags[i] !== 'string'), plain = fits.filter(i => typeof P.tags[i] === 'string'), u = this.mem.tag[pi];
    const spent = l => l.every(i => u.includes(i)); let ti = -1; // a spent pool hands over to the other one until both are used up
    if (ctxTags.length && Math.random() < 0.35) ti = this.pickFresh(spent(ctxTags) && !spent(plain) ? plain : ctxTags, u);
    else if (Math.random() < (P.shortyRate || 0.3)) ti = this.pickFresh(spent(plain) && !spent(ctxTags) ? ctxTags : plain, u);
    if (ti >= 0) { segs.push({ kind: 'tag', i: ti, t: txt(P.tags[ti]) }); if (P.tags[ti].when) { this.mem.ctxAt = this.mem.ctxAt || {}; this.mem.ctxAt[P.tags[ti].when] = S.elapsed; } }
    if (pi === 0 && typeof CFG !== 'undefined' && CFG.shortyAll && Math.random() < 0.5 && !/Shorty\.$/.test(segs[segs.length - 1].t.trim())) segs.push({ kind: 'shorty', t: 'Shorty.' });
    return { persona: P, key, segs, text: segs.map(s => s.t).join(' ') };
  },
  // clip ids for one composed line in studio voice v: opener, [core text, name, core text...], tag
  ids(line, v, name) {
    const ids = [], co = / & Co$/.test(name || ''), nm = (name || '').replace(/ & Co$/, '');
    for (const s of line.segs) {
      if (s.kind === 'op') ids.push(`o.${v}.${s.i}`);
      else if (s.kind === 'tag') ids.push(`t.${v}.${s.i}`);
      else if (s.kind === 'shorty') ids.push(`x.${v}.shorty`);
      else { const parts = s.t.split(/\$\{[nt]\}/); parts.forEach((p, si) => { if (si > 0) { ids.push(`n.${v}.${slugName(nm || (/\$\{t\}/.test(s.t) ? 'They' : 'He'))}`); if (co) ids.push(`n.${v}.andco`); } if (p.trim()) ids.push(`g.${v}.${line.key}.${s.i}.${si}`); }); }
    }
    return ids;
  },
  fill(line, name) { return line.text.replace(/\$\{n\}/g, name || 'He').replace(/\$\{t\}/g, name || 'They'); },
};
// every clip id the grammar can ask for (used by the test harness to check vox.js, and by tools/dump_vox_text.js through TALK)
function talkAllIds() {
  const out = [];
  TALK.personas.forEach(P => P.voices.forEach(v => {
    P.openers.forEach((o, i) => out.push(`o.${v}.${i}`)); P.tags.forEach((t, i) => out.push(`t.${v}.${i}`));
    for (const k in P.cores) P.cores[k].forEach((c, i) => (typeof c === 'string' ? c : c.t).split(/\$\{[nt]\}/).forEach((p, si) => { if (p.trim()) out.push(`g.${v}.${k}.${i}.${si}`); }));
  }));
  return out;
}
const personaItem = () => ({ label: 'Commentator', sub: 'Studio is the sarcastic New York guy · Shorty is a laid-back retired hooper on a podcast (the default) · Booth puts both on the call. Both are generated voices', val: () => ['Studio', 'Shorty', 'Booth · Studio + Shorty'][CFG.persona || 0], left: () => { CFG.persona = ((CFG.persona || 0) + 2) % 3; saveCfg(); Snd.demoVoice(); }, right: () => { CFG.persona = ((CFG.persona || 0) + 1) % 3; saveCfg(); Snd.demoVoice(); } });
const shortyItem = () => ({ label: 'Everybody Says Shorty', sub: 'The players and the studio guy throw a “Shorty” in too, not just Shorty in the booth', val: () => CFG.shortyAll ? 'On' : 'Off', left: () => { CFG.shortyAll = !CFG.shortyAll; saveCfg(); }, right: () => { CFG.shortyAll = !CFG.shortyAll; saveCfg(); } });
function voiceLabel() {
  const hv = typeof VOX !== 'undefined';
  if (hv && CFG.vox < 3) return 'Studio \u00B7 ' + STUDIO[CFG.vox] + ' \u00B7 neural human voice';
  if (hv && CFG.vox === 3) return 'Studio booth \u00B7 all three voices';
  const vs = Snd.getVoices(); if (!vs.length) return 'Device default';
  const v = CFG.voice > 0 ? vs[Math.min(CFG.voice, vs.length) - 1] : vs[0];
  return 'Device \u00B7 ' + (CFG.voice > 0 ? '' : 'auto \u00B7 ') + v.name.replace(/^Microsoft |^Google /, '').replace(/ Online \(Natural\)| \(Natural\)/, '').replace(/ - English.*$/, '') + (Snd.isHuman(v) ? ' \u00B7 natural' : '');
}
// one list: the studio voices (0-2), the studio booth (3), then the device voices (auto, then the ranked list)
function stepVoice(d) {
  const hv = typeof VOX !== 'undefined', total = 5 + Math.min(Snd.getVoices().length, 12);
  let ci = CFG.vox < 4 ? CFG.vox : 4 + CFG.voice;
  do { ci = (ci + d + total) % total; } while (!hv && ci < 4);
  if (ci < 4) CFG.vox = ci; else { CFG.vox = 4; CFG.voice = ci - 4; }
  saveCfg(); Snd.demoVoice();
}
const voiceItem = () => ({ label: 'Commentator Voice', sub: 'Studio voices are neural human voices built into the game \u00B7 the booth rotates all three \u00B7 device voices use what this computer has', val: voiceLabel, left: () => stepVoice(-1), right: () => stepVoice(1) });
