import sys,subprocess,json,numpy as np
from PIL import Image, ImageFilter
def frames(f,step=1.0):
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip())
    raw=subprocess.run(['ffmpeg','-loglevel','error','-ss','1','-t',str(max(1,dur-2)),'-i',f,'-vf',f'fps={1/step},scale=270:480,format=rgb24','-f','rawvideo','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.uint8).reshape(-1,480,270,3)
def srgb2lin(c): return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def lab(rgb):
    l=srgb2lin(rgb); M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]]); xyz=l@M.T/np.array([0.9505,1,1.089])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116); L=116*f[...,1]-16; a=500*(f[...,0]-f[...,1]); b=200*(f[...,1]-f[...,2]); return L,a,b
def stats(fr):
    x=fr.astype(np.float32)/255; mx=x.max(2); mn=x.min(2); s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    L,a,b=lab(x); g=np.asarray(Image.fromarray(fr).convert('L')).astype(np.float32)
    blur=np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)
    lap=np.abs(g[1:-1,1:-1]*4-g[:-2,1:-1]-g[2:,1:-1]-g[1:-1,:-2]-g[1:-1,2:])
    rg=x[...,0]-x[...,1]; yb=0.5*(x[...,0]+x[...,1])-x[...,2]; colorful=np.sqrt(rg.std()**2+yb.std()**2)+0.3*np.sqrt(rg.mean()**2+yb.mean()**2)
    return dict(L=L.mean(),Lsd=L.std(),L5=np.percentile(L,5),L50=np.percentile(L,50),L95=np.percentile(L,95),white=(L>90).mean(),dark=(L<20).mean(),
        sat=s.mean(),satHi=(s>0.5).mean(),colorful=colorful,a=a.mean(),b=b.mean(),edges=(lap>40).mean(),detail=(g-blur).std(),sharp=lap.var())
out={}
for f in sys.argv[1:]:
    st=[stats(fr) for fr in frames(f)]
    out[f.split('/')[-1][:40]]={k:float(np.median([s[k] for s in st])) for k in st[0]}
json.dump(out,open('/tmp/ana/vis_'+str(abs(hash(tuple(sys.argv[1:])))%10000)+'.json','w'))
import pandas as pd
df=pd.DataFrame(out).T; pd.set_option('display.width',250); print(df.round(3).to_string())
print('MEDIAN'); print(df.median().round(3).to_string())
