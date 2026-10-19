# 비평용 검수 시트: 직업마다 한 줄 — [게임 배율 2배: 대기 | 앉기0 | 앉기1 (통나무·땅 포함)] + [5배 확대: 앉기0]
#   python dev/sheets-sit/qa_sheet.py <out.png> <직업,...>
import os, sys, json
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import ORIG, OUT
names = sys.argv[2].split(',')
rows = []
for n in names:
    j = json.load(open(os.path.join(ORIG, n + '.json'))); im = Image.open(os.path.join(ORIG, n + '.png')).convert('RGBA')
    W, H = j['w'], j['h']; fx, fy = j['foot']; a = j['anims']['idle']; s = Image.open(os.path.join(OUT, n + '-sit.png')).convert('RGBA')
    fr = [im.crop((0, a['row'] * H, W, a['row'] * H + H)), s.crop((0, 0, W, H)), s.crop((W, 0, 2 * W, H))]
    cw, ch = int(W * 0.9), fy + 3
    g = Image.new('RGBA', (cw * 3, ch), (74, 98, 62, 255)); d = ImageDraw.Draw(g)
    d.rectangle((0, fy + 1, g.width, ch), fill=(52, 40, 30, 255))
    for i, c in enumerate(fr):
        ox = i * cw + cw // 2 - 6
        if i: d.rectangle((ox - 7, fy - 2, ox + 4, fy), fill=(94, 56, 24, 255))
        g.alpha_composite(c, (ox - fx, 0))
    g = g.resize((g.width * 2, g.height * 2), Image.NEAREST)
    z = Image.new('RGBA', (W, ch), (40, 44, 52, 255)); z.alpha_composite(fr[1], (0, 0)); z = z.resize((W * 5, ch * 5), Image.NEAREST)
    r = Image.new('RGBA', (g.width + z.width + 10, max(g.height, z.height) + 14), (20, 20, 24, 255))
    ImageDraw.Draw(r).text((4, 2), n + '  (game 2x: idle | sit0 | sit1)   (zoom 5x: sit0)', fill=(255, 255, 255, 255))
    r.paste(g, (0, 14)); r.paste(z, (g.width + 10, 14)); rows.append(r)
S = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), (20, 20, 24, 255)); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(sys.argv[1]); print(S.size)
