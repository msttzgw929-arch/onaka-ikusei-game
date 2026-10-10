import numpy as np, cv2
from PIL import Image
src=np.array(Image.open('src2x_fix.png').convert('RGB')).astype(np.float32)
H,W=src.shape[:2]
B=np.median(np.concatenate([src[:8].reshape(-1,3),src[-8:].reshape(-1,3),src[:,:8].reshape(-1,3),src[:,-8:].reshape(-1,3)]),0)
print('bg',B)
d=np.sqrt(((src-B)**2).sum(2))
isn=np.array(Image.open('cut_isnet-anime.png').resize((W,H),Image.BILINEAR))[:,:,3].astype(np.float32)/255
near=(d<22).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(near,connectivity=4)
bg=np.zeros((H,W),bool)
border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))
for i in range(1,n):
    m=lab==i
    cx=st[i,0]+st[i,2]/2; cy=st[i,1]+st[i,3]/2
    inface= 456<cx<570 and 110<cy<190
    if i in border or (not inface and isn[m].mean()<0.6): bg|=m
# soft alpha from colour distance, only in band near bg
band=cv2.dilate(bg.astype(np.uint8),np.ones((9,9),np.uint8)).astype(bool)
# F estimate: most bg-distant pixel in 5x5 window
best=d.copy(); F=src.copy()
for dy in range(-3,4):
  for dx in range(-3,4):
    dd=np.roll(np.roll(d,dy,0),dx,1); ss=np.roll(np.roll(src,dy,0),dx,1)
    m=dd>best; best=np.where(m,dd,best); F=np.where(m[...,None],ss,F)
FB=F-B; a_col=np.clip(((src-B)*FB).sum(2)/np.maximum((FB**2).sum(2),1),0,1)
a_col=np.where(d<16,0,a_col)
alpha=np.ones((H,W),np.float32)
alpha[band]=a_col[band]
alpha[bg]=0
alpha[band & (d<45)]=0
mx=src.max(2); mn=src.min(2); sat=(mx-mn)/np.maximum(mx,1)
alpha[band & (mx>165) & (sat<0.1)]=0
# keep largest fg component
fg=(alpha>0.3).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(fg)
big=1+np.argmax(st[1:,4]); keep=cv2.dilate((lab==big).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
alpha[~keep]=0
# decontaminate colour
a3=np.maximum(alpha,1e-3)[...,None]
col=np.clip((src-(1-a3)*B)/a3,0,255)
col=np.where(alpha[...,None]>0.02,col,src)
col=np.where(band[...,None],F*0.6+np.clip(col,0,255)*0.4,col)
# for edge pixels use nearby opaque colour to avoid halos
op=(alpha>0.95).astype(np.uint8)
inp=cv2.inpaint(src.astype(np.uint8),(1-op)*255,3,cv2.INPAINT_TELEA).astype(np.float32)
w=np.clip((alpha-0.2)/0.7,0,1)[...,None]
col=col*w+inp*(1-w)
# despeckle: light pixels inside dark hair neighbourhoods
lum=col.mean(2)
loc=cv2.blur(lum,(7,7))
med=cv2.medianBlur(np.clip(col,0,255).astype(np.uint8),5).astype(np.float32)
spk=(lum>150)&(loc<125)&(alpha>0)
spk=cv2.dilate(spk.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&(lum>110)
col[spk]=med[spk]
rgba=np.dstack([col,alpha*255]).astype(np.uint8)
Image.fromarray(rgba).save('cut.png')
for name,bgc in [('g',(0,160,0)),('k',(20,20,40))]:
    c=Image.new('RGBA',(W,H),bgc+(255,)); c.alpha_composite(Image.fromarray(rgba)); c.convert('RGB').save(f'prev_cut_{name}.png')
print('done')
