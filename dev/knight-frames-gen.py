# -*- coding: utf-8 -*-
# 검사 전신 프레임 생성기: 머리·몸통·망토·다리·팔을 프레임마다 자리 잡아 한 장으로 찍는다.
#  망토는 항상 어깨에 붙어 있고, 뒷팔은 몸 뒤에서 균형을 잡고, 앞팔은 어깨-팔꿈치-손 폴리라인으로 두껍게 긋는다.
import math, json, sys
W, H = 52, 34

def blank(): return [['.'] * W for _ in range(H)]
def setc(g, x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch
def put(g, x, y, rows):
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '.': setc(g, x + c, y + r, ch)

def limb(g, pts, chars, w=3):
    """폴리라인을 두께 w 로 긋는다. 세로에 가까우면 가로 스팬(chars 좌→우), 가로에 가까우면 세로 스팬(chars 위→아래)"""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        n = max(abs(dx), abs(dy), 1)
        for i in range(n + 1):
            t = i / n; x = round(x0 + dx * t); y = round(y0 + dy * t)
            if abs(dy) >= abs(dx):
                for k in range(w): setc(g, x - w // 2 + k, y, chars[k])
            else:
                for k in range(w): setc(g, x, y - w // 2 + k, chars[k])

def hand(g, x, y, front=True):
    put(g, x - 1, y - 1, ['SSS', 'SGS', 'sSs'] if front else ['ss', 'ss'])

def blade(g, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    n = max(abs(dx), abs(dy), 1)
    cells = []
    for i in range(n + 1):
        t = i / n; cells.append((round(x0 + dx * t), round(y0 + dy * t)))
    horiz = abs(dx) >= abs(dy)
    for i, (x, y) in enumerate(cells):
        tip = i >= n - 1
        setc(g, x, y, 'w' if tip else 'W')
        if not tip:
            if horiz: setc(g, x, y + 1, 'w')
            else: setc(g, x + 1, y, 'w')

def arc(g, cx, cy, r, a0, a1, ch='m', band=0.9):
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.': continue
            d = math.hypot(x - cx, y - cy)
            if abs(d - r) > band: continue
            a = math.degrees(math.atan2(y - cy, x - cx))
            if a0 <= a <= a1: g[y][x] = ch

def bands(g, spec, ch='c'):
    for y, x0, x1 in spec:
        for x in range(x0, x1 + 1): setc(g, x, y, ch)

def head(tilt=0):
    rows = ['..hhhhhh..', '.hHHHHHHh.', 'hHHHHHHHHh', 'hHHHHHHHHh', 'hHHHHHHHHh', 'hHHHHHHHHh', 'hHHHHHHHHh', '.hhhhhhhh.']
    rows[4 + tilt] = 'hHvvvvvvHh'
    feather = {-1: ['..rr......', '..rrr.....'], 0: ['....rr....', '...rrr....'], 1: ['.....rr...', '....rrr...']}[tilt]
    return feather + rows

TORSO = ['aaAATTTAAaa', 'aAAATTTAAAa', 'aAAATTTAAAa', 'aAAATyTAAAa', 'aAAATTTAAAa', 'aAAATTTAAAa', 'aAAATTTAAAa', 'aAAATTTAAAa', '.aAATTTAAa.']
BELT = ['.bbbbyybbb.', '.bbbbyybbb.']
PELV = ['.aAAAAAAAa.', '.aAAAAAAAa.']

def torso(g, x, y, lean=0, rows=TORSO):
    n = len(rows)
    for i, row in enumerate(rows):
        off = int(round(lean * (n - 1 - i) / (n - 1))) if lean else 0
        put(g, x + off, y + i, [row])

def leg(g, pts, front):
    limb(g, pts, 'lll')
    fx, fy = pts[-1]
    put(g, fx - 1 if front else fx - 2, fy + 1, ['kkkkk', 'kkkkk'] if front else ['kkkk', 'kkkk'])

def separate(g, arm_cells):
    """앞팔이 몸통 위를 지날 때 팔 둘레의 몸통 칸을 외곽선으로 바꿔 팔이 따로 읽히게 한다"""
    body = set('aATyb')
    for (x, y) in arm_cells:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and g[ny][nx] in body: g[ny][nx] = '#'

def arm_cells(g):
    return [(x, y) for y in range(H) for x in range(W) if g[y][x] in 'LEe']

CAPE_IDLE = ['.....cc', '....ccc', '...cccc', '...cccc', '..ccccc', '..ccccc', '.cccccc', '.cccccc', 'ccccccc', 'ccccccc', 'ccccccc', '.ccccc.', '..ccc..']
CAPE_BACK = ['......cc', '.....ccc', '....cccc', '....cccc', '...ccccc', '...ccccc', '..cccccc', '..cccccc', '.ccccccc', '.ccccccc', 'ccccccc.', '.cccccc.', '..cccc..']
CAPE_FLY = ['.cccc.......', 'ccccccc.....', 'cccccccc....', '.cccccccc...', '...cccccccc.', '.....ccccccc', '.......ccccc', '.......cccc.', '........ccc.', '.........cc.']
CAPE_DROP = ['cc...........', 'cccc.........', '.ccccc.......', '...cccccc....', '.....ccccccc.', '.......cccccc', '......ccccc..', '....ccccc....', '...cccc......', '..ccc........']
CAPE_STREAM = ['.......ccc......', '....cccccccc....', '..cccccccccccccc', 'ccccccc..ccccc..', '.cccc.....cc....']

FRAMES = []
def frame(name, build):
    g = blank(); build(g); FRAMES.append((name, [''.join(r) for r in g]))

# 0 서기
def f_idle(g):
    put(g, 5, 14, CAPE_IDLE)
    limb(g, [(11, 15), (11, 22)], 'ede'); hand(g, 11, 23, False)
    leg(g, [(14, 26), (14, 31)], False); leg(g, [(20, 26), (20, 31)], True)
    put(g, 12, 25, PELV); put(g, 12, 23, BELT); torso(g, 12, 14)
    put(g, 12, 4, head(0))
    limb(g, [(24, 14), (24, 19), (27, 23)], 'LEe'); hand(g, 27, 24)
    blade(g, 29, 24, 40, 19)
frame('서기', f_idle)

# 1 들기: 검을 세워 얼굴 옆까지 올린다
def f_raise(g):
    put(g, 5, 14, CAPE_IDLE)
    limb(g, [(11, 15), (10, 22)], 'ede'); hand(g, 10, 23, False)
    leg(g, [(14, 26), (13, 31)], False); leg(g, [(20, 26), (21, 31)], True)
    put(g, 12, 25, PELV); put(g, 12, 23, BELT); torso(g, 12, 14, -1)
    put(g, 11, 4, head(0))
    limb(g, [(24, 14), (24, 20), (28, 16)], 'LEe'); hand(g, 28, 15)
    blade(g, 28, 13, 28, 2); setc(g, 28, 17, 'n')
frame('들기', f_raise)

# 2 내려베기 예비: 몸을 젖히고 고개를 들어 검을 머리 뒤로 넘긴다, 무게는 뒷발
def f_windup(g):
    put(g, 3, 14, CAPE_BACK)
    limb(g, [(10, 15), (9, 22)], 'ede'); hand(g, 9, 23, False)
    leg(g, [(14, 26), (12, 29), (11, 31)], False); leg(g, [(20, 26), (21, 29), (22, 31)], True)
    put(g, 12, 25, PELV); put(g, 12, 23, BELT); torso(g, 12, 14, -1)
    put(g, 11, 4, head(-1))
    limb(g, [(22, 14), (24, 9), (21, 6)], 'LEe'); hand(g, 21, 5)
    blade(g, 19, 4, 11, 0)
frame('내려베기 예비', f_windup)

# 3 내려베기 타격: 앞발을 크게 내디디며 몸을 숙여 내리찍는다, 망토가 뒤로 솟고, 지나온 자리에 스미어
def f_strike(g):
    bands(g, [(12, 7, 11), (13, 4, 12), (14, 3, 13), (15, 4, 14), (16, 6, 14), (17, 8, 13), (18, 10, 13), (19, 11, 12)])
    limb(g, [(14, 16), (8, 20)], 'ede'); hand(g, 7, 21, False)
    leg(g, [(16, 27), (11, 29), (8, 31)], False); leg(g, [(22, 27), (25, 29), (26, 31)], True)
    put(g, 14, 25, PELV); put(g, 14, 23, BELT); torso(g, 13, 15, 2, TORSO[:4] + TORSO[5:])
    put(g, 15, 5, head(1))
    limb(g, [(26, 15), (31, 21)], 'LEe'); hand(g, 31, 22)
    blade(g, 33, 22, 44, 26)
    arc(g, 31, 22, 13.2, -95, 12, band=0.55)
frame('내려베기 타격', f_strike)

# 4 팔로스루: 더 낮게 웅크리고 검이 낮게 흘러나간다, 망토가 등 뒤로 떨어진다
def f_follow(g):
    bands(g, [(14, 5, 8), (15, 4, 10), (16, 4, 12), (17, 5, 15), (18, 6, 13), (19, 7, 11), (20, 8, 10)])
    limb(g, [(15, 18), (10, 22)], 'ede'); hand(g, 9, 23, False)
    leg(g, [(17, 28), (8, 31)], False); leg(g, [(23, 28), (25, 30), (26, 31)], True)
    put(g, 15, 26, PELV); put(g, 15, 24, BELT); torso(g, 14, 17, 2, TORSO[:3] + TORSO[5:])
    put(g, 16, 7, head(1))
    limb(g, [(27, 17), (29, 24)], 'LEe'); hand(g, 30, 25)
    blade(g, 32, 25, 45, 27)
    arc(g, 30, 25, 13.5, -32, 2, band=0.5)
frame('팔로스루', f_follow)

# 5 찌르기 예비: 옆으로 돌아 몸통이 좁고, 팔꿈치를 뒤로 당겨 검을 허리 옆에서 앞으로 겨눈다
def f_tprep(g):
    put(g, 3, 14, CAPE_BACK)
    limb(g, [(11, 15), (10, 22)], 'ede'); hand(g, 10, 23, False)
    leg(g, [(14, 26), (12, 29), (11, 31)], False); leg(g, [(20, 26), (21, 29), (22, 31)], True)
    put(g, 12, 25, PELV); put(g, 12, 23, BELT); torso(g, 13, 14, -1, [r[1:-1] for r in TORSO])
    put(g, 11, 4, head(0))
    limb(g, [(21, 14), (19, 20), (24, 22)], 'LEe'); separate(g, arm_cells(g)); hand(g, 24, 22)
    blade(g, 26, 22, 39, 22)
frame('찌르기 예비', f_tprep)

# 6 찌르기: 깊은 런지로 몸이 낮고 앞으로, 팔을 어깨 높이로 쭉 뻗고, 망토가 뒤로 수평으로 날린다
def f_thrust(g):
    put(g, 2, 14, CAPE_STREAM)
    limb(g, [(18, 17), (12, 20)], 'ede'); hand(g, 11, 21, False)
    leg(g, [(19, 27), (9, 31)], False); leg(g, [(25, 27), (29, 29), (31, 31)], True)
    put(g, 17, 25, PELV); put(g, 17, 23, BELT); torso(g, 16, 16, 2, TORSO[:3] + TORSO[5:])
    put(g, 21, 6, head(0))
    limb(g, [(29, 17), (36, 17)], 'LEe'); hand(g, 38, 17)
    blade(g, 40, 17, 51, 17)
frame('찌르기', f_thrust)

# 연결성 검사: 스미어·칼날 말고는 전부 한 덩어리여야 한다
def components(rows):
    seen = set(); comps = []
    for y in range(H):
        for x in range(W):
            if rows[y][x] in '.m' or (x, y) in seen: continue
            st = [(x, y)]; seen.add((x, y)); cells = []
            while st:
                cx, cy = st.pop(); cells.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and rows[ny][nx] not in '.m':
                            seen.add((nx, ny)); st.append((nx, ny))
            comps.append(cells)
    return comps

ok = True
for name, rows in FRAMES:
    comps = components(rows)
    if len(comps) > 1:
        ok = False
        print(name, '조각', [(len(c), rows[c[0][1]][c[0][0]], c[0]) for c in sorted(comps, key=len)[:-1]])
    print('--', name)
    print('\n'.join(rows))
print('connected:', ok)

js = ["'use strict';",
      "// 비교본(3번 방식, 전신 손도트): 검사 전신 프레임 7장. 52×34 칸(1.5px), 땅은 33행. 망토는 늘 어깨에 붙어 있고 뒷팔이 균형을 잡는다.",
      "//  글자: r 깃털 h/H 투구 v 눈가리개 a/A 갑옷 T 전포 y 문장·버클 b 벨트 l 다리 k 부츠 c 망토 L/E/e 앞팔 d 뒷팔 S/s/G 장갑·가드 W/w 칼날 n 손잡이 m 스미어",
      "//  생성기: 세션 스크래치 gen_frames.py (머리·몸통·망토 블록 + 팔·다리 폴리라인) — 결과 격자를 그대로 둔다",
      "(function () {",
      "  const FRAMES = ["]
for name, rows in FRAMES:
    js.append("    { name: %s, rows: [" % json.dumps(name, ensure_ascii=False))
    for r in rows: js.append("      '%s'," % r)
    js.append("    ] },")
js += ["  ];",
       "  for (const f of FRAMES) { const o = outline(f.rows); o.px = 0.5; f.sprite = o; }",
       "  const EXTRA = { c: '#2f5fc4', T: '#2f5fc4', L: '#c9d1dd', E: '#9ca5b6', e: '#5a6172', d: '#454b58', A: '#8c95a6', a: '#5a6172', S: '#3d7bff', s: '#2a55b8', G: '#3d7bff', W: '#f4f8ff', w: '#c9d8ff', n: '#4a3220', m: '#9fb8ff' };",
       "  const pal = () => Object.assign({}, heroPal('swordsman'), EXTRA);",
       "  // 검사에 꽂기. 평타 1 내려베기: 들기 ~0.14 → 예비 ~0.3 → 타격 ~0.52 → 팔로스루 ~0.78 → 서기. 평타 2 찌르기: 예비 ~0.32 → 찌르기 ~0.6 → 예비 ~0.8 → 서기",
       "  const fr = (i, until) => ({ sprite: FRAMES[i].sprite, until, anchor: 18 });",
       "  const apply = () => {",
       "    CLASSES.swordsman.look.frames = { pal: pal(), idle: fr(0, 1), atk: [[fr(1, 0.14), fr(2, 0.3), fr(3, 0.52), fr(4, 0.78), fr(0, 1)], [fr(5, 0.32), fr(6, 0.6), fr(5, 0.8), fr(0, 1)]] };",
       "    return CLASSES.swordsman.look.frames;",
       "  };",
       "  const remove = () => { delete CLASSES.swordsman.look.frames; };",
       "  window.knightFrames2 = { FRAMES, pal, apply, remove };",
       "})();", ""]
out = sys.argv[1]
open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(js))
print('wrote', out)
