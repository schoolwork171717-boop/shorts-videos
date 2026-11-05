# Shorts kit overrides (read by every scheduled run)

After building the Iron Canyon style and creating a project, copy these over the project:

- `kit/mix.py` → `<project>/tools/mix.py` — music beds, all original: `"dry"` (DEFAULT: the deadpan documentary bed —
  140 BPM half-time, D minor, sparse muted plucks, low sine root, wooden offbeat tick, a glassy bell every other bar)
  at -14 dB with ducking, about 20 dB under the voice; `"quirk"` (swung pizzicato + marimba, -9 dB); `"bed"`,
  `"tension"`, `"bounce"`. Plus `voice_polish` (rumble cut, presence, gentle compression) on the narration.
  Never use a copied or ripped soundtrack from another channel: always one of these beds.

script.json defaults for every new Short:

```json
{ "voice": "am_fenrir", "speed": 1.1, "lead": 0.2, "gap": 0.12, "outro": 1.0, "music": "dry" }
```

am_fenrir at 1.1 is the dry, deadpan, matter-of-fact narrator (about 137 Hz median, ~5.4 syllables/s, the same pace
as the reference channel). Write lines flat and factual and let the visuals be the joke; no exclamation marks.
Check after mix.py: loudness about -14 to -15 LUFS, true peak -1 dB.

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
