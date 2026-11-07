"""Iron Canyon kit v8: the narrator voice, cloned from the user's reference video, told as one flowing story.

  ~/.faceless-shorts/venv/bin/python tools/clone_voice.py <project> [--redo 0,3]
      script.json -> data/narration.wav + data/lines.json + data/words.json (real word times, no words.py needed)

script.json keys: "voice": "clone", "voice_ref" (default: voice/narrator.wav in the kit or ~/.faceless-shorts/voice/),
"speed" (default 1.12), "lead", "gap" (between chunks, default 0.05), "outro", "tries" (default 5).

v8 changes: lines are spoken in CHUNKS (a whole sentence or two at once, up to ~28 words) instead of one line at a time,
so the voice flows like a storyteller instead of resetting every line. Each chunk is made several times (Kyutai
Pocket TTS via sherpa-onnx, voice copied from the reference clip) and the best take wins: every word must be heard
(NeMo Parakeet ASR), then the take that sounds most like the reference (WeSpeaker), nearest its pitch (~190 Hz) and
liveliness. Parakeet's word timestamps then give exact line and word times, which drive captions and acting.
No audio effects. Models come from the sherpa-onnx GitHub releases on first use (works in cloud runs).
"""
import json, os, re, sys, time, urllib.request, tarfile, difflib
from pathlib import Path
import numpy as np
import scipy.io.wavfile as wf
import scipy.signal as ss
import pyworld as pw

SR = 24000
HOME = Path(os.environ.get('FACELESS_HOME', Path.home() / '.faceless-shorts'))
MD = HOME / 'clone'
REL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'
MODELS = {
    'pocket': ('tts-models/sherpa-onnx-pocket-tts-2026-01-26.tar.bz2', 'sherpa-onnx-pocket-tts-2026-01-26'),   # v8.3: full-precision model (int8 sounded buzzier, less like the narrator)
    'asr': ('asr-models/sherpa-onnx-nemo-parakeet_tdt_ctc_110m-en-36000-int8.tar.bz2', 'sherpa-onnx-nemo-parakeet_tdt_ctc_110m-en-36000-int8'),
    'spk': ('speaker-recongition-models/wespeaker_en_voxceleb_resnet34.onnx', 'wespeaker_en_voxceleb_resnet34.onnx'),
}
TARGET_F0, TARGET_RANGE = 184.0, 5.9      # the reference narrator: median pitch (Hz), pitch movement (semitones std)


def ensure_models():
    MD.mkdir(parents=True, exist_ok=True)
    for key, (url, name) in MODELS.items():
        if (MD / name).exists(): continue
        fn = MD / Path(url).name
        print(f'downloading {Path(url).name} ...', flush=True)
        urllib.request.urlretrieve(REL + url, fn)
        if fn.suffix == '.bz2':
            with tarfile.open(fn) as t: t.extractall(MD)
            fn.unlink()


def load(fn, sr_out):
    sr, x = wf.read(fn); x = x.astype(np.float32) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 2: x = x.mean(1)
    from math import gcd
    g = gcd(sr_out, sr); return ss.resample_poly(x, sr_out // g, sr // g).astype(np.float32)


def trim(x, thr=0.01):
    a = np.abs(x); idx = np.where(a > thr * a.max())[0]
    if not len(idx): return x
    pad = int(0.03 * SR); return x[max(0, idx[0] - pad): idx[-1] + pad]


def norm_words(s):
    from num2words import num2words
    s = s.lower().replace('%', ' percent')
    s = re.sub(r'(\d),(\d)', r'\1\2', s)
    s = re.sub(r'\d+(\.\d+)?', lambda m: ' ' + num2words(float(m.group()) if '.' in m.group() else int(m.group())) + ' ', s)
    s = re.sub(r"[^a-z' ]+", ' ', s.replace('-', ' '))
    return s.split()


def chunks_of(lines, max_words=28):
    """group consecutive lines into spoken chunks that end on a sentence end"""
    out, cur, n = [], [], 0
    for i, ln in enumerate(lines):
        cur.append(i); n += len(ln['text'].split())
        end = ln['text'].rstrip().endswith(('.', '!', '?', '"', '”'))
        nxt = len(lines[i + 1]['text'].split()) if i + 1 < len(lines) else 0
        if (end and n >= 8) or n + nxt > max_words or i == len(lines) - 1: out.append(cur); cur, n = [], 0
    return out


def smooth(x, sr, target_f0=190.0, rate=1.0, fp=5.0):
    """v9: WORLD re-voicing: move the chunk to the narrator's pitch, iron out pitch jitter, even out speaking rate."""
    x = x.astype(np.float64)
    f0, t = pw.harvest(x, sr, f0_floor=70, f0_ceil=420, frame_period=fp)
    f0 = pw.stonemask(x, f0, t, sr)
    sp = pw.cheaptrick(x, f0, t, sr); ap = pw.d4c(x, f0, t, sr)
    v = f0 > 0
    if v.sum() < 10: return x, 1.0
    med = np.median(f0[v]); k = target_f0 / med
    lf = np.zeros_like(f0); lf[v] = np.log(f0[v] * k)
    # jitter: median-filter the log-pitch inside voiced runs, then a light smoothing (keeps intonation, removes wobble)
    out = lf.copy(); idx = np.where(v)[0]
    runs = np.split(idx, np.where(np.diff(idx) > 1)[0] + 1)
    for r in runs:
        if len(r) >= 5:
            seg = ss.medfilt(lf[r], 5)
            if len(r) >= 9: seg = ss.savgol_filter(seg, 9, 2)
            out[r] = seg
    f1 = np.where(v, np.exp(out), 0.0)
    if abs(rate - 1.0) > 0.01:                      # time-scale: resample the frame sequence
        n = len(f0); m = int(round(n / rate)); src = np.linspace(0, n - 1, m)
        i0 = np.floor(src).astype(int); i1 = np.minimum(i0 + 1, n - 1); w = (src - i0)[:, None]
        sp = sp[i0] * (1 - w) + sp[i1] * w; ap = ap[i0] * (1 - w) + ap[i1] * w
        vv = (f1[i0] > 0) & (f1[i1] > 0); f1 = np.where(vv, f1[i0] * (1 - w[:, 0]) + f1[i1] * w[:, 0], np.where(f1[i0] > 0, f1[i0], 0))
    y = pw.synthesize(np.ascontiguousarray(f1), np.ascontiguousarray(sp), np.ascontiguousarray(ap), sr, fp)
    return y.astype(np.float32), k


def main():
    import sherpa_onnx as so
    if len(sys.argv) < 2: sys.exit(__doc__)
    ensure_models()
    P = Path(sys.argv[1]); S = json.loads((P / 'script.json').read_text())
    here = Path(__file__).resolve().parent
    ref_path = S.get('voice_ref') or next((str(p) for p in [here / 'voice/narrator.wav', here.parent / 'voice/narrator.wav', HOME / 'voice/narrator.wav'] if p.exists()), None)
    if not ref_path: sys.exit('no reference clip: set "voice_ref" in script.json or put voice/narrator.wav in the kit')
    speed = float(S.get('speed', 1.12)); tries = int(S.get('tries', 5))
    D = MD / MODELS['pocket'][1]
    tts = so.OfflineTts(so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(pocket=so.OfflineTtsPocketModelConfig(
        lm_flow=str(D / 'lm_flow.onnx'), lm_main=str(D / 'lm_main.onnx'), encoder=str(D / 'encoder.onnx'),
        decoder=str(D / 'decoder.onnx'), text_conditioner=str(D / 'text_conditioner.onnx'), vocab_json=str(D / 'vocab.json'),
        token_scores_json=str(D / 'token_scores.json')), num_threads=2)))
    A = MD / MODELS['asr'][1]
    asr = so.OfflineRecognizer.from_nemo_ctc(model=str(A / 'model.int8.onnx'), tokens=str(A / 'tokens.txt'), num_threads=2)
    spk = so.SpeakerEmbeddingExtractor(so.SpeakerEmbeddingExtractorConfig(model=str(MD / MODELS['spk'][1]), num_threads=2))
    ref24 = load(ref_path, SR); ref16 = load(ref_path, 16000)

    def emb(y16):
        st = spk.create_stream(); st.accept_waveform(16000, y16); st.input_finished(); e = np.array(spk.compute(st)); return e / np.linalg.norm(e)
    REF = emb(ref16)

    def hear(y):
        """ASR words with start times (s, relative to y)"""
        y16 = ss.resample_poly(y, 2, 3).astype(np.float32)
        st = asr.create_stream(); st.accept_waveform(16000, y16); asr.decode_stream(st); r = st.result
        words, cur = [], None
        for tok, ts in zip(r.tokens, r.timestamps):
            if tok.startswith(' ') or cur is None:
                if cur: words.append(cur)
                cur = {'w': tok.strip(), 's': float(ts)}
            else: cur['w'] += tok
        if cur: words.append(cur)
        words = [w for w in words if re.sub(r"[^A-Za-z0-9']", '', w['w'])]
        return r.text.strip(), words, y16

    def score(text, y):
        heard, words, y16 = hear(y)
        a, b = norm_words(text), norm_words(heard)
        sm = difflib.SequenceMatcher(None, a, b); m = sum(k.size for k in sm.get_matching_blocks()) / max(len(a), len(b), 1)
        sim = float(emb(y16) @ REF)
        f, _ = pw.harvest(y16.astype(np.float64), 16000, f0_floor=70, f0_ceil=400, frame_period=10); f = f[f > 0]
        semi = abs(12 * np.log2(np.median(f) / TARGET_F0)) if len(f) else 12
        rng = float(np.std(12 * np.log2(f / np.median(f)))) if len(f) else 0
        return m, sim, semi, rng, heard, words

    def take(text):
        best = None
        for k in range(tries + 6):
            g = so.GenerationConfig(); g.reference_audio = ref24.tolist(); g.reference_sample_rate = SR; g.speed = speed
            # Pocket TTS tends to swallow the first word; a leading "..." usually fixes it (alternate both ways)
            y = trim(np.asarray(tts.generate(('... ' + text) if k % 2 == 0 else text, g).samples, dtype=np.float32))
            m, sim, semi, rng, heard, words = score(text, y)
            q = (1.0 if m >= 0.99 else m - 0.6) * 3 + sim - 0.04 * semi - 0.07 * max(0.0, TARGET_RANGE - rng) - 0.02 * max(0.0, rng - TARGET_RANGE - 1.5)   # v8.2: lively takes win (flat = robotic)
            print(f'   take {k + 1}: words {m:.2f} voice {sim:.3f} pitch {semi:.1f}st range {rng:.1f}st  "{heard[:70]}"', flush=True)
            if best is None or q > best[0]: best = (q, y, m, words)
            if k + 1 >= tries and best[2] >= 0.99: break
        if best[2] < 0.99: print(f'   WARNING: best take only matched {best[2]:.0%} of the words', flush=True)
        y = best[1]; return y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.08, best[3]

    def align(lines_idx, heard_words, dur):
        """script words (with line index) -> times, from the ASR word times"""
        sw = [(li, w) for li in lines_idx for w in S['lines'][li]['text'].split()]
        a = [(norm_words(w) or [''])[0] for _, w in sw]; b = [(norm_words(w['w']) or [''])[0] for w in heard_words]
        times = [None] * len(sw)
        for blk in difflib.SequenceMatcher(None, a, b).get_matching_blocks():
            for k in range(blk.size): times[blk.a + k] = heard_words[blk.b + k]['s']
        known = [i for i, t in enumerate(times) if t is not None]
        for i in range(len(times)):                                    # fill gaps by interpolation
            if times[i] is None:
                lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
                t0 = times[lo] if lo is not None else 0.0; t1 = times[hi] if hi is not None else dur - 0.2
                i0 = lo if lo is not None else -1; i1 = hi if hi is not None else len(times)
                times[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
        ends = [max(times[i] + 0.12, times[i + 1] - 0.02) if i + 1 < len(times) else min(dur, times[i] + 0.45) for i in range(len(times))]
        return [(li, w, s, e) for (li, w), s, e in zip(sw, times, ends)]

    redo = set()
    if '--redo' in sys.argv: redo = {int(v) for v in sys.argv[sys.argv.index('--redo') + 1].split(',') if v.strip()}
    CD = P / 'data/clone8'; CD.mkdir(parents=True, exist_ok=True)
    groups = chunks_of(S['lines'])
    out = [np.zeros(int(float(S.get('lead', 0.12)) * SR))]; t = len(out[0]) / SR
    lines = [None] * len(S['lines']); words = []
    t0 = time.time(); placed = []
    keep = json.loads((P / 'data/words.json').read_text()) if '--keep-timing' in sys.argv and (P / 'data/words.json').exists() else None
    for ci, g in enumerate(groups):
        text = ' '.join(S['lines'][i]['text'] for i in g)
        print(f'chunk {ci} (lines {g[0]}-{g[-1]}): {text}', flush=True)
        cw, cj = CD / f'chunk{ci:02d}.wav', CD / f'chunk{ci:02d}.json'
        cached = cj.exists() and cw.exists() and json.loads(cj.read_text()).get('text') == text and ci not in redo
        if cached:
            x = load(str(cw), SR).astype(np.float64); hw = json.loads(cj.read_text())['words']; print('   (kept)', flush=True)
        else:
            x, hw = take(text); wf.write(cw, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16)); cj.write_text(json.dumps({'text': text, 'words': hw}))
        # v9 smoothing: every chunk is re-voiced (WORLD) onto the narrator's exact pitch with the jitter ironed out, and
        # (unless --keep-timing) gently re-timed to an even ~3.7 words/s, so chunk joins don't jump in pitch or pace
        rate = 1.0
        if S.get('smooth', True):
            if keep is None: rate = float(np.clip(len(text.split()) / (len(x) / SR) / float(S.get('wps', 3.7)), 0.9, 1.1))
            y2, k2 = smooth(x, SR, TARGET_F0, rate); x = (y2 / (np.sqrt(np.mean(y2 ** 2)) + 1e-9) * 0.08).astype(np.float64)
            hw = [{**w, 's': w['s'] / rate} for w in hw]
            print(f'   smoothed: pitch {12 * np.log2(k2):+.1f} st, pace x{rate:.2f}', flush=True)
        al = align(g, hw, len(x) / SR)
        # v8.1: cut the dead air the "..." prefix leaves before the first script word and after the last one
        # v8.4: cut only inside real silence. Head: the quietest 20 ms frame in the 0.3 s before the first script word;
        # tail: 0.15 s after the last frame that still has voice energy (never before the last word's end). Short fades on
        # both ends, so no word is ever clipped and no edge clicks (v8.1 cut on word timings and sometimes clipped).
        fr = int(0.02 * SR); env = np.sqrt(np.convolve(x * x, np.ones(fr) / fr, mode='same') + 1e-12); pk = np.percentile(env, 98)
        a0 = int(max(0.0, al[0][2] - 0.30) * SR); a1 = int(max(0.0, al[0][2] - 0.02) * SR)
        cut = (a0 + int(np.argmin(env[a0:a1]))) / SR if a1 - a0 > fr else 0.0
        if env[int(cut * SR)] > 0.12 * pk: cut = max(0.0, al[0][2] - 0.18)          # no quiet spot: keep a generous margin
        voiced = np.where(env > 0.05 * pk)[0]; last = (voiced[-1] / SR) if len(voiced) else len(x) / SR
        tail = min(len(x) / SR, max(last + 0.15, al[-1][3] + 0.1))
        x = x[int(cut * SR): int(tail * SR)].copy(); al = [(li, w, max(0.0, s - cut), max(0.05, e - cut)) for li, w, s, e in al]
        fi, fo = min(len(x), int(0.012 * SR)), min(len(x), int(0.035 * SR)); x[:fi] *= np.linspace(0, 1, fi); x[len(x) - fo:] *= np.linspace(1, 0, fo)
        for li in g:
            ws = [a for a in al if a[0] == li]
            lines[li] = {'i': li, 'text': S['lines'][li]['text'], 'start': round(t + max(0, ws[0][2] - 0.04), 3), 'end': round(t + ws[-1][3], 3)}
        words += [{'w': w, 'line': li, 's': round(t + s, 3), 'e': round(t + e, 3)} for li, w, s, e in al]
        end_p = S['lines'][g[-1]]['text'].rstrip()[-1:] in '.!?'
        gap = np.zeros(int(float(S.get('gap', 0.05)) * SR + (int(float(S.get('pause', 0.16)) * SR) if end_p else 0))) if ci + 1 < len(groups) else np.zeros(0)   # v9: a breath after a full stop
        if keep is not None: placed.append((keep[len(words) - len(al)]['s'] - al[0][2], x))
        out += [x, gap]; t += (len(x) + len(gap)) / SR
    out.append(np.zeros(int(float(S.get('outro', 0.6)) * SR)))
    y = np.concatenate(out)
    if keep is not None:                       # --keep-timing: same word times as the existing words.json, so the picture stays in sync
        dur0 = json.loads((P / 'data/lines.json').read_text())['duration']; y = np.zeros(int(dur0 * SR) + SR)
        for st, xx in placed: i0 = max(0, int(st * SR)); y[i0:i0 + len(xx)] += xx[:len(y) - i0]
        y = y[:int(dur0 * SR)]; words = keep; lines = json.loads((P / 'data/lines.json').read_text())['lines']
    y = y / (np.abs(y).max() + 1e-9) * 0.9
    (P / 'data').mkdir(exist_ok=True)
    wf.write(P / 'data/narration_raw.wav', SR, (y * 32767).astype(np.int16))
    # v8.2 polish: clean, present, radio-style voice (rumble cut, less boxiness, presence + air, gentle compression)
    import subprocess
    pol = 'highpass=f=75,equalizer=f=280:t=q:w=1.0:g=-3,equalizer=f=3400:t=q:w=1.2:g=2.5,treble=g=2:f=9000,acompressor=threshold=-21dB:ratio=2.6:attack=6:release=90:makeup=2,alimiter=limit=0.92'
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(P / 'data/narration_raw.wav'), '-af', pol, '-ar', str(SR), '-ac', '1', str(P / 'data/narration.wav')])
    if r.returncode: wf.write(P / 'data/narration.wav', SR, (y * 32767).astype(np.int16))
    dur = len(y) / SR
    (P / 'data/lines.json').write_text(json.dumps({'duration': round(dur, 3), 'voice': 'clone8:' + Path(ref_path).name, 'speed': speed, 'lines': lines}, indent=1))
    (P / 'data/words.json').write_text(json.dumps(words, indent=0))
    nw = len(words)
    print(f'data/narration.wav ({dur:.2f} s, {nw / dur:.2f} words/s, {time.time() - t0:.0f} s to make) + data/lines.json + data/words.json (real word times; skip words.py)')


if __name__ == '__main__':
    main()
