# 확대 비교: 직업마다 대기0 | 앉기0 | 앉기1, 발 기준 크롭, 배율 Z
import os, sys, json
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import ORIG, OUT
names = sys.argv[2].split(','); Z = int(sys.argv[3]) if len(sys.argv) > 3 else 6
rows = []
for n in names:
    j = json.load(open(os.path.join(ORIG, n + '.json'))); im = Image.open(os.path.join(ORIG, n + '.png')).convert('RGBA')
    W, H = j['w'], j['h']; fx, fy = j['foot']; a = j['anims']['idle']; s = Image.open(os.path.join(OUT, n + '-sit.png')).convert('RGBA')
    fr = [im.crop((0, a['row'] * H, W, a['row'] * H + H)), s.crop((0, 0, W, H)), s.crop((W, 0, 2 * W, H))]
    cw, ch = int(W * 0.8), int(fy * 0.9)
    t = Image.new('RGBA', (cw * 3, ch + 4), (60, 70, 60, 255)); d = ImageDraw.Draw(t)
    for i, c in enumerate(fr):
        ox = i * cw + cw // 2 - 4
        t.alpha_composite(c, (ox - fx, ch - fy))
        d.line((ox - 10, ch + 1, ox + 10, ch + 1), fill=(255, 0, 0, 255))
    rows.append(t.resize((t.width * Z, t.height * Z), Image.NEAREST))
S = Image.new('RGBA', (max(r.width for r in rows), sum(r.height for r in rows)), (20, 20, 20, 255)); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(sys.argv[1])
