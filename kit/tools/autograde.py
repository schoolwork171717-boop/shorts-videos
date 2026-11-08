"""v9.4 auto-grade: measure the film against the 20 reference Shorts and solve for an ffmpeg grade that matches them.
Reference medians (20 videos, 1 frame/s, CIE L*a*b*): L5 15.7  L50 49.2  L95 84.1  white(L>90) 3.1%  dark(L<20) 7.9%
a* +9.9  b* +5.7  HSV-sat 0.474  sat>0.5 46.9%  colourfulness 0.297  edge share 0.118  Laplacian var 1209.
A global red tint turned white faces pink, so tint/warm are capped at +-2-3% and colour comes from saturation instead.
usage: autograde.py in.mp4 out.mp4   (prints before/after table)"""
import sys, subprocess, json, os, tempfile, numpy as np
sys.argv_save = sys.argv[:]; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'measure_visuals.py')).read().split('out={}')[0]); sys.argv = sys.argv_save
TGT = dict(L5=15.7, L50=49.2, L95=84.1, white=0.031, a=9.9, b=5.7, sat=0.474, colorful=0.297, sharp=1209.0)
SC = dict(L5=6.0, L50=6.0, L95=6.0, white=0.03, a=5.0, b=6.0, sat=0.08, colorful=0.06, sharp=500.0)
W8 = dict(L5=1.0, L50=1.5, L95=1.0, white=0.7, a=1.0, b=0.5, sat=1.0, colorful=0.7, sharp=0.6)
inp, outp = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp(); fr = frames(inp, 3.0)[:18]
from PIL import Image
for i, f in enumerate(fr): Image.fromarray(f).save(f'{tmp}/f{i:02d}.png')
def filt(p):
    lo, mid, hi = p['lift'], p['mid'], p['white']
    pts = f"0/{lo:.4f} 0.25/{min(1, lo + (0.25) * (hi - lo) * (1 + p['mid2'])):.4f} 0.5/{mid:.4f} 0.85/{min(1, hi - 0.15 * (hi - mid) / 0.35):.4f} 1/{hi:.4f}"
    r = p['exp'] * (1 + p['tint'] + 0.5 * p['warm']); g = p['exp'] * (1 - 0.7 * p['tint'] + 0.1 * p['warm']); bl = p['exp'] * (1 - p['warm'])
    return (f"colorchannelmixer=rr={r:.4f}:gg={g:.4f}:bb={bl:.4f},curves=all='{pts}',eq=saturation={p['sat']:.4f},"
            f"unsharp=5:5:{p['sh']:.3f}:5:5:0")
def measure(p):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-start_number', '0', '-i', f'{tmp}/f%02d.png', '-vf', filt(p), '-start_number', '0', f'{tmp}/g%02d.png'], check=True)
    st = [stats(np.asarray(Image.open(f'{tmp}/g{i:02d}.png').convert('RGB'))) for i in range(len(fr))]
    return {k: float(np.median([s[k] for s in st])) for k in TGT}
def loss(m): return sum(W8[k] * ((m[k] - TGT[k]) / SC[k]) ** 2 for k in TGT)
p = dict(lift=0.0, mid=0.5, white=1.0, mid2=0.0, exp=1.0, tint=0.0, warm=0.0, sat=1.0, sh=0.0)
steps = dict(lift=0.03, mid=0.03, white=0.03, mid2=0.1, exp=0.04, tint=0.04, warm=0.04, sat=0.08, sh=0.3)
lim = dict(lift=(0, 0.15), mid=(0.35, 0.65), white=(0.85, 1.0), mid2=(-0.5, 0.5), exp=(0.85, 1.25), tint=(-0.02, 0.02), warm=(-0.03, 0.03), sat=(0.8, 1.7), sh=(0, 1.5))
m0 = measure(p); best = loss(m0); print('before', {k: round(v, 3) for k, v in m0.items()}, 'loss', round(best, 2))
for it in range(8):
    improved = False
    for k in p:
        for d in (+1, -1):
            q = dict(p); q[k] = float(np.clip(p[k] + d * steps[k], *lim[k])); 
            if q[k] == p[k]: continue
            l = loss(measure(q))
            if l < best - 1e-3: best, p, improved = l, q, True; break
    if not improved: steps = {k: v / 2 for k, v in steps.items()}
m1 = measure(p); print('after ', {k: round(v, 3) for k, v in m1.items()}, 'loss', round(best, 2)); print('target', TGT); print('filter', filt(p))
json.dump(dict(filter=filt(p), before=m0, after=m1), open(os.path.splitext(outp)[0] + '.grade.json', 'w'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', inp, '-vf', filt(p), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'copy', outp], check=True)
print('graded ->', outp)
