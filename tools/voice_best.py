# best-of-N regeneration: synthesize variants, score with Whisper vs reading (kana), keep best
import json,subprocess,urllib.request,urllib.parse,sys,difflib,re,numpy as np,pykakasi
src=open('/workspace/onaka-game/tools/gen_voice.py').read().split('only=sys.argv')[0]
g={};exec(src,g);L,S,H,OUT=g['L'],g['S'],g['H'],g['OUT']
from faster_whisper import WhisperModel
m=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4)
kk=pykakasi.kakasi()
def kana(s):
  s=re.sub(r'[^\w]','',s); return ''.join(x['hira'] for x in kk.convert(s)).replace('ー','')
def synth(st,t,inton,spd,pit,ss,path):
  sp=S[st]
  q=json.load(urllib.request.urlopen(urllib.request.Request(f'{H}/audio_query?speaker={sp}&text='+urllib.parse.quote(t),method='POST')))
  q.update(intonationScale=inton,speedScale=spd,pitchScale=pit-0.03,tempoDynamicsScale=1.15,prePhonemeLength=0.05,postPhonemeLength=0.15,styleStrengthScale=ss)
  wav=urllib.request.urlopen(urllib.request.Request(f'{H}/synthesis?speaker={sp}',data=json.dumps(q).encode(),headers={'Content-Type':'application/json'})).read()
  open('/tmp/vb.wav','wb').write(wav)
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/vb.wav','-af','highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11','-ac','1','-ar','44100','-b:a','112k',path],check=True)
def asr(f):
  b=subprocess.run(['ffmpeg','-v','quiet','-i',f,'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True).stdout
  segs,_=m.transcribe(np.frombuffer(b,np.int16).astype(np.float32)/32768,language='ja',beam_size=3)
  return ''.join(s.text for s in segs)
def score(f,ref): 
  h=asr(f); return difflib.SequenceMatcher(None,kana(h),kana(ref)).ratio(),h
for key in sys.argv[1:]:
  cat,i=key.rsplit('_',1);i=int(i)
  st,disp,t,inton,spd,pit,ss=L[cat][i]
  fn=f'{OUT}/{cat}_{i}.mp3'
  best=score(fn,t)+(fn,'orig'); print(key,'orig',round(best[0],2),best[1],flush=True)
  vars=[]
  for sty in dict.fromkeys([st,'joy','n']):
    for dI,sS,sp in [(0,ss,spd),(-0.3,min(ss,0.9),spd*0.95),(-0.15,ss,spd*0.92)]:
      vars.append((sty,inton+dI,sS,sp))
  for k,(sty,it,sS,sp) in enumerate(vars):
    p=f'/tmp/vb_{key}_{k}.mp3'; synth(sty,t,it,sp,pit,sS,p)
    sc,h=score(p,t); print('  ',k,sty,round(it,2),sS,round(sp,2),round(sc,2),h,flush=True)
    if sc>best[0]+0.03: best=(sc,h,p,(sty,it,sS,sp))
    if sc>=0.97: break
  if best[2]!=fn: subprocess.run(['cp',best[2],fn]); print('=>',key,'replaced',best[3],round(best[0],2),flush=True)
  else: print('=>',key,'kept',flush=True)
