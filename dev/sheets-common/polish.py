# 기준 그림 손질 (계열 공용, PixelLab image-to-pixelart 결과 → 게임 도트): 바탕 떼기 → 색 줄이기(14) → 외톨이 점 정리 → 바깥 1px 외곽선 #0b0d14 → 위 가장자리 하이라이트
#  python -I -B dev/sheets-common/polish.py <정리본.png> <손질본.png> [--colors 14]
#  주의 (검사 계열 검수 2026-10-17): 손질이 비평 점수를 늘 올리지는 않는다 — 성기사는 정리본 4.0 → 손질본 3.29. 둘 다 검수에 넣어 높은 쪽을 쓴다.
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = (0x0b, 0x0d, 0x14, 255)
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
lum = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11


def unbg(im, thr=22):
    """테두리 색(바탕)과 가까운 칸, 발밑 그림자(바탕보다 조금 어두운 무채색 띠)를 지운다"""
    im = im.convert('RGBA'); P = im.load(); W, H = im.size
    bg = P[0, 0]
    d = lambda c: sum(abs(c[i] - bg[i]) for i in range(3))
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if d(c) < thr: P[x, y] = (0, 0, 0, 0)
    # 남은 것 중 가장 큰 덩어리 + 그에 붙은 것만 (떨어진 그림자·잡점 제거)
    pts = {(x, y) for y in range(H) for x in range(W) if P[x, y][3]}
    comps = []
    while pts:
        st = [pts.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); comp.add(q); st.append(q)
        comps.append(comp)
    keep = max(comps, key=len)
    for c in comps:
        if c is not keep and len(c) < 12:
            for p in c: P[p] = (0, 0, 0, 0)
    return im


def quant(im, n=14):
    a = im.split()[3]
    q = im.convert('RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT).convert('RGBA'); q.putalpha(a)
    return q


def despeckle(im):
    P = im.load(); W, H = im.size; ch = []
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if not c[3]: continue
            nb = [P[x + a, y + b] for a, b in N4 if 0 <= x + a < W and 0 <= y + b < H]
            if any(n == c for n in nb): continue
            op = [n for n in nb if n[3]]
            if len(op) >= 3:
                best = max(set(op), key=op.count)
                if op.count(best) >= 2: ch.append(((x, y), best))
    for p, c in ch: P[p] = c
    return im


def outline(im):
    """아주 어두운 가장자리 칸은 외곽선 색으로, 바깥에 1px 외곽선 (모서리 대각선은 두지 않아 얇게)"""
    W, H = im.size; o = Image.new('RGBA', (W + 2, H + 2)); o.alpha_composite(im, (1, 1)); P = o.load()
    W, H = o.size
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if c[3] and lum(c) < 45: P[x, y] = OUT
    add = [(x, y) for y in range(H) for x in range(W) if not P[x, y][3] and any(0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] and P[x + a, y + b] != OUT for a, b in N4)]
    for p in add: P[p] = OUT
    return o


def rim(im, k=0.15):
    """빛은 위에서: 위가 외곽선/바깥인 칸을 조금 밝게 (몸 덩어리가 바탕에서 떠 보이게)"""
    P = im.load(); W, H = im.size; ch = []
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if not c[3] or c == OUT: continue
            up = P[x, y - 1] if y > 0 else (0, 0, 0, 0)
            if up == OUT or not up[3]:                     # 위 가장자리만 (오른쪽까지 넣으면 투구에 잡점처럼 찍힘)
                ch.append(((x, y), tuple(min(255, int(v + (255 - v) * k)) for v in c[:3]) + (255,)))
    for p, c in ch: P[p] = c
    return im


def polish(im, n=14):
    return rim(outline(despeckle(quant(im, n))))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--colors', type=int, default=14)
    a = ap.parse_args()
    im = unbg(Image.open(a.src)); im = im.crop(im.getbbox())
    polish(im, a.colors).save(a.dst); print(a.dst)
