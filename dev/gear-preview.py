# 장비 아이콘 미리보기: 옛 12×12(GEAR_SPR) 와 새 16×16(GEAR_ART) 를 나란히 PNG 로.
#  python3 dev/gear-preview.py [출력.png] [id,id,...]   (id 를 안 주면 GEAR_ART 에 있는 것 전부)
import json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = __file__.rsplit('/dev/', 1)[0]
js = r"""
const fs=require('fs'),vm=require('vm');const ctx={console,Date,performance,document:{createElement:()=>({getContext:()=>null})},localStorage:{getItem:()=>null},location:{search:''},navigator:{userAgent:''}};ctx.window=ctx;vm.createContext(ctx);
const parts=fs.readdirSync(process.argv[1]+'/src').filter(f=>/^gear-art-.*\.js$/.test(f)).map(f=>fs.readFileSync(process.argv[1]+'/src/'+f,'utf8')).join('\n');
vm.runInContext(fs.readFileSync(process.argv[1]+'/src/data.js','utf8')+'\n'+fs.readFileSync(process.argv[1]+'/src/gear-art.js','utf8')+'\n'+parts+';this.O={GI:GEAR_ITEMS,GS:GEAR_SPR,GA:GEAR_ART};',ctx);
console.log(JSON.stringify(ctx.O));
"""
O = json.loads(subprocess.check_output(['node', '-e', js, ROOT]))
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/gear-preview.png'
# 두 번째 인자: id 목록(쉼표) · 'spr:greatsword,plate' 처럼 옛 모양 계열 · 'slot:weapon' · 없으면 GEAR_ART 전부
arg = sys.argv[2] if len(sys.argv) > 2 else ''
if arg.startswith('spr:'): ids = [k for k, v in O['GI'].items() if v['spr'] in arg[4:].split(',')]
elif arg.startswith('slot:'): ids = [k for k, v in O['GI'].items() if v['slot'] == arg[5:]]
elif arg: ids = arg.split(',')
else: ids = list(O['GA'].keys())
# 검사: 16줄 × 16칸, pal 에 없는 글자
for k, a in O['GA'].items():
    bad = [i for i, r in enumerate(a['rows']) if len(r) != 16]
    if len(a['rows']) != 16 or bad: print(f'!! {k}: 줄 수 {len(a["rows"])}, 길이가 16 이 아닌 줄 {bad}')
    miss = sorted({c for r in a['rows'] for c in r if c != '.' and c not in a['pal']})
    if miss: print(f'!! {k}: pal 에 없는 글자 {miss}')
    if k not in O['GI']: print(f'!! {k}: GEAR_ITEMS 에 없는 id')
# 실루엣만 (흑백) 보기: 환경변수 SIL=1
import os
SIL = os.environ.get('SIL') == '1'
GRADE = ['#b8bcc6', '#5fcf5a', '#4aa3ff', '#b36bff', '#ff9f1c', '#ff4d6d', '#3ee8ff', '#f4f0ff']
INK = (20, 21, 28, 255)
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
def sprite(rows, pal):
    n = len(rows); im = Image.new('RGBA', (n + 2, n + 2), (0, 0, 0, 0)); px = im.load()
    cells = [(x + 1, y + 1, ch) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != '.']
    for x, y, _ in cells:
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): px[x + dx, y + dy] = INK
    for x, y, ch in cells: px[x, y] = (230, 230, 230, 255) if SIL else hexc(pal.get(ch, '#ff00ff'))
    return im
S = 4; cw = 18 * S * 2 + 30; ch = 18 * S + 26; cols = 4
rows_n = (len(ids) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cw, rows_n * ch), (34, 32, 52, 255)); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 13)
except Exception: font = None
for i, k in enumerate(ids):
    it = O['GI'][k]; x0 = (i % cols) * cw + 6; y0 = (i // cols) * ch + 4
    old = sprite(O['GS'][it['spr']], it['pal']).resize((14 * S, 14 * S), Image.NEAREST)
    sheet.alpha_composite(old, (x0, y0 + 8 * S // 4))
    if k in O['GA']:
        a = O['GA'][k]; new = sprite(a['rows'], a['pal']).resize((18 * S, 18 * S), Image.NEAREST)
        sheet.alpha_composite(new, (x0 + 14 * S + 14, y0))
    d.text((x0, y0 + 18 * S + 2), f"{it['name']}", fill=GRADE[it['g']], font=font)
sheet.save(out); print(out)
