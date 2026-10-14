# 캡처 격자: 줄마다 이름표 + 파일 여러 장을 가로로. 없으면 빈칸.
#  python -I grid.py out.png <dir> <scale> [--gray] "라벨:파일1,파일2,..." ...
#  파일 이름은 <dir> 기준, .png 생략 가능. --gray 면 흑백(밝기)으로 — 색깔놀이 점검용
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageOps
out, d, sc = sys.argv[1], sys.argv[2], float(sys.argv[3])
rest = sys.argv[4:]
gray = '--gray' in rest
#  --crop=x0,y0,x1,y1 : 잘라 낼 영역 (캔버스 720×300 기준)
rows = [a.split(':', 1) for a in rest if not a.startswith('--')]
crop = (0, 30, 720, 300)        # 위쪽 이름표 줄은 잘라 낸다
for a in rest:
    if a.startswith('--crop='): crop = tuple(map(int, a[7:].split(',')))
cw, ch = int((crop[2] - crop[0]) * sc), int((crop[3] - crop[1]) * sc)
n = max(len(r[1].split(',')) for r in rows)
LW = 150
try: font = ImageFont.truetype('malgun.ttf', 13)
except Exception: font = None
M = Image.new('RGB', (LW + n * (cw + 4), len(rows) * (ch + 4)), (24, 26, 34))
dr = ImageDraw.Draw(M)
for ri, (lab, fs) in enumerate(rows):
    dr.text((4, ri * (ch + 4) + ch // 2 - 8), lab, fill=(230, 230, 230), font=font)
    for ci, f in enumerate(fs.split(',')):
        p = os.path.join(d, f if f.endswith('.png') else f + '.png')
        if not f or not os.path.exists(p): continue
        im = Image.open(p).convert('RGB').crop(crop).resize((cw, ch), Image.NEAREST)
        if gray: im = ImageOps.grayscale(im).convert('RGB')
        M.paste(im, (LW + ci * (cw + 4), ri * (ch + 4)))
M.save(out)
print(out, M.size)
