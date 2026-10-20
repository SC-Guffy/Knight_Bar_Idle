from PIL import Image
from pathlib import Path
import json,shutil
root=Path('.'); p=root/'docs/motion-audit/generated/squire-cut-v9'; sprites=root/'src/sprites'
backup=p/'before-application';backup.mkdir(exist_ok=True)
for name in ['squire.png','squire.json']:
    if not (backup/name).exists():shutil.copyfile(sprites/name,backup/name)
original=Image.open(backup/'squire.png').convert('RGBA'); meta=json.loads((backup/'squire.json').read_text())
m=json.loads((p/'manifest.json').read_text(encoding='utf8'))
out=Image.new('RGBA',(max(original.width,8*64),original.height));out.paste(original,(0,0))
def face(c):
 ps={(x,y) for y in range(52) for x in range(64) if (lambda q:q[3]>128 and q[0]>175 and q[1]>100 and q[2]>60 and q[0]>q[1]*1.15 and q[2]<q[1]*.95)(c.getpixel((x,y)))}; comps=[]
 while ps:
  q=[ps.pop()]; component=[]
  while q:
   x,y=q.pop();component.append((x,y))
   for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if n in ps:ps.remove(n);q.append(n)
  comps.append(component)
 p=max(comps,key=len);return min(x for x,y in p),min(y for x,y in p),max(x for x,y in p)+1,max(y for x,y in p)+1

row=meta['anims']['atkA']['row'];out.paste((0,0,0,0),(0,row*64,out.width,(row+1)*64))
for i,f in enumerate(m['frames']):
    im=Image.open(p/f['file']).convert('RGBA')
    # Normalize the assembled cell against the unchanged idle face, not sheet padding.
    source=Image.new('RGBA',(64,64));source.alpha_composite(im,(3,f.get('offsetY',0)-1))
    x0,y0,x1,y1=face(source)
    sourceGround=source.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()[3]
    targetTop=[28,29,28,30,29,29,28,28][i]
    scale=(59-targetTop)/(sourceGround-y0)
    resized=source.resize((round(64*scale),round(64*scale)),Image.Resampling.NEAREST)
    faceX=(x0+x1)*scale/2
    solid=resized.getchannel('A').point(lambda a:255 if a>128 else 0)
    ground=solid.getbbox()[3]
    lean=[0,0,-1,2,1,1,0,0][i]
    dx=round(29.5+lean-faceX);dy=59-ground
    cell=Image.new('RGBA',(64,64));cell.alpha_composite(resized,(dx,dy));out.paste(cell,(i*64,row*64))
meta['anims']['atkA'].update(frames=8,hit=3,durations=[20,45,70,55,45,55,55,40])
meta['pts']['atkA']=[[43,38,29,18],[45,25,29,18],[45,21,29,18],[47,40,30,20],[44,40,30,18],[43,40,29,18],[43,39,29,18],[43,38,29,18]]
out.save(sprites/'squire.png');(sprites/'squire.json').write_text(json.dumps(meta,ensure_ascii=False)+'\n',encoding='utf8')
for key,a in meta['anims'].items():
    if key!='atkA':
        for i in range(a['frames']):
            box=(i*64,a['row']*64,(i+1)*64,(a['row']+1)*64)
            assert original.crop(box).tobytes()==out.crop(box).tobytes(),key
print('Applied squire atkA only; all other animation cells identical.')




