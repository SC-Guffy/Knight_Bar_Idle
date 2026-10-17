# 마법사 계열 시트 조립 (docs/specs/legacy-class-sheets.md): python -I build.py <cls> [--src DIR] [--out DIR]
#  입력: <src>/<동작>-<i>.png (96×96, 오른쪽 보기 — PixelLab 애니·ComfyUI 수리 결과를 골라 이 이름으로 둔다)
#        ref/<cls>.png = 지금 게임 그림 (전투 대기 컷, down.py 가 줄인 cap1-fight 를 복사 — 1칸 = 1px, 발 바닥 줄·발 가운데·팔레트의 기준)
#  핵심 5동작(idle·walk·atkA·atkB·cast)만 입력을 쓰고 나머지는 거기서 만든다 (스펙 "사용량 줄이기"):
#  자동 검사(check_frame): 몸과 떨어진 덩어리 — 작은 조각은 지우고, 큰 덩어리(떨어진 머리)가 있는 프레임은 이웃 프레임으로 바꾼다 (기준 그림의 후광·자락은 허용)
#    guard = idle 을 윗몸 1칸 낮춤 · hurt = idle 첫 장을 뒤로 밀기 · death = hurt 를 발끝 기준으로 뒤로 넘어뜨림 · sit 없음(게임이 예전 앉기를 쓴다)
#  출력: <out>/<cls>.png·.json (기본 src/sprites) + 미리보기 dev/sheets-mage/preview/<cls>.png (4배, hand 빨강·head 파랑)
#  hand = 지팡이 구슬 가운데 (평타가 나가는 자리·구슬 빛 자리, src/sprites.js sheetStaffGlow)
import os, sys, json, re
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
N = 96
FOOT = (44, 88)                  # 발 가운데·땅. 지팡이가 평타 때 발에서 앞으로 최대 47칸 → 앞 여백을 두려고 가운데보다 4칸 뒤
OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10

# 직업 → 지팡이 구슬 색 (src/classes.js WEAPONS[무기].staff.orb). 칸은 7종 모두 96 — 견습 지팡이도 평타·스킬 때 발에서 앞으로 41칸까지 나가 64칸(발 x 32)이면 잘린다
ORB = {'mage': '#9fd8ff', 'pyromancer': '#ff6a1f', 'cryomancer': '#9fe8ff', 'electromancer': '#b7e3ff',
       'archmage': '#ff3b1f', 'frostlord': '#cff6ff', 'thunderEmperor': '#fff2b0'}
# 동작 표: fps·반복·타격 프레임. cast 는 프레임마다 지팡이 기울기 bowA (스킬 자세의 bowA 와 가장 가까운 프레임을 고른다)
PLAN = {
    'idle': dict(fps=6, loop=True),
    'guard': dict(fps=6, loop=True),
    'walk': dict(fps=10, loop=True),
    'atkA': dict(fps=12, loop=False, hit=2),          # 원형 4프레임: 당김·겨눔(타격)·유지·복귀
    'atkB': dict(fps=12, loop=False, hit=2),
    'cast': dict(fps=10, loop=False),
    'hurt': dict(fps=12, loop=False),
    'death': dict(fps=8, loop=False),
}
ORDER = list(PLAN)


def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def pixels(im): return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())


def palette(ref):
    pal = sorted({c for c in pixels(ref) if c[3]})
    if OUT_C not in pal: pal.append(OUT_C)
    return pal


def tidy(im, pal, minc=10):
    """반투명 정리 → 팔레트 고정 → 작은 찌꺼기 제거 → 바깥 외곽선 #0b0d14."""
    im = im.convert('RGBA').copy(); w, h = im.size; px = im.load(); cache = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] < 128: px[x, y] = (0, 0, 0, 0); continue
            k = c[:3]
            if k not in cache: cache[k] = min(pal, key=lambda p: 3 * (p[0] - c[0]) ** 2 + 6 * (p[1] - c[1]) ** 2 + 2 * (p[2] - c[2]) ** 2)
            px[x, y] = cache[k]
    # 8방향 연결 덩어리 중 가장 큰 것보다 작고 minc 칸 미만이면 지운다
    seen, comps = set(), []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                st, comp = [(x, y)], []; seen.add((x, y))
                while st:
                    a, b = st.pop(); comp.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (a + dx, b + dy)
                            if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and px[q][3]: seen.add(q); st.append(q)
                comps.append(comp)
    if comps:
        big = max(len(c) for c in comps)
        for c in comps:
            if len(c) < big and len(c) < minc:
                for p in c: px[p] = (0, 0, 0, 0)
    edge = lambda x, y: any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    dark, lit = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and edge(x, y): (dark if lum(px[x, y]) < 70 else lit).append((x, y))
    for p in dark: px[p] = OUT_C
    add = set()
    for x, y in lit:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0: add.add((x + dx, y + dy))
    for p in add: px[p] = OUT_C
    return im


def shift(im, dx, dy):
    o = Image.new('RGBA', im.size); o.paste(im, (dx, dy)); return o


def feet(im):
    """발 바닥 줄과 그 줄의 발 가운데 x."""
    bb = im.getbbox(); px = im.load(); y = bb[3] - 1
    xs = [x for x in range(im.width) if px[x, y][3]]
    return (xs[0] + xs[-1]) // 2, y


def align(im, ref_feet, mode='feet'):
    fx, fy = feet(im)
    return shift(im, (ref_feet[0] - fx) if mode == 'feet' else 0, ref_feet[1] - fy)


def bob(im, cut, d):
    """cut 줄 위쪽을 d 칸 아래로 (숨쉬기·무게중심 낮추기)."""
    o = Image.new('RGBA', im.size)
    o.paste(im.crop((0, cut, im.width, im.height)), (0, cut))
    o.alpha_composite(im.crop((0, 0, im.width, cut)), (0, d))
    return o


def fall(im, ang, ref_feet):
    """발끝을 축으로 뒤(왼쪽)로 ang 도 넘어뜨린다. 넘어진 뒤 가장 낮은 줄을 땅에 맞춘다.
    넓은 캔버스에서 돌린 뒤, 지팡이가 칸 왼쪽 밖으로 나가면 칸 안에 들어오게 앞(오른쪽)으로 민다 (잘리지 않게)"""
    fx, fy = feet(im); W, H = im.size
    big = Image.new('RGBA', (W * 2, H * 2)); big.paste(im, (W // 2, H // 2))
    o = big.rotate(ang, resample=Image.NEAREST, center=(fx + W // 2, fy + H // 2), expand=False)
    bb = o.getbbox()
    if not bb: return Image.new('RGBA', im.size)
    dy = ref_feet[1] - (bb[3] - 1 - H // 2)
    dx = max(0, 1 - (bb[0] - W // 2))                                  # 왼쪽 끝이 칸 안(1칸 여백)
    out = Image.new('RGBA', im.size); out.paste(o.crop((W // 2 - dx, H // 2 - dy, W // 2 - dx + W, H // 2 - dy + H)), (0, 0))
    return out


def orb_pt(im, orb, foot_y):
    """구슬 가운데: 구슬 색에 가까운 칸 덩어리 중 가슴보다 앞에서 가장 앞·위인 것 (불꽃 머리·목도리처럼 같은 색인 칸은 빠진다). 없으면 가장 앞(오른쪽) 위 칸."""
    px = im.load(); oc = hexc(orb); hit = set()
    for y in range(0, foot_y - 6):
        for x in range(im.width):
            c = px[x, y]
            if c[3] and sum((c[i] - oc[i]) ** 2 for i in range(3)) < 3600: hit.add((x, y))
    fx, _ = feet(im); chest = (fx, foot_y - 22)
    best, bd = None, -1
    while hit:
        st = [hit.pop()]; comp = []
        while st:
            p = st.pop(); comp.append(p)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (p[0] + dx, p[1] + dy)
                    if q in hit: hit.remove(q); st.append(q)
        cx, cy = sum(p[0] for p in comp) / len(comp), sum(p[1] for p in comp) / len(comp)
        d = (cx - chest[0]) + 0.5 * (chest[1] - cy)               # 앞(오른쪽)·위일수록 — 지팡이는 앞손에 든다
        if len(comp) >= 2 and cx > chest[0] and d > bd: best, bd = [round(cx), round(cy)], d
    if best: return best
    bb = im.getbbox()
    for x in range(bb[2] - 1, bb[0] - 1, -1):
        ys = [y for y in range(bb[1], foot_y - 12) if px[x, y][3]]
        if ys: return [x, ys[0]]
    return [bb[2] - 1, bb[1]]


def head_pt(im):
    px = im.load(); bb = im.getbbox(); top = bb[1]
    # 지팡이(앞손)가 머리보다 높을 수 있으니, 몸 가운데(발 가운데 -8 ~ +5칸) 안에서 가장 높은 칸
    fx, _ = feet(im)
    for y in range(top, bb[3]):
        xs = [x for x in range(fx - 8, fx + 6) if 0 <= x < im.width and px[x, y][3]]
        if xs: return [sum(xs) // len(xs), y]
    return [fx, top]


def comps8(im):
    """8방향으로 이어진 덩어리들 (칸 목록) — 큰 것부터"""
    px = im.load(); W, H = im.size; seen = set(); out = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st, c = [(x, y)], []; seen.add((x, y))
                while st:
                    p = st.pop(); c.append(p)
                    for a in (-1, 0, 1):
                        for b in (-1, 0, 1):
                            q = (p[0] + a, p[1] + b)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and px[q][3]: seen.add(q); st.append(q)
                out.append(c)
    return sorted(out, key=len, reverse=True)


SMALL = 40          # 이보다 작은 떨어진 조각은 지운다 (외곽선 호·빛 찌꺼기). 크면 프레임을 버린다 (떨어진 머리 등)


def check_frame(im, ref_extra):
    """자동 검사 (로드맵 검수 ①②): 몸과 떨어진 덩어리.
    ref_extra = 기준 그림에서 몸과 원래 떨어져 있는 덩어리 크기 목록 (후광·목도리 자락) — 그만큼은 허용한다.
    → (고친 그림, 문제 목록). 문제에 'big' 이 있으면 그 프레임은 쓰지 않는다"""
    cs = comps8(im); extra = cs[1:]; allow = sorted(ref_extra, reverse=True)
    out = im.copy(); px = out.load(); issues = []
    for c in extra:
        # 기준 그림의 떨어진 덩어리와 크기가 비슷하면(±50%) 하나씩 허용
        hit = next((a for a in allow if 0.5 * a <= len(c) <= 1.5 * a), None)
        if hit is not None: allow.remove(hit); continue
        bb = (min(p[0] for p in c), min(p[1] for p in c), max(p[0] for p in c), max(p[1] for p in c))
        if len(c) < SMALL:
            for p in c: px[p] = (0, 0, 0, 0)
            issues.append(('small', len(c), bb))
        else:
            issues.append(('big', len(c), bb))
    return out, issues


def load_anim(src, name):
    fs = sorted((f for f in os.listdir(src) if re.fullmatch(rf'{name}-\d+\.png', f)), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    return [Image.open(os.path.join(src, f)).convert('RGBA') for f in fs]


def build(cls, src, out, cast_vals=None):
    ref = Image.open(os.path.join(HERE, 'ref', f'{cls}.png')).convert('RGBA')
    pal = palette(ref); rf = feet(tidy(ref, pal))          # 외곽선을 덧댄 뒤의 발 (프레임도 tidy 뒤에 맞춘다)
    T = lambda im, mode='feet': align(tidy(im, pal), rf, mode)
    A = {}
    for k in ('idle', 'walk', 'atkA', 'atkB', 'cast'):
        fr = load_anim(src, k)
        if not fr: sys.exit(f'{src}/{k}-*.png 가 없다')
        A[k] = [T(f, 'ground' if k == 'walk' else 'feet') for f in fr]
    # 자동 검사: 떨어진 덩어리 — 작은 것은 지우고, 큰 것(떨어진 머리 등)이 있는 프레임은 같은 동작의 이웃 프레임으로 바꾼다
    ref_extra = [len(c) for c in comps8(tidy(ref, pal))[1:]]
    pre_bad = set(json.load(open(os.path.join(src, '_bad.json')))) if os.path.exists(os.path.join(src, '_bad.json')) else set()   # 입히기의 머리-몸 연결 검사
    report = {}
    for k in list(A):
        fixed, bad = [], []
        for i, f in enumerate(A[k]):
            g, iss = check_frame(f, ref_extra)
            if f'{k}-{i}' in pre_bad: iss = iss + [('head-off', 0, None)]
            if iss: report[f'{k}{i}'] = iss
            fixed.append(g); bad.append(any(t in ('big', 'head-off') for t, n, bb in iss))
        good = [i for i, b in enumerate(bad) if not b]
        if not good: print(f'  [검사] {cls} {k}: 모든 프레임에 큰 떨어진 덩어리 — 그대로 둔다'); A[k] = fixed; continue
        A[k] = [fixed[i] if not bad[i] else fixed[min(good, key=lambda j: abs(j - i))] for i in range(len(fixed))]
    if report:
        print(f'  [검사] {cls}:', '; '.join(f"{k} " + ','.join(f'{t}{n}' for t, n, bb in v) for k, v in report.items()))
    i0 = A['idle'][0]
    waist = rf[1] - 12
    A['guard'] = [bob(f, waist, 1) for f in A['idle']]
    A['hurt'] = [shift(i0, -2, 0), shift(i0, -1, 0)]
    A['death'] = [A['hurt'][0]] + [fall(A['hurt'][0], a, rf) for a in (25, 50, 75, 90)]
    n = max(len(A[k]) for k in ORDER)
    sheet = Image.new('RGBA', (N * n, N * len(ORDER)))
    meta = {'w': N, 'h': N, 'foot': list(FOOT), 'anims': {}, 'pts': {}}
    for r, k in enumerate(ORDER):
        for i, f in enumerate(A[k]): sheet.alpha_composite(f, (N * i, N * r))
        m = {'row': r, 'frames': len(A[k]), **PLAN[k]}
        if 'hit' in m: m['hit'] = min(m['hit'], len(A[k]) - 1)
        if k == 'cast' and cast_vals: m['key'] = 'bowA'; m['val'] = cast_vals[:len(A[k])]
        meta['anims'][k] = m
        meta['pts'][k] = [orb_pt(f, ORB[cls], FOOT[1]) + head_pt(f) for f in A[k]]
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, f'{cls}.png'))
    with open(os.path.join(out, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {N}, "h": {N}, "foot": {json.dumps(list(FOOT))},\n "anims": {{\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["anims"][k])}' for k in ORDER))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["pts"][k])}' for k in ORDER))
        f.write('\n }\n}\n')
    # 미리보기
    S, L = 4, 90
    pv = Image.new('RGBA', (L + N * n * S, N * len(ORDER) * S), (20, 22, 29, 255))
    pv.alpha_composite(sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST), (L, 0))
    d = ImageDraw.Draw(pv)
    for r, k in enumerate(ORDER):
        d.text((4, r * N * S + 8), k, fill=(255, 220, 90)); d.text((4, r * N * S + 22), f"{len(A[k])}f", fill=(170, 170, 190))
        d.line([(L, r * N * S), (pv.width, r * N * S)], fill=(50, 52, 64))
        for i, p in enumerate(meta['pts'][k]):
            ox, oy = L + i * N * S, r * N * S
            d.rectangle([ox + p[0] * S, oy + p[1] * S, ox + p[0] * S + 3, oy + p[1] * S + 3], outline=(255, 60, 60))
            d.rectangle([ox + p[2] * S, oy + p[3] * S, ox + p[2] * S + 3, oy + p[3] * S + 3], outline=(80, 160, 255))
            d.line([(ox + (FOOT[0] - 2) * S, oy + (FOOT[1] + 1) * S), (ox + (FOOT[0] + 2) * S, oy + (FOOT[1] + 1) * S)], fill=(90, 90, 110))
    os.makedirs(os.path.join(HERE, 'preview'), exist_ok=True)
    pv.save(os.path.join(HERE, 'preview', f'{cls}.png'))
    print(cls, 'sheet', sheet.size, 'colors', len({c for c in pixels(sheet) if c[3]}))


# ── 관절 애니(skelgen.py, 2026-10-17) 시트: 3등신 키 46 · 칸 96 · 발 (33, 바닥 줄) ──
#  입력: skel/<cls>/A-wpn/0..14 (평타A 0~6 · 평타B 7~13 · 기준 자세 14), B-wpn/0..14 (시전 0~6 · 걷기 7~14), <A|B>-tips.json (지팡이 끝)
#  idle = 기준 자세에 숨쉬기(윗몸 1칸 내림) 4f · guard·hurt·death 는 위 build 와 같은 방식. 팔레트 다시 칠하기(tidy)는 하지 않는다 (새 그림 팔레트 유지)
#  hit: 평타A 3 (끝까지 뻗은 수평 겨눔) · 평타B 4 (앞 땅에 내리꽂음) — skel.py MOVES atkA/atkB 설계
SKEL_HIT = {'atkA': 3, 'atkB': 4}
SKEL_CAST = [-0.2, -0.2, -0.7, -1.4, -1.4, 0.7, 1.2]          # skel.py MOVES cast 의 bowA (cast 줄 key)
SKEL_CAST_DROP = {'frostlord': [1], 'thunderEmperor': [1, 2]}   # 3차 시전 시작 정지 프레임 (fix3 교체로 같은 그림, 비평 2026-10-17)


def build_skel(cls, out):
    d = os.path.join(HERE, 'skel', cls)
    fr = lambda p: [Image.open(os.path.join(d, f'{p}-wpn', f'{i}.png')).convert('RGBA') for i in range(15)]
    tp = lambda p: json.load(open(os.path.join(d, f'{p}-tips.json')))
    FA, FB, TA, TB = fr('A'), fr('B'), tp('A'), tp('B')
    base, tbase = FA[14], TA[14]
    bb = base.getbbox(); foot = (33, bb[3] - 1); waist = foot[1] - 16
    A = {'idle': [base, base, bob(base, waist, 1), bob(base, waist, 1)],
         'walk': FB[7:15], 'atkA': FA[0:7], 'atkB': FA[7:14], 'cast': FB[0:7]}
    T = {'idle': [tbase, tbase, [tbase[0], tbase[1] + 1], [tbase[0], tbase[1] + 1]],
         'walk': TB[7:15], 'atkA': TA[0:7], 'atkB': TA[7:14], 'cast': TB[0:7]}
    if os.path.exists(os.path.join(d, 'W-wpn', '7.png')):      # 걷기만 다시 뽑은 줄 (3차, 과장 걷기 8f)
        A['walk'] = [Image.open(os.path.join(d, 'W-wpn', f'{i}.png')).convert('RGBA') for i in range(8)]; T['walk'] = json.load(open(os.path.join(d, 'W-tips.json')))
    cast_val = list(SKEL_CAST); cast_fps = 10
    drop = SKEL_CAST_DROP.get(cls, [])
    if drop:      # 시전 시작의 같은 그림 프레임을 빼고, 줄 전체 시간은 그대로 (fps 를 줄인다)
        keep = [i for i in range(len(A['cast'])) if i not in drop]
        cast_fps = round(10 * len(keep) / len(A['cast'])); A['cast'] = [A['cast'][i] for i in keep]; T['cast'] = [T['cast'][i] for i in keep]; cast_val = [cast_val[i] for i in keep]
    A['guard'] = [bob(f, waist, 1) for f in A['idle']]; T['guard'] = [[t[0], t[1] + 1] for t in T['idle']]
    A['hurt'] = [shift(base, -2, 0), shift(base, -1, 0)]; T['hurt'] = [[tbase[0] - 2, tbase[1]], [tbase[0] - 1, tbase[1]]]
    A['death'] = [A['hurt'][0]] + [fall(A['hurt'][0], a, foot) for a in (25, 50, 75, 90)]; T['death'] = [T['hurt'][0]] * 5
    plan = dict(PLAN); plan['idle'] = dict(fps=4, loop=True); plan['guard'] = dict(fps=4, loop=True)
    plan['walk'] = dict(fps=10, loop=True); plan['atkA'] = dict(fps=16, loop=False, hit=SKEL_HIT['atkA'])
    plan['atkB'] = dict(fps=16, loop=False, hit=SKEL_HIT['atkB']); plan['cast'] = dict(fps=cast_fps, loop=False)
    n = max(len(A[k]) for k in ORDER)
    sheet = Image.new('RGBA', (N * n, N * len(ORDER)))
    meta = {'anims': {}, 'pts': {}}
    for r, k in enumerate(ORDER):
        for i, f in enumerate(A[k]): sheet.alpha_composite(f, (N * i, N * r))
        m = {'row': r, 'frames': len(A[k]), **plan[k]}
        if k == 'cast': m['key'] = 'bowA'; m['val'] = cast_val
        meta['anims'][k] = m
        # hand = 지팡이 끝(칸 안으로 자름) · head = 정수리
        meta['pts'][k] = [[max(0, min(N - 1, t[0])), max(0, min(N - 1, t[1]))] + head_pt(f) for f, t in zip(A[k], T[k])]
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, f'{cls}.png'))
    with open(os.path.join(out, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {N}, "h": {N}, "foot": {json.dumps(list(foot))},\n "anims": {{\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["anims"][k])}' for k in ORDER))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{k}": {json.dumps(meta["pts"][k])}' for k in ORDER))
        f.write('\n }\n}\n')
    S, L = 3, 90
    pv = Image.new('RGBA', (L + N * n * S, N * len(ORDER) * S), (20, 22, 29, 255))
    pv.alpha_composite(sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST), (L, 0))
    dr = ImageDraw.Draw(pv)
    for r, k in enumerate(ORDER):
        dr.text((4, r * N * S + 8), k, fill=(255, 220, 90)); dr.text((4, r * N * S + 22), f"{len(A[k])}f", fill=(170, 170, 190))
        dr.line([(L, r * N * S), (pv.width, r * N * S)], fill=(50, 52, 64))
        for i, p in enumerate(meta['pts'][k]):
            ox, oy = L + i * N * S, r * N * S
            dr.rectangle([ox + p[0] * S - 1, oy + p[1] * S - 1, ox + p[0] * S + 2, oy + p[1] * S + 2], outline=(255, 60, 60))
            dr.rectangle([ox + p[2] * S - 1, oy + p[3] * S - 1, ox + p[2] * S + 2, oy + p[3] * S + 2], outline=(80, 160, 255))
    os.makedirs(os.path.join(HERE, 'preview'), exist_ok=True)
    pv.save(os.path.join(HERE, 'preview', f'{cls}.png'))
    print(cls, 'sheet', sheet.size, 'foot', foot, 'colors', len({c for c in pixels(sheet) if c[3]}))


if __name__ == '__main__':
    a = sys.argv; cls = a[1]
    if '--skel' in a: build_skel(cls, a[a.index('--out') + 1] if '--out' in a else os.path.join(ROOT, 'src', 'sprites')); sys.exit(0)
    src = a[a.index('--src') + 1] if '--src' in a else os.path.join(HERE, 'work', cls, 'pick')
    out = a[a.index('--out') + 1] if '--out' in a else os.path.join(ROOT, 'src', 'sprites')
    vals = json.loads(a[a.index('--cast') + 1]) if '--cast' in a else None
    build(cls, src, out, vals)
