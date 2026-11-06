#!/usr/bin/env python3
"""Renders the commentator + call-out audio into src/vox.js (base64 mp3 clips) with the Kokoro neural TTS.

  pip install kokoro-onnx soundfile numpy        (needs ffmpeg with libmp3lame on PATH)
  python3 tools/make_vox.py kokoro-v1.0.int8.onnx voices-v1.0.bin

Model files: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0). Kokoro is Apache-2.0.
The game stitches the clips at runtime: line = [text clip] + [name clip] + [text clip]; call-outs are single clips.
Clip ids (o.<voice>.<i> openers, t.<voice>.<i> tags, g.<voice>.<key>.<line>.<part> core parts, n.<voice>.<name>, l.<voice>.demo, c<voice>.<phrase> call-outs) must match Talk.ids in src/b_talk.js and Snd.callClip in src/a_core.js.
"""
import sys, os, re, json, base64, hashlib, pickle, subprocess, time
import numpy as np
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
model, voices = sys.argv[1], sys.argv[2]
CACHE = os.path.join(os.environ.get('VOX_CACHE', HERE), '.vox_cache.pkl')
COM_VOICES = ['am_michael', 'am_fenrir', 'am_puck', 'am_onyx']   # 0-2 the studio commentator, 3 Shorty (set per persona in src/b_talk.js TALK.personas[].voices)
CALL_VOICES = ['am_adam', 'am_eric', 'am_liam', 'am_onyx', 'am_echo', 'am_fenrir', 'am_puck', 'am_michael']  # the players
SR = 24000
# espeak guesses these wrong or oddly, so they are spelled the way they sound
SAY_AS = {'LaMelo': 'Luh Mello', 'Gobert': 'Go bear', 'Dosunmu': 'Doe soon moo', 'Kuminga': 'Koo ming ga', 'McDaniels': 'Mick Daniels', 'Timberwolves': 'Timber wolves', 'Shannon': 'Shannon', 'Josh': 'Josh', 'Kukoc': 'Kookotch', 'Nowitzki': 'Novitski', 'Wemby': 'Wembee', 'Manu': 'Manoo', 'Luka': 'Looka', 'Garnett': 'Garnit', 'Kerr': 'Kurr', 'Lillard': 'Lillerd', 'Tatum': 'Taytum', 'Pippen': 'Pippin', 'Ainge': 'Aynj', 'Beal': 'Beel', 'Caron': 'Karen', 'DJ': 'D J', 'JR': 'J R', 'Shumpert': 'Shumpert', 'Jokić': 'Yokitch', 'DiVincenzo': 'Dee Vinchenzo', 'Knicks': 'Nicks', 'Brunson': 'Brunsen',
          "'16 Cavaliers": 'Twenty sixteen Cavaliers'}
DEMO = ['Ayyy, welcome to da show, kid. Try not to embarrass yourself.', 'Yo, Shorty. We live. Lock in wit’ me, Shorty, it’s about to get crazy.']

data = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'dump_vox_text.js')]))
PERSONAS, CALLS = data['TALK'], data['CALLS']
EXC = {'three': .8, 'dunk': .8, 'fireDunk': 1, 'oop': .85, 'fire': 1, 'hot': .6, 'block': .8, 'steal': .6, 'ankle': .9, 'layup': .4, 'two': .35, 'start': .5, 'startB': .5, 'over': .5, 'miss': .1, 'airball': .4, 'foulout': .9, 'fightwin': 1, 'fightlose': .8, 'andone': .7, 'sfoul': .5, 'swish': .6, 'injury': .4, 'charge': .4, 'flagrant': .7}
slug = lambda s: re.sub(r'[^a-z0-9]+', '', s.lower())
clean = lambda s: s.replace('’', "'").strip()

kok = Kokoro(model, voices)
cache = pickle.load(open(CACHE, 'rb')) if os.path.exists(CACHE) else {}

def synth(text, voice, speed):
    key = hashlib.md5(f'{voice}|{speed}|{text}'.encode()).hexdigest()
    if key not in cache:
        s, sr = kok.create(text, voice=voice, speed=speed, lang='en-us'); assert sr == SR
        cache[key] = s.astype(np.float32)
    return cache[key]

def finish(x, target, lead, tail):
    a = np.abs(x); idx = np.where(a > 0.008)[0]
    if len(idx) == 0: raise RuntimeError('silent clip')
    x = x[max(0, idx[0] - int(lead * SR)): idx[-1] + int(tail * SR)]
    act = x[np.abs(x) > 0.01]; rms = float(np.sqrt(np.mean(act ** 2)))
    g = min(target / rms, 0.92 / float(np.max(np.abs(x))))
    return x * g

def mp3(x):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '40k', '-f', 'mp3', '-'], input=x.astype('<f4').tobytes(), stdout=subprocess.PIPE, check=True)
    return p.stdout

out, secs, t0 = {}, 0.0, time.time()
def put(cid, x):
    global secs
    out[cid] = base64.b64encode(mp3(x)).decode(); secs += len(x) / SR

# commentary grammar pieces (openers, tags, core parts around the name slots), names and a demo line, for each voice of each persona
for vi, cv in enumerate(COM_VOICES):
    P = next((P for P in PERSONAS if vi in P['voices']), None)
    if P is None: continue
    sp = P.get('speed', 1.0)
    for i, op in enumerate(P['openers']): put(f'o.{vi}.{i}', finish(synth(clean(op), cv, sp * 1.04), 0.10, 0.012, 0.02))
    for i, tg in enumerate(P['tags']): put(f't.{vi}.{i}', finish(synth(clean(tg), cv, sp * 1.03), 0.10, 0.012, 0.03))
    for key, arr in P['cores'].items():
        for i, line in enumerate(arr):
            for si, part in enumerate(re.split(r'\$\{[nt]\}', line)):
                if not part.strip(): continue
                put(f'g.{vi}.{key}.{i}.{si}', finish(synth(clean(part), cv, min(1.1, sp * (1.03 + 0.07 * EXC.get(key, .3)))), 0.10, 0.012, 0.03))
        print(cv, key, len(arr), f'{time.time() - t0:.0f}s', flush=True)
    put(f'l.{vi}.demo', finish(synth(clean(DEMO[0 if vi < 3 else 1]), cv, sp * 1.06), 0.10, 0.012, 0.03))
    # names (players, teams, fillers). The comma keeps the pitch level so it sounds like it is part of a sentence.
    for n in data['names'] + ['He', 'They', 'Bench']:
        put(f'n.{vi}.{slug(n)}', finish(synth(SAY_AS.get(n, n) + ',', cv, 1.04), 0.10, 0.004, 0.006))
    for n in data['teams']:   # team names start a sentence ("Warriors win."), so they get a normal ending
        put(f'n.{vi}.{slug(n)}', finish(synth(SAY_AS.get(n, n), cv, 1.04), 0.10, 0.004, 0.02))
    put(f'n.{vi}.andco', finish(synth('and company.', cv, 1.06), 0.10, 0.01, 0.03))
    put(f'x.{vi}.shorty', finish(synth('Shorty.', cv, sp * 1.03), 0.10, 0.012, 0.03))
    pickle.dump(cache, open(CACHE, 'wb'))
# player call-outs, several different guys
phrases = sorted({p for arr in CALLS.values() for p in arr})
for vi, v in enumerate(CALL_VOICES):
    for ph in phrases:
        put(f'c{vi}.{slug(ph)}', finish(synth(clean(ph), v, 1.08), 0.085, 0.004, 0.03))
    print(v, f'{time.time() - t0:.0f}s', flush=True)

pickle.dump(cache, open(CACHE, 'wb'))
body = ',\n'.join(f'"{k}":"{v}"' for k, v in out.items())
dest = os.path.join(HERE, '..', 'src', 'vox.js')
open(dest, 'w').write('/* Generated by tools/make_vox.py (Kokoro neural TTS, Apache-2.0). Do not edit by hand. */\nconst VOX = {\n' + body + '\n};\n')
print(f'{len(out)} clips, {secs:.0f}s of audio, {os.path.getsize(dest) / 1e6:.2f} MB')
