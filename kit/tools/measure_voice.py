import sys,subprocess,numpy as np,pyworld as pw,sherpa_onnx as so,os,json
A=os.path.expanduser('~/.faceless-shorts/clone/sherpa-onnx-nemo-parakeet_tdt_ctc_110m-en-36000-int8')
asr=so.OfflineRecognizer.from_nemo_ctc(model=A+'/model.int8.onnx',tokens=A+'/tokens.txt',num_threads=2)
def load(f):
    raw=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-ac','1','-ar','16000','-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(raw,np.float32).astype(np.float64)
def feats(x,sr=16000):
    seg=x[:sr*40]
    st=asr.create_stream(); st.accept_waveform(sr,seg.astype(np.float32)); asr.decode_stream(st); r=st.result
    ts=[t for tok,t in zip(r.tokens,r.timestamps) if tok.startswith(' ')]; nw=len(ts)
    span=(ts[-1]-ts[0]) if nw>1 else 1
    gaps=np.diff(ts); pauses=(gaps>0.45).sum()/max(1,span)*10
    f0,t=pw.harvest(seg,sr,f0_floor=70,f0_ceil=450,frame_period=10); v=f0[f0>0]
    st_=12*np.log2(v/np.median(v))
    # spectral centroid & brightness of voiced frames
    S=np.abs(np.fft.rfft(seg[:len(seg)//512*512].reshape(-1,512)*np.hanning(512),axis=1)); fr=np.fft.rfftfreq(512,1/sr)
    e=S.sum(1); m=e>np.percentile(e,40); cen=(S[m]*fr).sum(1)/S[m].sum(1)
    hf=(S[m][:,fr>3000].sum(1)/S[m].sum(1))
    # energy dynamics: std of 50ms frame dB in speech
    fr50=seg[:len(seg)//800*800].reshape(-1,800); db=20*np.log10(np.sqrt((fr50**2).mean(1))+1e-6); sp=db>np.percentile(db,50)-6
    return dict(wps=nw/span, f0=float(np.median(v)), range_st=float(st_.std()), p90_10=float(np.percentile(st_,90)-np.percentile(st_,10)), centroid=float(np.median(cen)), hf=float(np.median(hf)), dyn_db=float(db[sp].std()), pauses_per10s=float(pauses))
out={}
for f in sys.argv[1:]:
    try: out[f.split('/')[-1][:38]]=feats(load(f))
    except Exception as e: print(f,e)
keys=list(next(iter(out.values())).keys()); print(' '*38,' '.join(f'{k:>9}' for k in keys))
for n,d in out.items(): print(f'{n:38}',' '.join(f'{d[k]:9.2f}' for k in keys))
print(f'{"MEDIAN":38}',' '.join(f'{np.median([d[k] for d in out.values()]):9.2f}' for k in keys)); json.dump(out,open('/tmp/ana/voice_out.json','w'))
