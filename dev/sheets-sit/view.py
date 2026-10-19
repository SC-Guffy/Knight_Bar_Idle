# 미리보기 한 장: 직업마다 [대기 0 | 앉기 0 | 앉기 1] 을 발 기준점에 맞춰 나란히 (빨간 줄 = 땅, 갈색 = 캠프 통나무 자리)
import os, sys, json
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import NAMES, ORIG, OUT
names = sys.argv[2].split(',') if len(sys.argv) > 2 else NAMES
Z = int(sys.argv[3]) if len(sys.argv) > 3 else 2
C = 140
tiles = []
for n in names:
    j = json.load(open(os.path.join(ORIG, n + '.json'))); im = Image.open(os.path.join(ORIG, n + '.png')).convert('RGBA')
    W, H = j['w'], j['h']; fx, fy = j['foot']; a = j['anims']['idle']
    s = Image.open(os.path.join(OUT, n + '-sit.png')).convert('RGBA')
    fr = [im.crop((0, a['row'] * H, W, a['row'] * H + H)), s.crop((0, 0, W, H)), s.crop((W, 0, 2 * W, H))]
    t = Image.new('RGBA', (C * 3, C), (60, 70, 60, 255)); d = ImageDraw.Draw(t)
    for i, c in enumerate(fr):
        ox = i * C + 60
        if i: d.rectangle((ox - 6, 128 - 3, ox + 5, 128), fill=(94, 56, 24, 255))   # 통나무 (16×5 화면px ≈ 11×3 시트px, 64칸 기준)
        t.alpha_composite(c, (ox - fx, 128 - fy))
        d.line((ox - 12, 128, ox + 12, 128), fill=(255, 0, 0, 255))
    d.text((2, 2), n, fill=(255, 255, 255, 255)); tiles.append(t)
cols = 3; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGBA', (cols * C * 3, rows * C), (30, 30, 30, 255))
for i, t in enumerate(tiles): S.paste(t, ((i % cols) * C * 3, (i // cols) * C))
S.resize((S.width * Z, S.height * Z), Image.NEAREST).save(sys.argv[1])
