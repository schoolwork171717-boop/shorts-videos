# Shorts kit overrides (read by every scheduled run)

After building the Iron Canyon style and creating a project, copy these over the project:

- `kit/mix.py` → `<project>/tools/mix.py` — adds the `"quirk"` music bed (playful documentary score: swung
  pizzicato bass, marimba melody over 8 bars, soft kick + shaker; original) at -9 dB with light ducking, about
  16 dB under the voice, and `voice_polish` (rumble cut, presence, gentle compression) on the narration.

script.json defaults for every new Short:

```json
{ "voice": "am_puck", "speed": 1.1, "lead": 0.2, "gap": 0.12, "outro": 1.0, "music": "quirk" }
```

am_puck is the lively, younger narrator; at 1.1 it reads ~11% faster than am_michael 1.05, which helps retention.
Check after mix.py: loudness about -14 LUFS, true peak -1 dB.

## Examples (kit/examples)
Finished, published-quality shot lists to copy patterns from:
- `sun-kink-shots.js`: a desert rail line with an instanced, bendable track (`layTrack({ off, joint, gap })`, `kink()`), torch glow,
  a hydraulic rail jack, an unbranded coal train that can tip off the track, dust puffs, sepia "old days", thermometer overlay.
- `quick-draw-shots.js`: an Old West street (wooden fronts, porches, cliffs), a 1930s institute and a modern lab (`interior()`),
  guns as separate cut-out planes on the person's pivot (`armed(person, side, toy, flag)`) with a pop-out BANG! flag,
  a flying 3D hat, a film-crew reveal, stopwatch / bar-chart / tally / thought-bubble overlays.
