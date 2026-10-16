# 창기사 계열 정리본 수리 (도트 검수 fix 판정 → 스크립트 손질, 손 픽셀 수정 없음 — docs/specs/pixel-qa.md 사용자 방침).
#  pix.py post 가 polish 뒤·무기 얹기 전에 부른다.
#  tidy(im): 갑옷 얼룩 정리 — 같은 색 계열(색상·채도 묶음)끼리 3×3 다수결로 잔점을 합치고, 계열마다 밝기를 3단으로 다시 나눈다
#            (위쪽 칸일수록 한 단 밝게: 빛은 위에서). 검수 지적 "회색 3~4단 조각이 얼룩덜룩, 빛 방향 없음"(창기사·용기병).
#  belly(im): 용기병 — 가장 밝은 큰 덩어리(흰 배)를 연보라·크림 2단 띠로 낮춘다. 지적 "흰 배가 칠이 빠진 구멍처럼"
#  eye(im): 용기병 — 머리(몸 위 1/5) 앞 끝에서 2칸 뒤에 노란 눈 1도트. 지적 "노란 눈이 안 보임"
#  green(im): 창기사 — 허리 높이 띠의 어두운 회색 칸을 녹색으로 (녹색 허리천). 지적 "녹색이 망토·깃발에만"
#  fist(im, g): 창 쥔 자리에 주먹 2×2 (손 점 g). 지적 "창 쥔 손이 안 보임"
import colorsys
from PIL import Image
OUT = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11


def fam(c):
    h, l, s = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
    return 'gray' if s < 0.18 else f'h{int(h * 12) % 12}'


def tidy(im, levels=4, passes=1, need=5):     # 2회·4칸·3단은 너무 뭉개져(창기사 6색, 면갑 사라짐) 약하게
    im = im.copy(); P = im.load(); W, H = im.size
    body = [(x, y) for y in range(H) for x in range(W) if P[x, y][3] and P[x, y] != OUT]
    # 1) 3×3 다수결 (같은 계열 안에서만, 8 이웃 중 need 이상 같은 색이면 그 색): 잔점·작은 조각을 주변 큰 덩어리로
    for _ in range(passes):
        new = {}
        for (x, y) in body:
            c = P[x, y]; f = fam(c); nb = []
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    if (a or b) and 0 <= x + a < W and 0 <= y + b < H:
                        n = P[x + a, y + b]
                        if n[3] and n != OUT and fam(n) == f: nb.append(n)
            if nb:
                best = max(set(nb), key=nb.count)
                if nb.count(best) >= need and best != c: new[(x, y)] = best
        for p, c in new.items(): P[p] = c
    # 2) 계열마다 밝기를 levels 묶음(1차원 k-평균)으로 나눠 묶음 평균색으로 — 빛은 위에서: 몸 위 30% 는 한 단 밝게 치우침
    ys = [y for _, y in body]; y0, y1 = min(ys), max(ys)
    groups = {}
    for p in body: groups.setdefault(fam(P[p]), []).append(p)
    for f, ps in groups.items():
        if len(ps) < 12: continue
        Ls = sorted(lum(P[p]) for p in ps); cs = [Ls[int((i + 0.5) * len(Ls) / levels)] for i in range(levels)]
        for _ in range(8):
            buck = [[] for _ in cs]
            for L in Ls: buck[min(range(levels), key=lambda j: abs(cs[j] - L))].append(L)
            cs = [sum(b_) / len(b_) if b_ else cs[j] for j, b_ in enumerate(buck)]
        idx = {p: min(range(levels), key=lambda j: abs(cs[j] - lum(P[p]))) for p in ps}
        mean = []
        for j in range(levels):
            q = [P[p] for p in ps if idx[p] == j]
            mean.append(tuple(int(sum(c[i] for c in q) / len(q)) for i in range(3)) + (255,) if q else None)
        order = sorted(range(levels), key=lambda j: cs[j])
        for p in ps:
            j = idx[p]; r = order.index(j); t = (p[1] - y0) / max(1, y1 - y0)
            if t < 0.3 and r < levels - 1 and mean[order[r + 1]]: j = order[r + 1]
            if mean[j]: P[p] = mean[j]
    return im


def belly(im, lav=((176, 160, 204), (214, 204, 230))):
    im = im.copy(); P = im.load(); W, H = im.size
    Ls = sorted(lum(P[x, y]) for y in range(H) for x in range(W) if P[x, y][3] and P[x, y] != OUT)
    thr = Ls[int(len(Ls) * 0.85)] if Ls else 200                      # 가장 밝은 15%
    bright = {(x, y) for y in range(H) for x in range(W) if P[x, y][3] and lum(P[x, y]) >= thr}
    comps, left = [], set(bright)
    while left:
        st = [left.pop()]; c = set(st)
        while st:
            x, y = st.pop()
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + a, y + b)
                if q in left: left.discard(q); c.add(q); st.append(q)
        comps.append(c)
    if not comps: return im
    blob = max(comps, key=len)
    if len(blob) < 15: return im
    ys = sorted({y for _, y in blob})
    for (x, y) in blob:                                   # 가로 띠: 2칸마다 밝은·어두운 연보라, 맨 위 줄 1도트 하이라이트만 남김
        P[x, y] = lav[(ys.index(y) // 2) % 2] + (255,)
    return im


def eye(im, col=(255, 214, 64, 255)):
    im = im.copy(); P = im.load(); W, H = im.size
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    y0 = min(y for _, y in pts); y1 = max(y for _, y in pts); band = [(x, y) for x, y in pts if y < y0 + (y1 - y0) * 0.22 and P[x, y] != OUT]
    if not band: return im
    fx = max(x for x, _ in band); row = sorted(y for x, y in band if x >= fx - 1)
    ey = row[len(row) // 2]; ex = fx - 3
    for p in ((ex, ey),):
        if 0 <= p[0] < W and P[p][3]: P[p] = col
    return im


def green(im, g=((44, 96, 52), (78, 140, 80))):
    im = im.copy(); P = im.load(); W, H = im.size
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    y0 = min(y for _, y in pts); y1 = max(y for _, y in pts); hh = y1 - y0
    xs = [x for x, y in pts if abs(y - (y0 + hh * 0.55)) < 2]; xm = (min(xs) + max(xs)) / 2; half = (max(xs) - min(xs)) * 0.28
    for y in range(int(y0 + hh * 0.54), int(y0 + hh * 0.54) + 2):          # 허리 높이 2줄, 몸통 가운데 폭만 (망토는 그대로)
        for x in range(int(xm - half), int(xm + half) + 1):
            c = P[x, y]
            if c[3] and c != OUT and colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)[2] < 0.3: P[x, y] = g[1 if lum(c) > 110 else 0] + (255,)
    return im


def fist(im, g, col=((120, 126, 140), (196, 202, 214))):
    im = im.copy(); P = im.load(); W, H = im.size; gx, gy = int(round(g[0])), int(round(g[1]))
    for (a, b, k) in ((0, 0, 1), (1, 0, 1), (0, 1, 0), (1, 1, 0)):
        x, y = gx + a, gy + b - 1
        if 0 <= x < W and 0 <= y < H: P[x, y] = col[k] + (255,)
    return im
