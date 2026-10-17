# 모델이 그린 활(own)에서 화살만 지우기 (화살·탄은 시트에 넣지 않는다 — VFX 몫)
#   1) 몸에서 떨어진 덩어리 지우기: 가장 큰 덩어리(8방향 연결)만 남긴다 (날아가는 화살)
#   2) (하늘 쏘기는 diag_off: 기운 어두운 가는 직선)
#   2') 활 앞으로 튀어나온 화살촉 지우기: 세로로 5칸 이상 이어진 칸이 있는 가장 오른쪽 열 너머를 지운다 (활대는 세로, 화살은 가로 1~3칸 — 촉은 3칸)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/noarrow.py <cls> <act> [src판=own]  → post-<act>-na-<i>.png, strip, GIF
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from skelpost import strip, W96


def biggest(im):
    P = im.load(); W, H = im.size; seen = set(); comps = []
    for y in range(H):
        for x in range(W):
            if not P[x, y][3] or (x, y) in seen: continue
            st = [(x, y)]; c = {(x, y)}; seen.add((x, y))
            while st:
                a, b = st.pop()
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (a + dx, b + dy)
                        if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and P[q][3]: seen.add(q); c.add(q); st.append(q)
            comps.append(c)
    keep = max(comps, key=len) if comps else set()
    for c in comps:
        if c is not keep:
            for q in c: P[q] = (0, 0, 0, 0)
    return im


def tip_off(im, need=5):
    P = im.load(); W, H = im.size; edge = 0
    for x in range(W):
        run = best = 0
        for y in range(H):
            run = run + 1 if P[x, y][3] else 0; best = max(best, run)
        if best >= need: edge = x
    for x in range(edge + 1, W):
        for y in range(H): P[x, y] = (0, 0, 0, 0)
    return im


def diag_off(im, amin=20, amax=70, tol=1.6):
    """하늘 쏘기: 활 손(위쪽 가장 오른쪽 피부 칸) 너머 위-오른쪽으로 기운 어두운 직선(화살대·촉)을 찾아 손 너머만 지운다"""
    import math, random
    P = im.load(); W, H = im.size
    skin = [(x, y) for y in range(H // 2 + 10) for x in range(W) if P[x, y][3] and P[x, y][0] > 200 and P[x, y][1] > 130 and P[x, y][2] > 120]
    if not skin: return im
    hand = max(skin, key=lambda q: q[0] - q[1])                       # 위-오른쪽 끝 피부 = 활 손
    cand = [(x, y) for y in range(H) for x in range(W) if P[x, y][3] and sum(P[x, y][:3]) < 200 and x >= hand[0] - 3 and y <= hand[1] + 3]
    if len(cand) < 6: return im
    rnd = random.Random(1); best = (None, None, 0)
    for _ in range(600):
        p1, p2 = rnd.sample(cand, 2); dx, dy = p2[0] - p1[0], p2[1] - p1[1]; L = math.hypot(dx, dy)
        if L < 4: continue
        d = (dx / L, dy / L); ang = abs(math.degrees(math.atan2(-d[1], d[0]))); ang = 180 - ang if ang > 90 else ang
        if not amin <= ang <= amax or d[0] * d[1] > 0: continue           # 위-오른쪽(화면 y 감소, x 증가)으로 기운 선만
        n = sum(1 for q in cand if abs((q[0] - p1[0]) * d[1] - (q[1] - p1[1]) * d[0]) <= tol)
        if n > best[2]: best = (p1, d, n)
    c, d, n = best
    if c is None or n < 5: return im
    if d[0] < 0: d = (-d[0], -d[1])
    th = (hand[0] - c[0]) * d[0] + (hand[1] - c[1]) * d[1]
    for y in range(H):
        for x in range(W):
            if P[x, y][3] and abs((x - c[0]) * d[1] - (y - c[1]) * d[0]) <= tol + 0.6 and (x - c[0]) * d[0] + (y - c[1]) * d[1] > th + 1: P[x, y] = (0, 0, 0, 0)
    return biggest(im)


if __name__ == '__main__':
    cls, act = sys.argv[1], sys.argv[2]; src = sys.argv[3] if len(sys.argv) > 3 else 'own'
    diag = act.startswith('sky')
    Wd = os.path.join(HERE, 'work', cls); fr = []; i = 0
    while os.path.exists(os.path.join(Wd, f'post-{act}-{src}-{i}.png')):
        f = biggest(Image.open(os.path.join(Wd, f'post-{act}-{src}-{i}.png')).convert('RGBA'))
        f = diag_off(f) if diag else tip_off(f)
        f.save(os.path.join(Wd, f'post-{act}-na-{i}.png')); fr.append(f); i += 1
    strip(fr).save(os.path.join(Wd, f'strip-{act}-na.png'))
    big = []
    for f in fr:
        b = Image.new('RGBA', (W96, W96), (20, 22, 30, 255)); b.alpha_composite(f); big.append(b.resize((W96 * 4, W96 * 4), Image.NEAREST).convert('RGB'))
    big[0].save(os.path.join(Wd, f'anim-{act}-na.gif'), save_all=True, append_images=big[1:], duration=110, loop=0)
    print(len(fr))
