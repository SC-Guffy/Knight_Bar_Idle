# 시트·키 그림 미리보기: 여러 PNG 를 체크무늬 위에 N배로 나란히 붙여 한 장으로 저장 (Read 로 보기용)
#  python -I sheet-view.py out.png scale a.png b.png ...
import sys
from PIL import Image
out, sc, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGBA') for f in files]
W = sum(i.width * sc + 8 for i in ims) + 8; H = max(i.height for i in ims) * sc + 16
bg = Image.new('RGBA', (W, H), (40, 44, 56, 255)); px = bg.load()
for y in range(H):
    for x in range(W):
        if (x // 8 + y // 8) % 2: px[x, y] = (54, 58, 72, 255)
x = 8
for i in ims:
    big = i.resize((i.width * sc, i.height * sc), Image.NEAREST)
    bg.alpha_composite(big, (x, 8)); x += big.width + 8
bg.save(out)
