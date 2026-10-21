# e30 별빛 화살비 — 밤하늘 조각 + 오로라 커튼 5프레임 루프 (무료 로컬 절차 생성)
import math, sys
import numpy as np
from PIL import Image

W, H, N = 96, 48, 5
# 팔레트 (원래 색): 하늘 2단, 커튼 5단, 별 2단
SKY0 = (60, 76, 160)    # 하늘 테두리
SKY1 = (78, 100, 190)    # 하늘 안쪽
SKY2 = (96, 122, 210)    # 하늘 밝은 결
CUR = [(56, 136, 220), (34, 160, 214), (40, 214, 220), (120, 246, 230), (228, 255, 250)]
STAR = (255, 255, 255)
STAR_DIM = (170, 210, 255)

def sky_mask():
    m = np.zeros((H, W), bool)
    for x in range(W):
        top = 6 + 3.0 * math.sin(x / 9.0) + 2.0 * math.sin(x / 4.3 + 1.0) + 0.06 * abs(x - 48)
        bot = 32 + 2.0 * math.sin(x / 11.0 + 0.5)
        # 양 끝을 둥글게
        e = min(x - 3, 92 - x)
        if e < 0: continue
        if e < 10:
            k = (10 - e) / 10.0
            top += 10 * k * k; bot -= 6 * k * k
        for y in range(H):
            if top <= y <= bot: m[y, x] = True
    return m

def ray_pattern(x, ph):
    # 세로 줄무늬 (빛줄기) 길이 — 프레임마다 옆으로 흐른다
    return (math.sin(x * 0.9 + ph * 2) * 0.5 + math.sin(x * 0.37 - ph) * 0.35 + math.sin(x * 2.1 + ph * 3) * 0.15)

def frame(f):
    ph = 2 * math.pi * f / N
    img = np.zeros((H, W, 4), np.uint8)
    sm = sky_mask()
    for y in range(H):
        for x in range(W):
            if sm[y, x]:
                edge = not (sm[max(y-1,0), x] and sm[min(y+1,H-1), x] and sm[y, max(x-1,0)] and sm[y, min(x+1,W-1)])
                c = SKY0 if edge else (SKY2 if (y < 16 and math.sin(x / 6.0 + y / 3.0) > 0.75) else SKY1)
                img[y, x] = (*c, 255)
    # 오로라 커튼 2겹: 뒤(위쪽, 어둡게) + 앞(아래, 밝게)
    for layer, (base, amp, length, lvl_off, x0, x1) in enumerate([(25, 3.0, 13, -1, 10, 86), (33, 3.5, 19, 0, 6, 90)]):
        for x in range(x0, x1 + 1):
            # 커튼 아랫단 물결 — 프레임마다 이동
            yb = base + amp * math.sin(x / 10.0 - ph + layer) + 1.2 * math.sin(x / 4.0 + ph * 2)
            # 끝 가늘게
            e = min(x - x0, x1 - x)
            taper = min(1.0, e / 8.0)
            yb = int(round(yb - (1 - taper) * 3))
            rp = 0.5 + 0.5 * ray_pattern(x, ph)
            L = length * (0.3 + 0.7 * rp ** 1.6) * (0.35 + 0.65 * taper)
            L = int(round(L))
            # 밝기 물결: 가장 밝은 지점이 좌→우로 흐른다 (5프레임 루프)
            cx = x0 + ((f / N) * 1.0 % 1.0) * (x1 - x0 + 30) - 15
            d = abs(x - cx)
            boost = 1 if d < 14 else 0
            for i in range(L):
                y = yb - i
                if y < 0 or y >= H: continue
                t = i / max(L, 1)
                if i == 0: lvl = 3
                elif i <= 2: lvl = 2
                elif t < 0.6: lvl = 1 + (1 if rp > 0.72 and t < 0.4 else 0)
                else: lvl = 0
                lvl += lvl_off + boost
                if i == 0 and boost and layer == 1: lvl = 4  # 하이라이트 단
                lvl = max(0, min(4, lvl))
                if lvl == 0 and sm[y, x] and i > 2 and (x + y) % 2 and t > 0.85:
                    continue  # 하늘 위에선 가장 어두운 끝은 생략 (잡음 방지)
                img[y, x] = (*CUR[lvl], 255)
            # 아랫단 바로 위 한 줄은 늘 밝게 (주인공 띠)
            if layer == 1 and 0 <= yb - 1 < H and boost == 0:
                img[yb, x] = (*CUR[3], 255)
    # 별: 8개, 프레임마다 2~3개씩 번갈아 반짝
    stars = [(14, 14, 0), (24, 9, 2), (35, 16, 4), (47, 8, 1), (57, 13, 3), (68, 10, 0), (78, 15, 2), (86, 19, 4), (42, 21, 3)]
    for (sx, sy, p) in stars:
        if not sm[sy, sx]: continue
        s = (f + p) % N
        if s == 0:   # 절정: 십자 별
            img[sy, sx] = (*STAR, 255)
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                if sm[sy+dy, sx+dx]: img[sy+dy, sx+dx] = (*STAR_DIM, 255)
        elif s in (1, 4):
            img[sy, sx] = (*STAR, 255)
        elif s == 2:
            img[sy, sx] = (*STAR_DIM, 255)
    return Image.fromarray(img, 'RGBA')

sheet = Image.new('RGBA', (W * N, H), (0, 0, 0, 0))
for f in range(N):
    sheet.paste(frame(f), (f * W, 0))
sheet.save(sys.argv[1])
print('saved', sys.argv[1])
