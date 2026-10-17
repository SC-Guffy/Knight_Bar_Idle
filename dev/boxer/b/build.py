# 파이터 계열 새 그림체 시트 조립 → src/sprites/<cls>B.png·json (96칸). 켜기는 src/sprites.js SHEET_ON['<cls>B'] (기본 false) 또는 ?sheetsOn=<cls>B
#  입력: final/<cls>.png (기준 그림) · skel/<cls>/A/<i>.png (평타 묶음 15f, 96칸) · skel/<cls>/W/<i>.png (걷기 8f) · skel/<cls>/sit.png (있으면)
#  줄 (지금 파이터 시트와 같은 이름 — src/jobs/fighter-fx.js 가 부른다):
#   idle = 기준 그림 + 숨쉬기 · guard = 묶음 0번 + 숨쉬기 · walk 8 · dash = 걷기 2장 · atkA = 묶음 0~6 · atkB = 7~14
#   charge = 장전 프레임 · release = 타격 3장 · skillA·skillB = 직업별 타격 프레임 조합 · awaken(3차) · hurt·death 파생 · sit
#  주먹 직업의 잽: 모델이 먼 쪽 팔(앞손)을 그리지 않아 가드 그대로였다 → 스트레이트 타격 프레임의 뻗은 팔을 한 단 어둡게(먼 팔 명암),
#   짧게(스트레이트보다 4~9칸 덜) 가드 프레임 뒤에 깐다 (스크립트 수리, 로드맵 대안 "동작 미달 → 스크립트")
#  python -I -B dev/boxer/b/build.py <cls> [...]  → src/sprites/<cls>B.* + dev/boxer/b/preview/<cls>.png·gif
import os, sys, json
from PIL import Image, ImageDraw, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
N = 96; OUTC = (11, 13, 20, 255)
KIND = {'fighter': 'punch', 'striker': 'punch', 'champion': 'punch', 'kickboxer': 'kick', 'tempest': 'kick', 'qigong': 'palm', 'grandmaster': 'palm'}
TIER3 = {'champion', 'tempest', 'grandmaster'}


def ld(p): return Image.open(p).convert('RGBA')


def shift(im, dx, dy):
    o = Image.new('RGBA', im.size); o.paste(im, (dx, dy)); return o


def feet(im):
    bb = im.getbbox(); P = im.load(); y = bb[3] - 1
    xs = [x for x in range(im.width) if P[x, y][3]]
    return (xs[0] + xs[-1]) // 2, y


def bob(im, cut, d):
    o = Image.new('RGBA', im.size)
    o.paste(im.crop((0, cut, im.width, im.height)), (0, cut)); o.alpha_composite(im.crop((0, 0, im.width, cut)), (0, d))
    return o


def fall(im, ang, fy):
    fx, _ = feet(im); W, H = im.size
    big = Image.new('RGBA', (W * 2, H * 2)); big.paste(im, (W // 2, H // 2))
    o = big.rotate(ang, resample=Image.NEAREST, center=(fx + W // 2, fy + H // 2))
    bb = o.getbbox(); dy = fy - (bb[3] - 1 - H // 2); dx = max(0, 1 - (bb[0] - W // 2))
    out = Image.new('RGBA', im.size); out.paste(o.crop((W // 2 - dx, H // 2 - dy, W // 2 - dx + W, H // 2 - dy + H)), (0, 0))
    return out


def darker(c):
    return c if c == OUTC else (int(c[0] * 0.72), int(c[1] * 0.72), int(c[2] * 0.76), 255)


def arm_seg(hit, guard):
    """스트레이트 타격 프레임에서 가드보다 앞으로 나간 팔(아래팔·주먹) 칸 — 가장 앞 칸 높이 ±5줄"""
    gb = guard.getbbox(); P = hit.load(); hb = hit.getbbox()
    xr = hb[2] - 1; ys = [y for y in range(N) if P[xr, y][3]]; ay = sum(ys) // len(ys)
    seg = Image.new('RGBA', hit.size); S = seg.load()
    for y in range(ay - 5, ay + 6):
        for x in range(gb[2] - 6, N):
            if P[x, y][3]: S[x, y] = darker(P[x, y])
    return seg


def jab(base, seg, short):
    o = Image.new('RGBA', base.size); o.alpha_composite(shift(seg, -short, -1)); o.alpha_composite(base)    # 먼 팔은 몸 뒤
    return o


def keep_big(im):
    """pixen 결과의 떨어진 잔점 지우기 (가장 큰 덩어리의 5% 미만 덩어리)"""
    P = im.load(); W_, H_ = im.size; seen = set(); comps = []
    for y in range(H_):
        for x in range(W_):
            if (x, y) in seen or not P[x, y][3]: continue
            st = [(x, y)]; seen.add((x, y)); c = []
            while st:
                a, b = st.pop(); c.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (a + dx, b + dy)
                        if 0 <= q[0] < W_ and 0 <= q[1] < H_ and q not in seen and P[q][3]: seen.add(q); st.append(q)
            comps.append(c)
    big = max(len(c) for c in comps)
    for c in comps:
        if len(c) < big * 0.05:
            for q in c: P[q] = (0, 0, 0, 0)
    return im


GOLD = lambda c: c[3] and c[0] > 140 and c[2] < 120


def halo(f, first):
    """기준 그림(final, 바짝 자른 좌표)의 후광 고리 = 머리 둘레 금빛 칸 중 머리 왼쪽·위쪽 테 (x ≤ 7 · y ≤ 3 · 오른쪽 위 x ≥ 15·y ≤ 6) + 닿은 외곽선.
    후광 색이 피부색과 비슷해 색만으로는 못 가른다. 이 프레임 머리 위치로 옮겨 몸 뒤에 깐다"""
    fin = ld(os.path.join(HERE, 'final', 'grandmaster.png')); Q = fin.load(); x0, y0 = first.getbbox()[:2]
    ring = {(x, y) for y in range(0, 16) for x in range(fin.width) if GOLD(Q[x, y]) and (x <= 7 or y <= 3 or (x >= 15 and y <= 6))}
    g = Image.new('RGBA', f.size); G = g.load()
    for (x, y) in ring:
        G[x + x0, y + y0] = Q[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < fin.width and 0 <= q[1] < fin.height and Q[q][3] and sum(Q[q][:3]) < 90: G[q[0] + x0, q[1] + y0] = Q[q]
    hx, hy = head_pt(first); fx_, fy_ = head_pt(f)
    o = Image.new('RGBA', f.size); o.alpha_composite(shift(g, fx_ - hx, fy_ - hy)); o.alpha_composite(f)
    return o


def put_feet(im, fx, fy, by='feet'):
    """발 줄(맨 아래)을 fy 에, 발 가운데(또는 몸 상자 가운데) x 를 fx 에"""
    if by == 'box': bb = im.getbbox(); cx, cy = (bb[0] + bb[2]) // 2, bb[3] - 1
    else: cx, cy = feet(im)
    return shift(im, fx - cx, fy - cy)


def hand_pt(im, fy):
    """앞손: 가슴~어깨 높이 띠에서 가장 앞 칸 (기탄·평타가 나가는 자리)"""
    P = im.load()
    for x in range(N - 1, -1, -1):
        ys = [y for y in range(max(0, fy - 34), fy - 12) if P[x, y][3]]
        if ys: return [x, sum(ys) // len(ys)]
    return [N // 2, fy - 24]


def head_pt(im):
    P = im.load(); bb = im.getbbox(); fx, _ = feet(im)
    for y in range(bb[1], bb[3]):
        xs = [x for x in range(fx - 10, fx + 8) if 0 <= x < N and P[x, y][3]]
        if xs: return [sum(xs) // len(xs), y]
    return [fx, bb[1]]


def build(cls):
    d = os.path.join(HERE, 'skel', cls); kind = KIND[cls]
    A = [ld(os.path.join(d, 'A', f'{i}.png')) for i in range(15)]
    first = ld(os.path.join(d, 'first.png')).resize((N, N), Image.NEAREST)          # 192 → 96 (2배로 앉힌 기준 그림)
    fx, fy = feet(first); waist = fy - 18
    # 걷기: skeleton 걷기는 4종이 모두 등을 돌려 버리고(2026-10-17), pixen 키 자세 2장(왼발·오른발 앞)을 발 줄에 맞춰 들썩임과 번갈아 쓴다
    wk = [os.path.join(HERE, 'work', cls, f'walkK{k}-0.png') for k in (1, 2)]
    W = None
    if all(os.path.exists(p) for p in wk):
        k1, k2 = (put_feet(keep_big(ld(p)), fx, fy) for p in wk)
        W = [k1, bob(k1, waist, 1), k2, bob(k2, waist, 1)]
    if cls == 'grandmaster': A = [halo(f, first) for f in A]
    if cls == 'tempest':      # 비평(anim r1·r2 3.43 fix): 쌍갈래·망토가 몸을 덮어 부푼 프레임(면적 1086~1237, 보통 920~1050) → 이웃 정상 프레임
        A[4] = A[3]; A[5] = A[6]; A[11] = A[10]; A[13] = A[14]; A[12] = A[14]     # 모델이 관절 애니에서 후광을 빼먹음 → 기준 그림 후광을 머리 따라 뒤에
    R = {}
    R['idle'] = [first, first, bob(first, waist, 1), bob(first, waist, 1)]
    R['guard'] = [A[0], A[0], bob(A[0], waist, 1), bob(A[0], waist, 1)]
    R['walk'] = W or [first] * 2
    R['dash'] = [R['walk'][0], R['walk'][2]] if W else [A[9], A[10]]
    if kind == 'punch':
        seg = arm_seg(A[10], A[0])
        R['atkA'] = [A[0], A[1], jab(A[2], seg, 4), jab(A[3], seg, 4), jab(A[4], seg, 9), A[5], A[6]]
        R['atkB'] = A[7:15]
        R['charge'] = [A[8], A[8], A[7], A[8]]; R['release'] = [A[9], A[10], A[12]]
        R['skillA'] = [R['atkA'][2], A[10], R['atkA'][3], A[11]]                     # 연타 러시: 잽·스트레이트 번갈아
        R['skillB'] = [A[8], A[9], A[10], A[11]]                                      # 붕권: 장전 → 끝까지
        hitA, hitB = 2, 3
    elif cls == 'tempest' and os.path.exists(os.path.join(HERE, 'work', cls, 'kickR-0.png')):
        # 템페스트: skeleton 차기가 낮고 머리·망토가 뭉쳐 비평 3회 미달 → pixen 키 자세 3장(무릎 들기·앞차기·머리 높이 돌려차기, 왼쪽을 보고 나와 좌우 반전)
        kC, kF, kR = (put_feet(keep_big(ImageOps.mirror(ld(os.path.join(HERE, 'work', cls, f'{k}-0.png')))), fx, fy) for k in ('kickC', 'kickF', 'kickR'))
        R['atkA'] = [A[0], kC, kF, kF, kC, A[0], A[0]]; R['atkB'] = [A[0], A[8], kC, kR, kR, kC, A[0]]
        R['charge'] = [kC, kC, A[8], kC]; R['release'] = [kC, kR, kC]
        R['skillA'] = [kC, kF, kF, kC]; R['skillB'] = [ImageOps.mirror(A[0]), kR, ImageOps.mirror(A[9]), kR]
        hitA, hitB = 2, 3
    elif kind == 'kick':
        R['atkA'] = A[0:7]; R['atkB'] = A[7:11] + A[13:15] if cls == 'tempest' else A[7:15]     # 템페스트: 머리·망토가 뭉친 11·12번 뺀 짧은 판
        R['charge'] = [A[8], A[8], A[9], A[8]]; R['release'] = [A[9], A[10], A[12]]
        R['skillA'] = [A[1], A[2], A[3], A[4]]                                        # 돌진·날아 차기 (코드가 띄운다)
        R['skillB'] = [ImageOps.mirror(A[0]), A[10], ImageOps.mirror(A[9]), A[11]]   # 회전 발차기: 등 돌림 ↔ 차기
        hitA, hitB = 2, 3
    else:
        R['atkA'] = A[0:7]; R['atkB'] = A[7:15]
        R['charge'] = [A[8], A[9], A[8], A[9]]; R['release'] = [A[10], A[11], A[12]]
        R['skillA'] = [A[8], A[9], A[10], A[11]]                                      # 장풍: 모아서 두 손 밀기
        R['skillB'] = [A[8], A[9], A[9], A[8]]                                        # 기막: 모은 자세 유지
        hitA, hitB = 2, 3
    if cls in TIER3: R['awaken'] = [R['guard'][0], R['charge'][0], R['charge'][1], R['release'][1], R['release'][1], R['guard'][2]]
    R['hurt'] = [shift(first, -2, 0), shift(first, -1, 0)]
    R['death'] = [R['hurt'][0]] + [fall(R['hurt'][0], a, fy) for a in (25, 50, 75, 90)]
    sit = os.path.join(HERE, 'work', cls, 'sit-0.png')
    if os.path.exists(sit):
        st = put_feet(keep_big(ld(sit)), fx, fy, by='box'); R['sit'] = [st, bob(st, fy - 12, 1)]
    plan = {'idle': (4, True), 'guard': (6, True), 'walk': (6, True), 'dash': (12, True), 'atkA': (16, False), 'atkB': (16, False),
            'charge': (10, True), 'release': (12, False), 'skillA': (12, False), 'skillB': (12, False), 'awaken': (10, False),
            'hurt': (12, False), 'death': (8, False), 'sit': (2, True)}
    order = [k for k in plan if k in R]
    n = max(len(R[k]) for k in order)
    sheet = Image.new('RGBA', (N * n, N * len(order))); meta = {'anims': {}, 'pts': {}}
    for r, k in enumerate(order):
        for i, f in enumerate(R[k]): sheet.alpha_composite(f, (N * i, N * r))
        m = {'row': r, 'frames': len(R[k]), 'fps': plan[k][0], 'loop': plan[k][1]}
        if k in ('atkA', 'atkB', 'release'): m['hit'] = {'atkA': hitA, 'atkB': hitB, 'release': 1}[k]
        meta['anims'][k] = m
        meta['pts'][k] = [hand_pt(f, fy) + head_pt(f) for f in R[k]]
    out = os.path.join(ROOT, 'src', 'sprites')
    sheet.save(os.path.join(out, f'{cls}B.png'))
    with open(os.path.join(out, f'{cls}B.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {N}, "h": {N}, "foot": [{fx}, {fy}], "noLean": true,\n "anims": {{\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["anims"][k])}' for k in order))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["pts"][k])}' for k in order))
        f.write('\n }\n}\n')
    # 미리보기: 줄마다 프레임 (3배) + 평타 GIF
    pvd = os.path.join(HERE, 'preview'); os.makedirs(pvd, exist_ok=True)
    S, L = 2, 70; pv = Image.new('RGBA', (L + N * n * S, N * len(order) * S), (20, 22, 29, 255))
    pv.alpha_composite(sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST), (L, 0)); dr = ImageDraw.Draw(pv)
    for r, k in enumerate(order): dr.text((4, r * N * S + 8), f'{k} {len(R[k])}f', fill=(255, 220, 90))
    pv.save(os.path.join(pvd, f'{cls}.png'))
    for k in ('atkA', 'atkB', 'walk'):
        g = [Image.alpha_composite(Image.new('RGBA', (N, N), (40, 42, 52, 255)), f).crop((8, 20, 88, 92)).resize((240, 216), Image.NEAREST).convert('P', palette=Image.ADAPTIVE) for f in R[k]]
        g[0].save(os.path.join(pvd, f'{cls}-{k}.gif'), save_all=True, append_images=g[1:], duration=int(1000 / plan[k][0]) if k != 'walk' else 100, loop=0)
    print(cls, 'sheet', sheet.size, 'foot', (fx, fy), 'rows', order)


if __name__ == '__main__':
    for c in sys.argv[1:]: build(c)
