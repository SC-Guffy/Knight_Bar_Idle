import json, numpy as np, sys
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGBA')); b=np.asarray(Image.open(sys.argv[2]).convert('RGBA'))
base=json.load(open(sys.argv[3])); FW=96; ch=[]
hx=lambda p: '#%02x%02x%02x%02x'%tuple(p) if p[3]<255 else '#%02x%02x%02x'%tuple(p[:3])
for i in range(5):
    fa=a[:,i*FW:(i+1)*FW]; fb=b[:,i*FW:(i+1)*FW]
    d=np.nonzero(np.any(fa!=fb,-1))
    px=[[int(x),int(y),hx(fa[y,x]),hx(fb[y,x])] for y,x in zip(*d)]
    if px: ch.append({"operation":"patch_pixels","frames":[i],"pixels":px})
    print(i,len(px))
base.append({"op":"workbench","changes":ch})
json.dump(base,open(sys.argv[4],'w'))
