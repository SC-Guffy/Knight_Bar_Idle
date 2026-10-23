# 시트 줄을 잘라 4배로 키운 몽타주 PNG 를 만든다: python3 montage.py <cls> <anim,anim,...> <out.png>
import json, sys
from PIL import Image
cls, anims, out = sys.argv[1], sys.argv[2].split(','), sys.argv[3]
d = json.load(open(f'src/sprites/{cls}.json')); im = Image.open(f'src/sprites/{cls}.png').convert('RGBA')
w = h = d['w']; S = 3 if w <= 64 else 2
rows = [a for a in anims if a in d['anims']]
maxf = max(d['anims'][a]['frames'] for a in rows)
M = Image.new('RGBA', (maxf * w * S, len(rows) * h * S), (34, 32, 48, 255))
for r, a in enumerate(rows):
    A = d['anims'][a]
    for f in range(A['frames']):
        c = im.crop((f * w, A['row'] * h, (f + 1) * w, (A['row'] + 1) * h)).resize((w * S, h * S), Image.NEAREST)
        M.alpha_composite(c, (f * w * S, r * h * S))
M.save(out)
