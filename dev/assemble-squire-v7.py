from PIL import Image
from pathlib import Path
import json
p=Path('docs/motion-audit/generated/squire-cut-v7')
im=Image.open(p/'poses.png').convert('RGBA')
w,h=im.size
frames=[]
names=['가드','오른팔 준비','대각 베기','짧은 회수','가드 복귀']
durations=[165,100,50,35,35]
# Equal source cells. Translation and uniform sampling only; no painted repairs.
bounds=[0,418,792,1215,1590,w]
for i in range(5):
    cell=im.crop((bounds[i],0,bounds[i+1],h))
    box=cell.getbbox()
    if not box: raise ValueError('empty frame')
    crop=cell.crop(box)
    scale=46/440
    crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
    out=Image.new('RGBA',(80,80))
    out.alpha_composite(crop,(10,70-crop.height))
    out.save(p/f'frame-{i+1}.png')
    frames.append(out)
manifest={'width':80,'height':80,'frames':[{'file':f'frame-{i+1}.png','name':names[i],'duration':durations[i]} for i in range(5)],'status':'검토 시안 / v6 팔 교환 오류 수정, 게임 미적용'}
(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
# GIF export uses dark review backdrop; PNG assets retain alpha.
gifs=[]
for f in frames:
    bg=Image.new('RGBA',f.size,'#303946');bg.alpha_composite(f)
    gifs.append(bg.convert('RGB').resize((480,480),Image.Resampling.NEAREST))
gifs[0].save(p/'preview.gif',save_all=True,append_images=gifs[1:],duration=durations,loop=0,disposal=2)
gifs[0].save(p/'preview-slow.gif',save_all=True,append_images=gifs[1:],duration=[x*3 for x in durations],loop=0,disposal=2)
print('Generated 5 frames, 385ms cycle; original sprite untouched.')


