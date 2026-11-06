// Prints every commentator line, player call-out and name the game can speak, as JSON for make_vox.py
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src');
const inp = fs.readFileSync(path.join(dir, 'b_input.js'), 'utf8'), core = fs.readFileSync(path.join(dir, 'a_core.js'), 'utf8');
const vm = require('vm');
const talkSrc = fs.readFileSync(path.join(dir, 'b_talk.js'), 'utf8');
const TALK = vm.runInNewContext(talkSrc + ';TALK', { localStorage: undefined });
const c0 = inp.indexOf('const CALLS = {'), c1 = inp.indexOf('};', c0);
const CALLS = eval('(' + inp.slice(c0 + 14, c1 + 1) + ')');
// player and team short names come from the same code the game uses
const game = fs.readFileSync(path.join(dir, 'd_game.js'), 'utf8');
const lastName = eval('(() => { ' + game.match(/const LAST = .*;/)[0] + '\n' + game.match(/const lastName = .*;/)[0] + '\n return lastName; })()');
const str = "(?:'([^']*)'|\"([^\"]*)\")";
const names = [...core.matchAll(/^\s+\w+:\s+\['([^']+)', '[GWB]'/gm)].map(m => lastName(m[1]));
const teams = [...core.matchAll(new RegExp("mkTeam\\('\\w+', " + str + ", " + str + ", " + str, 'g'))].map(m => m[5] || m[6]);
console.log(JSON.stringify({ TALK: TALK.personas.map(P => ({ name: P.name, voices: P.voices, speed: P.speed, openers: P.openers, tags: P.tags.map(t => typeof t === 'string' ? t : t.t), cores: Object.fromEntries(Object.entries(P.cores).map(([k, a]) => [k, a.map(c => typeof c === 'string' ? c : c.t)])) })), CALLS, names: [...new Set(names)], teams }));
