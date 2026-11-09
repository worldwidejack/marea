import numpy as np
from PIL import Image
im=np.array(Image.open('onda_gpt_1.png').convert('RGB')).astype(float)
mag=np.array([255,0,255.])
def score(a,m,p,ox,oy):
    H,W=m.shape; tot=0;n=0
    ys=np.arange(oy,H-p,p); xs=np.arange(ox,W-p,p)
    for y in ys[::2]:
        for x in xs[::2]:
            y0,y1,x0,x1=int(y),int(y+p),int(x),int(x+p)
            if not m[y0:y1,x0:x1].any(): continue
            b=a[y0+1:y1-1,x0+1:x1-1].reshape(-1,3); tot+=b.std(0).sum(); n+=1
    return tot/max(n,1)
for c,r in [(0,0),(1,0),(2,0),(0,1),(1,1),(2,1)]:
    a=im[r*512:(r+1)*512,c*512:(c+1)*512]; m=np.linalg.norm(a-mag,axis=2)>90
    res=[]
    for p in [5.0,5.5,5.75,6.0,6.25,6.5,7.0,8.0]:
        best=min((score(a,m,p,ox,oy),ox,oy) for ox in np.arange(0,p,1.0) for oy in np.arange(0,p,1.0))
        res.append((round(best[0],2),p))
    print((c,r),sorted(res)[:3])
