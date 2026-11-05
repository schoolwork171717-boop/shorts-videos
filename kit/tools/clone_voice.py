"""Iron Canyon kit: the narrator voice, cloned from the user's own reference video (kit v7).

  ~/.faceless-shorts/venv/bin/python tools/clone_voice.py <project>
      script.json -> data/narration.wav + data/lines.json (same format as voice.py, so words.py and the mixer just work)

script.json keys: "voice": "clone", "voice_ref": path to the reference clip (default: the kit's voice/narrator.wav next to
this file or in ~/.faceless-shorts/voice/), "speed" (default 1.12), "lead", "gap", "outro", "tries" (default 5).

How it works: Kyutai Pocket TTS (via sherpa-onnx) speaks each line in the voice of the reference clip. It samples, so
every line is made several times and the best take is kept: every word must be there (checked with Whisper), then the
take that sounds most like the reference (WeSpeaker speaker similarity), sits nearest its pitch (~190 Hz) and pace wins.
No audio effects are added. Models come from the sherpa-onnx GitHub releases (works in cloud runs; Hugging Face is not
needed). Needs: uv pip install sherpa-onnx num2words (setup does this).
"""
import json, os, re, sys, time, urllib.request, tarfile
from pathlib import Path
import numpy as np
import scipy.io.wavfile as wf
import scipy.signal as ss

SR = 24000
HOME = Path(os.environ.get('FACELESS_HOME', Path.home() / '.faceless-shorts'))
MD = HOME / 'clone'
REL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'
MODELS = {
    'pocket': ('tts-models/sherpa-onnx-pocket-tts-int8-2026-01-26.tar.bz2', 'sherpa-onnx-pocket-tts-int8-2026-01-26'),
    'whisper': ('asr-models/sherpa-onnx-whisper-base.en.tar.bz2', 'sherpa-onnx-whisper-base.en'),
    'spk': ('speaker-recongition-models/wespeaker_en_voxceleb_resnet34.onnx', 'wespeaker_en_voxceleb_resnet34.onnx'),
}
TARGET_F0 = 190.0      # the reference narrator's median pitch (Hz)


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
    pad = int(0.02 * SR); return x[max(0, idx[0] - pad): idx[-1] + pad]


def norm_words(s):
    from num2words import num2words
    s = s.lower().replace('%', ' percent')
    s = re.sub(r'(\d),(\d)', r'\1\2', s)
    s = re.sub(r'\d+(\.\d+)?', lambda m: ' ' + num2words(float(m.group()) if '.' in m.group() else int(m.group())) + ' ', s)
    s = re.sub(r"[^a-z' ]+", ' ', s.replace('-', ' '))
    return s.split()


def match(want, got):
    import difflib
    a, b = norm_words(want), norm_words(got)
    if not a: return 1.0
    sm = difflib.SequenceMatcher(None, a, b); hit = sum(m.size for m in sm.get_matching_blocks())
    return hit / max(len(a), len(b))


def main():
    import sherpa_onnx as so, pyworld as pw
    if len(sys.argv) < 2: sys.exit(__doc__)
    ensure_models()
    P = Path(sys.argv[1]); S = json.loads((P / 'script.json').read_text())
    here = Path(__file__).resolve().parent
    ref_path = S.get('voice_ref') or next((str(p) for p in [here / 'voice/narrator.wav', here.parent / 'voice/narrator.wav', HOME / 'voice/narrator.wav'] if p.exists()), None)
    if not ref_path: sys.exit('no reference clip: set "voice_ref" in script.json or put voice/narrator.wav in the kit')
    speed = float(S.get('speed', 1.12)); tries = int(S.get('tries', 5))
    D = MD / MODELS['pocket'][1]
    tts = so.OfflineTts(so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(pocket=so.OfflineTtsPocketModelConfig(
        lm_flow=str(D / 'lm_flow.int8.onnx'), lm_main=str(D / 'lm_main.int8.onnx'), encoder=str(D / 'encoder.onnx'),
        decoder=str(D / 'decoder.int8.onnx'), text_conditioner=str(D / 'text_conditioner.onnx'), vocab_json=str(D / 'vocab.json'),
        token_scores_json=str(D / 'token_scores.json')), num_threads=2)))
    W = MD / MODELS['whisper'][1]
    asr = so.OfflineRecognizer.from_whisper(encoder=str(W / 'base.en-encoder.int8.onnx'), decoder=str(W / 'base.en-decoder.int8.onnx'), tokens=str(W / 'base.en-tokens.txt'), num_threads=2)
    spk = so.SpeakerEmbeddingExtractor(so.SpeakerEmbeddingExtractorConfig(model=str(MD / MODELS['spk'][1]), num_threads=2))
    ref24 = load(ref_path, SR); ref16 = load(ref_path, 16000)

    def emb(y16):
        st = spk.create_stream(); st.accept_waveform(16000, y16); st.input_finished(); e = np.array(spk.compute(st)); return e / np.linalg.norm(e)
    REF = emb(ref16)

    def score(text, y):
        y16 = ss.resample_poly(y, 2, 3).astype(np.float32)
        st = asr.create_stream(); st.accept_waveform(16000, y16); asr.decode_stream(st); heard = st.result.text.strip()
        m = match(text, heard); sim = float(emb(y16) @ REF)
        f, _ = pw.harvest(y16.astype(np.float64), 16000, f0_floor=70, f0_ceil=400, frame_period=10); f = f[f > 0]
        semi = abs(12 * np.log2(np.median(f) / TARGET_F0)) if len(f) else 12
        return m, sim, semi, heard

    def take(text):
        best = None
        for k in range(tries + 4):
            g = so.GenerationConfig(); g.reference_audio = ref24.tolist(); g.reference_sample_rate = SR; g.speed = speed
            # Pocket TTS tends to swallow a line's first word; a leading "..." usually fixes it (alternate both ways)
            y = trim(np.asarray(tts.generate(('... ' + text) if k % 2 == 0 else text, g).samples, dtype=np.float32))
            m, sim, semi, heard = score(text, y)
            q = (1.0 if m >= 0.95 else m - 0.5) * 3 + sim - 0.05 * semi
            print(f'   take {k + 1}: words {m:.2f} voice {sim:.3f} pitch {semi:.1f}st  "{heard}"', flush=True)
            if best is None or q > best[0]: best = (q, y, m)
            if k + 1 >= tries and best[2] >= 0.95: break
        if best[2] < 0.95: print(f'   WARNING: best take only matched {best[2]:.0%} of the words', flush=True)
        y = best[1]; return y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.08          # even loudness line to line

    out = [np.zeros(int(S.get('lead', 0.12) * SR))]; t = len(out[0]) / SR; lines = []
    t0 = time.time()
    for i, ln in enumerate(S['lines']):
        print(f'{i:2d} {ln["text"]}', flush=True)
        x = take(ln['text'])
        lines.append({'i': i, 'text': ln['text'], 'start': round(t, 3), 'end': round(t + len(x) / SR, 3)})
        gap = np.zeros(int(float(ln.get('gap', S.get('gap', 0.04))) * SR))
        out += [x, gap]; t += (len(x) + len(gap)) / SR
    out.append(np.zeros(int(float(S.get('outro', 0.6)) * SR)))
    y = np.concatenate(out); y = y / (np.abs(y).max() + 1e-9) * 0.9
    (P / 'data').mkdir(exist_ok=True)
    wf.write(P / 'data/narration.wav', SR, (y * 32767).astype(np.int16))
    dur = len(y) / SR
    (P / 'data/lines.json').write_text(json.dumps({'duration': round(dur, 3), 'voice': 'clone:' + Path(ref_path).name, 'speed': speed, 'lines': lines}, indent=1))
    words = sum(len(l['text'].split()) for l in S['lines'])
    print(f'data/narration.wav ({dur:.2f} s, {words / dur:.2f} words/s, {time.time() - t0:.0f} s to make) + data/lines.json. Next: words.py')


if __name__ == '__main__':
    main()
