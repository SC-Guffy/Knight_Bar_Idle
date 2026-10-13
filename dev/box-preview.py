# 전리품 상자 아이콘 미리보기: 옛 12×12(GEAR_SPR) 와 새 16×16(BOX_ART·CHEST_ART) 를 나란히 PNG 로.
#  python3 dev/box-preview.py <출력.png> [exp|raid]   — SIL=1 이면 흑백 실루엣
import json, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
ROOT = __file__.rsplit('/dev/', 1)[0]
js = r"""
const fs=require('fs'),vm=require('vm');const ctx={console,Date,performance,document:{createElement:()=>({getContext:()=>null})},localStorage:{getItem:()=>null},location:{search:''},navigator:{userAgent:''}};ctx.window=ctx;vm.createContext(ctx);
const parts=fs.readdirSync(process.argv[1]+'/src').filter(f=>/^box-art-.*\.js$/.test(f)).map(f=>fs.readFileSync(process.argv[1]+'/src/'+f,'utf8')).join('\n');
vm.runInContext(fs.readFileSync(process.argv[1]+'/src/data.js','utf8')+'\n'+fs.readFileSync(process.argv[1]+'/src/box-art.js','utf8')+'\n'+parts+';this.O={LB:LOOT_BOXES,RB:RAID_BOSSES,GS:GEAR_SPR,BA:BOX_ART,CA:CHEST_ART};',ctx);
console.log(JSON.stringify(ctx.O));
"""
O = json.loads(subprocess.check_output(['node', '-e', js, ROOT]))
out = sys.argv[1]; which = sys.argv[2] if len(sys.argv) > 2 else 'all'
SIL = os.environ.get('SIL') == '1'
GRADE = ['#b8bcc6', '#5fcf5a', '#4aa3ff', '#b36bff', '#ff9f1c', '#ff4d6d', '#3ee8ff', '#f4f0ff']
items = []   # (이름, 색, 옛 {spr,pal}, 새 {rows,pal}|None)
if which in ('all', 'exp'):
    for g, b in enumerate(O['LB']): items.append((b['name'], GRADE[g], b, O['BA'][g] if g < len(O['BA']) else None))
if which in ('all', 'raid'):
    for k, b in O['RB'].items():
        top = max(i for i, w in enumerate(b['chest']['w']) if w > 0)
        items.append((b['chest']['name'], GRADE[top], b['chest'], O['CA'].get(k)))
for nm, _, _, a in items:
    if not a: continue
    if len(a['rows']) != 16 or any(len(r) != 16 for r in a['rows']): print(f'!! {nm}: 16×16 아님')
    miss = sorted({c for r in a['rows'] for c in r if c != '.' and c not in a['pal']})
    if miss: print(f'!! {nm}: pal 에 없는 글자 {miss}')
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
def sprite(rows, pal):
    n = len(rows); im = Image.new('RGBA', (n + 2, n + 2), (0, 0, 0, 0)); px = im.load()
    cells = [(x + 1, y + 1, ch) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != '.']
    for x, y, _ in cells:
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): px[x + dx, y + dy] = (20, 21, 28, 255)
    for x, y, ch in cells: px[x, y] = (230, 230, 230, 255) if SIL else hexc(pal.get(ch, '#ff00ff'))
    return im
S = 4; cw = 18 * S * 2 + 30; ch = 18 * S + 26; cols = 4
sheet = Image.new('RGBA', (cols * cw, ((len(items) + cols - 1) // cols) * ch), (34, 32, 52, 255)); d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 13)
for i, (nm, col, old, new) in enumerate(items):
    x0 = (i % cols) * cw + 6; y0 = (i // cols) * ch + 4
    sheet.alpha_composite(sprite(O['GS'][old['spr']], old['pal']).resize((14 * S, 14 * S), Image.NEAREST), (x0, y0 + 8))
    if new: sheet.alpha_composite(sprite(new['rows'], new['pal']).resize((18 * S, 18 * S), Image.NEAREST), (x0 + 14 * S + 14, y0))
    d.text((x0, y0 + 18 * S + 2), nm, fill=col, font=font)
sheet.save(out); print(out)
