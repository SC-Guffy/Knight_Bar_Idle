from PIL import Image
from pathlib import Path
import json
p=Path('docs/motion-audit/generated/squire-cut-v6')
im=Image.open(p/'poses.png').convert('RGBA')
w,h=im.size
frames=[]
names=['가드','작은 준비','대각 베기','짧은 여운','빠른 회수','가드 복귀']
durations=[165,100,35,15,35,35]
# Equal source cells. Translation and uniform sampling only; no painted repairs.
for i in range(6):
    cell=im.crop((round(i*w/6),0,round((i+1)*w/6),h))
    box=cell.getbbox()
    if not box: raise ValueError('empty frame')
    crop=cell.crop(box)
    scale=46/420
    crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
    out=Image.new('RGBA',(80,80))
    out.alpha_composite(crop,(10,70-crop.height))
    out.save(p/f'frame-{i+1}.png')
    frames.append(out)
manifest={'width':80,'height':80,'frames':[{'file':f'frame-{i+1}.png','name':names[i],'duration':durations[i]} for i in range(6)],'status':'검토 시안 / 원본 외형 세부 묘사 및 회수 경로 재검토 필요'}
(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
# GIF export uses dark review backdrop; PNG assets retain alpha.
gifs=[]
for f in frames:
    bg=Image.new('RGBA',f.size,'#303946');bg.alpha_composite(f)
    gifs.append(bg.convert('RGB').resize((480,480),Image.Resampling.NEAREST))
gifs[0].save(p/'preview.gif',save_all=True,append_images=gifs[1:],duration=durations,loop=0,disposal=2)
gifs[0].save(p/'preview-slow.gif',save_all=True,append_images=gifs[1:],duration=[x*3 for x in durations],loop=0,disposal=2)
print('Generated 6 frames, 385ms cycle; original sprite untouched.')
