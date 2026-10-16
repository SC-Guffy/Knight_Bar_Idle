# 다시 뽑기(2026-10-16) k32: 애니 앞 3장(솟구쳐 포효) + 3번째 장이 테두리부터 타들어 가며(침식) 입 앞에서 섬광·고리가 터지는 2장. 유료 호출 0.
#  (블록을 흩뿌리는 판은 부스러기처럼 보여서 버렸다)
#  어두운 픽셀은 밝게 끌어올린다(직업색 램프의 가장 어두운 단이 테처럼 보이지 않게).
#   python3 dev/vfx5/burst.py <a0.png> <a1.png> <a2.png> <out.png> [out_h]
import sys, random, math
from PIL import Image
a = [Image.open(p).convert('RGBA') for p in sys.argv[1:4]]; out = sys.argv[4]
W, H = a[0].size; OH = int(sys.argv[5]) if len(sys.argv) > 5 else H
L = lambda c: (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255
def lift(im):
    im = im.copy(); px = im.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] < 24: px[x, y] = (0, 0, 0, 0); continue
            if L(c) < 0.38: px[x, y] = tuple(int(255 - (255 - v) * 0.7) for v in c[:3]) + (255,)
    return im
def erode(im, n):
    im = im.copy()
    for _ in range(n):
        px = im.load(); cut = []
        for y in range(H):
            for x in range(W):
                if px[x, y][3] and any(not (0 <= x + dx < W and 0 <= y + dy < H) or not px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): cut.append((x, y))
        for x, y in cut: px[x, y] = (0, 0, 0, 0)
    return im
PINK, PALE, WHITE = (255, 120, 170, 255), (255, 200, 225, 255), (255, 255, 255, 255)
def burst(im, r, ring, rays, cx, cy):
    o = im.copy(); px = o.load()
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, (y - cy) * 1.1)
            if d <= r: px[x, y] = WHITE if d <= r * 0.55 else PALE if d <= r * 0.8 else PINK
            elif ring and abs(d - ring) <= 0.8: px[x, y] = PALE
    for k in range(rays):   # 굵은 빛살 (2px)
        ang = k / rays * math.tau + 0.3
        for t in range(int(r) + 1, int(r * 1.9)):
            for w in (0, 1):
                x, y = round(cx + math.cos(ang) * t + w * math.sin(ang)), round(cy + math.sin(ang) * t)
                if 0 <= x < W and 0 <= y < H: px[x, y] = PALE if t < r * 1.5 else PINK
    return o
fr = [lift(x) for x in a]
MX, MY = W * 0.66, H * 0.36   # 벌린 입 자리
fr += [burst(erode(fr[2], 1), 9, 0, 8, MX, MY), burst(erode(fr[2], 4), 5, 17, 0, MX, MY)]
s = Image.new('RGBA', (W * 5, OH))
for i, f in enumerate(fr): s.paste(f.crop((0, H - OH, W, H)), (i * W, 0))
s.save(out); print(out, s.size)
