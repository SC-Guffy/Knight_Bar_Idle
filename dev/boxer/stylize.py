# PixelLab 최종(64×64, 고퀄) → 게임 그림체 쪽으로 7:3 (사용자, 2026-10-13: "퀄리티가 갑자기 너무 높아졌다. 픽셀 느낌이 더 나야 돼",
# "기존안·현재안 7:3 정도로 기존에 치우친 느낌").
# 기존 기사는 11×13 도트를 EPX(Scale2x)로 2배 키우고 바깥 외곽선을 두른 그림이다 (src/body2.js hiRes). 같은 길을 밟는다:
#   1) 바깥 외곽선을 벗긴다  2) 2×2 칸을 한 칸으로 (칸 안 최빈색, 반 이상 비면 빈칸) → 키 약 20도트
#   3) 얼굴의 눈(피부 상자 안 어두운 칸)을 다시 찍는다  4) EPX 2배  5) 바깥 1칸 외곽선 #0b0d14, 발 바닥 y=58
#   (색 줄이기 quant 는 얼굴·재질이 뭉개져서 쓰지 않는다)
#   python -I dev/boxer/stylize.py  →  dev/boxer/pix-<직업>.png
import os, sys, glob
from collections import Counter
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_C = (0x0b, 0x0d, 0x14, 255)
FOOT_Y = 58


def strip_outline(im):
    w, h = im.size; px = im.load(); kill = []
    for y in range(h):
        for x in range(w):
            if px[x, y] != OUT_C: continue
            if any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): kill.append((x, y))
    for x, y in kill: px[x, y] = (0, 0, 0, 0)
    return im


def half(im):
    """2×2 → 1칸. 반 이상 비면 빈칸. 아주 어두운 선 색(밝기 < 45)은 다른 색이 있으면 표를 주지 않는다 (줄이면 선이 몸을 덮는다).
    같은 수면 밝은 쪽 — 줄인 그림이 어두워지지 않게."""
    w, h = im.size; px = im.load(); out = Image.new('RGBA', (w // 2, h // 2)); po = out.load()
    lum = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
    for y in range(h // 2):
        for x in range(w // 2):
            op = [px[2 * x + i, 2 * y + j] for i in (0, 1) for j in (0, 1)]
            op = [c for c in op if c[3]]
            if len(op) < 2: continue
            lit = [c for c in op if lum(c) >= 45]
            vote = lit if len(lit) >= 1 and len(lit) >= len(op) - 2 else op
            cnt = Counter(vote).most_common()
            po[x, y] = max((c for c, n in cnt if n == cnt[0][1]), key=lum)
    # 안쪽의 작은 어두운 점(눈·입·벨트 버클 선)은 살린다: 8이웃 중 6개 이상이 밝은(밝기 > 110) 어두운(밝기 < 70) 칸
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = px[x, y]
            if not c[3] or lum(c) >= 70: continue
            nb = [px[x + i, y + j] for i in (-1, 0, 1) for j in (-1, 0, 1) if i or j]
            if sum(1 for q in nb if q[3] and lum(q) > 110) >= 6: po[x // 2, y // 2] = c
    return out


def keep_eyes(src, small, n=2):
    """얼굴 피부(따뜻하고 밝은 색) 상자 안쪽의 어두운 칸 중 가장 앞(오른쪽) 것 n개를 줄인 그림에 찍는다 — 축소하면 눈이 사라져서."""
    w, h = src.size; px = src.load(); bb = src.getbbox()
    lum = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
    top = bb[1] + int((bb[3] - bb[1]) * 0.5)
    skin = [(x, y) for y in range(bb[1], top) for x in range(w)
            if px[x, y][3] and px[x, y][0] > px[x, y][1] > px[x, y][2] and px[x, y][0] - px[x, y][2] > 40 and lum(px[x, y]) > 120]
    if len(skin) < 6: return small
    xs = [p[0] for p in skin]; ys = [p[1] for p in skin]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cand = [(x, y) for y in range(y0 + 1, y0 + (y1 - y0) * 2 // 3 + 1) for x in range(x0 + 1, x1)
            if px[x, y][3] and lum(px[x, y]) < 70]
    cand.sort(key=lambda p: -p[0])
    sp = small.load(); done = set()
    for x, y in cand:
        b = (x // 2, y // 2)
        if b in done: continue
        sp[b] = px[x, y]; done.add(b)
        if len(done) >= n: break
    return small


def quant(im, n):
    rgb = Image.new('RGB', im.size, (255, 0, 255)); rgb.paste(im, mask=im.split()[3])
    q = rgb.quantize(colors=n + 1, method=Image.MEDIANCUT).convert('RGB')
    out = Image.new('RGBA', im.size); a = im.split()[3]
    out.paste(q, mask=a)
    return out


def epx2(im):
    w, h = im.size; px = im.load(); out = Image.new('RGBA', (w * 2, h * 2)); po = out.load()
    at = lambda x, y: px[x, y] if 0 <= x < w and 0 <= y < h else (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            P = at(x, y); A = at(x, y - 1); B = at(x + 1, y); C = at(x - 1, y); D = at(x, y + 1)
            p1 = p2 = p3 = p4 = P
            if P[3]:
                if C == A and C != D and A != B: p1 = A
                if A == B and A != C and B != D: p2 = B
                if D == C and D != B and C != A: p3 = C
                if B == D and B != A and D != C: p4 = D
            po[2 * x, 2 * y] = p1; po[2 * x + 1, 2 * y] = p2; po[2 * x, 2 * y + 1] = p3; po[2 * x + 1, 2 * y + 1] = p4
    return out


def outline_foot(im):
    w, h = im.size; bb = im.getbbox()
    out = Image.new('RGBA', (w, h)); out.paste(im, (0, FOOT_Y - (bb[3] - 1)))
    po = out.load(); add = []
    for y in range(h):
        for x in range(w):
            if po[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and po[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): add.append((x, y))
    for x, y in add: po[x, y] = OUT_C
    return out


def stylize(path):
    im = strip_outline(Image.open(path).convert('RGBA'))
    return outline_foot(epx2(keep_eyes(im, half(im))))


if __name__ == '__main__':
    for f in sorted(glob.glob(os.path.join(HERE, 'final-*-1.png'))):
        cls = os.path.basename(f).split('-')[1]
        stylize(f).save(os.path.join(HERE, f'pix-{cls}.png'))
    print('ok')
