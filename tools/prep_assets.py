import numpy as np, cv2, json
from PIL import Image, ImageDraw, ImageFilter
W='/workspace/onaka-game/work/'; A='/workspace/onaka-game/assets/img/'
cut=Image.open(W+'cut.png')  # 982x2684 (2x of source)
w,h=cut.size
cut.save(A+'body.png',optimize=True)
# ---- upper layer mask (head, breasts, arms) drawn above the belly ----
m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m)
poly=[(0,0),(w,0),(w,762),(800,762),(745,738),(700,712),(668,668),(652,634),(640,628),(600,612),(560,606),(520,600),(480,600),(440,604),(400,610),(360,618),(336,626),(330,660),(300,705),(262,748),(200,762),(0,762)]
d.polygon(poly,fill=255)
m=m.filter(ImageFilter.GaussianBlur(2.2))
ua=np.array(cut)[:,:,3].astype(np.float32)*np.array(m).astype(np.float32)/255
up=np.array(cut).copy(); up[:,:,3]=ua.astype(np.uint8)
Image.fromarray(up[:780]).save(A+'upper.png',optimize=True)
# ---- face patch ----
FX0,FY0,FX1,FY1=442,98,570,198; K=2
src=np.array(cut.convert('RGB').crop((FX0,FY0,FX1,FY1)).resize(((FX1-FX0)*K,(FY1-FY0)*K),Image.LANCZOS)).astype(np.float32)
def P(pts): return np.array([[(x-FX0)*K,(y-FY0)*K] for x,y in pts],np.int32)
def feather(mask,r): return cv2.GaussianBlur(mask.astype(np.float32),(0,0),r)
L_EYE=[(451,125),(456,121),(462,119),(474,118),(486,120),(489,128),(487,140),(470,141),(456,139),(451,133)]
R_EYE=[(513,123),(519,117),(536,116),(550,117),(557,120),(557,128),(551,138),(530,139),(515,135)]
MOUTH=[(482,165),(507,162),(531,163),(533,170),(521,181),(499,182),(484,174)]
H_,W_=src.shape[:2]
def shifted(dy):
    M=np.float32([[1,0,0],[0,1,dy*K]]); return cv2.warpAffine(src,M,(W_,H_),borderMode=cv2.BORDER_REPLICATE)
noeyes=src.copy()
for poly_,dy in ((L_EYE,-19),(R_EYE,-19)):
    mk=np.zeros((H_,W_),np.uint8); cv2.fillPoly(mk,[P(poly_)],1)
    f=feather(mk,1.6)[...,None]; sh=shifted(dy)
    noeyes=noeyes*(1-f)+sh*f
# mouth: copy from above (between nose and mouth) & below? use smooth inpaint then add slight texture
mk=np.zeros((H_,W_),np.uint8); cv2.fillPoly(mk,[P(MOUTH)],255)
nomouth=cv2.inpaint(np.clip(src,0,255).astype(np.uint8),mk,6,cv2.INPAINT_TELEA).astype(np.float32)
nomouth=cv2.GaussianBlur(nomouth,(0,0),1.2)*(feather(mk>0,2)[...,None])+src*(1-feather(mk>0,2)[...,None])
for n,a in (('face_base',src),('face_noeyes',noeyes),('face_nomouth',nomouth)):
    Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(A+n+'.png')
json.dump({'face':[FX0,FY0,FX1,FY1,K],'belly':{'cx':482,'cy':898,'rx':226,'ry':196},'size':[w,h],
  'Leye':L_EYE,'Reye':R_EYE,'mouth':MOUTH},open(A+'meta.json','w'))
print('ok')
