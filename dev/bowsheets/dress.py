# 레인저 계열 원형 마네킹 + 직업 입히기 (PixelLab 0회 시안). 검사 계열 dev/sheets-sword/{parts,mannequin,dress}.py 와 같은 방식을 활·석궁에 맞췄다.
#   1) 캡처(8배, capture.js) → 1배 (base.down)
#   2) 마네킹: 장식 없는 검사 몸 + 무기(장궁 / 거대 석궁 / 공성 석궁) 를 부위색으로 칠한다 — 투구·몸통·바지·장화·장갑(손)·무기
#      PixelLab 애니가 이 색을 지키면 프레임마다 부위를 색으로 다시 가를 수 있다
#   3) 입히기: 마네킹 프레임 → 그 직업. 머리(모자·후드·관)는 직업 그림에서 통째로, 몸통 무늬·망토는 같은 이동량으로 옮기고,
#      못 덮은 곳과 바지·장화·손·무기는 직업 부위 램프(3단). 마지막에 직업 팔레트 고정 + 외곽선
#   python -I dev/bowsheets/dress.py   → dev/bowsheets/mq/*.png, dev/review/sheets-bow/mq-*.png·dress-*.png·line-*.png, 실루엣 겹침 sil-iou.json
import os, sys, json
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'boxer', 'sheets'))
from base import down
from common import tidy
SHOTS = os.path.join(ROOT, 'dev', 'shots'); CAP = os.path.join(HERE, 'cap'); MQ = os.path.join(HERE, 'mq')
REV = os.path.join(ROOT, 'dev', 'review', 'sheets-bow')
OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster']
ARCH = {'ranger': 'mq-bow', 'marksman': 'mq-bow', 'arcaneArcher': 'mq-bow', 'deadeye': 'mq-bow', 'voidArcher': 'mq-bow',
        'arbalest': 'mq-xbow', 'siegeMaster': 'mq-siege'}
TESTS = ['stand', 'p6', 'p13', 'up', 'w0', 'w1']
RAMP = {   # 검사 계열 마네킹과 같은 부위색 (blade → 무기)
    'helm': [(0x4a, 0x52, 0x60), (0x7d, 0x87, 0x98), (0xb8, 0xc0, 0xcc)],
    'torso': [(0x6a, 0x1f, 0x22), (0xa8, 0x32, 0x3a), (0xd9, 0x55, 0x5c)],
    'legs': [(0x22, 0x30, 0x5a), (0x3a, 0x4f, 0x8c), (0x5c, 0x75, 0xb8)],
    'boots': [(0x3a, 0x26, 0x18), (0x5e, 0x3e, 0x26), (0x86, 0x60, 0x3c)],
    'glove': [(0x8a, 0x6a, 0x2a), (0xc9, 0x9a, 0x3a), (0xec, 0xc7, 0x60)],
    'weapon': [(0x8a, 0x96, 0xa8), (0xd0, 0xd8, 0xe4), (0xfa, 0xfc, 0xff)],
}


def load(name):
    p = os.path.join(CAP, name + '.png')
    if not os.path.exists(p):
        os.makedirs(CAP, exist_ok=True)
        down(Image.open(os.path.join(SHOTS, name + '.png')).convert('RGBA'))[0].save(p)
    return Image.open(p).convert('RGBA')


def ground_of(im):
    return im.getbbox()[3] - 1


def parts(full, body, wpn, ground=None):
    """픽셀마다 부위. 띠는 땅에서 잰다 (기존 기사는 다리 높이가 같다): 머리 = 땅-19 위, 몸통 = ~땅-5, 바지, 맨 아래 3줄 장화. 무기 옆 몸 = 손"""
    W, H = full.size; F, B, P = full.load(), body.load(), wpn.load()
    g = ground if ground is not None else ground_of(full); neck, belt = g - 19, g - 5
    out = {}
    for y in range(H):
        for x in range(W):
            c = F[x, y]
            if c[3] == 0: continue
            if lum(c) < 24: out[x, y] = 'line'; continue
            if not B[x, y][3]: out[x, y] = 'weapon'; continue
            nw = any(0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] and not B[x + a, y + b][3] for a in (-1, 0, 1) for b in (-1, 0, 1))
            out[x, y] = 'glove' if nw and y < belt else 'helm' if y < neck else 'torso' if y < belt else 'boots' if y > g - 3 else 'legs'
    return out


def paint(full, part):
    """부위 → 마네킹 램프 (부위 안 밝기 3등분)"""
    F = full.load(); o = Image.new('RGBA', full.size); O = o.load(); groups = {}
    for p, k in part.items(): groups.setdefault(k, []).append(p)
    for k, ps in groups.items():
        if k == 'line':
            for p in ps: O[p] = OUT_C
            continue
        ls = sorted(lum(F[p]) for p in ps); t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
        for p in ps:
            L = lum(F[p]); O[p] = RAMP[k][wlevel(L) if k == 'weapon' else 0 if L < t1 else 1 if L < t2 else 2] + (255,)
    return o


# 무기는 재질이 밝기로 갈린다 (활대·몸체 나무 / 쇠 / 시위·빛) — 3등분 대신 고정 밝기 단
wlevel = lambda L: 0 if L < 90 else 1 if L < 200 else 2


def weapon_ramp(colors):
    lv = [[c for c in colors if wlevel(lum(c)) == i] for i in range(3)]
    best = [max(set(l), key=l.count) if l else None for l in lv]
    for i in range(3):
        if best[i] is None: best[i] = next((best[j] for j in sorted(range(3), key=lambda j: abs(j - i)) if best[j]), (128, 128, 128, 255))
    return best


def wmask_img(n):
    """무기 칸 그림: full 과 wcol(무기 색만 #ff00ff) 이 다른 칸 (onlyWeapon 캡처는 쓰지 않는다 — 공용 규칙)"""
    full = load(n + '-full'); F = full.load(); o = Image.new('RGBA', full.size); O = o.load()
    for p in diff_pts(full, load(n + '-wcol')):
        if F[p][3]: O[p] = F[p]
    return o


def mannequin(arch, test):
    n = f'{arch}-{test}'; full = load(n + '-noacc')
    g = ground_of(load(f'{arch}-stand-noacc'))        # 걷기 등에서 발이 떠도 띠는 대기 자세 땅으로
    return paint(full, parts(full, load(n + '-body'), wmask_img(n), g))


def classify(M):
    pal = [(c, k, i) for k, r in RAMP.items() for i, c in enumerate(r)]
    out = {}; px = M.load()
    for y in range(M.height):
        for x in range(M.width):
            c = px[x, y]
            if c[3] < 128: continue
            if lum(c) < 24: out[x, y] = ('line', 0); continue
            b = min(pal, key=lambda p: 3 * (p[0][0] - c[0]) ** 2 + 6 * (p[0][1] - c[1]) ** 2 + 2 * (p[0][2] - c[2]) ** 2)
            out[x, y] = (b[1], b[2])
    return out


def ramp_of(colors):
    if not colors: return None
    cs = sorted(colors, key=lum); n = len(cs); out = []
    for a, b in ((0, n // 3), (n // 3, 2 * n // 3), (2 * n // 3, n)):
        seg = cs[a:max(b, a + 1)]; out.append(max(set(seg), key=seg.count))
    return out


def ramp_q(colors, qs=(0.15, 0.45, 0.75)):
    """직업 부위 색 → 3단: 빈도까지 넣어 밝기순으로 줄 세운 뒤 15·45·75% 자리 색. 드문 밝은 장식선(차원궁사 분홍 등)이 넓은 면을 칠하지 않게"""
    if not colors: return None
    cs = sorted(colors, key=lum); n = len(cs)
    return [cs[min(n - 1, int(q * n))] for q in qs]


def anchor(pm, part):
    """부위 아랫줄 가운데. 가장 큰 덩어리만 본다 (PixelLab 프레임은 발밑 그림자·장화에 머리색 비슷한 칸이 생겨 아랫줄이 발로 잡힌다)"""
    ps = set(p for p, k in pm.items() if (k[0] if isinstance(k, tuple) else k) == part)
    if not ps: return None
    left, best = set(ps), set()
    while left:
        st = [left.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); comp.add(q); st.append(q)
        if len(comp) > len(best): best = comp
    ps = best
    yb = max(y for _, y in ps); row = [x for x, y in ps if y == yb]
    return ((min(row) + max(row)) / 2, yb)


def big(mask, minc=12):
    left, out = set(mask), set()
    while left:
        st = [left.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); comp.add(q); st.append(q)
        if len(comp) >= minc: out |= comp
    return out


import math


def axis(pts, by_tips=True):
    """점들의 주축 각도(도, -90~90]와 가운데. by_tips: 축 방향 양 끝의 가운데 (활), 아니면 무게중심 (석궁 T자)"""
    n = len(pts); mx = sum(p[0] for p in pts) / n; my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts); syy = sum((p[1] - my) ** 2 for p in pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    a = 0.5 * math.atan2(2 * sxy, sxx - syy); ux, uy = math.cos(a), math.sin(a)
    if by_tips:
        pr = [(p[0] - mx) * ux + (p[1] - my) * uy for p in pts]; lo, hi = min(pr), max(pr)
        mx, my = mx + ux * (lo + hi) / 2, my + uy * (lo + hi) / 2
    d = math.degrees(a)
    if d <= -90: d += 180
    if d > 90: d -= 180
    return mx, my, d


sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
from wpn import rotsprite, WeaponSprite, grip_tip, overlay, diff_pts      # 계열 공용 무기 덧그리기 (RotSprite 식)


def crescent(cx, cy):
    """차원궁사 초승달 활 (세로): 양 끝이 뒤로 휜 초승달 날 — 짙은 보라 몸 + 분홍 안쪽 날"""
    D, L, T = (0x2a, 0x12, 0x50, 255), (0xff, 0x8a, 0xff, 255), (0xff, 0x4d, 0xff, 255)
    sp = {}
    for i in range(-16, 17):
        t = i / 16; y = cy + i; x = cx + round(8 * (1 - t * t)) - 3
        sp[x, y] = D; sp[x + 1, y] = L
        if abs(t) < 0.7: sp[x - 1, y] = D
    for k in range(1, 4):                       # 양 끝 날: 뒤·바깥으로
        sp[cx - 3 - k, cy - 16 - k] = T if k < 3 else L
        sp[cx - 3 - k, cy + 16 + k] = T if k < 3 else L
    return sp


def disk(cx, cy, r, fill, edge, rays=None):
    sp = {}
    for y in range(cy - r - 3, cy + r + 4):
        for x in range(cx - r - 3, cx + r + 4):
            d = math.hypot(x - cx, y - cy)
            if d <= r - 1: sp[x, y] = fill
            elif d <= r + 0.3: sp[x, y] = edge
    if rays:
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            for rr in (r + 2, r + 3): sp[round(cx + rr * math.cos(a)), round(cy + rr * math.sin(a))] = rays
    return sp


def ring(cx, cy, r, c1, c2):
    """끊긴 고리 (차원 틈): 바깥 c1, 안쪽 c2, 45도마다 끊는다"""
    sp = {}
    for k in range(int(4 * math.pi * r)):
        a = k / (2 * r)
        if math.degrees(a) % 45 < 9: continue
        sp[round(cx + r * math.cos(a)), round(cy + r * math.sin(a))] = c1
        sp[round(cx + (r - 1) * math.cos(a)), round(cy + (r - 1) * math.sin(a))] = c2
    return sp


def bbox_of(CP, k):
    ps = [p for p, v in CP.items() if v == k]
    return min(p[0] for p in ps), min(p[1] for p in ps), max(p[0] for p in ps), max(p[1] for p in ps)


# 실루엣 틀 바꾸기 (2026-10-16 사용자 승인): 직업 대기 그림 좌표로 소품을 그린다.
#  층: back(몸 뒤, 빈 칸) · front(몸 위, 무기 아래) · head(머리 위). 기준: 'head' 는 머리 이동(hoff), 'body' 는 몸 이동(off) 을 따라간다
def props(cls, CP):
    out = []
    hx0, hy0, hx1, hy1 = bbox_of(CP, 'helm'); tx0, ty0, tx1, ty1 = bbox_of(CP, 'torso')
    if cls == 'voidArcher':
        hood, tip = (0x3a, 0x1a, 0x6a, 255), (0xff, 0x8a, 0xff, 255)
        horn = {}
        for k in range(5):                       # 후드 위 뿔 두 갈래 (뒤로 휨)
            horn[hx0 + 5 - k // 2, hy0 - k] = tip if k == 4 else hood
            horn[hx0 + 11 - k // 2, hy0 - k + 1] = tip if k == 4 else hood
            if k < 2: horn[hx0 + 6 - k // 2, hy0 - k] = hood; horn[hx0 + 12 - k // 2, hy0 - k + 1] = hood
        out.append(('head', 'head', horn))
        out.append(('back', 'body', ring(tx0 - 1, ty0 + 3, 9, (0xff, 0x4d, 0xff, 255), (0x3a, 0x1a, 0x6a, 255))))
    if cls == 'deadeye':                         # 머리 뒤 태양 원반 (후광)
        out.append(('back', 'head', disk(hx0 + 4, hy0 + 5, 8, (0xff, 0xd2, 0x57, 255), (0xc9, 0xa2, 0x27, 255), rays=(0xff, 0xf0, 0xb0, 255))))
    if cls == 'siegeMaster':                     # 앞 어깨 큰 견갑 (둥근 판)
        st, hi, dk = (0x6a, 0x70, 0x7c, 255), (0xa8, 0xae, 0xb8, 255), (0x3a, 0x3e, 0x48, 255)
        pd = {}; cx, cy = tx1 - 4, ty0 + 2
        for y in range(cy - 3, cy + 4):
            for x in range(cx - 5, cx + 6):
                if ((x - cx) / 5.5) ** 2 + ((y - cy) / 3.6) ** 2 <= 1: pd[x, y] = hi if y < cy - 1 else st if y < cy + 2 else dk
        out.append(('front', 'body', pd))
    return out


# 무기 덧그리기 (공용 dev/sheets-common/wpn.py, 2026-10-16 승인): 직업 무기 그림 = full 과 wcol(무기 색만 #ff00ff) 이 다른 칸 (WeaponSprite.from_capture).
#  프레임: grip_tip(마네킹 활대 칸, 손 칸, end='up') 의 손 점(축 가운데)·끝 점(위 끝)에 overlay. 석궁은 쇠 활대 칸으로만 잰다(axis_sel) — T자 전체 주축은 가림에 따라 90° 바뀐다.
#  시위는 프레임마다 모양이 달라(당김) 무기와 같이 돌릴 수 없다 → 마네킹 시위 칸(무기 밝은 단)을 직업 시위색으로 under 에 그린다.
#  alt(틀 바꾸기): 공성포수는 어깨 거치(무기 그림 1.2배, 손 점을 위·뒤로), 차원궁사는 초승달 활
XBOW = ('arbalest', 'siegeMaster')


def class_weapon(cls, CP, alt):
    full, wc = load(f'c-{cls}-full'), load(f'c-{cls}-wcol')
    glove = [p for p, k in CP.items() if k == 'glove']
    # 활·석궁 모두 end='up' (가운데·위 끝). 석궁은 T자라 쇠 활대(밝은 칸)로만 각도를 잰다 — 마네킹 쪽도 쇠 단만 (dress2)
    end = 'up'; sel = (lambda c: lum(c) >= 90) if cls in XBOW else None
    ws = WeaponSprite.from_capture(full, wc, glove, end, sel)
    if alt and cls == 'voidArcher':                     # 초승달 활: 쥔 자리(가운데)에서 위 끝으로
        sp = crescent(0, 0); xs = [p[0] for p in sp]; ys = [p[1] for p in sp]; x0, y0 = min(xs), min(ys)
        img = Image.new('RGBA', (max(xs) - x0 + 1, max(ys) - y0 + 1)); P = img.load()
        for (x, y), c in sp.items(): P[x - x0, y - y0] = c
        ws = WeaponSprite(img, (-x0 + 2, -y0), math.atan2(-16, -3))
    if alt and cls == 'siegeMaster':
        k = 1.2; img = ws.img.resize((round(ws.img.width * k), round(ws.img.height * k)), Image.NEAREST)
        ws = WeaponSprite(img, (ws.grip[0] * k, ws.grip[1] * k), ws.ang)
    # 시위 색 = 무기도 몸도 아닌 칸 중 가장 많은 색 (빛나는 활은 빛 색)
    na = load(f'c-{cls}-noacc'); F, B, D = na.load(), load(f'c-{cls}-body').load(), diff_pts(full, wc)     # 망토 없는 그림에서 (망토 색이 섞이지 않게)
    sc = [F[x, y] for y in range(na.height) for x in range(na.width) if F[x, y][3] and not B[x, y][3] and (x, y) not in D and lum(F[x, y]) >= 24]
    return ws, (max(set(sc), key=sc.count) if sc else (217, 210, 192, 255)), end


def geom(cls, M):
    """마네킹 프레임의 (손 점, 끝 점) — 무기 칸이 모자라면 None (build.py 가 이웃 프레임으로 메운다)"""
    MP = classify(M)
    glove = [p for p, (k, i) in MP.items() if k == 'glove']
    if cls in XBOW:
        # 석궁: 손보다 앞의 쇠·시위 칸 중 가장 큰 덩어리 (PixelLab 프레임은 투구 회색이 쇠 회색과 섞인다)
        gx = sum(p[0] for p in glove) / len(glove) if glove else 0
        cand = {p for p, (k, i) in MP.items() if k == 'weapon' and i >= 1 and p[0] > gx + 1}
        limb = list(biggest(cand))
    else:
        limb = [p for p, (k, i) in MP.items() if k == 'weapon' and i != 2]
    return grip_tip(limb, glove, 'up') if len(limb) >= 6 else None


def biggest(pts):
    left, best = set(pts), set()
    while left:
        st = [left.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); comp.add(q); st.append(q)
        if len(comp) > len(best): best = comp
    return best


def glove_c(M):
    gl = [p for p, (k, i) in classify(M).items() if k == 'glove']
    return (sum(p[0] for p in gl) / len(gl), sum(p[1] for p in gl) / len(gl)) if gl else None


def line_pts(a, b):
    n = max(1, round(max(abs(b[0] - a[0]), abs(b[1] - a[1]))))
    return {(round(a[0] + (b[0] - a[0]) * k / n), round(a[1] + (b[1] - a[1]) * k / n)) for k in range(n + 1)}


def code_string(gp, tp, pull, col):
    """활 시위: 위 끝(tp) → 당긴 점 → 아래 끝(손 점 기준 대칭). pull = 활대 축에서 몸 쪽(뒤)으로 당긴 도트"""
    lo = (2 * gp[0] - tp[0], 2 * gp[1] - tp[1])
    dx, dy = tp[0] - gp[0], tp[1] - gp[1]; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L
    if nx > 0: nx, ny = -nx, -ny
    # 쉴 때 시위는 양 끝을 잇는 직선 (활대 곡선의 뒤) — 손 점에서 2칸 뒤
    nock = (gp[0] + nx * (2 + pull), gp[1] + ny * (2 + pull))
    c = col[:3] + (255,)
    return {p: c for p in line_pts(tp, nock) | line_pts(nock, lo)}


def dress2(cls, M, alt=True, wfix=None, shoulder=True):
    """덧그리기 + (alt) 틀 바꾸기 판 입히기. wfix = {'gp','tp'} 손 점·끝 점 덮어쓰기(무기가 빠진 프레임), {'pull'} 활 시위를 코드로"""
    full, noacc, body, wpn = (load(f'c-{cls}-{k}') if k != 'wpn' else wmask_img(f'c-{cls}') for k in ('full', 'noacc', 'body', 'wpn'))
    W = full.width; inN = lambda p: 0 <= p[0] < W and 0 <= p[1] < W
    g = ground_of(noacc); neck = g - 19
    CP = parts(noacc, body, wpn); C = noacc.load(); Fp = full.load()
    A, Bn = full.load(), noacc.load()
    cape = big({(x, y) for y in range(W) for x in range(W) if A[x, y][3] and A[x, y] != Bn[x, y]})
    ramps = {k: (weapon_ramp if k == 'weapon' else ramp_q)([C[p] for p, kk in CP.items() if kk == k]) for k in RAMP}
    for k in RAMP:
        if ramps[k] is None: ramps[k] = ramps['torso']
    base = classify(mannequin(ARCH[cls], 'stand')); MP = classify(M)
    ba, ma = anchor(base, 'helm'), anchor(MP, 'helm') or anchor(base, 'helm')
    ca = anchor({p: k for p, k in CP.items() if p[1] < neck}, 'helm')
    off = (round(ma[0] - ba[0]), round(ma[1] - ba[1])); hoff = (round(ma[0] - ca[0]), round(ma[1] - ca[1]))
    o = Image.new('RGBA', (W, W)); O = o.load(); mv = lambda p, d: (p[0] + d[0], p[1] + d[1])
    PR = props(cls, CP) if alt else []

    def put(layer, empty_only=False):
        for lay, ref, sp in PR:
            if lay != layer: continue
            d = hoff if ref == 'head' else off
            for p, c in sp.items():
                q = mv(p, d)
                if inN(q) and (not empty_only or not O[q][3]): O[q] = c
    for p in cape:                                       # 망토 (몸 뒤, 빈 칸에만)
        q = mv(p, off)
        if inN(q) and q not in MP: O[q] = Fp[p]
    put('back', True)
    near = lambda x, y, f: any(f(MP.get((x + a, y + b), ('',))[0]) for a in (-1, 0, 1) for b in (-1, 0, 1))
    for (x, y), (k, i) in MP.items():                    # 몸: 부위 램프, 몸통은 직업 무늬 우선 (마네킹 무기는 덧그리기로 바꾼다)
        if k == 'weapon': continue
        if k == 'line':
            if near(x, y, lambda v: v == 'weapon') and not near(x, y, lambda v: v not in ('weapon', 'line', '')): continue   # 무기에만 붙은 외곽선
            O[x, y] = OUT_C; continue
        if k == 'helm': continue
        c = ramps[k][i]
        if k == 'torso':
            q = (x - off[0], y - off[1])
            if CP.get(q) == 'torso': c = C[q]
        O[x, y] = c[:3] + (255,)
    for (x, y), (k, i) in MP.items():                    # 쥔 손 (overlay 의 front)
        if k == 'glove': O[x, y] = ramps['glove'][i][:3] + (255,)
    put('front')
    # 무기: 공용 overlay
    ws, scol, end = class_weapon(cls, CP, alt)
    glove_pts = [p for p, (k, i) in MP.items() if k == 'glove']
    # 정지 시안(리그 자세)만 공성 석궁을 어깨로 옮긴다. PixelLab 공성 원형은 첫 프레임부터 어깨 거치라 옮기지 않는다 (shoulder=False)
    sh = (-2, -6) if alt and cls == 'siegeMaster' and shoulder else (0, 0)
    under = {(x + sh[0], y + sh[1]): scol[:3] + (255,) for (x, y), (k, i) in MP.items() if k == 'weapon' and i == 2}
    g = geom(cls, M) if not wfix or 'gp' not in wfix else (wfix['gp'], wfix['tp'])
    if wfix and wfix.get('pull') is not None and g and cls not in XBOW:      # 활 시위를 코드로 (PixelLab 이 가는 시위를 지우거나 흩뜨린다)
        under = code_string(g[0], g[1], wfix['pull'], scol)
    before = {(x, y) for y in range(W) for x in range(W) if O[x, y][3]}
    if g:
        gp, tp = g
        gp, tp = (gp[0] + sh[0], gp[1] + sh[1]), (tp[0] + sh[0], tp[1] + sh[1])
        o = overlay(o, set(), gp, tp, ws, front=glove_pts if not sh[1] else (), line=False, under=under); O = o.load()
    wpn_now = {(x, y) for y in range(W) for x in range(W) if O[x, y][3]} - before
    head = {p for p, k in CP.items() if p[1] < neck and k not in ('weapon', 'line', 'glove')}
    head |= {p for p, k in CP.items() if k == 'line' and p[1] < neck + 1 and any((p[0] + a, p[1] + b) in head for a in (-1, 0, 1) for b in (-1, 0, 1))}
    for p in head:
        q = mv(p, hoff)
        if inN(q) and q not in wpn_now: O[q] = C[p]
    put('head')
    pal = sorted({c for c in (full.get_flattened_data() if hasattr(full, 'get_flattened_data') else full.getdata()) if c[3]})
    for _, _, sp in PR:
        for c in sp.values():
            if c not in pal: pal.append(c)
    if OUT_C not in pal: pal.append(OUT_C)
    keep = {p: O[p] for p in wpn_now if O[p][3]}
    o = tidy(o, pal, minc=6); T = o.load()
    for p, c in keep.items(): T[p] = c          # 1칸 두께의 어두운 활대·석궁 몸체는 전부 가장자리라 tidy 가 외곽선으로 칠한다 → 덧그린 무기 색으로 되돌림
    return o


def dress(cls, M):
    """첫 시안 (v1): 무기까지 마네킹 모양으로 칠한다 — 비교용으로 남김"""
    full, noacc, body = (load(f'c-{cls}-{k}') for k in ('full', 'noacc', 'body')); wpn = wmask_img(f'c-{cls}')
    W = full.width; inN = lambda p: 0 <= p[0] < W and 0 <= p[1] < W
    g = ground_of(noacc); neck = g - 19
    CP = parts(noacc, body, wpn); C = noacc.load(); Fp = full.load()
    A, Bn = full.load(), noacc.load()
    cape = big({(x, y) for y in range(W) for x in range(W) if A[x, y][3] and A[x, y] != Bn[x, y]})
    ramps = {k: (weapon_ramp if k == 'weapon' else ramp_of)([C[p] for p, kk in CP.items() if kk == k]) for k in RAMP}
    for k in RAMP:
        if ramps[k] is None: ramps[k] = ramps['torso']
    base = classify(mannequin(ARCH[cls], 'stand')); MP = classify(M)
    ba, ma = anchor(base, 'helm'), anchor(MP, 'helm') or anchor(base, 'helm')
    ca = anchor({p: k for p, k in CP.items() if p[1] < neck}, 'helm')
    off = (round(ma[0] - ba[0]), round(ma[1] - ba[1])); hoff = (round(ma[0] - ca[0]), round(ma[1] - ca[1]))
    o = Image.new('RGBA', (W, W)); O = o.load(); mv = lambda p, d: (p[0] + d[0], p[1] + d[1])
    for p in cape:                                       # 망토 (몸 뒤, 빈 칸에만)
        q = mv(p, off)
        if inN(q) and q not in MP: O[q] = Fp[p]
    for (x, y), (k, i) in MP.items():                    # 몸: 부위 램프, 몸통은 직업 무늬 우선
        if k == 'line': O[x, y] = OUT_C; continue
        if k == 'helm': continue
        c = ramps[k][i]
        if k == 'torso':
            q = (x - off[0], y - off[1])
            if CP.get(q) == 'torso': c = C[q]
        O[x, y] = c[:3] + (255,)
    head = {p for p, k in CP.items() if p[1] < neck and k not in ('weapon', 'line', 'glove')}   # 머리: 목 위 칠한 칸 + 붙은 외곽선
    head |= {p for p, k in CP.items() if k == 'line' and p[1] < neck + 1 and any((p[0] + a, p[1] + b) in head for a in (-1, 0, 1) for b in (-1, 0, 1))}
    for p in head:
        q = mv(p, hoff)
        if inN(q) and MP.get(q, ('',))[0] != 'weapon': O[q] = C[p]
    pal = sorted({c for c in (full.get_flattened_data() if hasattr(full, 'get_flattened_data') else full.getdata()) if c[3]})
    if OUT_C not in pal: pal.append(OUT_C)
    return tidy(o, pal, minc=6)


def mask(im):
    px = im.load()
    return {(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]}


def iou(a, b, foot_a, foot_b):
    """발 기준점을 맞춰 겹친 실루엣 IoU"""
    d = (foot_b[0] - foot_a[0], foot_b[1] - foot_a[1]); a = {(x + d[0], y + d[1]) for x, y in a}
    return len(a & b) / max(1, len(a | b))


def tile(ims, S=3, gap=6, bg=(20, 22, 29, 255), mode='color'):
    H = max(i.height for i in ims); o = Image.new('RGBA', (sum(i.width * S + gap for i in ims), H * S), bg); x = 0
    for im in ims:
        if mode == 'gray':
            g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(im.getchannel('A')); im = g
        elif mode == 'sil':
            s = Image.new('RGBA', im.size, (230, 230, 236, 255)); s.putalpha(im.getchannel('A')); im = s
        o.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, (H - im.height) * S)); x += im.width * S + gap
    return o


def tight(im, foot):
    """줄 세우기용: 발 기준점 둘레 64×56 만 (빈 여백 없이)"""
    return im.crop((foot[0] - 26, foot[1] - 50, foot[0] + 38, foot[1] + 6))


FOOT = lambda c: (58, 116) if c in ('siegeMaster', 'mq-siege') else (42, 86)

if __name__ == '__main__':
    os.makedirs(MQ, exist_ok=True); os.makedirs(REV, exist_ok=True)
    for arch in ('mq-bow', 'mq-xbow', 'mq-siege'):
        fr = [mannequin(arch, t) for t in TESTS]
        for t, im in zip(TESTS, fr): im.save(os.path.join(MQ, f'{arch}-{t}.png'))
        tile([tight(f, FOOT(arch)) for f in fr]).save(os.path.join(REV, f'{arch}.png'))
    # v1 = 첫 시안 (무기도 마네킹 모양) · v2 = 무기 덧그리기 + 실루엣 틀 바꾸기 (2026-10-16 승인안)
    rows = {}
    for cls in IDS:
        orig = load(f'c-{cls}-full'); rows[cls] = {'orig': orig}
        for ver, fn, pre in (('v1', dress, 'dress'), ('v2', dress2, 'dress2')):
            fr = [fn(cls, Image.open(os.path.join(MQ, f'{ARCH[cls]}-{t}.png')).convert('RGBA')) for t in TESTS]
            for t, im in zip(TESTS, fr): im.save(os.path.join(MQ, f'{pre}-{cls}-{t}.png'))
            rows[cls][ver] = fr
            tile([tight(orig, FOOT(cls))] + [tight(f, FOOT(cls)) for f in fr]).save(os.path.join(REV, f'{pre}-{cls}.png'))
    for mode in ('color', 'gray', 'sil'):
        tile([tight(rows[c]['orig'], FOOT(c)) for c in IDS], mode=mode).save(os.path.join(REV, f'line-orig-{mode}.png'))
        tile([tight(rows[c]['v1'][0], FOOT(c)) for c in IDS], mode=mode).save(os.path.join(REV, f'line-dress-{mode}.png'))
        tile([tight(rows[c]['v2'][0], FOOT(c)) for c in IDS], mode=mode).save(os.path.join(REV, f'line-dress2-{mode}.png'))
    res = {}
    for kind in ('orig', 'v1', 'v2'):
        M = {c: mask(rows[c][kind] if kind == 'orig' else rows[c][kind][0]) for c in IDS}
        res[kind] = {f'{a}|{b}': round(iou(M[a], M[b], FOOT(a), FOOT(b)), 3) for i, a in enumerate(IDS) for b in IDS[i + 1:]}
    json.dump(res, open(os.path.join(REV, 'sil-iou.json'), 'w'), indent=1)
    for kind in res:
        print(kind, sorted(res[kind].items(), key=lambda kv: -kv[1])[:7])
