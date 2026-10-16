# 관절 지정 애니 (animate-with-skeleton-v3) — 마법사 계열 (로드맵 승인 2026-10-17: 4직업 × 2회 15f, usage 최대 32, 재시도 0, 1단계 화염술사 A 먼저)
#  첫 프레임 = design/final/<cls>.png (키 46 기준 그림) 에서 지팡이를 지운 빈손 그림을 192칸에 2배로 (발 x FOOT_X, 땅 176).
#  관절 = skel.py MOVES_B (3등신 키 46 비율). 기준 관절(to_b(pose()))을 그림의 몸 상자에 맞춰 옮기고, 모든 프레임에 같은 이동을 준다.
#  A = 평타A 7 + 평타B 7 + 기준 1 (15f) · B = 시전 7 + 걷기 8 (15f)
#  python -I -B skelgen.py prep <cls> <A|B>   → skel/<cls>/req-<A|B>.json, first.png, staff.png(덧그릴 지팡이), fit.png(막대 인형 겹침)
#  (호출) MSYS_NO_PATHCONV=1 python -I plx.py raw <cls> skel<A|B> /animate-with-skeleton-v3 skel/<cls>/req-<A|B>.json
#  python -I -B skelgen.py post <cls> <A|B>   → skel/<cls>/<A|B>-raw/ (모델 프레임 96칸), <A|B>-wpn/ (지팡이 덧그림), 몽타주
import os, sys, json, base64, io, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-sword'))
import importlib.util
_sp = importlib.util.spec_from_file_location('mskel', os.path.join(HERE, 'skel.py')); SK = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(SK)
N, GROUND = 192, 176
DESC = {
    'pyromancer': 'small chibi young woman fire mage, 3 heads tall, very long orange ponytail streaming behind, red headband, sleeveless red top with bracers, short red skirt, boots, right hand empty',
    'mage': 'small chibi young woman apprentice wizard, 3 heads tall, big blue pointed hat bent back, long brown hair, blue tunic dress with belt, boots, right hand empty',
    'cryomancer': 'small chibi young woman ice mage, 3 heads tall, round light blue hood, white hair, white fur collar, blue cape, long white gloves, short blue skirt, white boots, right hand empty',
    'electromancer': 'small chibi young woman storm mage, 3 heads tall, spiky blonde hair, navy circlet with two light blue lightning horns, navy coat dress with gold buttons, navy stockings, boots, right hand empty',
}
ACTION = {'A': 'magic staff attacks: thrust forward, then raise overhead and slam down', 'B': 'casting a spell with both hands then walking'}


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


# 지팡이가 굵거나 몸에 붙어 열기로 안 갈리는 기준 그림: 64칸 그림 좌표로 지팡이 영역을 직접 지정 (격자 확대본을 보고 정함)
_skin = lambda c: c[0] > 170 and c[1] > 110 and c[0] > c[2] + 30
MANUAL = {
    'cryomancer': lambda x, y, c: x >= 26,                                   # 오른쪽 얼음 지팡이 (망토 오른쪽 외곽선 = x 25)
    'mage': lambda x, y, c: x >= 22 and 19 <= y <= 38 and not _skin(c),     # 구슬 지팡이 (모자 챙 y 9~12 는 남김, 손 살색은 남김)
    'electromancer': lambda x, y, c: (x >= 22 and not _skin(c)) or (x >= 19 and y >= 37),   # 구슬 + 가는 자루 (손 살색 남김, 발치 자루 끝)
}


CAP_STAFF = {'mage': 1.5, 'electromancer': 1.5}      # 견습 지팡이 26칸 → 39칸 (기준 그림 쪽은 구슬 끝만 보임)


def staff_split_cls(cls, im):
    if cls not in MANUAL: return staff_split(im)
    im = im.convert('RGBA'); P = im.load(); body = Image.new('RGBA', im.size); B = body.load(); staff = set()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if not c[3]: continue
            if MANUAL[cls](x, y, c): staff.add((x, y))
            else: B[x, y] = c
    return body, staff


def body_box(im):
    bb = im.getbbox(); return bb


def place(cls):
    """first.png (192칸, 빈손) · staff.png (지팡이만, 같은 좌표) · 기준 관절 이동량"""
    fin = Image.open(os.path.join(HERE, 'design', 'final', f'{cls}.png')).convert('RGBA')
    body, staff = staff_split_cls(cls, fin)
    W, H = fin.size
    # 2배로 192칸: 발 바닥(몸 맨 아래 줄) = 땅-1, 몸 가로 가운데(아래 1/3 의 가운데) = FOOT_X
    bb = body.getbbox(); ys = range(bb[1] + (bb[3] - bb[1]) * 2 // 3, bb[3]); P = body.load()
    xs = [x for y in ys for x in range(W) if P[x, y][3]]
    cx = (min(xs) + max(xs)) / 2
    ox, oy = round(SK.FOOT_X - cx * 2), (GROUND - 1) - (bb[3] - 1) * 2 - 1
    first = Image.new('RGBA', (N, N)); first.alpha_composite(body.resize((W * 2, H * 2), Image.NEAREST), (ox, oy))
    st = Image.new('RGBA', fin.size); S = st.load(); F = fin.load()
    for p in staff: S[p] = F[p]
    st2 = Image.new('RGBA', (N, N)); st2.alpha_composite(st.resize((W * 2, H * 2), Image.NEAREST), (ox, oy))
    return first, st2, (ox, oy), (W, H)


def fit_keys(first, staff):
    """설계 관절(to_b 기준) → 그림 좌표 변환 (x' = a·x + bx, y' = a·y + by). 그림에서 잰 기준점에 맞춘다:
    발바닥(몸 맨 아래 줄) · 목(정수리~발바닥의 37% — 3등신) · 다리 가운데 x. 첫 프레임의 앞손(RIGHT ARM)은 그림에서 지팡이를 쥔 자리.
    → (변환 함수, 첫 프레임 관절)"""
    base = SK.to_b(SK.pose())
    bb = first.getbbox(); P = first.load()
    foot_s = bb[3] - 1
    # 정수리: 몸 가운데 ±10칸 열의 가장 위 칸 (뒤로 흐르는 머리·모자 끝 제외)
    cols = range(int(SK.FOOT_X) - 10, int(SK.FOOT_X) + 12)
    top_s = min(y for x in cols for y in range(N) if 0 <= x < N and P[x, y][3])
    neck_s = top_s + 0.37 * (foot_s - top_s)
    foot_b = max(base['RIGHT LEG'][1], base['LEFT LEG'][1]); neck_b = base['NECK'][1]
    a = (foot_s - neck_s) / (foot_b - neck_b); by = foot_s - a * foot_b
    pel_b = (base['RIGHT HIP'][0] + base['LEFT HIP'][0]) / 2
    ys = range(foot_s - 6, foot_s + 1); xs = [x for y in ys for x in range(N) if P[x, y][3]]
    bx = (min(xs) + max(xs)) / 2 - a * pel_b
    T = lambda q: (round(a * q[0] + bx, 1), round(a * q[1] + by, 1))
    f0 = {k: T(v) for k, v in base.items()}
    # 앞손 = 지팡이 칸 중 몸 칸에 닿은 것들의 가운데 (쥔 손)
    S = staff.load(); grip = [(x, y) for y in range(N) for x in range(N) if S[x, y][3] and any(P[x + i, y + j][3] for i in (-1, 0, 1) for j in (-1, 0, 1) if 0 <= x + i < N and 0 <= y + j < N)]
    if grip:
        gx = sum(p[0] for p in grip) / len(grip); gy = sum(p[1] for p in grip) / len(grip)
        sh = f0['RIGHT SHOULDER']; f0['RIGHT ARM'] = (round(gx, 1), round(gy, 1)); f0['RIGHT ELBOW'] = (round((sh[0] + gx) / 2 + 2, 1), round((sh[1] + gy) / 2 + 2, 1))
    return T, f0, a


def keys_of(frames, T):
    return [SK.kp({k: T(v) for k, v in p.items()}) for p in frames]


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def seq(part):
    M = SK.MOVES_B
    if part == 'A': return M['atkA'][:7] + M['atkB'][:7] + [(SK.to_b(SK.pose()), -80, None)]
    return M['cast'][:7] + M['walk'][:8]


def prep(cls, part, seed=71):
    d = os.path.join(HERE, 'skel', cls); os.makedirs(d, exist_ok=True)
    first, staff, off, sz = place(cls)
    first.save(os.path.join(d, 'first.png')); staff.save(os.path.join(d, 'staff.png'))
    T, base, scale = fit_keys(first, staff)
    fr = seq(part)
    body = {'description': DESC[cls], 'action': ACTION[part], 'direction': 'east', 'view': 'side', 'first_frame': b64(first),
            'first_frame_keypoints': SK.kp(base), 'keypoints': keys_of([p for p, a, b in fr], T), 'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(d, f'req-{part}.json'), 'w'), ensure_ascii=False)
    json.dump({'staff_deg': [a for p, a, b in fr], 'bowA': [b for p, a, b in fr], 'scale': scale, 'offset': off,
               'grip': [T(p['RIGHT ARM']) for p, a, b in fr]}, open(os.path.join(d, f'meta-{part}.json'), 'w'))
    # 겹침 확인: 첫 프레임 위에 기준 막대 인형
    S = 3; im = Image.new('RGBA', (N * S, N * S), (24, 26, 34, 255)); im.alpha_composite(first.resize((N * S, N * S), Image.NEAREST))
    dr = ImageDraw.Draw(im)
    for a_, b_ in SK.BONES:
        dr.line([(base[a_][0] * S, base[a_][1] * S), (base[b_][0] * S, base[b_][1] * S)], fill=(255, 120, 90) if 'RIGHT' in a_ + b_ else (90, 170, 255) if 'LEFT' in a_ + b_ else (240, 240, 240), width=3)
    for k, (x, y) in base.items(): dr.ellipse([x * S - 4, y * S - 4, x * S + 4, y * S + 4], outline=(255, 255, 0))
    im.crop((0, 40 * S, 150 * S, 185 * S)).save(os.path.join(d, 'fit.png'))
    tiles = [SK.stick({k: T(v) for k, v in p.items()}, a, S=2, staff=tuple(v * scale for v in SK.STAFF_B), head_r=15 * scale, crop=(0, 40, 192, 184)) for p, a, b in fr]
    mont = Image.new('RGBA', (tiles[0].width * len(tiles), tiles[0].height), (30, 32, 40, 255))
    for i, t in enumerate(tiles): mont.paste(t, (i * t.width, 0))
    mont.save(os.path.join(d, f'stick-{part}.png'))
    print(cls, part, 'frames', len(fr), 'offset', off, 'scale', round(scale, 2))


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


BONES = [('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'),
         ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'),
         ('NECK', 'RIGHT HIP'), ('NECK', 'LEFT HIP'), ('NECK', 'RIGHT SHOULDER'), ('NECK', 'LEFT SHOULDER')]


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


DARK_FILL = {'cryomancer': (24, 52, 112)}     # 망토 안쪽 검은 덩어리 → 직업색 어두운 단계 (비평 2026-10-17)


def dark_fill(body, col):
    B = body.load(); W, H = body.size
    dk = lambda c: c[3] and sum(c[:3]) < 120
    qs = [(x, y) for y in range(H) for x in range(W) if dk(B[x, y]) and all(0 <= x + i < W and 0 <= y + j < H and dk(B[x + i, y + j]) for i in (-1, 0, 1) for j in (-1, 0, 1))]
    for q in qs: B[q] = col + (255,)
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


def post(cls, part):
    """모델 프레임 → 96칸: 줄이기 → 모델이 그린 지팡이·이펙트 지우기(가는 선·떨어진 덩어리, staff_split) → 원래 지팡이 덧그리기(설계 손 점·각도)"""
    from wpn import WeaponSprite, overlay
    d = os.path.join(HERE, 'skel', cls); meta = json.load(open(os.path.join(d, f'meta-{part}.json')))
    first = down2(Image.open(os.path.join(d, 'first.png'))); stf = keep_big(down2(Image.open(os.path.join(d, 'staff.png'))))
    full = first.copy(); full.alpha_composite(stf)
    wcol = full.copy(); W_ = wcol.load(); S_ = stf.load()
    for y in range(stf.height):
        for x in range(stf.width):
            if S_[x, y][3]: W_[x, y] = (255, 0, 255, 255)
    F_ = first.load()
    glove = [(x, y) for y in range(stf.height) for x in range(stf.width) if F_[x, y][3] and any(0 <= x + i < stf.width and 0 <= y + j < stf.height and S_[x + i, y + j][3] for i in (-1, 0, 1) for j in (-1, 0, 1))]
    ws = WeaponSprite.from_capture(full, wcol, glove)
    if cls in CAP_STAFF:      # 기준 그림 지팡이가 너무 작은 직업: 게임 지팡이 캡처를 키 46 비율로 키워 쓴다
        sys.path.insert(0, HERE); import mannequin as MQ
        g0 = MQ.staff_sprite(cls, MQ.parts(cls)[1]); k = CAP_STAFF[cls]
        ws = WeaponSprite(g0.img.resize((round(g0.img.width * k), round(g0.img.height * k)), Image.NEAREST), (g0.grip[0] * k, g0.grip[1] * k), g0.ang)
    raw_d, out_d = os.path.join(d, f'{part}-raw'), os.path.join(d, f'{part}-wpn'); os.makedirs(raw_d, exist_ok=True); os.makedirs(out_d, exist_ok=True)
    outs = []; log = []; req = json.load(open(os.path.join(d, f'req-{part}.json')))
    fb, _ = staff_split_cls(cls, Image.open(os.path.join(HERE, 'design', 'final', f'{cls}.png')))
    PAL = {c[:3] for c in fb.get_flattened_data() if c[3]}          # 몸 팔레트 = 지팡이를 뺀 기준 그림 색 (모델 지팡이의 회색·노랑은 빠진다)
    WI = ws.img.load()
    ltip = max(((x - ws.grip[0]) * math.cos(ws.ang) + (y - ws.grip[1]) * math.sin(ws.ang)) for y in range(ws.img.height) for x in range(ws.img.width) if WI[x, y][3])
    n = len(meta['staff_deg']); order = list(range(7, n)) + list(range(7)) if part == 'B' else list(range(n))
    res = {}; tip_off = None     # 걷기 지팡이 끝 높이 (몸 정수리 기준) — 첫 걷기 프레임 값으로 고정 (비평: 걷는 동안 불꽃이 얼굴 높이로 출렁임)
    for i in order:
        im = down2(Image.open(os.path.join(HERE, 'work', cls, f'skel{part}-{i}.png')))
        im.save(os.path.join(raw_d, f'{i}.png'))
        pal = PAL
        env, KP = envelope(req['keypoints'][i], 96)
        body = snap(keep_big(body_of(pal_filter(im, pal, 40), env, KP), 0.05), pal)
        if cls in DARK_FILL: body = dark_fill(body, DARK_FILL[cls])
        g = KP['RIGHT ARM']; a = math.radians(meta['staff_deg'][i])        # 손 = 설계 관절 손 점 (모델은 관절을 따른다)
        g = snap_hand(body, g, KP['RIGHT ELBOW'])                          # 모델 손이 설계보다 짧거나 어긋나면 실제 팔 끝 칸으로
        ms = model_staff(im, body, g, meta['staff_deg'][i])
        if ms and math.cos(math.radians(ms[1] - meta["staff_deg"][i])) < 0.8: ms = None     # 37° 넘게 어긋나면 이펙트를 잘못 잰 것 → 설계 각도
        walk = part == 'B' and i >= 7
        if ms and not walk: a = math.radians(ms[1])                         # 각도만 모델 지팡이 축 (팔 자세와 맞게). 걷기는 설계 각도 고정 (비평: 걷기 중 지팡이 튐)
        if part == 'A' and i == 0: a = math.radians(meta['staff_deg'][-1])  # 14→0 이음새 (비평 2026-10-17)
        if part == 'B' and (walk or i <= 1):
            top = body.getbbox()[1]; ty = g[1] + ltip * math.sin(a)
            if tip_off is None: tip_off = ty - top
            elif abs(math.sin(a)) > 0.5:      # 손은 그대로, 쥔 자리만 자루 따라 밀어 끝 높이를 맞춘다
                dd = (top + tip_off - ty) / math.sin(a); g = (g[0] + dd * math.cos(a), g[1] + dd * math.sin(a))
        # 손 둘레의 뼈대 밖 불꽃색 = 모델 불덩이 잔재 (손 아래·뒤쪽 머리카락은 남긴다)
        Bq = body.load()
        for hk in ('RIGHT ARM', 'LEFT ARM'):
            hx, hy = KP[hk]
            for y in range(int(hy - 7), int(hy + 8)):
                for x in range(int(hx - 7), int(hx + 8)):
                    if 0 <= x < 96 and 0 <= y < 96 and (x, y) not in env and (x >= hx - 1 or y < hy - 1):
                        c = Bq[x, y]
                        if c[3] and c[0] > 200 and c[1] > 80 and c[2] < 120 and (x - hx) ** 2 + (y - hy) ** 2 <= 49: Bq[x, y] = (0, 0, 0, 0)
        log.append((i, ms and (round(ms[0][0]), round(ms[0][1]), round(ms[1])), round(meta['staff_deg'][i])))
        t = (g[0] + 20 * math.cos(a), g[1] + 20 * math.sin(a))
        B = body.load(); front = [(x, y) for y in range(body.height) for x in range(body.width) if B[x, y][3] and (x - g[0]) ** 2 + (y - g[1]) ** 2 <= 4]
        o = overlay(body, set(), g, t, ws, front=front)
        O = o.load(); B = body.load(); foot = body.getbbox()[3] - 1 if body.getbbox() else 88
        for y in range(int(foot) + 1, o.height):        # 지팡이가 땅(발바닥 선) 아래로 뚫지 않게
            for x in range(o.width):
                if O[x, y][3] and not B[x, y][3]: O[x, y] = (0, 0, 0, 0)
        o.save(os.path.join(out_d, f'{i}.png')); res[i] = (im, body, o)
    outs = [res[i] for i in range(n)]
    if part == 'A':        # 0번 = 14번 기준 자세 (반복 재생 이음새에서 지팡이가 튀지 않게, 비평 2026-10-17)
        outs[0] = (outs[0][0], outs[-1][1], outs[-1][2]); outs[-1][2].save(os.path.join(out_d, '0.png'))
    S = 3; W = 96 * S
    mont = Image.new('RGBA', (W * len(outs), W * 3), (24, 26, 34, 255))
    for i, row in enumerate(outs):
        for r, im in enumerate(row): mont.alpha_composite(im.resize((W, W), Image.NEAREST), (i * W, r * W))
    mont.save(os.path.join(d, f'post-{part}.png')); print('post', cls, part, len(outs)); [print(*r) for r in log]


if __name__ == '__main__':
    if sys.argv[1] == 'post': post(sys.argv[2], sys.argv[3]); sys.exit(0)
    cmd, cls, part = sys.argv[1], sys.argv[2], sys.argv[3]
    if cmd == 'prep': prep(cls, part)
