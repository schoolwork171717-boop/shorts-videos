# Shorts kit overrides (read by every scheduled run)

After building the Iron Canyon style and creating a project, copy these over the project:

- `kit/mix.py` → `<project>/tools/mix.py` — music beds, all original: `"bright"` (DEFAULT since v6: playful 116 BPM stereo
  bed with pizzicato, mallet, flute and reverb), `"epic"`, `"dry"` (the deadpan documentary bed —
  140 BPM half-time, D minor, sparse muted plucks, low sine root, wooden offbeat tick, a glassy bell every other bar)
  at -14 dB with ducking, about 20 dB under the voice; `"quirk"` (swung pizzicato + marimba, -9 dB); `"bed"`,
  `"tension"`, `"bounce"`. Plus `voice_polish` (rumble cut, presence, gentle compression) on the narration.
  Never use a copied or ripped soundtrack from another channel: always one of these beds.

script.json defaults for every new Short:

```json
{ "voice": "clone", "speed": 1.12, "lead": 0.12, "gap": 0.04, "outro": 0.6, "music": "bright" }
```

**v7 voice (the user's own narrator, cloned):** make the narration with
`~/.faceless-shorts/venv/bin/python tools/clone_voice.py .` (not voice.py), then words.py as usual. It speaks every
line in the voice of `voice/narrator.wav` (a clip of the narrator from the user's reference video; setup copies it to
`~/.faceless-shorts/voice/`) with Kyutai Pocket TTS through sherpa-onnx, makes each line ~5 times and keeps the take
where Whisper hears every word and the voice is closest to the reference (pitch ~190 Hz, ~3.6 words/s). Models come
from the sherpa-onnx GitHub releases on first use (~350 MB, works in cloud runs). If a line prints "WARNING: best take
only matched", reword that line slightly and run again. The Kokoro blend below is only the fallback.

Fallback voice (only if cloning can't run): a natural blend of three Kokoro voices (the deadpan narrator, the brighter Eric, the younger Puck) at 1.3x:
upbeat and trendy, with NO audio processing (the old WORLD "energize" step made it sound robotic; leave it off).
Generate it with the kit copy of voice.py, which understands blends:
`~/.faceless-shorts/venv/bin/python tools/voice.py .` (setup copies it into the project's tools/), then words.py as usual.
Write for tweens and teens: short punchy sentences, "you" framing, wonder and drama, a few exclamation marks.
Music "bright" by default, "epic" for grand stories, "dry" for quiet ones, "quirk" for silly ones.

## Animation, not cuts
Viewers notice when a Short is a slideshow. Every shot is a little scene where something happens on camera:
- About 10-12 shots in 40 s, each 2.5-7 s; one long take may cover two narration lines.
- In every shot a person DOES something: walks across the set, climbs, descends a rope, unpacks, sleeps and wakes,
  eats, picks up a phone, points, counts on fingers, shrugs. Use `legs: 'walk'` + a `path()` of points, `tween()`d arms,
  props that pop in on the word that names them, lights that switch on.
- The camera never stops: push-ins, orbits, a crane down a shaft, a camera that tracks the walking person
  (look target = the person's x), a pull-back reveal at the end. Hard cuts (`cut: true`) only for impacts.
- Time-lapses happen inside one take (asleep → stretch → eat → sleep → phone in the same shot).
- Keep everyone and everything inside ±(0.21 × distance) m of the look point sideways at fov 40 (9:16 is narrow);
  lay out sets in a narrow band and let the camera move along it.

## Examples (kit/examples)
Finished, published-quality shot lists to copy patterns from:
- `sun-kink-shots.js`: a desert rail line with an instanced, bendable track (`layTrack({ off, joint, gap })`, `kink()`), torch glow,
  a hydraulic rail jack, an unbranded coal train that can tip off the track, dust puffs, sepia "old days", thermometer overlay.
- `quick-draw-shots.js`: an Old West street (wooden fronts, porches, cliffs), a 1930s institute and a modern lab (`interior()`),
  guns as separate cut-out planes on the person's pivot (`armed(person, side, toy, flag)`) with a pop-out BANG! flag,
  a flying 3D hat, a film-crew reveal, stopwatch / bar-chart / tally / thought-bubble overlays.
- `cave-shots.js` (the continuous-animation reference): a mountain plateau with a pit and timber tripod, a one-take
  abseil down a 50 m rock shaft into an ice cave with a live depth counter, a camp that appears item by item as the
  person walks past, an in-shot time-lapse, a phone that rings and shakes, a surface tent with a wall calendar and a
  clock that gets covered, a tally board, goggles drawn over a face, a glare-to-daylight exit and a rising pull-back.

## Engine v3: the inked, cel-shaded look (kit/engine)
`engine.js` (replaces src/core/engine.js): ink outlines on every 3D object (depth + normal edges, lighter with distance;
cut-out people are masked out because they have their own ink) and cel shading (MeshStandardMaterial -> soft-banded toon
material). Turn off per frame with `look.style = { ink: false, cel: false }` or in the URL with `&ink=0&cel=0`.
Mark a mesh `userData.noInk` / `userData.noCel` / material `userData.keepPBR` to opt it out.
`main.js` (replaces src/main.js): 0.3 s cross-dissolve into every shot; give a shot `cut: true` for a hard cut
(impacts) or `dissolve: 0.5` for a slower one.
`fx.js` (new src/core/fx.js): `motes` (floating dust/embers), `shafts` (light beams), `rain`, `sparkle`, `sweat`.
Render cost: about 3 s per frame at res 0.6 without a GPU (render in 4-second segments).

## Acting v4 (kit/engine: toon.js, act.js, main.js, engine.js, han.js, beasts.js)
- `toon.js`: blended expressions (`set({ ...A.face(t, keys) })`), new moods excited/gasp/skeptic/scheme, `tilt`, `eyeS`,
  `mouthS`, robes + wide sleeves, Han hats (scholar, mian, official, headband), long mustache, goatee.
- `act.js`: `face`, `keys`, `alive`, `pop`, `jolt`, `hop`: pure functions of t, so segments render identically.
- `main.js`: transitions `trans: 'zoom' | 'whip' | 'dissolve'`, `cut: true`.
- `engine.js`: majestic grade (`GRADE_DEFAULT`, per frame `look.grade`).
- `han.js` / `beasts.js`: Han palace sets, the seismoscope jar, a galloping horse. Example: `examples/jar-shots.js`.

## v5 additions
- **Swooshes on camera moves:** call `A.autoSwoosh(S, cue, CUES)` at the end of buildShots: every `trans: 'zoom'|'whip'`
  shot gets a stereo swoosh (the whip pans with its direction); list extra fast moves inside a shot as `moves: [t, ...]`.
  mix.py has the new `swoosh` cue (`sweep: -1..1` pans it across).
- **Magnificent layer (fx.js):** `FX.petals` (tumbling blossoms), `FX.orbs` (glowing bokeh), `FX.godray(x, y, t, { k })`
  (radiant burst behind a reveal), `FX.speedLines(t, k, cx, cy)` (shock / impact / fast zoom), `FX.vignetteGlow`.
- **Squash & stretch (act.js):** `sq: A.squashHop(t, t0, dur)` with every hop (act() applies it via `A.applySquash`),
  `A.flicker(t, seed)` for lantern lights.

## v6 (matched to the user's own reference video)
- Voice: blend `am_fenrir:0.4+am_eric:0.4+am_puck:0.2` at 1.3, gap 0.04 (fast, continuous, ~135 Hz); mixer voice -17.5 dB.
- Music: `"bright"` (original playful stereo bed with reverb) is the default.
- Captions: Nunito Black rounded white, slim dark edge, soft shadow, y 1420 (kit/engine/captions.js + index.html + fonts/).
- Render at 60 fps (`FPS=60`), 2-second segments.
- Camera float + breathing zoom + roll in shoot(); grade with teal-navy shadows and warm highlights, vignette 0.32.
- Posting times (Phoenix) aimed at US Eastern evening peaks (Buffer 2026): Mon 3 & 6 PM, Tue 6 & 7 PM, Wed 5 & 6 PM,
  Thu 5 & 6 PM, Fri 2 & 4 PM, Sat 9 AM & 5 PM, Sun 5 & 6 PM.
- Hashtags: 4-5 specific ones in the description: #shorts + 2 topic tags + 1-2 audience tags (#didyouknow, #history,
  #science, #facts...), never more than 15; 6-8 specific keyword tags.

## v7 (the user's narrator voice)
- Voice: `"voice": "clone"`, speed 1.12, via `tools/clone_voice.py` + `voice/narrator.wav` (speaker similarity ~0.85-0.9
  to the reference vs 0.70 for the old Kokoro blend; pitch ~190 Hz; pace ~3.6 words/s like the reference).
- Cloning model: Kyutai Pocket TTS (CC-BY 4.0 per its license file), WeSpeaker + Whisper base.en for take selection.
- After every upload, set the language: YouTube sometimes guesses the audio language wrong (the sun-kink Short was
  marked Tamil). With Zapier YouTube "Make API Mutating Request": PUT https://www.googleapis.com/youtube/v3/videos
  ?part=snippet with the video's id and its full snippet (title, description, tags, categoryId) plus
  "defaultLanguage": "en", "defaultAudioLanguage": "en".
