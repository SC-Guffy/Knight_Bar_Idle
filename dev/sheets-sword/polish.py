# 기준 그림 손질 (PixelLab image-to-pixelart 결과 → 게임 도트): 바탕 떼기 → 색 줄이기(14) → 외톨이 점 정리 → 바깥 1px 외곽선 #0b0d14 → 위·오른쪽 하이라이트
#  python -I -B polish.py → design/pl/clean-<cls>.png (바탕만 뗀 정리본), design/pl/polish-<cls>.png (손질본), 비교 그림 → dev/review/sheets-sword/design/
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


def polish(im):
    return rim(outline(despeckle(quant(im))))


if __name__ == '__main__':
    R = os.path.join(ROOT, 'dev', 'review', 'sheets-sword', 'design'); os.makedirs(R, exist_ok=True)
    rows = []
    for c, p in (('swordsman', 'B2-11'), ('paladin', 'B2-51')):
        raw = Image.open(os.path.join(HERE, 'work', c, 'ref64-0.png'))
        clean = unbg(raw); clean = clean.crop(clean.getbbox()); clean.save(os.path.join(HERE, 'design', 'pl', f'clean-{c}.png'))
        pol = polish(clean.copy()); pol.save(os.path.join(HERE, 'design', 'pl', f'polish-{c}.png'))
        comfy = Image.open(os.path.join(HERE, 'design', 'px', f'{c}-{p}-h46.png')).convert('RGBA')
        for tag, im in (('comfy', comfy), ('pl', clean), ('polish', pol)): im.save(os.path.join(R, f'st-{c}-{tag}.png'))
        rows.append((c, [comfy, clean, pol]))
        cols = {x for x in pol.get_flattened_data() if x[3]} if hasattr(pol, 'get_flattened_data') else set()
        print(c, 'sizes', [i.size for i in (comfy, clean, pol)], 'colors', len(cols))
    # 4배 나란히
    S = 4; Wt = max(sum(i.width + 6 for i in ims) for _, ims in rows); Ht = sum(max(i.height for i in ims) + 6 for _, ims in rows)
    pv = Image.new('RGBA', (Wt * S, Ht * S), (30, 33, 42, 255)); y = 0
    for _, ims in rows:
        x = 0; h = max(i.height for i in ims)
        for i in ims: pv.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x * S, (y + h - i.height) * S)); x += i.width + 6
        y += h + 6
    pv.save(os.path.join(R, 'st-compare-x4.png'))
    # 게임 화면 (화면 2배 = 시트 1칸 3px)
    sc = Image.open(os.path.join(HERE, 'ref', '_scene.png')).convert('RGBA'); bg = Image.new('RGBA', sc.size, (20, 22, 30, 255)); bg.alpha_composite(sc)
    s = bg.crop((0, 0, 600, 150)).resize((1200, 300), Image.NEAREST)
    xs = (180, 230, 280, 360, 410, 460)
    for x, im in zip(xs, [i for _, ims in rows for i in ims]):
        big = im.resize((im.width * 3, im.height * 3), Image.NEAREST); s.alpha_composite(big, (x * 2 - big.width // 2, 280 - im.getbbox()[3] * 3 + 3))
    s.save(os.path.join(R, 'st-compare-scene.png'))
