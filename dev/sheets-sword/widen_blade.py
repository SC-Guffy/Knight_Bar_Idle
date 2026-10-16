# 대검 날 넓히기 (스크립트, PixelLab 0회): 대검전사 N5 시안은 밑그림(design/mannequin-gs.png)의 넓은 날을 모델이 좁게 다시 그려
#  46칸에서 1~2칸 막대가 된다. 밑그림과 같은 자리의 넓은 날 다각형을 1024 결과에 덧칠한다 — 바탕·회색(칼) 칸만 칠하고 몸·머리·갑옷은 건드리지 않는다.
#  python -I -B widen_blade.py <원본1024.png> <출력.png>
import sys, math
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size; P = im.load()
# 밑그림 좌표 → 1024: 격자 64×52 를 15배, 가운데
g, gw, gh = 15, 64, 52; X0, Y0 = (1024 - gw * g) // 2, (1024 - gh * g) // 2
ox, oy = 14, 4
cx, cy = (30 + ox) * g + X0 + g / 2, (25 + oy) * g + Y0 + g / 2
a = math.radians(-158); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
def poly(t0, t1, w):
    t0 *= g; t1 *= g; w *= g
    return [(cx + ux * t0 + nx * w, cy + uy * t0 + ny * w), (cx + ux * t1 + nx * w, cy + uy * t1 + ny * w),
            (cx + ux * t1 - nx * w, cy + uy * t1 - ny * w), (cx + ux * t0 - nx * w, cy + uy * t0 - ny * w)]
masks = {}
for name, (t0, t1, w) in {'blade': (5, 42, 5.5), 'edge': (5, 42, 6.6), 'light': (5, 42, 2.2), 'groove': (5, 42, 0.6)}.items():
    m = Image.new('L', (W, H)); ImageDraw.Draw(m).polygon(poly(t0, t1, w), fill=255); masks[name] = m.load()
bg = tuple(sorted(P[x, 2][i] for x in range(W))[W // 2] for i in range(3))
def free(c):   # 바탕이거나 무채색 회색(칼) 칸만
    return sum(abs(c[i] - bg[i]) for i in range(3)) < 40 or (max(c) - min(c) < 26 and sum(c) > 300)
LIGHT, MID, DARK, OUT = (232, 236, 242), (186, 192, 204), (128, 136, 152), (11, 13, 20)
for y in range(H):
    for x in range(W):
        if not masks['edge'][x, y] or not free(P[x, y]): continue
        if not masks['blade'][x, y]: P[x, y] = OUT
        elif masks['groove'][x, y]: P[x, y] = DARK
        elif masks['light'][x, y]: P[x, y] = LIGHT if (x + y) % 1 == 0 and ((x - cx) * nx + (y - cy) * ny) > 0 else MID
        else: P[x, y] = MID if ((x - cx) * nx + (y - cy) * ny) > 0 else DARK
im.save(dst); print(dst)
