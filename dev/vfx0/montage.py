# 캡처 프레임들을 잘라 한 줄(또는 여러 줄)로 붙인다. 줄마다 이름표.
#  python -I montage.py out.png x0 y0 x1 y1 scale "라벨:파일1,파일2,..." ["라벨2:..."]
import sys
from PIL import Image, ImageDraw
out, x0, y0, x1, y1, sc = sys.argv[1], *map(int, sys.argv[2:6]), float(sys.argv[6])
rows = [a.split(':', 1) for a in sys.argv[7:]]
cw, ch = int((x1 - x0) * sc), int((y1 - y0) * sc)
n = max(len(r[1].split(',')) for r in rows)
LW = 110
M = Image.new('RGB', (LW + n * (cw + 4), len(rows) * (ch + 4)), (24, 26, 34))
d = ImageDraw.Draw(M)
for ri, (lab, fs) in enumerate(rows):
    d.text((4, ri * (ch + 4) + ch // 2 - 6), lab, fill=(230, 230, 230))
    for ci, f in enumerate(fs.split(',')):
        if not f: continue
        im = Image.open(f).convert('RGB').crop((x0, y0, x1, y1)).resize((cw, ch), Image.NEAREST)
        M.paste(im, (LW + ci * (cw + 4), ri * (ch + 4)))
M.save(out)
