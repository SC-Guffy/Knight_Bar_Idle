# 몽타주: python -I montage.py <출력.png> <배율> <줄1 파일들(쉼표)> [<줄2> ...]  — 각 줄 왼쪽부터, 칸 크기 그대로, 어두운 바탕
import sys
from PIL import Image
out, S = sys.argv[1], int(sys.argv[2]); rows = [r.split(',') for r in sys.argv[3:]]
ims = [[Image.open(f).convert('RGBA') for f in r] for r in rows]
W = max(sum(i.width for i in r) + 4 * len(r) for r in ims); H = sum(max(i.height for i in r) + 4 for r in ims)
pv = Image.new('RGBA', (W * S, H * S), (30, 33, 42, 255)); y = 0
for r in ims:
    x = 0; h = max(i.height for i in r)
    for i in r:
        pv.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x * S, (y + h - i.height) * S)); x += i.width + 4
    y += h + 4
pv.save(out)
