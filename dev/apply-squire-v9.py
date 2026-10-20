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
row=meta['anims']['atkA']['row'];out.paste((0,0,0,0),(0,row*64,out.width,(row+1)*64))
for i,f in enumerate(m['frames']):
    im=Image.open(p/f['file']).convert('RGBA');cell=Image.new('RGBA',(64,64));cell.alpha_composite(im,(3,f.get('offsetY',0)-1));out.paste(cell,(i*64,row*64))
meta['anims']['atkA'].update(frames=8,hit=3,durations=[f['duration'] for f in m['frames']])
meta['pts']['atkA']=[[43,38,29,18],[45,25,29,18],[45,21,29,18],[47,40,30,20],[44,40,30,18],[43,40,29,18],[43,39,29,18],[43,38,29,18]]
out.save(sprites/'squire.png');(sprites/'squire.json').write_text(json.dumps(meta,ensure_ascii=False)+'\n',encoding='utf8')
for key,a in meta['anims'].items():
    if key!='atkA':
        for i in range(a['frames']):
            box=(i*64,a['row']*64,(i+1)*64,(a['row']+1)*64)
            assert original.crop(box).tobytes()==out.crop(box).tobytes(),key
print('Applied squire atkA only; all other animation cells identical.')
