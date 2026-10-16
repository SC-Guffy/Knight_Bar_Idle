# 관절 애니(animate-with-skeleton-v3 등) 결과 후처리 공용 함수 — 마법사 계열(dev/sheets-mage/skelgen.py)에서 옮김 (로드맵 2026-10-17: 다른 계열도 쓰게)
#  흐름 예: im = down2(모델 192칸 프레임) → env, KP = envelope(프레임 관절, 96) → body = body_of(pal_filter(im, 몸팔레트), env, KP)
#          → keep_big · snap(팔레트) · drop_fire_blobs → 손 = snap_hand(body, KP['RIGHT ARM'], KP['RIGHT ELBOW']) → 각도 = model_staff(...) 또는 설계 → wpn.overlay
#  - staff_split: 3×3 열기로 가는 선(모델이 그린 무기·이펙트)을 몸에서 떼어 냄 (가장 큰 덩어리 + 몸 가운데 ±10칸의 큰 덩어리)
#  - envelope/body_of: 관절 뼈대 둘레 r 칸은 원래 칸을 되살림 (가는 팔·다리 보존) · 손·얼굴보다 앞, 머리 뒤 검은 덩어리 지움
#  - pal_filter: 기준 그림 팔레트에서 먼 색·무채색 연기 지움 / snap: 팔레트로 맞춤 / drop_fire_blobs: 뼈대 밖 작은 불꽃색 덩어리 지움
#  - model_staff: 모델이 그린 무기 축(각도) 재기 / snap_hand: 설계 손 점 → 실제 팔 끝 칸 / dark_fill: 속까지 검은 덩어리를 어두운 직업색으로
import math
from PIL import Image


BONES = [('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'),
         ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'),
         ('NECK', 'RIGHT HIP'), ('NECK', 'LEFT HIP'), ('NECK', 'RIGHT SHOULDER'), ('NECK', 'LEFT SHOULDER')]


def staff_split(im):
    """기준 그림 → (빈손 몸, 지팡이 칸 집합). 지팡이는 1~2칸 가는 선이라 3×3 열기(깎았다 불리기)에서 떨어져 나간다.
    열린 몸 덩어리(가장 큰 것)를 1칸 불린 영역 안의 원래 칸만 몸으로 남기고, 나머지 = 지팡이(갈래·불꽃 머리 포함)"""
    im = im.convert('RGBA'); W, H = im.size; P = im.load()
    a = [[P[x, y][3] > 0 for x in range(W)] for y in range(H)]
    def erode(m):
        return [[all(0 <= x + i < W and 0 <= y + j < H and m[y + j][x + i] for i in (-1, 0, 1) for j in (-1, 0, 1)) for x in range(W)] for y in range(H)]
    def dilate(m):
        return [[any(0 <= x + i < W and 0 <= y + j < H and m[y + j][x + i] for i in (-1, 0, 1) for j in (-1, 0, 1)) for x in range(W)] for y in range(H)]
    o = dilate(erode(a))
    # 큰 덩어리들 (가는 허리·발목에서 몸이 둘로 끊겨도 같이 남게: 가장 큰 것의 25% 이상)
    seen = set(); best = []; allc = []
    for y in range(H):
        for x in range(W):
            if o[y][x] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    p = st.pop(); c.append(p)
                    for i in (-1, 0, 1):
                        for j in (-1, 0, 1):
                            q = (p[0] + i, p[1] + j)
                            if 0 <= q[0] < W and 0 <= q[1] < H and o[q[1]][q[0]] and q not in seen: seen.add(q); st.append(q)
                allc.append(c)
                if len(c) > len(best): best = c
    keep = [[False] * W for _ in range(H)]
    bx = sum(x for x, _ in best) / len(best)
    for c in allc:        # 25% 이상 + 가로 가운데가 몸 가운데 ±10칸 (앞으로 뻗은 불꽃·고리 이펙트는 빠진다)
        if len(c) >= 0.25 * len(best) and abs(sum(x for x, _ in c) / len(c) - bx) <= 10 * W / 96:
            for x, y in c: keep[y][x] = True
    keep = dilate(keep)
    body = Image.new('RGBA', im.size); B = body.load(); staff = set()
    for y in range(H):
        for x in range(W):
            if not a[y][x]: continue
            if keep[y][x]: B[x, y] = P[x, y]
            else: staff.add((x, y))
    return body, staff


def down2(im):
    """192 → 96: 2×2 칸마다 불투명이 2칸 이상이면 칠하고 색은 가장 많은 색 (평균 안 함)"""
    im = im.convert('RGBA'); W, H = im.size; P = im.load(); o = Image.new('RGBA', (W // 2, H // 2)); O = o.load()
    for y in range(H // 2):
        for x in range(W // 2):
            cs = [P[2 * x + i, 2 * y + j] for i in (0, 1) for j in (0, 1)]; op = [c for c in cs if c[3] >= 128]
            if len(op) >= 2: O[x, y] = max(set(op), key=op.count)[:3] + (255,)
    return o


def comps(im):
    """불투명 칸의 8방향 덩어리 목록 (큰 것부터)"""
    P = im.load(); W, H = im.size; seen = set(); out = []
    for y in range(H):
        for x in range(W):
            if P[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    q = st.pop(); c.append(q)
                    for i in (-1, 0, 1):
                        for j in (-1, 0, 1):
                            r = (q[0] + i, q[1] + j)
                            if 0 <= r[0] < W and 0 <= r[1] < H and P[r][3] and r not in seen: seen.add(r); st.append(r)
                out.append(c)
    return sorted(out, key=len, reverse=True)


def keep_big(im, frac=0.3):
    """가장 큰 덩어리의 frac 이상인 덩어리만 남긴다 (지팡이 옆에 묻어 온 머리카락 끝 같은 부스러기 제거)"""
    cs = comps(im); o = Image.new('RGBA', im.size); P = im.load(); O = o.load()
    for c in cs:
        if len(c) >= frac * len(cs[0]):
            for q in c: O[q] = P[q]
    return o


def pal_filter(im, pal, thr=60):
    """기준 그림 팔레트에서 먼 색(모델이 그린 불꽃·연기·섬광)을 지운다"""
    im = im.copy(); P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if not c[3]: continue
            dd = min((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2 for p in pal)
            grey = max(c[:3]) - min(c[:3]) < 34 and 90 < sum(c[:3]) / 3 < 215        # 연기: 무채색 중간 밝기
            if dd > thr * thr or (grey and dd > 14 * 14): P[x, y] = (0, 0, 0, 0)
    return im


def snap(im, pal):
    """모든 칸을 기준 그림 팔레트의 가장 가까운 색으로 (모델이 섞은 중간색 정리)"""
    im = im.copy(); P = im.load(); memo = {}
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if not c[3]: continue
            k = c[:3]
            if k not in memo: memo[k] = min(pal, key=lambda p: (k[0] - p[0]) ** 2 + (k[1] - p[1]) ** 2 + (k[2] - p[2]) ** 2)
            P[x, y] = memo[k] + (255,)
    return im


def envelope(kp, size, r=3.5):
    """관절 뼈대(96칸 좌표) 둘레 r 칸 안 = 팔다리 자리. 가는 팔다리가 '가는 선 = 지팡이' 규칙에 같이 지워지지 않게"""
    P = {k['label']: (k['x'] * size, k['y'] * size) for k in kp}
    env = set()
    for a, b in BONES:
        if a not in P or b not in P: continue
        (x0, y0), (x1, y1) = P[a], P[b]
        for x in range(int(min(x0, x1) - r) - 1, int(max(x0, x1) + r) + 2):
            for y in range(int(min(y0, y1) - r) - 1, int(max(y0, y1) + r) + 2):
                dx, dy = x1 - x0, y1 - y0; L = dx * dx + dy * dy or 1
                t = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / L))
                if (x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2 <= r * r: env.add((x, y))
    return env, P


def body_of(im, env, KP=None):
    """열기로 남은 몸 + 뼈대 둘레의 원래 칸 (가는 팔·다리 복원).
    손·얼굴보다 1칸 넘게 앞(오른쪽)에 있는 뼈대 밖 칸 = 모델이 앞으로 쏜 이펙트(불꽃 고리·연기) → 지운다"""
    body, _ = staff_split(im); B = body.load(); P = im.load()
    for (x, y) in env:
        if 0 <= x < im.width and 0 <= y < im.height and P[x, y][3] and not B[x, y][3]: B[x, y] = P[x, y]
    if KP:
        front = max(v[0] for k, v in KP.items() if k in ('RIGHT ARM', 'LEFT ARM', 'NOSE', 'RIGHT EYE', 'LEFT EYE', 'RIGHT EAR', 'LEFT EAR')) + 1
        for y in range(im.height):
            for x in range(int(front) + 1, im.width):
                if B[x, y][3] and (x, y) not in env: B[x, y] = (0, 0, 0, 0)
        # 몸 뒤쪽 뼈대 밖의 '속까지 검은' 덩어리 = 모델 지팡이 머리 잔재 (머리카락 외곽선은 밝은 칸과 닿아 남는다)
        back = min(v[0] for v in KP.values()) - 4
        dk = lambda c: c[3] and sum(c[:3]) < 210
        rm = [(x, y) for y in range(im.height) for x in range(0, max(0, int(back)))
              if dk(B[x, y]) and (x, y) not in env and not any(0 <= x + i < im.width and 0 <= y + j < im.height and B[x + i, y + j][3] and not dk(B[x + i, y + j]) for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2))]
        for q in rm: B[q] = (0, 0, 0, 0)
    return body


def dark_fill(body, col):
    B = body.load(); W, H = body.size
    dk = lambda c: c[3] and sum(c[:3]) < 120
    qs = [(x, y) for y in range(H) for x in range(W) if dk(B[x, y]) and all(0 <= x + i < W and 0 <= y + j < H and dk(B[x + i, y + j]) for i in (-1, 0, 1) for j in (-1, 0, 1))]
    for q in qs: B[q] = col + (255,)
    return body


def drop_fire_blobs(body, env, n=90, frac=0.3):
    """뼈대 둘레를 잘라 낸 나머지에서, 작고(n 칸 미만) 불꽃색이 frac 이상인 덩어리 = 모델 불덩이 → 지운다 (머리카락은 커서 남는다)"""
    W, H = body.size; B = body.load()
    fire = lambda c: c[0] > 190 and c[1] > 70 and c[2] < 120
    cut = Image.new('RGBA', body.size); C = cut.load()
    for y in range(H):
        for x in range(W):
            if B[x, y][3] and (x, y) not in env: C[x, y] = B[x, y]
    for c in comps(cut):
        if len(c) < n and sum(1 for q in c if fire(B[q])) >= frac * len(c):
            for q in c: B[q] = (0, 0, 0, 0)
    return body


def snap_hand(body, g, elbow, r=6):
    """설계 손 점 둘레 r 칸 안의 몸 칸 중 팔꿈치→손 방향으로 가장 먼 칸(실제 팔 끝). 손 점 위에 몸 칸이 있으면 그대로"""
    B = body.load(); W, H = body.size; gx, gy = g
    if 0 <= round(gx) < W and 0 <= round(gy) < H and B[round(gx), round(gy)][3]: return g
    ux, uy = gx - elbow[0], gy - elbow[1]; L = math.hypot(ux, uy) or 1; ux, uy = ux / L, uy / L
    cs = [(x, y) for x in range(int(gx - r), int(gx + r) + 1) for y in range(int(gy - r), int(gy + r) + 1)
          if 0 <= x < W and 0 <= y < H and B[x, y][3] and (x - gx) ** 2 + (y - gy) ** 2 <= r * r and (x - elbow[0]) * ux + (y - elbow[1]) * uy > 0]
    if not cs: return g
    return max(cs, key=lambda q: (q[0] - elbow[0]) * ux + (q[1] - elbow[1]) * uy - 0.3 * math.hypot(q[0] - gx, q[1] - gy))


def model_staff(im, body, g0, deg0):
    """모델이 그린 지팡이(몸에서 떨어져 나간 어두운 칸)의 쥔 자리·방향을 잰다 → (grip, deg) 또는 None.
    팔 자세와 지팡이가 같이 움직이게, 설계 각도 대신 모델이 팔에 쥐여 준 방향을 따른다"""
    P = im.load(); B = body.load(); W, H = im.size
    R = [(x, y) for y in range(H) for x in range(W) if P[x, y][3] and not B[x, y][3] and sum(P[x, y][:3]) < 330]
    if len(R) < 8: return None
    mx = sum(x for x, _ in R) / len(R); my = sum(y for _, y in R) / len(R)
    sxx = sum((x - mx) ** 2 for x, _ in R); syy = sum((y - my) ** 2 for _, y in R); sxy = sum((x - mx) * (y - my) for x, y in R)
    th = 0.5 * math.atan2(2 * sxy, sxx - syy); ux, uy = math.cos(th), math.sin(th)
    ts = [(x - mx) * ux + (y - my) * uy for x, y in R]
    if max(ts) - min(ts) < 8: return None
    touch = [(x, y) for x, y in R if any(0 <= x + i < W and 0 <= y + j < H and B[x + i, y + j][3] for i in (-1, 0, 1) for j in (-1, 0, 1))]
    if touch:
        # 몸에 닿은 칸 중 설계 손 점에 가장 가까운 무리
        touch.sort(key=lambda q: (q[0] - g0[0]) ** 2 + (q[1] - g0[1]) ** 2); near = touch[:4]
        gx = sum(x for x, _ in near) / len(near); gy = sum(y for _, y in near) / len(near)
    else: gx, gy = g0
    if math.cos(th - math.radians(deg0)) < 0: ux, uy = -ux, -uy        # 축은 모델 것, 머리 쪽은 설계 각도에 가까운 쪽
    return (gx, gy), math.degrees(math.atan2(uy, ux))
