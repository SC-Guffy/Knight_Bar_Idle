# 사라지는 프레임 만들기: 밝기 thr 이상인 칸만 남기고 바깥 외곽선 1칸 덧댐
#  python -I bright.py in.png out.png thr
import sys
from PIL import Image
L = lambda c: (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255
im = Image.open(sys.argv[1]).convert('RGBA'); thr = float(sys.argv[3]); W, H = im.size; px = im.load()
o = Image.new('RGBA', im.size, (0, 0, 0, 0)); q = o.load()
for y in range(H):
    for x in range(W):
        if px[x, y][3] >= 128 and L(px[x, y]) >= thr: q[x, y] = px[x, y][:3] + (255,)
add = [(x, y) for y in range(H) for x in range(W) if not q[x, y][3] and any(0 <= x + dx < W and 0 <= y + dy < H and q[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for p in add: q[p] = (11, 13, 20, 255)
o.save(sys.argv[2])
