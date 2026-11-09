import numpy as np, cv2, json
from PIL import Image
im=np.array(Image.open('onda_gpt_1.png').convert('RGB'))
imf=im.astype(float); mag=np.array([255,0,255.])
pg=np.array(Image.open('../8dir/direzioni/east.png').convert('RGBA'))
pal=np.unique(pg[pg[...,3]>0][:,:3],axis=0)
def lab(c): return cv2.cvtColor(np.array(c,np.uint8).reshape(-1,1,3),cv2.COLOR_RGB2LAB).reshape(-1,3).astype(float)
palL=lab(pal)
def fit(a,m):
    best=None
    for p in np.arange(5.2,6.3,0.05):
        for oy in np.arange(0,p,0.75):
            for ox in np.arange(0,p,0.75):
                H,W=m.shape; tot=n=0
                for y in np.arange(oy,H-p,p)[::2]:
                    for x in np.arange(ox,W-p,p)[::2]:
                        y0,y1,x0,x1=int(y),int(y+p),int(x),int(x+p)
                        if not m[y0:y1,x0:x1].any(): continue
                        tot+=a[y0+1:y1-1,x0+1:x1-1].reshape(-1,3).std(0).sum(); n+=1
                s=tot/max(n,1)
                if best is None or s<best[0]: best=(s,p,ox,oy)
    return best
out={}; frames=[]; info=[]
for k,(c,r) in enumerate([(0,0),(1,0),(2,0),(0,1),(1,1),(2,1)]):
    a=imf[r*512:(r+1)*512,c*512:(c+1)*512]; m=np.linalg.norm(a-mag,axis=2)>90
    s,p,ox,oy=fit(a,m); info.append((k+1,round(p,2),round(s,1)))
    H,W=m.shape; ny=int((H-oy)//p); nx=int((W-ox)//p)
    px=np.zeros((ny,nx,4),np.uint8)
    for j in range(ny):
        for i in range(nx):
            y0,y1,x0,x1=int(oy+j*p),int(oy+(j+1)*p),int(ox+i*p),int(ox+(i+1)*p)
            blk=a[y0:y1,x0:x1].reshape(-1,3); mm=m[y0:y1,x0:x1].reshape(-1)
            if mm.mean()<0.5: continue
            px[j,i,:3]=np.median(blk[mm],axis=0); px[j,i,3]=255
    frames.append(px)
print(info)
# tavolozza: colori del PG; i colori lontani = energia (k-means 4)
allp=np.concatenate([f[f[...,3]>0][:,:3] for f in frames])
L=lab(allp); d=np.min(np.linalg.norm(L[:,None,:]-palL[None],axis=2),axis=1)
lontani=allp[d>28]; print('pixel',len(allp),'lontani dal PG',len(lontani))
Z=lontani.astype(np.float32); crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,50,0.5)
_,lab_,cen=cv2.kmeans(Z,5,None,crit,5,cv2.KMEANS_PP_CENTERS); en=np.round(cen).astype(np.uint8); print('energia',en.tolist())
palfull=np.concatenate([pal,en]); pfL=lab(palfull)
res=[]
for f in frames:
    g=f.copy(); idx=np.argwhere(f[...,3]>0)
    cols=lab(f[f[...,3]>0][:,:3]); dd=np.linalg.norm(cols[:,None,:]-pfL[None],axis=2).argmin(1)
    g[f[...,3]>0,:3]=palfull[dd]; res.append(g)
# riquadro comune con i piedi sulla stessa riga: ritaglio ogni frame sul suo bbox, poi allineo il fondo
boxes=[]
for g in res:
    ys,xs=np.where(g[...,3]>0); boxes.append((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
print('bbox',boxes)
Wt=max(b[2]-b[0] for b in boxes); Ht=max(b[3]-b[1] for b in boxes)
for k,(g,b) in enumerate(zip(res,boxes)):
    t=np.zeros((Ht,Wt,4),np.uint8); c=g[b[1]:b[3],b[0]:b[2]]
    t[Ht-c.shape[0]:,:c.shape[1]]=c   # fondo e sinistra allineati
    Image.fromarray(t).save(f'f{k+1}_px.png')
print('riquadro',Wt,Ht)
