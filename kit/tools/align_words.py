"""v9: exact word times for ANY narration (Kokoro or clone) with the local Parakeet ASR - no Whisper download.
  python tools/align_words.py <project>    data/narration.wav + data/lines.json + script.json -> data/words.json"""
import json, re, sys, difflib
from pathlib import Path
import numpy as np, scipy.io.wavfile as wf, scipy.signal as ss
import sherpa_onnx as so
A = Path.home() / '.faceless-shorts/clone/sherpa-onnx-nemo-parakeet_tdt_ctc_110m-en-36000-int8'
asr = so.OfflineRecognizer.from_nemo_ctc(model=str(A / 'model.int8.onnx'), tokens=str(A / 'tokens.txt'), num_threads=2)
def norm(w): return re.sub(r"[^a-z0-9']", '', w.lower())
P = Path(sys.argv[1]); S = json.loads((P / 'script.json').read_text()); L = json.loads((P / 'data/lines.json').read_text()); L = L['lines'] if isinstance(L, dict) else L
sr, x = wf.read(P / 'data/narration.wav'); x = x.astype(np.float32) / 32768; x = x.mean(1) if x.ndim > 1 else x
y16 = ss.resample_poly(x, 16000, sr).astype(np.float32); dur = len(x) / sr
def lt(l): return (l.get('s', l.get('start')), l.get('e', l.get('end')))
out = []
for li, line in enumerate(S['lines']):
    s0, e0 = lt(L[li]); a, b = max(0, s0 - 0.25), min(dur, e0 + 0.25)
    st = asr.create_stream(); st.accept_waveform(16000, y16[int(a * 16000):int(b * 16000)]); asr.decode_stream(st); r = st.result
    hw, cur = [], None
    for tok, ts in zip(r.tokens, r.timestamps):
        if tok.startswith(' ') or cur is None:
            if cur: hw.append(cur)
            cur = {'w': tok.strip(), 's': a + float(ts)}
        else: cur['w'] += tok
    if cur: hw.append(cur)
    hw = [w for w in hw if norm(w['w'])]
    sw = line['text'].split(); A1 = [norm(w) for w in sw]; B1 = [norm(w['w']) for w in hw]
    t = [None] * len(sw)
    for blk in difflib.SequenceMatcher(None, A1, B1).get_matching_blocks():
        for k in range(blk.size): t[blk.a + k] = hw[blk.b + k]['s']
    known = [i for i, v in enumerate(t) if v is not None]
    for i in range(len(t)):
        if t[i] is None:
            lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
            t0 = t[lo] if lo is not None else s0; t1 = t[hi] if hi is not None else e0 - 0.15
            i0 = lo if lo is not None else -1; i1 = hi if hi is not None else len(t)
            t[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
    t = [min(max(v, s0 - 0.05), e0) for v in t]
    for i, w in enumerate(sw):
        e = max(t[i] + 0.1, t[i + 1] - 0.02) if i + 1 < len(sw) else e0
        out.append({'w': w, 'line': li, 's': round(t[i], 3), 'e': round(e, 3)})
    print(f'line {li}: matched {len(known)}/{len(sw)}')
(P / 'data/words.json').write_text(json.dumps(out))
print('data/words.json:', len(out), 'words')
