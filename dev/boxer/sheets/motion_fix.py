# 파이터 계열 모션 손 편집 (PixelLab 없이, 2026-10-15 사용자 검사 반영 — docs/specs/boxer-class.md "모션 수정")
#  원본은 dev/boxer/sheets/orig/<cls>.png·json (처음 편집 전 시트). 이 스크립트는 원본에서 다시 만들어 src/sprites 에 쓴다 (여러 번 돌려도 같다).
#   python -I dev/boxer/sheets/motion_fix.py
#  1) 잽/스트레이트: atkA = 앞손 잽(밝은 앞팔, 뒷손은 턱). atkB = 뒷손 스트레이트 — 뻗은 팔을 뒷팔 명암(한 단 어둡게)으로, 앞 주먹을 턱 앞으로.
#     스트라이커는 허리로 처진 반대 팔을 지운다.
#  2) 연타 러시(skillA, 스트라이커·챔피언): 평타와 다른 그림 — 팔을 반쯤만 뻗어 짧게 끊어 치는 잽/스트레이트를 몸통·얼굴 높이로 번갈아 4프레임.
#  3) 킥복서·템페스트: atkB = 뒷발 돌려차기 — 차는 다리를 뒷다리 명암으로. skillB(회전 발차기) = 등을 돌린(좌우 반전) 프레임과 차는 프레임을 번갈아.
import os, sys, json, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import px
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(HERE, 'orig')


def load(c):
    shutil.copy(os.path.join(ORIG, c + '.json'), px.SP(c, 'json'))
    return Image.open(os.path.join(ORIG, c + '.png')).convert('RGBA'), json.load(open(os.path.join(ORIG, c + '.json')))


def fr(sh, m, a, f):
    A = m['anims'][a]; f = min(f, A['frames'] - 1)
    return sh.crop((f * 64, A['row'] * 64, f * 64 + 64, A['row'] * 64 + 64))


def tip(img):
    """가장 오른쪽 불투명 칸 (x, y) — 뻗은 주먹·발끝"""
    p = img.load()
    for x in range(63, -1, -1):
        ys = [y for y in range(64) if p[x, y][3] and p[x, y] != px.OUTLINE]
        if ys: return x, sum(ys) // len(ys)


def band(img, x0, yc, h):
    """x0 오른쪽, yc±h 줄의 칸 (뻗은 팔·다리)"""
    return px.region(img, lambda x, y, p: x >= x0 and yc - h <= y <= yc + h)


def straight(c, sh, m, dk, arm_x, chin_from, chin_box, erase_low=False, anim='atkB'):
    """atkB 의 뻗은 프레임을 뒷손 스트레이트로"""
    src = fr(sh, m, *chin_from); ty, tx = px.bbox_top(src)
    A = m['anims'][anim]; out = {}
    hit = A.get('hit', 1)
    for f in (hit, hit + 1):                         # 뻗은 두 장(타격·다음)만 — 준비·복귀 프레임은 그대로
        im = fr(sh, m, anim, f)
        t = tip(im)
        y0, x0 = px.bbox_top(im)
        if erase_low:
            pts = px.region(im, lambda x, y, p: (x < 28 and 32 <= y < 52 and (px.is_skin(p) or px.is_glove(p) or px.is_gold(p))) or (x < 23 and 37 <= y < 52 and px.lum(p) < 40))
            px.erase(im, pts); px.clean_orphans(im); px.drop_specks(im)
        px.recolor(im, band(im, arm_x, t[1], 6), dk)
        if chin_box:
            im.alpha_composite(src.crop(chin_box), (chin_box[0] + x0 - tx, chin_box[1] + y0 - ty))
        px.outline(im)
        out[f] = im
    return out


def short(im, arm_x, yc, back=9, down=0):
    """뻗은 팔을 back 칸만큼 당겨(반쯤 뻗은 짧은 주먹) down 칸 내린다"""
    o = im.copy(); pts = band(o, arm_x, yc, 6)
    p = im.load(); seg = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); q = seg.load()
    for (x, y) in pts: q[x, y] = p[x, y]
    px.erase(o, pts)
    o.alpha_composite(seg, (-back, down))
    px.drop_specks(o); px.outline(o)
    return o


def pivot(im, hipx, y0, foot=58, back=2, heel=2):
    """뒷발 피벗: 엉덩이(hipx) 뒤쪽 다리를 무릎(y0) 아래로 갈수록 뒤로 back 칸 뻗고, 뒷발 뒤꿈치(왼쪽 끝)를 heel 칸 든다"""
    P = im.load(); leg = px.region(im, lambda x, y, p: x < hipx and y >= y0)
    if not leg: return im
    o = im.copy(); px.erase(o, leg); Q = o.load()
    moved = {}
    for (x, y) in leg: moved[(x - round(back * (y - y0) / max(1, foot - y0)), y)] = P[x, y]
    fx = [x for (x, y) in moved if y >= foot - 4]
    xl, xr = (min(fx), max(fx)) if fx else (0, 1)
    for (x, y), c in sorted(moved.items(), key=lambda t: -t[0][1]):
        r = round(heel * (xr - x) / max(1, xr - xl)) if y >= foot - 4 else 0
        if 0 <= x < 64 and 0 <= y - r < 64: Q[x, y - r] = c
    px.drop_specks(o); px.outline(o)
    return o


def stretch(im, xm, yc, E, h=5):
    """뻗은 팔을 E 칸 늘린다: yc±h 줄에서 xm 오른쪽을 E 칸 밀고, 빈 칸은 xm 열을 되풀이"""
    if E <= 0: return im
    P = im.load(); o = im.copy(); Q = o.load()
    for y in range(max(0, yc - h), min(64, yc + h + 1)):
        for x in range(63, xm, -1):
            Q[x, y] = P[x - E, y] if x - E > xm else P[xm, y]
    px.outline(o)
    return o


def put(sh, m, a, f, im):
    A = m['anims'][a]
    sh.paste(Image.new('RGBA', (64, 64), (0, 0, 0, 0)), (f * 64, A['row'] * 64)); sh.alpha_composite(im, (f * 64, A['row'] * 64))


def boxer(c, arm_x, chin_from, chin_box, erase_low, hipx, knee):
    sh, m = load(c)
    dk = px.darker_map(px.palette(sh))
    st = straight(c, sh, m, dk, arm_x, chin_from, chin_box, erase_low)
    for f, im in st.items():
        t = tip(im)
        st[f] = pivot(stretch(im, arm_x + 6, t[1], min(4, 62 - t[0])), hipx, knee)
        put(sh, m, 'atkB', f, st[f])
    if c != 'fighter':                                # 내지르기(붕권·궁극기 막타)도 뒷손 스트레이트로
        for f, im in straight(c, sh, m, dk, arm_x, chin_from, chin_box, erase_low, 'release').items(): put(sh, m, 'release', f, im)
    if 'skillA' in m['anims']:
        jab = fr(sh, m, 'atkA', 1); stf = st[min(st)]
        tj, ts = tip(jab), tip(stf)
        sx = arm_x + 4                                # 턱 앞 장갑(앞손)은 그대로 두고 뻗은 팔만 당긴다
        frames = [short(jab, sx, tj[1], 9, 0), short(stf, sx, ts[1], 9, 0), short(jab, sx, tj[1], 11, 4), short(stf, sx, ts[1], 11, 4)]
        A = m['anims']['skillA']
        for f in range(A['frames']): put(sh, m, 'skillA', f, frames[f % 4])
    # 잽은 짧게 (스트레이트보다 4칸 덜 뻗는다 — 2026-10-15 사용자: 스트레이트가 잽보다 길게)
    A = m['anims']['atkA']; h = A.get('hit', 1)
    for f in (h, h + 1):
        im = fr(sh, m, 'atkA', f); t = tip(im)
        put(sh, m, 'atkA', f, short(im, arm_x + 4, t[1], 4, 0))
    sh.save(px.SP(c, 'png'))
    return sh


def kicker(c, leg_x):
    sh, m = load(c)
    dk = px.darker_map(px.palette(sh))
    A = m['anims']['atkB']; kicks = []; hit = A.get('hit', 1)
    for f in (hit, hit + 1):
        im = fr(sh, m, 'atkB', f); t = tip(im)
        px.recolor(im, band(im, leg_x, t[1], 6), dk); px.outline(im)
        put(sh, m, 'atkB', f, im); kicks.append(im)
    # 회전 발차기: 등 돌림(좌우 반전) → 차기 → 등 돌림 → 차기. 반전은 발 가운데(32) 기준
    g0 = fr(sh, m, 'guard', 0)
    turned = ImageOps.mirror(g0)
    B = m['anims']['skillB']
    seq = [turned, kicks[0] if kicks else fr(sh, m, 'skillB', 1), ImageOps.mirror(fr(sh, m, 'atkA', 0)), kicks[-1] if kicks else fr(sh, m, 'skillB', 3)]
    for f in range(B['frames']): put(sh, m, 'skillB', f, seq[f % 4])
    sh.save(px.SP(c, 'png'))


if __name__ == '__main__':
    boxer('striker', 38, ('atkA', 1), (28, 29, 40, 41), True, 32, 51)
    boxer('champion', 40, ('atkA', 1), None, False, 33, 50)
    boxer('fighter', 37, ('guard', 0), None, False, 31, 50)
    kicker('kickboxer', 39)
    kicker('tempest', 39)
    os.system('node "' + os.path.join(HERE, '..', 'sheet-meta.js') + '"')
    print('ok')


# ── 템페스트 퀄업 (킥복서 + 목도리뿐이라 색깔놀이에 가깝다는 지적): 실루엣을 바꾸는 손 픽셀 부품 ──
#  기준점: 초록 목도리 칸 중 머리 가운데에 가장 가까운 덩어리의 맨 위 = 목. 머리 꼭대기 = 불투명 맨 위 줄.
#  ① 바람 반망토: 목에서 등 뒤(왼쪽)로 퍼져 내려오는 짧은 망토 — 몸 뒤(빈칸에만)에 그린다
#  ② 쌍갈래 높은 머리: 머리 뒤쪽 위에서 솟아 뒤로 휘는 두 번째 갈래 (몸 뒤)
#  ③ 금속 장식: 망토 깃에 은빛 고정쇠 하나
MANTLE = [(20, 74, 70, 255), (38, 120, 104, 255), (78, 176, 146, 255), (150, 230, 205, 255)]   # 어두움 → 밝음 (청록)
HAIR = None
METAL = [(110, 118, 132, 255), (190, 198, 210, 255), (240, 244, 250, 255)]


def is_green(p): return p[1] > p[0] + 25 and p[1] > p[2] + 5 and p[3]


def neck_of(im):
    top = px.bbox_top(im); hx = top[1]
    g = px.region(im, lambda x, y, p: is_green(p) and abs(x - hx) <= 9 and y > top[0] + 6)
    if not g: return hx - 2, top[0] + 14
    y0 = min(y for x, y in g); xs = [x for x, y in g if y <= y0 + 1]
    return sum(xs) // len(xs), y0


def behind(im, pts, col):
    """빈칸에만 칠한다 (몸 뒤)"""
    p = im.load()
    for (x, y) in pts:
        if 0 <= x < 64 and 0 <= y < 64 and not p[x, y][3]: p[x, y] = col


def mantle(im, flip=False):
    """어깨에 걸쳐 등 뒤로 짧게 날리는 반망토: 길이 9칸, 아래로 갈수록 넓어지고 끝은 두 갈래. 위는 밝고 아래는 어둡다"""
    nx, ny = neck_of(im); s = 1 if not flip else -1
    p = im.load(); pts = {}
    for i in range(0, 10):
        x = nx - s * (1 + i)
        top = ny + (i // 3)
        bot = ny + 3 + int(i * 0.7)
        if i >= 7 and i % 2 == 0: bot -= 2
        for y in range(top, bot + 1):
            d = (y - top) / max(1, bot - top)
            k = 3 if y == top and i < 6 else 2 if d < 0.4 else 1 if d < 0.8 else 0
            pts[(x, y)] = MANTLE[k]
    for (x, y), c in pts.items():
        if 0 <= x < 64 and 0 <= y < 64 and not p[x, y][3]: p[x, y] = c
    # 어깨 금속 장식 (깃 고정쇠, 몸 위)
    for (dx, dy, k) in ((0, 0, 2), (1, 0, 1), (0, 1, 1), (1, 1, 0)):
        x, y = nx + dx - 1, ny + dy
        if 0 <= x < 64 and 0 <= y < 64: p[x, y] = METAL[k]


SILVER = [(58, 64, 84, 255), (120, 130, 152, 255), (186, 196, 212, 255), (232, 238, 246, 255)]
TEAL_TIP = [(30, 96, 92, 255), (70, 170, 150, 255)]


def twin_tail(im, hair, flip=False):
    """묶은 머리를 위아래 두 갈래로 (뒤쪽 머리칼을 위로 옮겨 한 갈래 더) + 머리를 은백색, 끝은 청록으로"""
    top, hx = px.bbox_top(im); p = im.load()
    hs = {p[x, y] for y in range(64) for x in range(64) if p[x, y][3] and p[x, y][0] > p[x, y][2] + 30 and p[x, y][0] >= p[x, y][1] and px.lum(p[x, y]) < 125 and not is_green(p[x, y])}
    hs |= set(hair)
    H = [(x, y) for y in range(64) for x in range(64) if p[x, y] in hs]
    if not H: return
    hl = min(x for x, y in H if y <= top + 6) if any(y <= top + 6 for x, y in H) else hx - 6
    tail = [(x, y) for (x, y) in H if x < hl - 1]
    # 두 번째 갈래: 뒤쪽 머리칼을 위로 5, 앞으로 2 옮겨 몸 뒤 빈칸에
    for (x, y) in tail:
        q = (x + 3, y - 8)
        if 0 <= q[0] < 64 and 0 <= q[1] < 64 and not p[q][3]: p[q] = p[x, y]
    # 은백색으로 다시 칠하기 (명암 순서 유지), 머리 뒤 끝(가장 왼쪽 4칸)은 청록
    rank = sorted(hs, key=px.lum)
    allh = [(x, y) for y in range(64) for x in range(64) if p[x, y] in hs]
    xmin = min(x for x, y in allh) if allh else 0
    for (x, y) in allh:
        k = 1 + rank.index(p[x, y]) * (len(SILVER) - 2) // max(1, len(rank) - 1)
        p[x, y] = TEAL_TIP[0 if k < 2 else 1] if x <= xmin + 3 else SILVER[k]


def pauldron(im):
    """앞 어깨 금속 견갑 + 뒤로 뻗은 지느러미 (몸 위)"""
    nx, ny = neck_of(im); p = im.load()
    shape = ['.###.', '#ccb#', '#cbbb#'[:5], '.#bb#', '..##.']
    cols = {'#': px.OUTLINE, 'c': METAL[2], 'b': METAL[1]}
    for j, row in enumerate(shape):
        for i, ch in enumerate(row):
            if ch in cols:
                x, y = nx + 1 + i, ny + 1 + j
                if 0 <= x < 64 and 0 <= y < 64: p[x, y] = cols[ch]
    # 지느러미: 견갑 위에서 뒤·위로 3칸
    for i, (dx, dy) in enumerate(((0, 0), (-1, -1), (-2, -2))):
        x, y = nx + 1 + dx, ny + dy
        if 0 <= x < 64 and 0 <= y < 64 and not p[x, y][3]: p[x, y] = METAL[1 if i else 2]


def hair_ramp(im):
    cs = [q for q in px.palette(im) if q[0] > q[2] + 30 and q[0] < 200 and q[1] < 150 and q[1] > 40]
    cs = sorted(cs, key=px.lum)
    return [cs[0], cs[len(cs) // 2], cs[-1]] if len(cs) >= 3 else [(70, 40, 25, 255), (120, 70, 40, 255), (170, 110, 60, 255)]


def tempest():
    c = 'tempest'
    sh = Image.open(px.SP(c, 'png')).convert('RGBA'); m = json.load(open(px.SP(c, 'json')))
    hair = hair_ramp(sh)
    # 날아 차기(skillA): 매달린 디딤발을 무릎에서 접는다 (발목 아래를 위·뒤로)
    for f in range(m['anims']['skillA']['frames']):
        im = fr(sh, m, 'skillA', f); t = tip(im)
        if t[0] < 50: continue
        leg = px.region(im, lambda x, y, p: 24 <= x <= 42 and y >= 44)
        if len(leg) < 8: continue
        seg = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); q = seg.load(); P = im.load()
        for (x, y) in leg: q[x, y] = P[x, y]
        px.erase(im, leg); im.alpha_composite(seg, (-5, -8)); px.drop_specks(im); px.outline(im)
        put(sh, m, 'skillA', f, im)
    # 앉기: 그랜드마스터 무릎 꿇기 하체(남색 장삼 → 흰 바지) + 템페스트 상체(가드 0번)
    gm = Image.open(px.SP('grandmaster', 'png')).convert('RGBA'); gmm = json.load(open(px.SP('grandmaster', 'json')))
    pants = sorted([q for q in px.palette(sh) if abs(q[0] - q[1]) < 14 and abs(q[1] - q[2]) < 14 and px.lum(q) > 120], key=px.lum)
    up = fr(sh, m, 'idle', 0)                       # 서 있는 상체(팔 내림) — 가드 상체는 팔이 들려 깨져 보였다
    for f in range(m['anims']['sit']['frames']):
        base = fr(gm, gmm, 'sit', min(f, gmm['anims']['sit']['frames'] - 1))
        P = base.load(); low = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); L = low.load()
        robe = sorted({P[x, y] for y in range(42, 64) for x in range(64) if P[x, y][3] and P[x, y] != px.OUTLINE and P[x, y][2] > P[x, y][0] + 20}, key=px.lum)
        for y in range(42, 64):
            for x in range(64):
                v = P[x, y]
                if not v[3]: continue
                if v in robe and pants: L[x, y] = pants[min(len(pants) - 1, int(robe.index(v) / max(1, len(robe) - 1) * (len(pants) - 1)))]
                elif px.is_skin(v) or v == px.OUTLINE: L[x, y] = v
        low = low.crop((26, 0, 64, 64)); lo = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); lo.alpha_composite(low, (26, 0))   # 장삼 뒤 자락은 버린다
        upc = up.crop((0, 0, 64, 45))
        o = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); o.alpha_composite(lo, (0, 0)); o.alpha_composite(upc, (-2, 4 + f))
        px.drop_specks(o); px.outline(o)
        put(sh, m, 'sit', f, o)
    # 각성: 높이 찬 다리(앞차기 1번) + 허리 둘레 회오리 고리 (뒤 반은 몸 뒤, 앞 반은 몸 위, 프레임마다 무늬가 돈다)
    kick = fr(sh, m, 'atkA', m['anims']['atkA'].get('hit', 1)); g0 = fr(sh, m, 'guard', 0)
    A = m['anims']['awaken']
    for f in range(A['frames']):
        im = (g0 if f == 0 else kick).copy()
        cx, cy = 31, 44 - (2 if f else 0)
        back, front = [], []
        import math
        for i in range(72):
            a = i / 72 * 2 * math.pi
            x, y = cx + int(round(17 * math.cos(a))), cy + int(round(5 * math.sin(a)))
            on = ((i + f * 4) // 5) % 2 == 0 or f == 0
            if not on: continue
            k = 3 if (i + f * 4) % 5 == 0 else 2
            (front if math.sin(a) > 0 else back).append((x, y, k))
            (front if math.sin(a) > 0 else back).append((x, y + 1, 1))
        Pm = im.load()
        for (x, y, k) in back:
            if 0 <= x < 64 and 0 <= y < 64 and not Pm[x, y][3]: Pm[x, y] = MANTLE[k]
        for (x, y, k) in front:
            if 0 <= x < 64 and 0 <= y < 64: Pm[x, y] = MANTLE[k]
        put(sh, m, 'awaken', f, im)
    # 모든 프레임에 반망토·쌍갈래 머리 (각성 회오리 위에)
    for a, A in m['anims'].items():
        for f in range(A['frames']):
            im = fr(sh, m, a, f)
            if not any(p[3] for p in im.get_flattened_data()): continue
            twin_tail(im, hair); mantle(im); pauldron(im); px.outline(im)
            put(sh, m, a, f, im)
    sh.save(px.SP(c, 'png'))


if __name__ == '__main__':
    tempest()
    os.system('node "' + os.path.join(HERE, '..', 'sheet-meta.js') + '"')
    print('tempest ok')
