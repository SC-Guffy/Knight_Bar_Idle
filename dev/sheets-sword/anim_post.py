# 관절 애니 후처리 (PixelLab 0): work/paladin/skel-atk-*.png (192, 15f) → 3칸 최빈색으로 64칸 → 중립 그림 팔레트 고정(반투명 잔상 버림)
#  → 가장 큰 덩어리만 → 손목 좌표(관절 RIGHT ARM / 3)에서 설계 칼 각도로 성검(금빛 2칸 폭 + 외곽선) 덧그리기
#  python -I -B anim_post.py → anim/paladin-atk-{i}.png, anim/paladin-atk-strip.png, anim/paladin-atk-x4.gif
import os, json, math, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim')
OUT = (11, 13, 20, 255); BLADE = (255, 250, 190, 255); BLADE_D = (232, 190, 80, 255); GUARD = (178, 124, 36, 255)


def palette(im):
    return sorted({c for c in im.getdata() if c[3]})


def near(c, pal):
    return min(pal, key=lambda p: sum((c[i] - p[i]) ** 2 for i in range(3)))


def down(im, pal):
    W = im.width // 3; o = Image.new('RGBA', (W, W)); P = im.load(); O = o.load()
    for y in range(W):
        for x in range(W):
            cs = [P[3 * x + a, 3 * y + b] for a in range(3) for b in range(3) if P[3 * x + a, 3 * y + b][3] >= 200]
            if len(cs) >= 4: O[x, y] = near(max(set(cs), key=cs.count), pal)
    return o


def main_blob(im):
    P = im.load(); W, H = im.size; pts = {(x, y) for y in range(H) for x in range(W) if P[x, y][3]}; best = set()
    while pts:
        st = [pts.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); comp.add(q); st.append(q)
        if len(comp) > len(best): best = comp
    o = Image.new('RGBA', im.size); O = o.load()
    for p in best: O[p] = P[p]
    return o


def sword(im, g, ang, L=13):
    P = im.load(); a = math.radians(ang); u = (math.cos(a), math.sin(a)); n = (-u[1], u[0]); pts = {}
    for t in range(0, L * 2 + 1):
        t2 = t / 2
        for s, col in ((0, BLADE), (1, BLADE_D)):
            x, y = round(g[0] + u[0] * t2 + n[0] * s * 0.6), round(g[1] + u[1] * t2 + n[1] * s * 0.6)
            if t2 >= 2 and 0 <= x < im.width and 0 <= y < im.height: pts[(x, y)] = col
    for s in (-2, -1, 0, 1, 2):                                  # 코등이
        x, y = round(g[0] + u[0] * 1.5 + n[0] * s), round(g[1] + u[1] * 1.5 + n[1] * s); pts[(x, y)] = GUARD
    for (x, y), c in pts.items(): P[x, y] = c
    for (x, y) in list(pts):
        for a2, b2 in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + a2, y + b2)
            if q not in pts and 0 <= q[0] < im.width and 0 <= q[1] < im.height and not P[q][3]: P[q] = OUT
    return im


if __name__ == '__main__':
    d = json.load(open(os.path.join(A, 'paladin-atk.json'), encoding='utf-8'))
    pal = palette(Image.open(os.path.join(A, 'paladin64-idle.png')).convert('RGBA'))
    fr = []
    for i in range(15):
        im = Image.open(os.path.join(HERE, 'work', 'paladin', f'skel-atk-{i}.png')).convert('RGBA')
        o = main_blob(down(im, pal))
        h = next(k for k in d['frames'][i] if k['label'] == 'RIGHT ARM'); g = (h['x'] * 64, h['y'] * 64)
        o = sword(o, g, d['angles'][i]); o.save(os.path.join(A, f'paladin-atk-{i}.png')); fr.append(o)
    strip = Image.new('RGBA', (64 * 15, 64)); [strip.alpha_composite(f, (64 * i, 0)) for i, f in enumerate(fr)]
    strip.save(os.path.join(A, 'paladin-atk-strip.png'))
    g = []
    for f in fr:
        b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
    g[0].save(os.path.join(A, 'paladin-atk-x4.gif'), save_all=True, append_images=g[1:], duration=70, loop=0)
    sv = Image.new('RGBA', (64 * 8 * 3, 64 * 2 * 3), (38, 40, 50, 255))
    for i, f in enumerate(fr): sv.alpha_composite(f.resize((192, 192), Image.NEAREST), ((i % 8) * 192, (i // 8) * 192))
    sv.save(os.path.join(A, '_post-atk.png')); print('ok', len(pal))
