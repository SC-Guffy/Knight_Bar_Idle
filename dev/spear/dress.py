# 창기사 계열 원형 마네킹·직업 입히기 (와이어프레임 방식 시험, PixelLab 0회). 검사 세션 dev/sheets-sword/ 의 부위 가르기·램프를 그대로 쓴다.
#  마네킹 = 장식 없는 검사 몸 + 창(96칸, 발 (24,84)) / 할버드(128칸, 발 (56,112)), 부위마다 다른 색 (sheets-sword mannequin.RAMP).
#  입히기 = 마네킹 프레임을 부위로 가른 뒤 머리·몸통 무늬·소품은 직업 그림에서 옮기고 나머지는 직업 부위 램프로 칠한다.
#  실루엣 바꾸기 (로드맵 결정 "생성 때 틀을 바꾼다"): 창기사 깃발 · 용기병 용비늘 어깨+날개꼴 망토 · 용황 왕관형 투구+큰 꼬리 장식 — FEAT 에 손 도트로.
#  입력: shots/<name>-<자세>-<full|noacc|nocape|nosh|wcol>.png (capture.js spearParts, 160칸 발 (80,140))
#  python -I dress.py   → out/dress/*.png, ../review/sheets-spear/mq-*.png · dress-*.png
import os, sys, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
SW = os.path.join(HERE, '..', 'sheets-sword')
sys.path.insert(0, SW)
sys.path.insert(0, os.path.join(HERE, '..', 'boxer', 'sheets'))
from parts import parts, lum, OUT_C, bands, diff_mask
from mannequin import RAMP
import importlib.util
_sp = importlib.util.spec_from_file_location('sw_dress', os.path.join(SW, 'dress.py')); _sw = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_sw)
classify, ramp_of, anchor, big, solid, palette_of = _sw.classify, _sw.ramp_of, _sw.anchor, _sw.big, _sw.solid, _sw.palette_of   # 검사 세션 dress.py (이름이 겹쳐 따로 불러온다)
from common import tidy
sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
from wpn import WeaponSprite, overlay, grip_tip, diff_pts, line_fit, near_line  # grip_tip: 직업 무기 그림 쪽 (from_capture)

CELL = {'spear': (128, (36, 112)), 'halberd': (128, (66, 112))}
ARCH = {'lancer': 'spear', 'dragoon': 'spear', 'dragonlord': 'spear', 'cavalier': 'spear', 'skyGeneral': 'spear',
        'halberdier': 'halberd', 'warlord': 'halberd'}
LINE = 'line'


def cap(name, pose, kind, arch):
    N, (fx, fy) = CELL[arch]
    im = Image.open(os.path.join(HERE, 'shots', f'{name}-{pose}-{kind}.png')).convert('RGBA')
    im = im.crop((80 - fx, 140 - fy, 80 - fx + N, 140 - fy + N)); px = im.load()
    for y in range(N):
        for x in range(N):
            c = px[x, y]; px[x, y] = c[:3] + (255,) if c[3] >= 160 else (0, 0, 0, 0)
    return im


def wpn_of(name, pose, arch):
    """무기 칸 = 무기 색만 바꿔 찍은 그림(wcol)과 다른 칸 (capture.js)"""
    a, b = cap(name, pose, 'noacc', arch), cap(name, pose, 'wcol', arch)
    A, B = a.load(), b.load(); o = Image.new('RGBA', a.size); O = o.load()
    for y in range(a.height):
        for x in range(a.width):
            if (A[x, y][3] or B[x, y][3]) and A[x, y] != B[x, y]: O[x, y] = (255, 0, 255, 255)
    return o


def body_of(full, wpn):
    """무기 칸을 뺀 몸"""
    b = full.copy(); B, P = b.load(), wpn.load()
    for y in range(b.height):
        for x in range(b.width):
            if P[x, y][3]: B[x, y] = (0, 0, 0, 0)
    return b


def mannequin(arch, pose):
    full, wpn = cap('mq-' + arch, pose, 'noacc', arch), wpn_of('mq-' + arch, pose, arch)
    F = full.load(); part = parts(full, body_of(full, wpn), wpn)
    o = Image.new('RGBA', full.size); O = o.load(); groups = {}
    for p, k in part.items(): groups.setdefault(k, []).append(p)
    for k, ps in groups.items():
        if k == 'line':
            for p in ps: O[p] = OUT_C
            continue
        ls = sorted(lum(F[p]) for p in ps); t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
        for p in ps:
            L = lum(F[p]); O[p] = RAMP[k][0 if L < t1 else 1 if L < t2 else 2] + (255,)
    return o


def weapon_axis(MP):
    """마네킹 프레임 부위 지도 → (지울 무기 칸, 손 점, 끝 점, 앞에 다시 그릴 손 칸) 또는 None.
    무기 칸: RANSAC 직선(line_fit) 가까운 칸 (생성 애니에선 투구 밝은 회색도 무기 색으로 섞인다).
    손 점: 몸통 가운데를 무기 직선에 내린 자리 ±10칸 안의 장갑 (손은 늘 몸 가까이 — 할버드 날 금 테두리가 장갑색이라 장갑만으론 틀린다).
    끝: 손에서 먼 쪽. 양 끝 거리가 비슷하면(차이 30% 미만) 날 때문에 폭이 넓은 쪽"""
    cand = [p for p, v in MP.items() if v[0] == 'blade']; glove = [p for p, v in MP.items() if v[0] == 'glove']
    torso = [p for p, v in MP.items() if v[0] == 'torso']
    c, d, inl = line_fit(cand) if len(cand) >= 6 else (None, None, [])
    if len(inl) < 6: return None
    T = lambda p: (p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1]
    P = lambda tt: (c[0] + d[0] * tt, c[1] + d[1] * tt)
    ts = [T(p) for p in inl]; t0, t1 = min(ts), max(ts)
    if torso:
        tc = T((sum(p[0] for p in torso) / len(torso), sum(p[1] for p in torso) / len(torso)))
    else:
        tc = (t0 + t1) / 2
    tc = max(t0, min(t1, tc))
    gl = [p for p in near_line(glove, c, d, 4, tc - 10, tc + 10)]
    tg = sum(T(p) for p in gl) / len(gl) if gl else tc
    d0, d1 = abs(tg - t0), abs(t1 - tg)
    if abs(d0 - d1) < 0.3 * (t1 - t0):
        wide = lambda te: sum(1 for p in near_line(cand + glove, c, d, 7, te - 10, te + 10) if abs((p[0] - c[0]) * d[1] - (p[1] - c[1]) * d[0]) > 1.5)
        te = t1 if wide(t1) >= wide(t0) else t0
    else:
        te = t1 if d1 > d0 else t0
    g, t = P(tg), P(te)
    a0, a1 = (te - 12, te + 2) if te > tg else (te - 2, te + 12)      # 끝쪽 12칸 = 창날·도끼날 (넓게 지운다)
    mask = set(near_line(cand, c, d, 2.5, t0 - 1, t1 + 1)) | set(near_line(cand, c, d, 7, a0, a1)) | set(near_line(glove, c, d, 7, a0, a1))
    # 손에서 끝 쪽으로 12칸 넘게 떨어진 직선 근처는 무기 자리 — 부위와 상관없이 지운다 (마네킹 날의 빨강·외곽선 조각이 남지 않게)
    lo, hi = (tg + 12, te + 3) if te > tg else (te - 3, tg - 12)
    mask |= set(near_line(list(MP), c, d, 7, lo, hi))
    gl = [p for p in glove if math.hypot(p[0] - g[0], p[1] - g[1]) <= 4 and p not in mask]
    return mask, g, t, gl


def dress(cls, M, ref_pose='guard'):
    """마네킹 프레임 M → cls 그림 (검사 세션 dress 를 칸·발 기준점만 바꿔 옮김)"""
    arch = ARCH[cls]; N = M.width
    full = cap('p-' + cls, ref_pose, 'noacc', arch); wpn = wpn_of('p-' + cls, ref_pose, arch)
    Cpx = full.load(); CP = parts(full, body_of(full, wpn), wpn)
    neck, belt, ground = bands(full)
    G = cap('p-' + cls, ref_pose, 'full', arch); Gpx = G.load()
    sh = solid(big(diff_mask(G, cap('p-' + cls, ref_pose, 'nosh', arch))), G)
    cape = big(diff_mask(G, cap('p-' + cls, ref_pose, 'nocape', arch))) - sh
    BP = classify(mannequin(arch, ref_pose)); MP = classify(M)
    ramps = {k: ramp_of([Cpx[p] for p, kk in CP.items() if kk == k]) for k in RAMP}
    for k in RAMP:
        if ramps[k] is None: ramps[k] = ramps['torso']
    ca = anchor({p: k for p, k in CP.items() if p[1] < neck}, 'helm', N)
    ba = anchor(BP, 'helm', N); ma = anchor(MP, 'helm', N) or ba
    off = (round(ma[0] - ba[0]), round(ma[1] - ba[1])); hoff = (round(ma[0] - ca[0]), round(ma[1] - ca[1]))
    inN = lambda p: 0 <= p[0] < N and 0 <= p[1] < N
    mv = lambda p, d: (p[0] + d[0], p[1] + d[1])
    o = Image.new('RGBA', (N, N)); O = o.load()
    for p in cape:
        q = mv(p, off)
        if inN(q) and q not in MP: O[q] = Gpx[p]
    for (x, y), (k, i) in MP.items():
        if k == LINE: O[x, y] = OUT_C; continue
        if k == 'helm': continue
        c = ramps[k][i]
        if k == 'torso':
            q = (x - off[0], y - off[1])
            if CP.get(q) == 'torso': c = Cpx[q]
        O[x, y] = c[:3] + (255,)
    for p in sh:
        q = mv(p, off)
        if inN(q) and MP.get(q, (None,))[0] not in ('blade', 'glove'): O[q] = Gpx[p]
    head = {p for p, k in CP.items() if p[1] < neck and k not in ('blade', LINE)}
    head |= {p for p, k in CP.items() if k == LINE and p[1] < neck + 1 and any((p[0] + a, p[1] + b) in head for a in (-1, 0, 1) for b in (-1, 0, 1))}
    # 목 위에 걸린 무기 조각(할버드 날·창끝)이 같이 옮겨지지 않게 가장 큰 덩어리(머리)만
    comps, left = [], set(head)
    while left:
        st = [left.pop()]; cp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); cp.add(q); st.append(q)
        comps.append(cp)
    head = max(comps, key=len) if comps else head
    for p in head:
        q = mv(p, hoff)
        if inN(q): O[q] = Cpx[p]
    # 후광 등 머리 위 소품: 전체와 noacc 의 차이 중 망토·방패가 아닌 것 (목 위) → 머리와 같이 옮긴다
    for p in big(diff_mask(G, full), 4) - sh - cape:
        q = mv(p, hoff)
        if p[1] < neck and inN(q) and not O[q][3]: O[q] = Gpx[p]
    pal = palette_of(G)
    # 무기 덧그리기 (사용자 결정 2026-10-16): 마네킹 모양 무기를 지우고 원래 직업 무기를 같은 손 점·각도로 얹는다 (dev/sheets-common/wpn.py)
    #  생성 애니는 색이 조금 바뀌어 투구 밝은 회색이 무기 색으로 섞인다 → 무기 칸은 RANSAC 직선(line_fit) 가까운 칸만, 옮긴 머리 칸은 빼고
    headq = {mv(p, hoff) for p in head}
    W = weapon_axis(MP)
    if W:
        mask, g, t, gl = W; mask -= headq
        # 떠 있는 무기 색 칸 (생성 애니가 넣은 이펙트 그림·반짝이): 무기 직선 밖이고 몸 칸에서 3칸 넘게 떨어진 것은 지운다
        body = {p for p, v in MP.items() if v[0] not in ('blade', LINE)} | headq
        for p in [p for p, v in MP.items() if v[0] in ('blade', LINE) and p not in mask and p not in headq]:
            if not any((p[0] + a, p[1] + b) in body for a in range(-3, 4) for b in range(-3, 4)): O[p] = (0, 0, 0, 0)
        ws = WeaponSprite.from_capture(full, cap('p-' + cls, ref_pose, 'wcol', arch), [p for p, k in CP.items() if k == 'glove'])
        o = overlay(o, mask, g, t, ws, front=[p for p in gl if p not in headq])
    return o, MP, pal, ramps


# ── 실루엣 바꾸기: 손 도트 (문자 → 색). 기준점: 투구 아랫줄 가운데(H), 몸통 뒤쪽 끝·어깨(S), 무기 끝(T) ──
def stamp(o, rows, x0, y0, cols, behind=False):
    O = o.load(); N = o.width
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.' or ch not in cols: continue
            x, y = x0 + i, y0 + j
            if not (0 <= x < N and 0 <= y < N): continue
            if behind and O[x, y][3]: continue
            O[x, y] = cols[ch]


def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def geo(MP):
    """부위 지도에서 기준점: 투구 (아랫줄 가운데·윗줄), 몸통 상자, 무기 끝"""
    pts = lambda k: [p for p, v in MP.items() if v[0] == k]
    helm, torso, blade = pts('helm'), pts('torso'), pts('blade')
    hb = max(y for _, y in helm); hrow = [x for x, y in helm if y == hb]
    tx0, tx1 = min(x for x, _ in torso), max(x for x, _ in torso); ty0, ty1 = min(y for _, y in torso), max(y for _, y in torso)
    tip = max(blade, key=lambda p: (p[0] - p[1] * 0.0)) if blade else None
    return dict(hx=(min(hrow) + max(hrow)) // 2, hy=hb, htop=min(y for _, y in helm), hx0=min(x for x, _ in helm), hx1=max(x for x, _ in helm),
                tx0=tx0, tx1=tx1, ty0=ty0, ty1=ty1, tip=tip, blade=blade)


def wpn_now(o, cls, pz):
    """덧그린 프레임에서 직업 무기 칸 (무기 색에 가까운 칸 중 몸 오른쪽 위) — 깃발 자리 찾기용"""
    W = Image.open(os.path.join(HERE, 'shots', f'p-{cls}-guard-full.png')).convert('RGBA')
    cols = {c[:3] for c in (W.get_flattened_data() if hasattr(W, 'get_flattened_data') else W.getdata()) if c[3]}
    full = cap('p-' + cls, 'guard', 'noacc', ARCH[cls]); wcol = cap('p-' + cls, 'guard', 'wcol', ARCH[cls])
    F = full.load(); wc = {F[p][:3] for p in diff_pts(full, wcol) if F[p][3]} - {OUT_C[:3]}
    O = o.load()
    return [(x, y) for y in range(o.height) for x in range(o.width) if O[x, y][3] and O[x, y][:3] in wc]


def feat_lancer(o, g, P):
    """창기사: 창날 바로 뒤 자루에 매단 제비꼬리 삼각 깃발 (녹색·금 줄) — 1차 창병의 표지"""
    if not g['blade']: return
    tx = max(x for x, _ in g['blade'])
    col = [y for x, y in g['blade'] if x == tx - 12] or [y for x, y in g['blade'] if x == tx - 11]
    if not col: return
    sx, sy = tx - 12, min(col)
    C = {'#': OUT_C, 'g': hexc(P['A']), 'd': hexc(P['a']), 'y': hexc(P['y'])}
    stamp(o, ['##########',
              '#gggggggg#',
              '#gyyyggggg#',
              '#gggggggg#',
              '#ddggggd#.',
              '#ddd#dddd#',
              '#dd#..#dd#',
              '##.....##.'], sx - 10, sy + 1, C)


def feat_dragoon(o, g, P):
    """용기병: 등 뒤로 솟은 날개꼴 망토 (막 사이 밝은 뼈대, 아래가 톱니) + 앞 어깨 용비늘 견갑 (밝은 비늘이 아래로 늘어짐)"""
    C = {'#': OUT_C, 'a': hexc(P['A']), 'A': hexc(P['y']), 'v': hexc(P['v'])}
    wing = ['..............##',
            '............##v#',
            '..........##AAA#',
            '........##AAaAA#',
            '......##aAaaAaA#',
            '....##aaAaaaAaa#',
            '..##aaaAaaaaAaa#',
            '.#aaaaAaaaaAaaa#',
            '#aaaaAaaaaAaaaa#',
            '#aaaA#aaaA#aaaa#',
            '.#aa#.#aa#.#aaa#',
            '..##...##...#aa#',
            '.............##.']
    stamp(o, wing, g['tx0'] - 12, g['ty0'] - 6, C, behind=True)
    scale = ['..####..',
             '.#AAAA#.',
             '#AaAAaA#',
             '#aAaaAa#',
             '.#a#a#a#',
             '..#.#.#.']
    # 앞 어깨 = 몸통 앞 끝이지만 팔을 뻗은 자세에선 몸통 칸이 팔까지 이어지므로 투구 앞 끝 + 2 를 넘지 않게
    stamp(o, scale, min(g['tx1'], g['hx1'] + 2) - 5, g['ty0'] - 3, C)


def feat_dragonlord(o, g, P):
    """용황: 투구 위 왕관(뾰족 5개, 금) + 투구 뒤에서 허리 아래까지 늘어진 큰 꼬리 장식(분홍 갈기, 끝이 갈라짐)"""
    C = {'#': OUT_C, 'n': hexc(P['n']), 'v': hexc(P['v']), 'y': hexc(P['y'])}
    crown = ['#...#...#...#',
             'n#.#n#.#n#.#n',
             'nn#nnn#nnn#nn',
             'nnnnnnvnnnnnn',
             '#nnnnnnnnnnn#']
    stamp(o, crown, g['hx'] - 7, g['htop'] - 4, C)
    tail = ['.....###..',
            '....#vvv#.',
            '...#vyyv#.',
            '..#vvyvv#.',
            '..#vvvv#..',
            '.#vvyv#...',
            '.#vvvv#...',
            '#vvyv#....',
            '#vvvv#....',
            '#vvyv#....',
            '#vvvv#....',
            '.#vvyv#...',
            '.#vvvv#...',
            '..#vvv#...',
            '..#v#v#...',
            '.#v#.#v#..',
            '.##...##..']
    stamp(o, tail, g['hx0'] - 8, g['htop'] - 1, C, behind=True)


FEAT = {'lancer': feat_lancer, 'dragoon': feat_dragoon, 'dragonlord': feat_dragonlord}


def outline_out(o):
    """칠한 칸 바깥 빈 칸에 외곽선"""
    o = o.copy(); O = o.load(); N = o.width; add = []
    for y in range(N):
        for x in range(N):
            if O[x, y][3]: continue
            if any(0 <= x + a < N and 0 <= y + b < N and O[x + a, y + b][3] and O[x + a, y + b] != OUT_C for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for p in add: O[p] = OUT_C
    return o


if __name__ == '__main__':
    sys.path.insert(0, os.path.join(HERE, '..', '..', 'src'))
    import json, re
    # 직업 팔레트 (classes.js look.pal) — 손 도트 색
    src = open(os.path.join(HERE, '..', '..', 'src', 'classes.js'), encoding='utf-8').read()
    def pal(cls):
        m = re.search(r'\n  ' + cls + r': \{.*?pal: \{([^}]*)\}', src, re.S)
        return dict(re.findall(r"(\w): '(#[0-9a-fA-F]{6})'", m.group(1)))
    od = os.path.join(HERE, 'out', 'dress'); os.makedirs(od, exist_ok=True)
    rv = os.path.join(HERE, '..', 'review', 'sheets-spear'); os.makedirs(rv, exist_ok=True)
    den = float(sys.argv[1]) if len(sys.argv) > 1 else 0
    POSES = ['guard', 'idle', 't15', 't30', 't45', 't70']
    for arch in ('spear', 'halberd'):
        for pz in POSES:
            mannequin(arch, pz).save(os.path.join(od, f'mq-{arch}-{pz}.png'))
    for cls in ARCH:
        P = pal(cls)
        for pz in POSES:
            M = mannequin(ARCH[cls], pz)
            o, MP, pl, ramps = dress(cls, M)
            o = tidy(o, pl, minc=6)
            o.save(os.path.join(od, f'{cls}-{pz}-d0.png'))
            if cls in FEAT:
                g = geo(MP); g['blade'] = wpn_now(o, cls, pz); f = o.copy(); FEAT[cls](f, g, P); f = outline_out(f)
                f.save(os.path.join(od, f'{cls}-{pz}-new.png'))
        cap('p-' + cls, 'guard', 'full', ARCH[cls]).save(os.path.join(od, f'{cls}-orig.png'))
    print('ok', od)
    # 검토 페이지 그림: 마네킹 (대기·임시 평타 자세), 전(지금)·후(실루엣 바꿈) 컬러·흑백·실루엣 줄
    from PIL import ImageOps
    def tile(im, arch, mode, W=128):
        N, (fx, fy) = CELL[arch]
        if mode == 'gray':
            a = im.split()[3]; im = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); im.putalpha(a)
        elif mode == 'sil':
            a = im.split()[3]; im = Image.new('RGBA', im.size, (230, 232, 240, 255)); im.putalpha(a)
        b = Image.new('RGBA', (W, 100), (32, 34, 44, 255)); b.paste(im, (40 - fx, 92 - fy), im); return b
    def row(tiles, out, Z=3):
        r = Image.new('RGBA', (len(tiles) * 130, 100), (20, 22, 29, 255))
        for i, t in enumerate(tiles): r.alpha_composite(t, (i * 130, 0))
        r.resize((r.width * Z, r.height * Z), Image.NEAREST).save(os.path.join(rv, out))
    for arch in ('spear', 'halberd'):
        row([tile(Image.open(os.path.join(od, f'mq-{arch}-{pz}.png')), arch, 'color') for pz in POSES], f'mq-{arch}.png')
    trio = ['lancer', 'dragoon', 'dragonlord']
    for mode in ('color', 'gray', 'sil'):
        row([tile(cap('p-' + c, 'guard', 'full', 'spear'), 'spear', mode) for c in trio] +
            [tile(Image.open(os.path.join(od, f'{c}-guard-new.png')), 'spear', mode) for c in trio], f'sil3-guard-{mode}.png')
        row([tile(cap('p-' + c, 'idle', 'full', 'spear'), 'spear', mode) for c in trio] +
            [tile(Image.open(os.path.join(od, f'{c}-idle-new.png')), 'spear', mode) for c in trio], f'sil3-idle-{mode}.png')
    for c in trio:
        row([tile(Image.open(os.path.join(od, f'mq-spear-{pz}.png')), 'spear', 'color') for pz in POSES[2:]] +
            [tile(Image.open(os.path.join(od, f'{c}-{pz}-new.png')), 'spear', 'color') for pz in POSES[2:]], f'dress-{c}.png', Z=2)
    for c in ('halberdier', 'warlord', 'cavalier', 'skyGeneral'):
        a = ARCH[c]
        row([tile(cap('p-' + c, 'guard', 'full', a), a, 'color')] + [tile(Image.open(os.path.join(od, f'{c}-{pz}-d0.png')), a, 'color') for pz in POSES], f'dress-{c}.png', Z=2)
    print('review', rv)
