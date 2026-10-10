import numpy as np, onnxruntime as ort, sys, json
from huggingface_hub import hf_hub_download
from PIL import Image
repo=sys.argv[1]; inp=sys.argv[2]; out=sys.argv[3]
p=hf_hub_download(repo,'onnx/model.onnx')
print(open(hf_hub_download(repo,'preprocessor_config.json')).read())
so=ort.SessionOptions(); so.intra_op_num_threads=6
s=ort.InferenceSession(p,so,providers=['CPUExecutionProvider'])
print([ (i.name,i.shape) for i in s.get_inputs()])
im=np.array(Image.open(inp).convert('RGB')).astype(np.float32)/255
H,W,_=im.shape; T=128; P=12
res=None
for y in range(0,H,T):
  for x in range(0,W,T):
    y0,x0=max(0,y-P),max(0,x-P); y1,x1=min(H,y+T+P),min(W,x+T+P)
    tt=im[y0:y1,x0:x1]; h,w=tt.shape[:2]; ph=(-h)%8; pw=(-w)%8
    tt=np.pad(tt,((0,ph),(0,pw),(0,0)),mode='reflect')
    t=tt.transpose(2,0,1)[None]
    o=s.run(None,{s.get_inputs()[0].name:t})[0][0].transpose(1,2,0)
    sc=o.shape[0]//(h+ph); o=o[:h*sc,:w*sc]
    if res is None: res=np.zeros((H*sc,W*sc,3),np.float32)
    yy,xx=min(T,H-y),min(T,W-x)
    res[y*sc:(y+yy)*sc,x*sc:(x+xx)*sc]=o[(y-y0)*sc:(y-y0+yy)*sc,(x-x0)*sc:(x-x0+xx)*sc]
  print(y,flush=True)
Image.fromarray((np.clip(res,0,1)*255+0.5).astype(np.uint8)).save(out)
