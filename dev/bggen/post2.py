"""AI 생성 배경 → 진짜 저해상도 도트로.
usage: post2.py in.png out.png native_rows colors [bright] [sat]
1) 마젠타 하늘 키아웃 + 풍경 시작 줄까지 크롭
2) 원본 해상도에서 먼저 N색으로 양자화
3) 칸(셀)마다 최빈색으로 축소 → 중간색이 안 생겨 경계가 또렷
4) 고립 픽셀 정리 (4방향 이웃이 모두 다른 색이면 이웃 최빈색으로)
5) 밝기·채도 낮춰 캐릭터 뒤로 물러나게 (팔레트에만 적용)
6) 위쪽 40% 를 4x4 바이엘 디더로 페이드
"""
import sys
from collections import Counter
from PIL import Image, ImageEnhance

src, out, NCOL = sys.argv[1], sys.argv[2], int(sys.argv[4])
ARG = sys.argv[3]  # 'c5' = 원본 격자 5px 로 복원, 숫자 = 목표 줄 수
BRIGHT = float(sys.argv[5]) if len(sys.argv) > 5 else 0.62
SAT = float(sys.argv[6]) if len(sys.argv) > 6 else 0.75
FADE = float(sys.argv[8]) if len(sys.argv) > 8 else 0.4
KEEP = int(sys.argv[7]) if len(sys.argv) > 7 else 0   # >0 이면 아래 KEEP 줄만 남긴다 (땅에서 피어난 낮은 띠)

im = Image.open(src).convert('RGB')
W0, H0 = im.size
p = im.load()
mag = lambda c: c[0] > 150 and c[2] > 150 and c[1] < 120 and abs(c[0] - c[2]) < 90

top = next(y for y in range(H0) if sum(not mag(p[x, y]) for x in range(0, W0, 4)) > 6)
im = im.crop((0, top, W0, H0))
W0, H0 = im.size
p = im.load()

# 마젠타는 키 색 하나로 고정해 양자화 팔레트를 낭비하지 않게
KEY = (255, 0, 255)
for y in range(H0):
    for x in range(W0):
        if mag(p[x, y]): p[x, y] = KEY

q = im.quantize(colors=NCOL + 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
pal = q.getpalette()[: (NCOL + 1) * 3]
cols = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
key_i = min(range(len(cols)), key=lambda i: sum((a - b) ** 2 for a, b in zip(cols[i], KEY)))
qp = q.load()

if ARG.startswith('c'):
    cell = float(ARG[1:])
    # 격자 위상: 경계가 격자선에 가장 많이 걸리는 오프셋
    L = im.convert('L').load()
    ed = [0] * W0
    for y in range(0, H0, 2):
        for x in range(1, W0):
            if abs(L[x, y] - L[x - 1, y]) > 18: ed[x] += 1
    ph = max(range(int(cell)), key=lambda o: sum(ed[x] for x in range(o, W0, int(cell))))
    im2 = im.crop((ph, 0, W0, H0)); q = q.crop((ph, 0, W0, H0)); qp = q.load(); W0 -= ph
    NH = int(H0 // cell)
    if NH > 56:   # 너무 높은 장면은 자르지 않고 56줄로 축소 (랜드마크 보존)
        NH = 56; cell = H0 / NH
else:
    NH = int(ARG); cell = H0 / NH
NW = int(W0 // cell)
grid = [[0] * NW for _ in range(NH)]
for gy in range(NH):
    y0, y1 = int(gy * cell), int((gy + 1) * cell)
    for gx in range(NW):
        x0, x1 = int(gx * cell), min(W0, int((gx + 1) * cell))
        cnt = Counter(qp[x, y] for y in range(y0, y1) for x in range(x0, x1))
        # 셀 절반 이상이 하늘이면 하늘, 아니면 하늘 빼고 최빈색
        if cnt[key_i] * 2 >= sum(cnt.values()):
            grid[gy][gx] = key_i
        else:
            cnt.pop(key_i, None)
            grid[gy][gx] = cnt.most_common(1)[0][0]

for _ in range(2):
    g2 = [row[:] for row in grid]
    for y in range(NH):
        for x in range(NW):
            nb = [grid[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if 0 <= x + dx < NW and 0 <= y + dy < NH]
            if grid[y][x] not in nb:
                g2[y][x] = Counter(nb).most_common(1)[0][0]
    grid = g2

# 팔레트 색만 어둡게
sw = Image.new('RGB', (len(cols), 1))
sw.putdata(cols)
cnt = Counter(i for row in grid for i in row if i != key_i)
lum = sum(n * (0.299 * cols[i][0] + 0.587 * cols[i][1] + 0.114 * cols[i][2]) for i, n in cnt.items()) / sum(cnt.values())
TARGET = BRIGHT * 120   # 기본 0.7 → 평균 밝기 84
bf = max(0.55, min(1.0, TARGET / lum))
print('lum', round(lum), 'bright', round(bf, 2))
sw = ImageEnhance.Brightness(ImageEnhance.Color(sw).enhance(SAT)).enhance(bf)
dcols = list(sw.get_flattened_data()) if hasattr(sw,'get_flattened_data') else list(sw.getdata())

if KEEP and NH > KEEP:
    grid = grid[NH - KEEP:]; NH = KEEP
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
# 풍경이 처음 나오는 줄부터 FADE 비율만큼 디더 페이드
import math
if KEEP:
    # 땅에서 피어난 실루엣: 열마다 높이가 다른 윗선 (낮은 사인 합, 양 끝이 이어지도록 주기 = 폭)
    def ht(x):
        t = 2 * math.pi * x / NW
        v = 0.55 * math.sin(3 * t + 1.3) + 0.3 * math.sin(7 * t + 0.4) + 0.15 * math.sin(13 * t + 2.1)
        return KEEP * (0.45 + 0.55 * (v + 1) / 2)
    outim = Image.new('RGBA', (NW, NH))
    op = outim.load()
    for x in range(NW):
        top = NH - ht(x)
        for y in range(NH):
            i = grid[y][x]
            t = (y - top + 0.5) / 3          # 윗선에서 3줄 동안 디더로 흩어진다
            if i == key_i or t < 0 or t < (BAYER[y % 4][x % 4] + 0.5) / 16:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = dcols[i] + (255,)
else:
    first = next(y for y in range(NH) if any(c != key_i for c in grid[y]))
    span = max(1, (NH - first) * FADE)
    outim = Image.new('RGBA', (NW, NH))
    op = outim.load()
    for y in range(NH):
        t = (y - first + 0.5) / span
        for x in range(NW):
            i = grid[y][x]
            if i == key_i or t < (BAYER[y % 4][x % 4] + 0.5) / 16:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = dcols[i] + (255,)
outim.save(out)
print(out, outim.size)
