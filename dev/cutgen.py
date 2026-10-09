# -*- coding: utf-8 -*-
# 평타 컷(절충안) 손도트 레이어 굽기 라이브러리 — 무기 계열마다 dev/cuts/<계열>.py 가 이걸 불러 팔·다리 그림을 굽는다.
#
#  팔 ARMS[이름] = (E, H) 또는 { 'e': E, 'h': H, 'radii': (어깨, 팔꿈치, 손목), 'hand': 'fist'|'grip'|'open'|'none', 'light': (x, y) }
#     어깨(0,0) 기준 팔꿈치 E·손 H (칸, 아래 +y, 오른쪽을 본다). 팔꿈치는 한쪽으로만 접힌다: cross(윗팔, 아랫팔) <= 0 (어기면 경고)
#     뒷팔(빈손·몸 뒤)도 같은 규칙. 그림 글자: L 빛 · A 팔 · a 그늘 · S/s 장갑 (외곽선은 JS 가 두른다)
#  다리 LEGS[이름] = (G, (뒷 엉덩이, 무릎, 발목), (앞 엉덩이, 무릎, 발목)) — 골반 아래 가운데(0,0) 기준, 땅은 G 칸 아래, 발목은 G-1.5 쯤.
#     무릎은 앞으로 굽는다: cross(허벅지, 정강이) >= 0. LIFTED[이름] = 'back'|'front' 이면 그 발이 땅에서 뜬 부츠(앞코 처짐 없이 블록)
#  FIX[('arm'|'leg', 이름)] = [(x, y, 글자), …] — 구운 격자(외곽선 전)에 손으로 고친 칸. 다시 구워도 남는다
#
#  write_block(js 파일, 블록 이름, ARMS, LEGS, FIX, LIFTED) 은 그 파일 안의
#     // ── 컷 레이어 <블록 이름> (자동 생성 …) ──  …  // ── 컷 레이어 <블록 이름> 끝 ──
#  사이를 addCutSprites({...}, {...}); 로 바꾼다 (없으면 파일 끝에 붙인다). 이름은 계열 접두사를 붙여 겹치지 않게 (예: gs_windup)
import math, re

def seg_dist(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2))
    qx, qy = a[0] + dx * t, a[1] + dy * t
    return math.hypot(px - qx, py - qy), t, (px - qx, py - qy)

def raster_limb(pts, radii, light=(-0.55, -0.83), hi=0.3, lo=-0.38):
    cells = {}
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    for j in range(math.floor(min(ys)) - 3, math.ceil(max(ys)) + 3):
        for i in range(math.floor(min(xs)) - 3, math.ceil(max(xs)) + 3):
            cx, cy = i + 0.5, j + 0.5
            best = None
            for k in range(len(pts) - 1):
                d, t, o = seg_dist(cx, cy, pts[k], pts[k + 1])
                r = radii[k] + (radii[k + 1] - radii[k]) * t
                if best is None or d - r < best[0] - best[1]: best = (d, r, o)
            d, r, o = best
            if d <= r:
                dot = (o[0] * light[0] + o[1] * light[1]) / max(r, 0.01)
                cells[(i, j)] = 'L' if dot > hi else 'a' if dot < lo else 'A'
    return cells

def to_rows(cells):
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    rows = [['.'] * (x1 - x0 + 1) for _ in range(y1 - y0 + 1)]
    for (i, j), ch in cells.items(): rows[j - y0][i - x0] = ch
    return [''.join(r) for r in rows], (-x0, -y0)

def cross(o, a, b): return (a[0] - o[0]) * (b[1] - a[1]) - (a[1] - o[1]) * (b[0] - a[0])

HANDS = {
    'fist': ((-1, 'SSS'), (0, 'SSS'), (1, 'sSs')),     # 장갑 낀 주먹 (손 칸이 가운데)
    'grip': ((-1, 'SS.'), (0, 'SSS'), (1, 'sSs')),     # 자루를 감아쥔 손
    'open': ((-1, '.S.'), (0, 'SSS'), (1, '.s.')),     # 편 손 (활 시위·마법)
}

def make_arm(name, spec, fix=()):
    if isinstance(spec, dict):
        E, H = spec['e'], spec['h']; radii = spec.get('radii', (1.55, 1.3, 1.05)); hand = spec.get('hand', 'fist'); light = spec.get('light', (-0.55, -0.83))
    else:
        (E, H), radii, hand, light = spec, (1.55, 1.3, 1.05), 'fist', (-0.55, -0.83)
    S = (0.0, 0.0)
    c = cross(S, E, H)
    if c > 0.01: print(f'!! 팔 {name}: 팔꿈치가 반대로 꺾임 (cross={c:.2f})')
    cells = raster_limb([S, E, H], radii, light)
    hx, hy = math.floor(H[0]), math.floor(H[1])
    if hand in HANDS:
        for dy, row in HANDS[hand]:
            for dx, ch in zip((-1, 0, 1), row):
                if ch != '.': cells[(hx + dx, hy + dy)] = ch
    for (x, y, ch) in fix:
        if ch == '.': cells.pop((x, y), None)
        else: cells[(x, y)] = ch
    rows, (ox, oy) = to_rows(cells)
    return rows, [round(S[0] - 0.5 + ox, 2), round(S[1] - 0.5 + oy, 2)], [hx + ox, hy + oy]

def make_legs(name, spec, fix=(), lifted=None):
    G, back, front = spec
    cells = {}
    for side, (h, k, a) in (('back', back), ('front', front)):
        c = cross(h, k, a)
        if c < -0.01: print(f'!! 다리 {name}/{side}: 무릎이 뒤로 꺾임 (cross={c:.2f})')
        lc = raster_limb([h, k, a], [1.95, 1.7, 1.45], light=(-0.85, -0.5))
        mp = {'L': 'm', 'A': 'l', 'a': 'n'} if side == 'front' else {'L': 'p', 'A': 'p', 'a': 'q'}
        boot = 'k' if side == 'front' else 'j'
        ax, ay = a
        bc = {}
        for j in range(math.floor(ay) - 2, math.ceil(ay) + 3):
            for i in range(math.floor(ax) - 3, math.ceil(ax) + 4):
                cx, cy = i + 0.5, j + 0.5
                if lifted == side:
                    if ax - 1.6 <= cx <= ax + 1.6 and ay - 0.6 <= cy <= ay + 1.4: bc[(i, j)] = boot
                elif ax - 1.7 <= cx <= ax + 2.7 and ay - 0.6 <= cy <= G: bc[(i, j)] = boot
        layer = {key: mp[v] for key, v in lc.items()}
        layer.update(bc)
        for key in list(layer):
            if layer[key] == boot and (key[0], key[1] - 1) in layer and layer[(key[0], key[1] - 1)] != boot:
                layer[key] = 'K' if side == 'front' else 'j'
        if side == 'front':      # 앞다리와 맞닿는 뒷다리 칸은 외곽선으로 갈라 둔다
            for (i, j) in layer:
                for nx, ny in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if (nx, ny) in cells and cells[(nx, ny)] in 'pqj' and (nx, ny) not in layer: cells[(nx, ny)] = '#'
        cells.update(layer)
    cells = {k: v for k, v in cells.items() if k[1] < G}
    for (x, y, ch) in fix:
        if ch == '.': cells.pop((x, y), None)
        else: cells[(x, y)] = ch
    rows, (ox, oy) = to_rows(cells)
    return rows, [ox, oy], G

def bake_js(arms, legs, fix=None, lifted=None):
    fix = fix or {}; lifted = lifted or {}
    out = ['addCutSprites({']
    for name, spec in arms.items():
        rows, sh, hd = make_arm(name, spec, fix.get(('arm', name), ()))
        out.append(f"  {name}: {{ sh: [{sh[0]}, {sh[1]}], hd: [{hd[0]}, {hd[1]}], rows: [")
        out += [f"    '{r}'," for r in rows]
        out.append('  ] },')
    out.append('}, {')
    for name, spec in legs.items():
        rows, hip, G = make_legs(name, spec, fix.get(('leg', name), ()), lifted.get(name))
        out.append(f"  {name}: {{ hip: [{hip[0]}, {hip[1]}], g: {G}, rows: [")
        out += [f"    '{r}'," for r in rows]
        out.append('  ] },')
    out.append('});')
    return '\n'.join(out)

def preview(arms, legs, fix=None, lifted=None):
    fix = fix or {}; lifted = lifted or {}
    for name, spec in arms.items():
        rows, sh, hd = make_arm(name, spec, fix.get(('arm', name), ()))
        print(f'[팔 {name}] sh={sh} hd={hd}'); print('\n'.join(rows))
    for name, spec in legs.items():
        rows, hip, G = make_legs(name, spec, fix.get(('leg', name), ()), lifted.get(name))
        print(f'[다리 {name}] hip={hip} g={G}'); print('\n'.join(rows))

def write_block(path, block, arms, legs, fix=None, lifted=None):
    body = bake_js(arms, legs, fix, lifted)
    head = f'// ── 컷 레이어 {block} (자동 생성: dev/cutgen.py — 손으로 고칠 칸은 생성기의 FIX 에) ──'
    tail = f'// ── 컷 레이어 {block} 끝 ──'
    try: src = open(path, encoding='utf-8').read()
    except FileNotFoundError: src = "'use strict';\n"
    pat = re.compile(re.escape(f'// ── 컷 레이어 {block} (') + r'.*?' + re.escape(tail), re.S)
    blk = head + '\n' + body + '\n' + tail
    src = pat.sub(lambda m: blk, src) if pat.search(src) else src.rstrip('\n') + '\n\n' + blk + '\n'
    open(path, 'w', encoding='utf-8', newline='\n').write(src)
    print('wrote', path, block)
