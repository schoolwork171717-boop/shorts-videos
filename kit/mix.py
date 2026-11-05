"""Inside Out soundtrack: narration + soft procedural sound effects + a quiet music bed, all made here with numpy.
No samples, no AI audio, no downloads.

  python3 tools/mix.py [project=.]          → data/mix.wav (48 kHz stereo)

Reads data/cues.json (node tools/capture.mjs cues), data/narration.wav if it exists (voice.py or words.py --audio),
and script.json "music": "bed" (the procedural score, default) · "none" · "audio/your-track.mp3" (your own royalty-free
track, any format ffmpeg reads). The music ducks under the voice.

Sound rules (STYLE.md): every effect is soft and rounded, nothing above ~5 kHz, no ticks / hats / glitches / beeps.
Music: bed tension bounce quirk dry epic.  Voice: script.json "energize": {"up": 1.5, "expr": 1.4} (needs pyworld).
Cue types: swoosh (camera moves; + sweep: -1..1 pan glide) whoosh slide pop plop gulp boing bubbles sizzle sparkle thud slam tock zip alarm  (+ gain, dur)
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile

P = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
SR = 48000
rng = np.random.default_rng(11)
cj = json.loads((P / 'data/cues.json').read_text())
script = json.loads((P / 'script.json').read_text())
DUR = float(cj['duration'])
N = int(DUR * SR) + SR // 10


def lp(x, f, o=2): b, a = signal.butter(o, min(f, SR / 2 - 100) / (SR / 2), 'low'); return signal.lfilter(b, a, x)
def hp(x, f, o=2): b, a = signal.butter(o, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, f0, f1, o=2): b, a = signal.butter(o, [f0 / (SR / 2), f1 / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def db(x): return 10 ** (x / 20)
def tt(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=None):
    """attack a seconds then exponential release over the rest"""
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    rest = n - na; e[na:] = np.exp(-np.linspace(0, r or 5, rest)) if rest > 0 else 1; return e
def sweep(f0, f1, d, shape='exp'):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d) if shape == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def noise(d): return rng.standard_normal(int(d * SR))


# ---------- the effects ----------
def whoosh(d=0.38, **_):
    n = noise(d); lo, hi = lp(n, 500), lp(n, 2200)
    k = np.sin(np.pi * np.linspace(0, 1, len(n))); x = (lo * (1 - k) + hi * k) * k ** 1.5
    return x / (np.abs(x).max() + 1e-9) * 0.5
def slide(d=1.0, **_):
    n = lp(noise(d), 700); e = np.sin(np.pi * np.linspace(0, 1, len(n))) ** 2
    return n / (np.abs(n).max() + 1e-9) * e * 0.35 + sweep(260, 120, d) * e * 0.08
def pop(**_): x = sweep(560, 240, 0.11) * env(int(0.11 * SR), 0.002, 6); return lp(x, 3000) * 0.7
def plop(**_): x = sweep(700, 180, 0.14) * env(int(0.14 * SR), 0.002, 5); return lp(x, 2500) * 0.6
def gulp(**_):
    a = sweep(320, 140, 0.16) * env(int(0.16 * SR), 0.01, 4); b = sweep(240, 90, 0.2) * env(int(0.2 * SR), 0.01, 4)
    x = np.concatenate([a, np.zeros(int(0.04 * SR)), b]); return lp(x, 1800) * 0.8
def boing(**_):
    d = 0.42; t = tt(d); f = 200 * (1 + 0.6 * t / d) * (1 + 0.08 * np.sin(2 * np.pi * 18 * t))
    return lp(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.004, 4), 2000) * 0.55
def bubbles(d=2.0, **_):
    x = np.zeros(int(d * SR))
    for _ in range(int(d * 7)):
        st = rng.integers(0, max(1, len(x) - int(0.08 * SR))); f = rng.uniform(380, 900); b = sweep(f, f * 1.6, 0.06) * env(int(0.06 * SR), 0.003, 5)
        x[st:st + len(b)] += b * rng.uniform(0.2, 0.5)
    return lp(x, 2500) * 0.5
def sizzle(d=1.0, **_):
    n = bp(noise(d), 1800, 4500); crack = (rng.random(len(n)) < 0.002).astype(float); crack = lp(crack, 300) * 40
    e = np.minimum(1, np.linspace(0, 6, len(n))) * np.linspace(1, 0.2, len(n)); return n * (0.4 + crack) * e * 0.12
def sparkle(d=1.2, **_):
    notes = [784, 880, 1047, 1175, 1319, 1568]; x = np.zeros(int(d * SR) + SR // 2)
    for k, f in enumerate(notes):
        st = int(k * d / len(notes) * SR); n = int(0.4 * SR); t = tt(0.4)
        x[st:st + n] += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(n, 0.004, 6) * 0.22
    return lp(x, 4500)
def thud(**_):
    d = 0.35; t = tt(d); x = np.sin(2 * np.pi * (70 + 40 * np.exp(-t * 30)) * t) * env(len(t), 0.002, 7)
    return x * 0.9 + lp(noise(d), 220) * env(len(t), 0.001, 12) * 0.3
def slam(**_):
    d = 0.5; t = tt(d); x = np.sin(2 * np.pi * (60 + 60 * np.exp(-t * 25)) * t) * env(len(t), 0.002, 6)
    return np.tanh(1.6 * (x + lp(noise(d), 1200) * env(len(t), 0.001, 10) * 0.6)) * 0.9
def tock(**_): d = 0.09; t = tt(d); return (np.sin(2 * np.pi * 420 * t) + 0.3 * np.sin(2 * np.pi * 840 * t)) * env(len(t), 0.001, 9) * 0.35
def zip_(**_):
    d = 0.32; n = bp(noise(d), 400, 3000); k = np.linspace(0, 1, len(n))
    return (n / (np.abs(n).max() + 1e-9) * 0.35 + sweep(300, 1100, d) * 0.12) * np.sin(np.pi * k) ** 1.2
def alarm(d=2.0, **_):
    x = np.zeros(int(d * SR)); one = np.sin(2 * np.pi * 150 * tt(0.22)) * env(int(0.22 * SR), 0.02, 5)
    for st in np.arange(0, d - 0.25, 0.5): i = int(st * SR); x[i:i + len(one)] += one
    return lp(x, 900) * 0.55

def inhale(d=1.0, **_):
    n = bp(noise(d), 300, 2600); k = np.linspace(0, 1, len(n)); e = np.sin(np.pi * np.minimum(1, k * 1.15)) ** 1.5 * (0.6 + 0.4 * k)
    return n / (np.abs(n).max() + 1e-9) * e * 0.5
def heartbeat(**_):
    one = lambda d, f: np.sin(2 * np.pi * f * tt(d)) * env(int(d * SR), 0.004, 7)
    x = np.concatenate([one(0.16, 58), np.zeros(int(0.09 * SR)), one(0.2, 52) * 0.75]); return lp(x, 300) * 1.0

def ding(**_):
    t = tt(1.4); x = sum(np.sin(2 * np.pi * f * t) * g for f, g in [(1318, 1), (2637, 0.35), (3951, 0.12)]) * env(len(t), 0.002, 4); return x * 0.5
def chirp(d=1.0, **_):
    x = np.zeros(int(d * SR))
    for k, st in enumerate(np.arange(0, d - 0.12, 0.17)):
        i = int(st * SR); c = sweep(3200 + (k % 3) * 300, 4400, 0.08) * env(int(0.08 * SR), 0.004, 6); x[i:i + len(c)] += c[:len(x) - i] * (0.6 + 0.4 * rng.random())
    return x * 0.4
def chug(d=2.0, **_):
    x = np.zeros(int(d * SR)); one = bp(noise(0.14), 200, 1600) * env(int(0.14 * SR), 0.005, 6)
    for k, st in enumerate(np.arange(0, d - 0.15, 0.22)): i = int(st * SR); x[i:i + len(one)] += one * (1 if k % 2 == 0 else 0.6)
    return x * 0.7
def stampit(**_):
    t = tt(0.18); x = np.sin(2 * np.pi * 95 * t) * env(len(t), 0.001, 10) + bp(noise(0.18), 1500, 5000) * env(len(t), 0.001, 14) * 0.6; return x * 0.9

def swoosh(d=0.5, **_):
    """camera-move swoosh: airy noise whose brightness rises then falls, a soft low whoom underneath (pans if the cue says so)"""
    n = int(d * SR); t = np.arange(n) / SR; k = t / d
    x = noise(d); out = np.zeros(n); seg_ = 512
    for i in range(0, n, seg_):                                       # time-varying band-pass, block by block
        kk = (i + seg_ / 2) / n; fc = 350 + 2600 * np.sin(np.pi * min(1, kk * 1.15)) ** 1.5
        out[i:i + seg_] = bp(x[max(0, i - 2048):i + seg_], fc * 0.6, min(fc * 1.6, SR / 2 - 200))[-len(out[i:i + seg_]):]
    shape = np.where(k < 0.62, (k / 0.62) ** 2, np.exp(-(k - 0.62) * 9))
    whoom = np.sin(2 * np.pi * np.cumsum(70 - 30 * k) / SR) * shape * 0.35
    return out * shape + whoom

FX = dict(swoosh=swoosh, ding=ding, chirp=chirp, chug=chug, stamp=stampit, inhale=inhale, heartbeat=heartbeat, whoosh=whoosh, slide=slide, pop=pop, plop=plop, gulp=gulp, boing=boing, bubbles=bubbles, sizzle=sizzle,
          sparkle=sparkle, thud=thud, slam=slam, tock=tock, zip=zip_, alarm=alarm)
LEVEL = dict(swoosh=-15, ding=-17, chirp=-19, chug=-20, stamp=-12, inhale=-15, heartbeat=-8, whoosh=-17, slide=-19, pop=-14, plop=-15, gulp=-11, boing=-15, bubbles=-21, sizzle=-18, sparkle=-17,
             thud=-11, slam=-9, tock=-18, zip=-14, alarm=-17)


# ---------- the music bed: soft pad + plucked arpeggio, 100 BPM, I–vi–IV–V ----------
def music_bed():
    bpm = 100; beat = 60 / bpm; bar = beat * 4
    chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]]
    x = np.zeros(N)
    nb = int(np.ceil(DUR / bar)) + 1
    for b in range(nb):
        ch = chords[b % 4]; st = int(b * bar * SR); n = int(bar * SR)
        if st >= N: break
        t = tt(bar); e = np.minimum(1, t / 0.4) * np.minimum(1, (bar - t) / 0.4)
        pad = sum(np.sin(2 * np.pi * f / 2 * t) + 0.25 * np.sin(2 * np.pi * f * t) for f in ch) * e * 0.10
        x[st:st + n] += pad[:max(0, min(n, N - st))]
        for k in range(8):                                                       # eighth-note pluck arpeggio
            f = ch[[0, 1, 2, 1, 2, 0, 1, 2][k]] * (2 if k % 4 == 2 else 1); ps = st + int(k * beat / 2 * SR); pn = int(0.5 * SR)
            if ps + pn >= N: continue
            pt = tt(0.5); pl = (np.sin(2 * np.pi * f * pt) + 0.35 * np.sin(4 * np.pi * f * pt)) * env(pn, 0.003, 7) * 0.12
            x[ps:ps + pn] += pl
    x = lp(x, 3200)
    fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo)
    return x / (np.abs(x).max() + 1e-9) * fade

def music_bounce():
    """light comedy: oom-pah bass + staccato plucked melody, 118 BPM, major (script.json "music": "bounce")"""
    bpm = 118; beat = 60 / bpm; x = np.zeros(N)
    prog = [(130.8, [261.6, 329.6, 392.0]), (174.6, [261.6, 349.2, 440.0]), (196.0, [246.9, 293.7, 392.0]), (130.8, [261.6, 329.6, 392.0])]
    mel = [0, 2, 1, 2, 0, 1, 2, 1]
    pl = lambda f, d, g: (np.sin(2 * np.pi * f * tt(d)) + 0.4 * np.sin(4 * np.pi * f * tt(d)) + 0.15 * np.sin(6 * np.pi * f * tt(d))) * env(int(d * SR), 0.003, 9) * g
    for k in range(int(DUR / beat) + 1):
        bass, ch = prog[(k // 8) % 4]; i = int(k * beat * SR)
        b = pl(bass if k % 2 == 0 else bass * 1.5, 0.3, 0.35) if k % 2 == 0 else pl(ch[0] / 2 * 1.5, 0.22, 0.18)
        if i + len(b) < N: x[i:i + len(b)] += b
        if k % 2 == 1:
            c = sum(pl(f, 0.16, 0.07) for f in ch)
            if i + len(c) < N: x[i:i + len(c)] += c
        f = ch[mel[k % 8]] * 2; m = pl(f, 0.18, 0.09); j = i + int(beat / 2 * SR) if k % 4 == 3 else i
        if j + len(m) < N and k % 8 not in (3, 7): x[j:j + len(m)] += m
    x = lp(x, 4200); fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo)
    return x / (np.abs(x).max() + 1e-9) * fade

def music_tension():
    """low drone + slow minor pulse, for mysterious / tense explainers (script.json "music": "tension")"""
    t = np.arange(N) / SR; x = np.zeros(N)
    for f, g in [(55, 0.5), (82.4, 0.3), (110, 0.2), (130.8, 0.12)]: x += np.sin(2 * np.pi * f * t + np.sin(t * 0.3) * 0.5) * g
    x *= 0.55 + 0.45 * np.sin(2 * np.pi * t / 8) ** 2
    beat = 60 / 84; ping = lambda f: (np.sin(2 * np.pi * f * tt(1.2)) + 0.3 * np.sin(4 * np.pi * f * tt(1.2))) * env(int(1.2 * SR), 0.01, 5)
    seq = [220.0, 261.6, 196.0, 174.6]
    for k in range(int(DUR / (beat * 2))):
        i = int(k * beat * 2 * SR); pg = ping(seq[(k // 2) % 4]) * 0.35
        if i + len(pg) < N: x[i:i + len(pg)] += pg
    x = lp(x, 2200); fade = np.ones(N); fo = int(1.5 * SR); fade[-fo:] = np.linspace(1, 0, fo); fi = int(0.8 * SR); fade[:fi] *= np.linspace(0, 1, fi)
    return x / (np.abs(x).max() + 1e-9) * fade


def music_quirk():
    """playful documentary bed (script.json "music": "quirk"): swung pizzicato bass, marimba melody that changes every
    bar over an 8-bar progression, soft kick + shaker. 104 BPM, major, original."""
    bpm = 104; beat = 60 / bpm; bar = beat * 4; x = np.zeros(N); rs = np.random.default_rng(7)
    C, Am, F, G, E7 = [130.8, 164.8, 196.0], [110.0, 130.8, 164.8], [87.3, 110.0, 130.8], [98.0, 123.5, 146.8], [82.4, 103.8, 123.5]
    prog = [C, Am, F, G, C, E7, Am, G]
    def put(i, y):
        if i < 0 or i >= N: return
        n = min(len(y), N - i); x[i:i + n] += y[:n]
    pizz = lambda f, g: (np.sin(2 * np.pi * f * tt(0.35)) + 0.5 * np.sin(4 * np.pi * f * tt(0.35)) + 0.2 * np.sin(6 * np.pi * f * tt(0.35))) * env(int(0.35 * SR), 0.002, 12) * g
    mar = lambda f, g: (np.sin(2 * np.pi * f * tt(0.4)) + 0.3 * np.sin(8 * np.pi * f * tt(0.4)) * np.exp(-tt(0.4) * 30)) * env(int(0.4 * SR), 0.001, 9) * g
    kick = lambda g: np.sin(2 * np.pi * (50 + 60 * np.exp(-tt(0.18) * 30)) * tt(0.18)) * env(int(0.18 * SR), 0.001, 14) * g
    shk = lambda g: hp(noise(0.05), 6000) * env(int(0.05 * SR), 0.001, 30) * g
    sw = beat * 0.62                                                  # swung 8th: long-short
    nb = int(DUR / bar) + 2
    for b in range(nb):
        ch = prog[b % 8]; b0 = b * bar
        for k in range(4):                                            # bass: root on 1 and 3, fifth on 2 and 4, a pickup into each bar
            f = ch[0] if k % 2 == 0 else ch[2] / 2 * 1.0
            put(int((b0 + k * beat) * SR), pizz(f, 0.30 if k % 2 == 0 else 0.22))
        put(int((b0 + 3 * beat + sw) * SR), pizz(ch[1] / 2 * 2, 0.14))
        for k in (0, 2): put(int((b0 + k * beat) * SR), kick(0.28))
        for k in range(4):
            put(int((b0 + k * beat) * SR), shk(0.05)); put(int((b0 + k * beat + sw) * SR), shk(0.035))
        tones = [c * 4 for c in ch] + [ch[0] * 8]                     # marimba two octaves up
        pat = rs.choice([[0, 1, 2, -1, 1, 3, -1, 2], [2, -1, 1, 0, -1, 2, 3, 1], [0, 2, -1, 3, 2, -1, 1, -1], [3, 2, 1, -1, 0, -1, 2, 1]])
        if b % 8 == 7: pat = [3, 2, 1, 0, -1, -1, -1, -1]           # a little turnaround every 8 bars
        for k, n_ in enumerate(pat):
            if n_ < 0: continue
            tk = b0 + (k // 2) * beat + (sw if k % 2 else 0)
            put(int(tk * SR), mar(tones[n_], 0.16 if k % 2 == 0 else 0.11))
    x = lp(x, 7000); x = hp(x, 45)
    fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fi = int(0.15 * SR); fade[:fi] *= np.linspace(0, 1, fi)
    return x / (np.abs(x).max() + 1e-9) * fade

def music_dry():
    """dry, curious documentary bed (script.json "music": "dry"): sparse muted plucks in D minor over a slow half-time
    pulse, a soft glassy bell answering every other bar, a quiet wooden tick. 70 BPM feel, original."""
    bpm = 140; beat = 60 / bpm; bar = beat * 4; x = np.zeros(N); rs = np.random.default_rng(11)
    Dm, Bb, F, C, Gm, A7 = [73.4, 87.3, 110.0], [58.3, 73.4, 87.3], [87.3, 110.0, 130.8], [65.4, 82.4, 98.0], [98.0, 116.5, 146.8], [110.0, 138.6, 164.8]
    prog = [Dm, Dm, Bb, Bb, F, C, Gm, A7]
    def put(i, y):
        if i < 0 or i >= N: return
        n = min(len(y), N - i); x[i:i + n] += y[:n]
    pluck = lambda f, g, d=0.28: lp((np.sin(2 * np.pi * f * tt(d)) + 0.35 * np.sin(4 * np.pi * f * tt(d))) * env(int(d * SR), 0.002, 16), 2600) * g
    bell = lambda f, g: (np.sin(2 * np.pi * f * tt(1.2)) + 0.25 * np.sin(2 * np.pi * f * 2.76 * tt(1.2)) * np.exp(-tt(1.2) * 6)) * env(int(1.2 * SR), 0.004, 3.2) * g
    tick = lambda g: bp(noise(0.03), 1800, 4200) * env(int(0.03 * SR), 0.0005, 60) * g
    low = lambda f, g: np.sin(2 * np.pi * f * tt(0.6)) * env(int(0.6 * SR), 0.01, 5) * g
    nb = int(DUR / bar) + 2
    for b in range(nb):
        ch = prog[b % 8]; b0 = b * bar
        put(int(b0 * SR), low(ch[0], 0.30)); put(int((b0 + 2 * beat) * SR), low(ch[0] * 1.5, 0.16))
        pat = rs.choice([[0, -1, 2, 1, -1, 2, -1, 1], [0, 2, -1, 1, 2, -1, -1, -1], [-1, 1, 0, -1, 2, -1, 1, -1], [0, -1, -1, 2, -1, 1, 0, -1]])
        for k, n_ in enumerate(pat):
            if n_ >= 0: put(int((b0 + k * beat / 2) * SR), pluck(ch[n_] * 2, 0.20 if k % 2 == 0 else 0.13))
        for k in range(4): put(int((b0 + k * beat + beat / 2) * SR), tick(0.05))
        if b % 2 == 1: put(int((b0 + 2.5 * beat) * SR), bell(ch[1] * 8, 0.07))
    x = lp(x, 6000); x = hp(x, 40)
    fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fi = int(0.15 * SR); fade[:fi] *= np.linspace(0, 1, fi)
    return x / (np.abs(x).max() + 1e-9) * fade

def music_epic():
    """majestic, driving adventure bed (script.json "music": "epic"): 120 BPM, D minor pentatonic. Plucked-zither
    arpeggios in 16ths (Karplus-Strong), big low drums on 1 and the and-of-3, a warm swelling pad, a rising swell into
    every 4th bar. Original."""
    bpm = 120; beat = 60 / bpm; bar = beat * 4; x = np.zeros(N); rs = np.random.default_rng(5)
    Dm, Bb, C, Am, F, Gm = [73.4, 110.0, 146.8], [58.3, 87.3, 116.5], [65.4, 98.0, 130.8], [55.0, 82.4, 110.0], [87.3, 130.8, 174.6], [49.0, 73.4, 98.0]
    prog = [Dm, Bb, C, Am, Dm, F, Gm, Am]
    pent = [146.8, 174.6, 196.0, 220.0, 261.6, 293.7, 349.2, 392.0, 440.0]          # D F G A C, two octaves
    def put(i, y):
        if i < 0 or i >= N: return
        n = min(len(y), N - i); x[i:i + n] += y[:n]
    def ks(f, d=0.6, g=1.0, damp=0.996):                                            # plucked string
        n = int(d * SR); L = max(2, int(SR / f)); buf = rs.uniform(-1, 1, L); out = np.zeros(n)
        for i in range(n):
            out[i] = buf[i % L]; buf[i % L] = damp * 0.5 * (buf[i % L] + buf[(i + 1) % L])
        return lp(out, 5000) * env(n, 0.001, 4) * g
    cache = {}
    def pl(f, g):
        if f not in cache: cache[f] = ks(f)
        return cache[f] * g
    drum = lambda g: (np.sin(2 * np.pi * (48 + 70 * np.exp(-tt(0.5) * 18)) * tt(0.5)) * env(int(0.5 * SR), 0.002, 6) + lp(noise(0.5), 600) * env(int(0.5 * SR), 0.001, 20) * 0.5) * g
    def pad(ch, d):
        t_ = tt(d); y = sum(np.sin(2 * np.pi * f * 2 * t_ * (1 + dt)) for f in ch for dt in (-0.004, 0.004))
        a = np.minimum(1, t_ / 0.4) * np.minimum(1, (d - t_) / 0.3); return lp(y, 1800) * a
    nb = int(DUR / bar) + 2
    for b in range(nb):
        ch = prog[b % 8]; b0 = b * bar
        put(int(b0 * SR), pad(ch, bar) * 0.05)
        put(int(b0 * SR), drum(0.55)); put(int((b0 + 2.5 * beat) * SR), drum(0.38)); put(int((b0 + 3 * beat) * SR), drum(0.3))
        if b % 2: put(int((b0 + 1.5 * beat) * SR), drum(0.22))
        put(int(b0 * SR), pl(ch[0] * 2, 0.35)); put(int((b0 + 2 * beat) * SR), pl(ch[1] * 2, 0.25))
        base = rs.integers(0, 4); shape = rs.choice([[0, 2, 4, 2], [0, 1, 2, 4], [4, 2, 1, 0], [0, 2, 3, 5]])
        for k in range(16):
            n_ = min(len(pent) - 1, base + shape[k % 4] + (2 if k >= 8 and b % 2 else 0))
            put(int((b0 + k * beat / 4) * SR), pl(pent[n_], 0.16 if k % 4 == 0 else 0.10))
        if b % 4 == 3:                                                              # swell into the next phrase
            d = bar * 0.9; t_ = tt(d); put(int((b0 + bar - d) * SR), bp(noise(d), 300, 3000) * (t_ / d) ** 2 * 0.12)
    x = lp(x, 7500); x = hp(x, 38)
    fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); fi = int(0.1 * SR); fade[:fi] *= np.linspace(0, 1, fi)
    return x / (np.abs(x).max() + 1e-9) * fade

def energize(v, sr_, up=1.5, expr=1.4):
    """livelier narration without changing timing (script.json "energize": {"up": semitones, "expr": factor}): WORLD
    vocoder raises the pitch a little and widens its movement around a slow baseline. Needs pyworld; skipped if missing."""
    try:
        import pyworld as pw
        from scipy.ndimage import median_filter, uniform_filter1d
    except Exception as e:
        print('energize skipped (pyworld not installed):', e); return v
    x = v.mean(1).astype(np.float64); pk = np.abs(x).max() + 1e-9; x = x / pk
    x16 = signal.resample_poly(x, 1, 2)                                             # analyse at 24 kHz (Kokoro's rate)
    f0, t_ = pw.harvest(x16, sr_ // 2, f0_floor=60, f0_ceil=420, frame_period=5.0)
    sp = pw.cheaptrick(x16, f0, t_, sr_ // 2); ap_ = pw.d4c(x16, f0, t_, sr_ // 2)
    vv = f0 > 0; lf = np.zeros_like(f0); lf[vv] = np.log2(f0[vv]); base = lf.copy(); idx = np.where(vv)[0]
    if len(idx): base[idx] = uniform_filter1d(median_filter(lf[idx], size=241, mode='nearest'), 121, mode='nearest')
    nf = np.zeros_like(f0); nf[vv] = 2 ** (base[vv] + (lf[vv] - base[vv]) * expr + up / 12)
    y = pw.synthesize(nf, sp, ap_, sr_ // 2, frame_period=5.0)
    y = signal.resample_poly(y, 2, 1)[:len(x)]; y = np.pad(y, (0, len(x) - len(y)))
    y = y / (np.abs(y).max() + 1e-9) * pk
    print(f'voice energized: +{up} st, expression x{expr}')
    return np.stack([y, y], 1)

def voice_polish(v):
    """make the AI voice sit closer and more natural: rumble cut, a touch of presence, gentle compression"""
    out = np.zeros_like(v)
    for c in range(v.shape[1]):
        y = hp(v[:, c], 85)
        y = y + 0.35 * bp(y, 2500, 5000)                              # ~+2.5 dB presence
        env_ = signal.lfilter([1 - 0.995], [1, -0.995], np.abs(y)); thr = np.percentile(env_[env_ > 1e-5], 70)
        g = np.where(env_ > thr, (thr / (env_ + 1e-9)) ** 0.4, 1.0)    # ~1.7:1 above the 70th percentile
        out[:, c] = y * g
    return out

def load_audio(f):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(f), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(out, dtype=np.float32).reshape(-1, 2).astype(np.float64); return a


mix = np.zeros((N, 2))
# voice
vf = P / 'data/narration.wav'
voice = None
if vf.exists():
    v = load_audio(vf)[:N]; voice = np.zeros((N, 2)); voice[:len(v)] = v
    if script.get('energize'): voice = energize(voice, SR, **script['energize'])
    voice = voice_polish(voice)
    rms = np.sqrt(np.mean(voice ** 2) + 1e-12); voice *= db(-19) / rms
    mix += voice
# music
mus = script.get('music', 'bed')
if mus and mus != 'none':
    m = music_bed() if mus == 'bed' else music_tension() if mus == 'tension' else music_bounce() if mus == 'bounce' else music_quirk() if mus == 'quirk' else music_dry() if mus == 'dry' else music_epic() if mus == 'epic' else None
    if m is None:
        a = load_audio(P / mus)[:N]; m = np.zeros(N); m[:len(a)] = a.mean(1); m /= np.abs(m).max() + 1e-9
    m = np.stack([m, m], 1) * db((-9 if mus == 'quirk' else -14 if mus == 'dry' else -15 if mus == 'epic' else -24) if voice is not None else -20)
    if voice is not None:                                                        # duck under the voice
        lev = np.abs(voice.mean(1)); lev = signal.lfilter([1 - 0.9995], [1, -0.9995], lev); lev /= lev.max() + 1e-9
        m *= (1 - (0.4 if mus in ('quirk', 'dry', 'epic') else 0.55) * np.clip(lev * 3, 0, 1))[:, None]
    mix += m
# effects
for c in cj['cues']:
    fn = FX.get(c['type'])
    if not fn: print('unknown cue type, skipped:', c['type']); continue
    x = fn(**({'d': c['dur']} if c.get('dur') else {}))
    x = lp(x, 5000) * db(LEVEL[c['type']]) * c.get('gain', 1.0) / (np.abs(x).max() + 1e-9) * 0.9
    i = int(c['t'] * SR); n = min(len(x), N - i)
    if n > 0 and i >= 0:
        if c.get('sweep'):                                            # pan glides across the stereo field (camera moves)
            sv = float(c['sweep']); pn = np.linspace(-sv, sv, n); mix[i:i + n, 0] += x[:n] * np.clip(1 - pn, 0, 1); mix[i:i + n, 1] += x[:n] * np.clip(1 + pn, 0, 1)
        else: pan = c.get('pan', 0.0); mix[i:i + n, 0] += x[:n] * (1 - max(0, pan)); mix[i:i + n, 1] += x[:n] * (1 + min(0, pan))
# master: gentle soft-clip, peak -1 dBFS
mix = np.tanh(mix * 1.2) / 1.2
mix *= db(-1) / (np.abs(mix).max() + 1e-9)
wavfile.write(P / 'data/mix.wav', SR, (mix * 32767).astype(np.int16))
print(f"data/mix.wav: {DUR:.2f} s · voice: {'yes' if voice is not None else 'NO (captions-only)'} · music: {mus} · {len(cj['cues'])} cues")
