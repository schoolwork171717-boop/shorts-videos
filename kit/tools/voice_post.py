"""v9.4 trendy voice: the refs' narrator measures f0 179 Hz, spectral centroid ~1640 Hz, high-band share 0.20.
Kokoro male voices sit at 115-150 Hz and sound dark, so lift the pitch with formants preserved (timing unchanged, so all
word times / cues / renders stay valid) and add presence EQ + light compression.  usage: voice_post.py <project> [semitones]"""
import sys, subprocess, shutil, os
p = sys.argv[1]; semi = float(sys.argv[2]) if len(sys.argv) > 2 else 7.5
src = os.path.join(p, 'data/narration.wav'); raw = os.path.join(p, 'data/narration_raw.wav')
if not os.path.exists(raw): shutil.copy(src, raw)
af = (f'rubberband=pitch={2 ** (semi / 12):.4f}:formant=preserved:pitchq=quality,'
      'highshelf=f=3500:g=3,equalizer=f=5000:t=q:w=1:g=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=60')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', af, '-ar', '24000', src], check=True)
print('voice_post:', src, f'+{semi} st, presence EQ')
