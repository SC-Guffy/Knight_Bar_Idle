# 원형 마네킹 몸 움직임 확인 (로드맵 검수 2026-10-16): 덧그리기 전 PixelLab 프레임에서 무기 칸(dress.weapon_axis)을 뺀 몸만.
#  줄마다: 원본 프레임 → 몸만 → 첫 프레임(파랑)·이 프레임(주황) 겹침. 수치: 몸 겹침(IoU), 머리 이동, 손 이동, 발 벌어짐
#  python -I -B motion.py  → ../review/sheets-spear/gen/motion-<이름>.png, 표는 stdout
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gen as G, dress as D
OUT = os.path.join(HERE, '..', 'review', 'sheets-spear', 'gen')
SRCFX = G.SRC_FX


def body_of(M):
    MP = D.classify(M); W = D.weapon_axis(MP); mask = W[0] if W else set()
    return {p for p, v in MP.items() if v[0] != 'blade' and p not in mask}, (W[1] if W else None)


for name in ('walk', 'spearA', 'spearB', 'halbA', 'halbB'):
    fs = [G.ground(G.despeck(G.solid(M, 128)), 112) for M in G.gen_frames(name)]
    bs = [body_of(M) for M in fs]
    b0 = bs[0][0]; Z = 3; W_ = 96
    x0 = SRCFX[name] - 40
    sheet = Image.new('RGBA', (len(fs) * (W_ + 2) * Z, 3 * 70 * Z), (24, 26, 34, 255))
    rows = []
    for k, (M, (b, g)) in enumerate(zip(fs, bs)):
        crop = lambda im: im.crop((x0, 112 - 64, x0 + W_, 112 + 6))
        body = Image.new('RGBA', M.size); BP = body.load(); MP_ = M.load()
        for p in b: BP[p] = MP_[p]
        on = Image.new('RGBA', M.size); O = on.load()
        for p in b0: O[p] = (80, 140, 255, 160)
        for p in b: O[p] = (255, 150, 60, 200) if p not in b0 else (240, 240, 250, 255)
        for r, im in enumerate((M, body, on)):
            sheet.alpha_composite(crop(im).resize((W_ * Z, 70 * Z), Image.NEAREST), (k * (W_ + 2) * Z, r * 70 * Z))
        iou = len(b0 & b) / len(b0 | b)
        top = min(y for _, y in b); hx = [x for x, y in b if y <= top + 3]; h = (sum(hx) / len(hx), top)
        t0 = min(y for _, y in b0); hx0 = [x for x, y in b0 if y <= t0 + 3]; h0 = (sum(hx0) / len(hx0), t0)
        feet = [x for x, y in b if y >= 109]
        rows.append((k, round(iou, 2), round(((h[0] - h0[0]) ** 2 + (h[1] - h0[1]) ** 2) ** .5, 1), (max(feet) - min(feet)) if feet else 0, [round(v) for v in g] if g else None))
    sheet.save(os.path.join(OUT, f'motion-{name}.png'))
    g0 = rows[0][4]
    print(name, ' | '.join(f'#{k} IoU {i} 머리 {h} 발 {f} 손 {round(((g[0]-g0[0])**2+(g[1]-g0[1])**2)**.5) if g and g0 else "-"}' for k, i, h, f, g in rows))
