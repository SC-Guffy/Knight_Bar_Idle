from PIL import Image
from pathlib import Path
import json, shutil, hashlib
p=Path('docs/motion-audit/generated/squire-cut-v9'); old=p.parent/'squire-cut-v8'
im=Image.open(p/'inbetweens.png').convert('RGBA'); w,h=im.size
for i in range(3):
    cell=im.crop((round(i*w/3),0,round((i+1)*w/3),h)); box=cell.getbbox()
    crop=cell.crop(box); scale=44/500
    crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
    out=Image.new('RGBA',(80,80));out.alpha_composite(crop,(10,70-crop.height));out.save(p/f'between-{i+1}.png')
order=[('frame-1.png','가드·준비 시작',20),('between-1.png','준비 연결',45),('frame-2.png','준비 절정',70),('frame-3.png','타격',15),('frame-4.png','짧은 여운',15),('between-2.png','회수 시작',35),('between-3.png','회수 연결',35),('frame-5.png','가드 복귀',150)]
for i in range(1,6):shutil.copyfile(old/f'frame-{i}.png',p/f'frame-{i}.png')
manifest={'width':80,'height':80,'duration':385,'hitMs':135,'status':'v8 핵심 포즈 사용자 승인 / 연결·타이밍 검토본 / 게임 미적용','frames':[{'file':f,'name':n,'duration':d,'source':'approved-v8' if f.startswith('frame') else 'generated-inbetween'} for f,n,d in order]}
for frame in manifest['frames']:
    asset=Image.open(p/frame['file']).convert('RGBA')
    solid=asset.getchannel('A').point(lambda x:255 if x>128 else 0)
    frame['offsetY']=60-solid.getbbox()[3]
(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
gifs=[]
for index,(f,_,_) in enumerate(order):
    bg=Image.new('RGBA',(80,80),'#303946'); bg.alpha_composite(Image.open(p/f).convert('RGBA'),(0,manifest['frames'][index]['offsetY']));gifs.append(bg.convert('RGB').resize((480,480),Image.Resampling.NEAREST))
for name,factor in [('preview.gif',1),('preview-slow.gif',3)]:
    elapsed=previous=0;dur=[]
    for _,_,ms in order:
        elapsed+=ms*factor; end=int(elapsed/10+0.5)*10;dur.append(end-previous);previous=end
    gifs[0].save(p/name,save_all=True,append_images=gifs[1:],duration=dur,loop=0,disposal=2)
assert sum(f['duration'] for f in manifest['frames'])==385
assert sum(f['duration'] for f in manifest['frames'][:3])==135
for i in range(1,6):assert (old/f'frame-{i}.png').read_bytes()==(p/f'frame-{i}.png').read_bytes()
print('8 frames; 385ms; hit 135ms; all 5 approved PNGs byte-identical')
contact=Image.new('RGBA',(80*len(order),80),'#303946')
for i,(f,_,_) in enumerate(order):
    asset=Image.open(p/f).convert('RGBA')
    assert asset.size==(80,80)
    contact.alpha_composite(asset,(80*i,manifest['frames'][i]['offsetY']))
contact.resize((1920,240),Image.Resampling.NEAREST).save(p/'contact.png')

# Self-contained review page: no HTTP request needed for frame playback.
import base64
html=(p/'index.html').read_text(encoding='utf8')
embedded={}
for url,folder in [('../squire-cut-v8/manifest.json',old),('manifest.json',p)]:
    data=json.loads((folder/'manifest.json').read_text(encoding='utf8'))
    for frame in data['frames']:
        frame['file']='data:image/png;base64,'+base64.b64encode((folder/frame['file']).read_bytes()).decode('ascii')
    embedded[url]=data
if 'const embedded=' not in html:
    html=html.replace('let models=[]','const embedded='+json.dumps(embedded,ensure_ascii=False)+';let models=[]')
    html=html.replace("const m=await fetch(url).then(r=>{if(!r.ok)throw Error(url);return r.json()});",'const m=embedded[url];')
    html=html.replace('loadImg(prefix+f.file)',"loadImg(f.file.startsWith('data:')?f.file:prefix+f.file)")
    (p/'index.html').write_text(html,encoding='utf8')
