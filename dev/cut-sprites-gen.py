# -*- coding: utf-8 -*-
# 평타 컷(절충안)용 팔·다리 손도트 레이어 생성기.
#  관절 좌표(칸)를 컷마다 직접 정하고, 두께 있는 띠로 도트를 찍은 뒤 행 문자열로 구워 src/limbs.js 의 ARM_CUT·LEG_CUT 블록을 바꾼다.
#  결과 행은 그대로 손으로 고쳐도 되고, 고칠 칸은 아래 FIX 에 적어 두면 다시 구워도 남는다.
#  실행: python dev/cut-sprites-gen.py  (미리보기만: --dry)
import math, re, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ── 팔: 어깨(0,0) 기준 팔꿈치 E·손 H (칸, 아래가 +y, 오른쪽을 본다). 팔꿈치는 한쪽으로만 접힌다: cross(윗팔, 아랫팔) <= 0
ARMS = {
    # 앞팔 (무기를 쥔 팔)
    'rest':    ((0.2, 5.3),  (3.2, 8.6)),     # 늘어뜨린 채 검을 허리 앞에
    'raise':   ((1.0, 5.2),  (4.0, 0.8)),     # 팔꿈치 아래, 손을 어깨 높이 앞으로 — 검을 세워 든다
    'windup':  ((2.8, -6.0), (-0.4, -11.4)),   # 팔꿈치가 앞·위로 서고 손은 머리 위 — 칼날이 머리 뒤로 넘어간다
    'strike':  ((4.3, 2.6),  (9.4, 4.6)),     # 앞·아래로 쭉 — 내리찍음
    'follow':  ((3.0, 4.6),  (7.5, 7.4)),     # 더 낮게 흘러나감
    'recover': ((0.8, 5.2),  (4.6, 7.6)),     # 거두며 쉬는 자리로
    'lowBack': ((-3.0, 4.0), (-4.6, 8.8)),    # 허리 뒤로 내림 — 올려베기 예비
    'scoop':   ((4.6, -1.0), (9.0, -4.6)),    # 앞·위로 퍼올림
    'high':    ((2.0, -5.2), (3.0, -10.4)),   # 머리 위로 치켜듦
    'chamber': ((-3.0, 3.8), (1.4, 5.6)),     # 팔꿈치를 뒤로 당겨 검을 허리 옆에서 앞으로 겨눔
    'thrust':  ((5.2, 0.4),  (10.4, 0.8)),    # 어깨 높이로 쭉
    # 뒷팔 (빈손, 몸 뒤에서 한 단계 어둡게)
    'bRest':     ((-0.6, 5.2), (-0.9, 10.2)),
    'bGuard':    ((2.0, 4.6),  (5.4, 7.2)),    # 앞으로 내밀어 균형
    'bFling':    ((-4.4, 2.6), (-7.8, 6.0)),   # 내리찍을 때 뒤로 젖힘
    'bFlingHigh':((-4.6, 1.6), (-8.2, 4.2)),
    'bRecover':  ((-1.4, 5.0), (-2.6, 9.6)),
    'bPoint':    ((4.2, 1.6),  (8.8, 2.2)),    # 찌르기 예비: 빈손으로 적을 겨눔
    'bBack':     ((-4.4, -1.6), (-8.8, -2.2)), # 찌르기: 뒤로 뻗어 균형
}
# ── 다리: 골반 아래(0,0) 기준 엉덩이 h·무릎 k·발목 a. 땅은 G 칸 아래 (발목은 G-1.5). 무릎은 앞으로 굽는다: cross(허벅지, 정강이) >= 0
LEGS = {
    #            G     뒷다리 (h, k, a)                          앞다리 (h, k, a)
    'stand':   (7.0, ((-3.5, -0.5), (-3.6, 2.8), (-3.8, 5.5)), ((3.5, -0.5), (3.9, 2.8), (3.8, 5.5))),
    'set':     (7.0, ((-3.5, -0.5), (-4.0, 2.8), (-5.2, 5.5)), ((3.5, -0.5), (4.8, 2.8), (5.2, 5.5))),
    'load':    (6.5, ((-3.5, -0.5), (-1.6, 2.4), (-4.6, 5.0)), ((3.5, -0.5), (6.0, 2.3), (7.6, 5.0))),
    'lunge':   (5.5, ((-3.5, -0.5), (-5.6, 1.8), (-8.6, 4.0)), ((3.5, -0.5), (7.4, 0.9), (8.0, 4.0))),
    'lungeDeep':(5.0,((-3.5, -0.5), (-6.0, 1.4), (-10.0, 3.5)), ((3.5, -0.5), (8.0, 0.5), (8.8, 3.5))),
    'crouch':  (6.0, ((-3.5, -0.5), (-1.2, 1.9), (-4.6, 4.5)), ((3.5, -0.5), (6.6, 1.4), (5.6, 4.5))),
    'rise':    (7.5, ((-3.5, -0.5), (-3.2, 2.8), (-6.6, 4.4)), ((3.5, -0.5), (5.0, 3.0), (6.0, 6.0))),
    'recover': (6.8, ((-3.5, -0.5), (-3.8, 2.7), (-5.0, 5.3)), ((3.5, -0.5), (5.0, 2.6), (5.4, 5.3))),
}
LIFTED = {'rise': 'back'}       # 들린 발: 부츠 앞코가 아래로 처진다
FIX = {}                        # 손으로 고친 칸: { 'arm:이름' 또는 'leg:이름': [(x, y, 글자), …] } (외곽선 전 격자 기준)

def seg_dist(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2))
    qx, qy = a[0] + dx * t, a[1] + dy * t
    return math.hypot(px - qx, py - qy), t, (px - qx, py - qy)

def raster_limb(pts, radii, light=(-0.55, -0.83)):
    """pts 를 잇는 띠: 칸 중심이 반지름 안이면 칠한다. 빛 쪽 L, 가운데 A, 그늘 a"""
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
                cells[(i, j)] = 'L' if dot > 0.3 else 'a' if dot < -0.38 else 'A'
    return cells

def to_rows(cells, origin):
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    rows = [['.'] * (x1 - x0 + 1) for _ in range(y1 - y0 + 1)]
    for (i, j), ch in cells.items(): rows[j - y0][i - x0] = ch
    return [''.join(r) for r in rows], (origin[0] - x0, origin[1] - y0)

def cross(o, a, b): return (a[0] - o[0]) * (b[1] - a[1]) - (a[1] - o[1]) * (b[0] - a[0])

def make_arm(name):
    E, H = ARMS[name]
    S = (0.0, 0.0)
    c = cross(S, E, H)
    if c > 0.01: print(f'!! 팔 {name}: 팔꿈치가 반대로 꺾임 (cross={c:.2f})')
    cells = raster_limb([S, E, H], [1.55, 1.3, 1.05])
    hx, hy = math.floor(H[0]), math.floor(H[1])
    for dy, row in ((-1, 'SSS'), (0, 'SSS'), (1, 'sSs')):              # 장갑 낀 주먹 (손 칸이 가운데)
        for dx, ch in zip((-1, 0, 1), row): cells[(hx + dx, hy + dy)] = ch
    for (x, y, ch) in FIX.get('arm:' + name, []): cells[(x, y)] = ch
    rows, (ox, oy) = to_rows(cells, (0, 0))
    # 닻: 어깨 칸·손 칸 (칸 중심이 그 점) — limbs.js 가 외곽선 패딩만큼 +1 한다
    sh = [round(S[0] - 0.5 + ox, 2), round(S[1] - 0.5 + oy, 2)]
    hd = [hx + ox, hy + oy]
    return rows, sh, hd

def make_legs(name):
    G, back, front = LEGS[name]
    cells = {}
    for side, (h, k, a) in (('back', back), ('front', front)):
        c = cross(h, k, a)
        if c < -0.01: print(f'!! 다리 {name}/{side}: 무릎이 뒤로 꺾임 (cross={c:.2f})')
        lc = raster_limb([h, k, a], [1.95, 1.7, 1.45], light=(-0.85, -0.5))
        mp = {'L': 'm', 'A': 'l', 'a': 'n'} if side == 'front' else {'L': 'p', 'A': 'p', 'a': 'q'}
        boot = 'k' if side == 'front' else 'j'
        ax, ay = a
        lifted = LIFTED.get(name) == side
        bc = {}
        for j in range(math.floor(ay) - 2, math.ceil(ay) + 3):
            for i in range(math.floor(ax) - 3, math.ceil(ax) + 4):
                cx, cy = i + 0.5, j + 0.5
                if lifted:   # 들린 발: 발목 아래로 2칸, 앞코가 아래로
                    if ax - 1.6 <= cx <= ax + 1.6 and ay - 0.6 <= cy <= ay + 1.4: bc[(i, j)] = boot
                elif ax - 1.7 <= cx <= ax + 2.7 and ay - 0.6 <= cy <= G: bc[(i, j)] = boot
        if side == 'front':
            for key in list(cells):                     # 앞다리와 맞닿는 뒷다리 칸은 외곽선으로 갈라 둔다
                if cells[key] in 'pqj':
                    pass
        layer = {key: mp[v] for key, v in lc.items()}
        layer.update(bc)
        for key in list(layer):                          # 부츠 윗줄은 밝게
            if layer[key] == boot and (key[0], key[1] - 1) in layer and layer[(key[0], key[1] - 1)] != boot: layer[key] = 'K' if side == 'front' else 'j'
        if side == 'front':
            for (i, j), v in layer.items():
                for nx, ny in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if (nx, ny) in cells and cells[(nx, ny)] in 'pqj' and (nx, ny) not in layer: cells[(nx, ny)] = '#'
        cells.update(layer)
    # 땅 아래는 자른다
    cells = {k: v for k, v in cells.items() if k[1] < G}
    for (x, y, ch) in FIX.get('leg:' + name, []): cells[(x, y)] = ch
    rows, (ox, oy) = to_rows(cells, (0, 0))
    hip = [ox, oy]                                     # 골반 아래 가운데 (격자 모서리 기준)
    return rows, hip, G

def js_block():
    out = ["// ── 평타 컷 레이어 (절충안, dev/cut-sprites-gen.py 가 굽는다 — 이 블록 안은 손으로 고쳐도 되지만, 다시 구우면 FIX 에 적은 칸만 남는다) ──",
           "// ARM_CUT: 앞팔·뒷팔 그림 { sh 어깨 칸, hd 손 칸, rows } · LEG_CUT: 두 다리 그림 { hip 골반 아래 가운데(칸 모서리), g 땅까지 칸, rows }",
           "//  다리 글자: l/m/n 앞다리(가운데·빛·그늘) · p/q 뒷다리 · k/K 앞 부츠 · j 뒷 부츠",
           "const ARM_CUT = {"]
    for name in ARMS:
        rows, sh, hd = make_arm(name)
        out.append(f"  {name}: {{ sh: [{sh[0]}, {sh[1]}], hd: [{hd[0]}, {hd[1]}], rows: [")
        for r in rows: out.append(f"    '{r}',")
        out.append("  ] },")
    out.append("};")
    out.append("const LEG_CUT = {")
    for name in LEGS:
        rows, hip, G = make_legs(name)
        out.append(f"  {name}: {{ hip: [{hip[0]}, {hip[1]}], g: {G}, rows: [")
        for r in rows: out.append(f"    '{r}',")
        out.append("  ] },")
    out.append("};")
    out.append("// ── 평타 컷 레이어 끝 ──")
    return '\n'.join(out)

if __name__ == '__main__':
    for name in ARMS:
        rows, sh, hd = make_arm(name)
        print(f'[팔 {name}] sh={sh} hd={hd}'); print('\n'.join(rows))
    for name in LEGS:
        rows, hip, G = make_legs(name)
        print(f'[다리 {name}] hip={hip} g={G}'); print('\n'.join(rows))
    if '--dry' not in sys.argv:
        path = 'src/limbs.js'
        src = open(path, encoding='utf-8').read()
        block = js_block()
        if '// ── 평타 컷 레이어 (' in src:
            src = re.sub(r"// ── 평타 컷 레이어 \(.*?// ── 평타 컷 레이어 끝 ──", lambda m: block, src, flags=re.S)
        else:
            src = src.rstrip('\n') + '\n\n' + block + '\n'
        open(path, 'w', encoding='utf-8', newline='\n').write(src)
        print('wrote', path)
