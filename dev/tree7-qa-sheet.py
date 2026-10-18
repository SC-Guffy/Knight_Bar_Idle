# 시즌7 트리 새 스킬 검수 시트: 새 스킬 1칸 / ★★★ / 바탕 ★★★ 세 줄 (dev/shots 의 T7SHOOT 띠에서). python dev/tree7-qa-sheet.py <결과 폴더> [줄기-칸 ...]
import json,os,sys
from PIL import Image, ImageDraw, ImageFont
SP=sys.argv.pop(1) if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else os.path.dirname(os.path.abspath(__file__))   # 결과 폴더 (lines.json 이 있는 곳)
SH=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
lines=json.load(open(os.path.join(SP,'lines.json'),encoding='utf-8'))
only=set(sys.argv[1:])
font=ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf',22)
n=0
for L in lines:
  for slot,(base,name,bname) in L['base'].items():
    key=f"{L['id']}-{slot}"
    if only and key not in only: continue
    rows=[(f"{name} 1칸",f"t7-{key}-0.png"),(f"{name} ★★★",f"t7-{key}-3.png"),(f"바탕: {bname} (지금 스킬 ★★★)",f"base-{L['id']}-{base}.png")]
    ims=[Image.open(os.path.join(SH,f)).convert('RGB') for _,f in rows]
    W=max(i.width for i in ims); H=sum(i.height+30 for i in ims)
    out=Image.new('RGB',(W,H),(8,8,14)); d=ImageDraw.Draw(out); y=0
    for (lab,_),im in zip(rows,ims):
      d.text((6,y+3),lab,fill=(255,230,150),font=font); y+=30; out.paste(im,(0,y)); y+=im.height
    out=out.resize((W*2//3,H*2//3), Image.NEAREST)
    out.save(os.path.join(SP,key+'.png')); n+=1
print(n)
