# 창 계열 남은 흠 수리 (2026-10-18 사용자 "개선해", 무료 스크립트): frames/<cls>/*.png (128칸) 를 프레임마다 고친다
#  lance  (랜서): 모델이 그린 보호대(파랑)를 기준점으로, 몸 반대쪽으로 뻗은 밝은 칸 = 랜스 → 지우고 같은 방향·길이로
#                 밑동이 굵고 끝이 뾰족한 원뿔을 은색 3단 명암(아래 그늘·중간 은·위 하이라이트)으로 다시 그린다 — "칼처럼 읽힘" 해결.
#                 기준점이 모델 그림이라 손·동작과 어긋나지 않는다.
#  shield (천마장군): 금테 정면 방패 한 장(REF)을 기준으로, 다른 프레임에서 방패 덩어리(갈색 뒷면·금테)를 지우고 그 자리 가운데에 기준 방패를 얹는다.
#   python -I -B fix_lance_shield.py lance cavalier | shield skyGeneral
import os, sys, math, glob, colorsys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
from wpn import line_fit
OUT, SH, MID, HI = (40, 44, 56), (96, 104, 124), (162, 170, 188), (236, 240, 248)
hls = lambda c: colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
ROWS = ('atkA', 'atkB', 'cast', 'walk', 'idle')
SHIELD_ROWS = ('atkA', 'atkB', 'cast')   # 방패 통일은 평타·시전만 — 걷기는 방패가 작게 보여 덩어리를 잘못 잡고 얼굴 위에 큰 방패를 얹었다


def comps(pts):
    pts = set(pts); out = []
    while pts:
        st = [pts.pop()]; c = {st[0]}
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); c.add(q); st.append(q)
        out.append(c)
    return out


def fix_lance(im):
    P = im.load(); W, H = im.size
    allp = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    if not allp: return im, False
    bx = sum(x for x, _ in allp) / len(allp); by = sum(y for _, y in allp) / len(allp)
    # 파란 덩어리(보호대 후보)마다 둘레 45칸의 밝고 가는 칸으로 직선을 맞추고, 직선이 그 덩어리를 3칸 안으로 지나며 inlier 10 이상인 것 중
    #  가장 긴 것을 랜스로 본다 — 몸 밖 가는 칸 전체로 맞추면 투구·갑옷 가장자리를 잡아 몸을 가로지르는 랜스가 그려졌다. 못 찾으면 그 프레임은 그대로
    M = set(allp); ero = {(x, y) for (x, y) in M if all((x + u, y + v) in M for u in range(-2, 3) for v in range(-2, 3))}
    op = {(x + u, y + v) for (x, y) in ero for u in range(-2, 3) for v in range(-2, 3)}
    thinl = [p for p in allp if p not in op and max(P[p][:3]) - min(P[p][:3]) < 45 and sum(P[p][:3]) > 420]
    blue = [p for p in allp if P[p][2] > P[p][0] + 50 and P[p][2] > 120]
    best = None
    for cb in comps(blue):
        if len(cb) < 3: continue
        Vc = (sum(x for x, _ in cb) / len(cb), sum(y for _, y in cb) / len(cb))
        cand = [p for p in thinl if 2 < math.dist(p, Vc) < 45]
        if len(cand) < 10: continue
        c1, d1, in1 = line_fit(cand, tol=1.4)
        if len(in1) < 10 or abs((Vc[0] - c1[0]) * d1[1] - (Vc[1] - c1[1]) * d1[0]) > 3: continue
        if best is None or len(in1) > len(best[2]): best = (Vc, d1, in1)
    if best is None: return im, False
    V, d0, inl0 = best
    light = list(inl0)
    far = max(inl0, key=lambda p: math.dist(p, V))       # 랜스 방향 = 기준점에서 직선의 먼 끝 쪽
    away = (far[0] - V[0], far[1] - V[1]); n = math.hypot(*away) or 1; away = (away[0] / n, away[1] / n)
    light = [p for p in light if (p[0] - V[0]) * away[0] + (p[1] - V[1]) * away[1] > 1]
    if len(light) < 6: return im, False
    c, d, inl = line_fit(light + [tuple(map(round, V))] * 3, tol=1.6)
    if d[0] * away[0] + d[1] * away[1] < 0: d = (-d[0], -d[1])
    L = max((p[0] - V[0]) * d[0] + (p[1] - V[1]) * d[1] for p in light)
    if L < 10: return im, False
    nrm = (-d[1], d[0])
    # 지우기: 보호대 앞 직선 둘레의 밝은·외곽선 칸
    for p in allp:
        t = (p[0] - V[0]) * d[0] + (p[1] - V[1]) * d[1]; s = abs((p[0] - V[0]) * nrm[0] + (p[1] - V[1]) * nrm[1])
        if 3 < t < L + 3 and s < 4.2 and P[p] [:3] not in () and (max(P[p][:3]) - min(P[p][:3]) < 60):
            P[p] = (0, 0, 0, 0)
    # 원뿔: 8배로 그려 칸 가운데 표본. 밑동 반지름 3.2 → 끝 0, 보호대 앞 2칸부터
    Z = 8; big = Image.new('RGBA', (W * Z, H * Z)); D = ImageDraw.Draw(big)
    Q = lambda t, s: ((V[0] + d[0] * t + nrm[0] * s + 0.5) * Z, (V[1] + d[1] * t + nrm[1] * s + 0.5) * Z)
    r0, t0, t1 = 4.4, 2.0, L + 1.5          # 밑동 굵게 (3.2 는 여전히 칼날처럼 가늘었다)
    rad = lambda t: r0 * max(0.0, 1 - (t - t0) / (t1 - t0)) ** 0.85
    up = 1 if nrm[1] < 0 else -1                      # 화면 위쪽 면 = 하이라이트
    D.polygon([Q(t0, r0 + 1), Q(t1 + 1, 0), Q(t0, -r0 - 1)], fill=OUT + (255,))
    D.polygon([Q(t0, r0), Q(t1, 0), Q(t0, -r0)], fill=MID + (255,))
    D.polygon([Q(t0, -up * r0), Q(t1, 0), Q(t0 + (t1 - t0) * 0.2, -up * rad(t0 + (t1 - t0) * 0.2) * 0.35), Q(t0, -up * r0 * 0.35)], fill=SH + (255,))
    D.polygon([Q(t0, up * r0 * 0.9), Q(t1 - 2, 0), Q(t0, up * r0 * 0.45)], fill=HI + (255,))
    vc = Q(0.5, 0)                                    # 둥근 파란 보호대 (vamplate) — 원뿔 밑동보다 크게
    D.ellipse([vc[0] - 5.4 * Z, vc[1] - 5.4 * Z, vc[0] + 5.4 * Z, vc[1] + 5.4 * Z], fill=OUT + (255,))
    D.ellipse([vc[0] - 4.4 * Z, vc[1] - 4.4 * Z, vc[0] + 4.4 * Z, vc[1] + 4.4 * Z], fill=(48, 84, 178, 255))
    D.ellipse([vc[0] - 2.6 * Z, vc[1] - 3.6 * Z, vc[0] + 0.2 * Z, vc[1] - 1.4 * Z], fill=(120, 160, 236, 255))
    BP = big.load()
    for y in range(H):
        for x in range(W):
            cc = BP[x * Z + Z // 2, y * Z + Z // 2]
            if cc[3]: P[x, y] = cc
    return im, True


REF = {'skyGeneral': ('atkA', 2)}                       # 금테 정면 방패가 또렷한 프레임


def shield_blob(im):
    P = im.load(); W, H = im.size
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3] and 0.04 < hls(P[x, y])[0] < 0.16 and hls(P[x, y])[2] > 0.3 and hls(P[x, y])[1] > 0.12]
    if len(pts) < 12: return None
    allp = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    bx = sum(x for x, _ in allp) / len(allp)
    cs = [c for c in comps(pts) if len(c) >= 12 and sum(x for x, _ in c) / len(c) < bx + 2]   # 몸 앞쪽(왼쪽, 먼 팔) — 금 랜스(오른쪽)는 뺀다
    if not cs: return None
    return max(cs, key=len)


def ref_shield(cls):
    row, i = REF[cls]; im = Image.open(os.path.join(HERE, 'frames', cls, f'{row}-{i}.png')).convert('RGBA'); b = shield_blob(im)
    xs = [x for x, _ in b]; ys = [y for _, y in b]; box = (min(xs) - 1, min(ys) - 1, max(xs) + 2, max(ys) + 2)
    cut = im.crop(box); return cut, ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def fix_shield(im, ref):
    P = im.load(); b = shield_blob(im)
    if not b: return im, False
    xs = [x for x, _ in b]; ys = [y for _, y in b]
    cx, cy = (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2
    for p in b: P[p] = (0, 0, 0, 0)
    im.alpha_composite(ref, (round(cx - ref.width / 2), round(cy - ref.height / 2)))
    return im, True


if __name__ == '__main__':
    what, cls = sys.argv[1], sys.argv[2]
    fs = [f for r in (ROWS if what == 'lance' else SHIELD_ROWS) for f in glob.glob(os.path.join(HERE, 'frames', cls, f'{r}-*.png'))]
    ref = ref_shield(cls)[0] if what == 'shield' else None
    n = 0
    for f in fs:
        im = Image.open(f).convert('RGBA')
        im, ok = fix_lance(im) if what == 'lance' else fix_shield(im, ref)
        if ok: im.save(f); n += 1
    print(cls, what, 'fixed', n, '/', len(fs))
