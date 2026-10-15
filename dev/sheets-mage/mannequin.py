# 지팡이 원형 마네킹 + 직업 입히기 (와이어프레임 방식 시안, PixelLab 0회 — docs/specs/legacy-class-sheets.md)
#  부위 가르기: cap/cap1-fight-<cls>.png(전체) 와 cap1-key-<cls>.png(지팡이만 자루 #ff00ff·갈래 #00ff00·구슬 #00ffff 로 칠해 찍은 것)
#    두 장이 다른 칸 = 지팡이 (그 칸의 key 색으로 자루·갈래·구슬). 나머지는 땅에서 잰 띠: 머리 = 땅-19 위, 몸통 = 땅-5 위, 바지, 맨 아래 3줄 신발.
#    살색 칸 중 몸통·바지 띠 = 손. 아주 어두운 칸 = 외곽선.
#  마네킹: 견습 마법사 몸에서 모자·머리카락을 빼고(민머리 + 눈) 부위마다 다른 색 3단으로 칠한다 → mq/staff.png (96칸, 발 44·88)
#    PixelLab 애니가 이 색을 지키면 프레임마다 부위를 색으로 다시 가를 수 있다 (검사 계열 dev/sheets-sword 와 같은 생각).
#  입히기 dress(cls, M): 마네킹 프레임 M 의 부위 → 직업 그림. 머리(모자·머리카락·관·후광)와 지팡이 머리(갈래+구슬)는 직업 그림에서 통째로 옮기고
#    (머리는 마네킹 머리 아랫줄 가운데에 맞춤), 몸통·바지·신발·손은 같은 자리 직업 색 → 없으면 직업 부위 3단 색.
#    지팡이는 덧그리기: 공용 dev/sheets-common/wpn.py — 직업 지팡이 그림을 마네킹 손 점·끝 방향에 돌려 얹는다.
#  python -I -B mannequin.py  → mq/staff.png, mq/dress-<cls>.png, mq/electro-b.png (뇌전술사 새 머리 시안) + 미리보기
import os, sys, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build import tidy, palette, OUT_C, lum
sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
from wpn import WeaponSprite, overlay, grip_tip

IDS = ['mage', 'pyromancer', 'cryomancer', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor']
KEY = {'shaft': (255, 0, 255), 'fork': (0, 255, 0), 'orb': (0, 255, 255)}
RAMP = {
    'head': [(0x8a, 0x7a, 0x6a), (0xc8, 0xb4, 0x9c), (0xec, 0xdc, 0xc4)],
    'torso': [(0x6a, 0x1f, 0x22), (0xa8, 0x32, 0x3a), (0xd9, 0x55, 0x5c)],
    'legs': [(0x22, 0x30, 0x5a), (0x3a, 0x4f, 0x8c), (0x5c, 0x75, 0xb8)],
    'boots': [(0x3a, 0x26, 0x18), (0x5e, 0x3e, 0x26), (0x86, 0x60, 0x3c)],
    'hand': [(0x8a, 0x6a, 0x2a), (0xc9, 0x9a, 0x3a), (0xec, 0xc7, 0x60)],
    'shaft': [(0x30, 0x60, 0x30), (0x4c, 0x90, 0x48), (0x78, 0xc0, 0x70)],
    'fork': [(0x6a, 0x2a, 0x8a), (0x9a, 0x48, 0xc0), (0xc8, 0x80, 0xe8)],
    'orb': [(0x1a, 0x7a, 0x8a), (0x30, 0xb8, 0xc8), (0x90, 0xf0, 0xf8)],
}
EYE = (0x0b, 0x0d, 0x14)
SKIN = [(240, 194, 154), (232, 176, 128), (232, 224, 240)]
BODY = ('torso', 'legs', 'boots', 'hand')


def img(name):
    return Image.open(os.path.join(HERE, 'cap', name + '.png')).convert('RGBA')


def near(c, cs):
    return min(cs, key=lambda p: sum((p[i] - c[i]) ** 2 for i in range(3)))


def parts(cls):
    """{(x,y): 부위} + 띠 (목, 허리, 땅)"""
    F, K = img(f'cap1-fight-{cls}'), img(f'cap1-key-{cls}')
    f, k = F.load(), K.load()
    ground = F.getbbox()[3] - 1
    neck, belt = ground - 19, ground - 5
    out = {}
    for y in range(F.height):
        for x in range(F.width):
            c = f[x, y]
            if not c[3]: continue
            if k[x, y][:3] != c[:3] and k[x, y][3]:
                kc = k[x, y][:3]
                # 그늘진 key 색도 가장 가까운 key 로 (어두운 외곽선 칸은 외곽선)
                out[x, y] = 'line' if lum(kc) < 24 else min(KEY, key=lambda n: sum((KEY[n][i] / 255 * max(kc) - kc[i]) ** 2 for i in range(3)))
                continue
            if lum(c) < 24: out[x, y] = 'line'; continue
            skin = sum((c[i] - near(c, SKIN)[i]) ** 2 for i in range(3)) < 300
            if y < neck: out[x, y] = 'head'
            elif skin: out[x, y] = 'hand'
            elif y < belt: out[x, y] = 'torso'
            elif y > ground - 3: out[x, y] = 'boots'
            else: out[x, y] = 'legs'
    return F, out, (neck, belt, ground)


def shade3(F, ps):
    """칸들의 밝기 3등분 → {칸: 0/1/2}"""
    f = F.load(); ls = sorted(lum(f[p]) for p in ps)
    if not ls: return {}
    t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
    return {p: 0 if lum(f[p]) < t1 else 1 if lum(f[p]) < t2 else 2 for p in ps}


def mannequin():
    F, P, (neck, belt, ground) = parts('mage')
    f = F.load()
    o = Image.new('RGBA', F.size); O = o.load()
    groups = {}
    for p, k in P.items(): groups.setdefault(k, []).append(p)
    for k, ps in groups.items():
        if k == 'line':
            for p in ps:
                if p[1] >= neck: O[p] = OUT_C
            continue
        if k == 'head': continue
        for p, i in shade3(F, ps).items(): O[p] = RAMP[k][i] + (255,)
    # 민머리: 머리 띠의 얼굴(살색) 칸 상자에서 위로 4칸 올린 둥근 머리, 눈은 그대로
    face = [p for p, k in P.items() if k == 'head' and sum((f[p][i] - near(f[p], SKIN)[i]) ** 2 for i in range(3)) < 300]
    eyes = [p for p, k in P.items() if k in ('head', 'line') and p[1] < neck and face and min(q[1] for q in face) <= p[1] <= max(q[1] for q in face)
            and min(q[0] for q in face) < p[0] < max(q[0] for q in face) and lum(f[p]) < 50]
    x0, x1 = min(p[0] for p in face) - 1, max(p[0] for p in face) + 1
    y0, y1 = min(p[1] for p in face) - 4, neck
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 0.5, (y1 - y0) / 2 + 0.5
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            if dx * dx + dy * dy <= 1.0 and not O[x, y][3]:
                lit = (dx * 0.6 - dy * 0.8)
                O[x, y] = RAMP['head'][2 if lit > 0.45 else 0 if lit < -0.55 else 1] + (255,)
    for p in eyes: O[p] = EYE + (255,)
    return tidy(o, [c + (255,) for r in RAMP.values() for c in r] + [OUT_C])


def classify(M):
    pal = [(c, k, i) for k, r in RAMP.items() for i, c in enumerate(r)]
    m, out = M.load(), {}
    for y in range(M.height):
        for x in range(M.width):
            c = m[x, y]
            if not c[3]: continue
            if lum(c) < 24: out[x, y] = ('line', 0); continue
            b = min(pal, key=lambda p: 3 * (p[0][0] - c[0]) ** 2 + 6 * (p[0][1] - c[1]) ** 2 + 2 * (p[0][2] - c[2]) ** 2)
            out[x, y] = (b[1], b[2])
    return out


def ramp_of(cols):
    if not cols: return None
    cs = sorted(cols, key=lum); n = len(cs); out = []
    for a, b in ((0, n // 3), (n // 3, 2 * n // 3), (2 * n // 3, n)):
        seg = cs[a:max(b, a + 1)]; out.append(max(set(seg), key=seg.count))
    return out


def anchor(ps):
    ys = max(p[1] for p in ps); xs = [p[0] for p in ps if p[1] == ys]
    return (sum(xs) / len(xs), ys)


def comps(ps):
    """칸 목록 → 8방향으로 이어진 덩어리들"""
    left, out = set(ps), []
    while left:
        st = [left.pop()]; c = []
        while st:
            p = st.pop(); c.append(p)
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (p[0] + a, p[1] + b)
                    if q in left: left.remove(q); st.append(q)
        out.append(c)
    return out


def biggest(ps):
    """8방향으로 이어진 가장 큰 덩어리 (부위색이 조금 번져 다른 곳에 생긴 칸은 뺀다)"""
    left, best = set(ps), []
    while left:
        st = [left.pop()]; c = []
        while st:
            p = st.pop(); c.append(p)
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (p[0] + a, p[1] + b)
                    if q in left: left.remove(q); st.append(q)
        if len(c) > len(best): best = c
    return best


def centroid(ps):
    return (sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps))


def dress(cls, M, head_img=None):
    """마네킹 프레임 M → cls 그림. head_img 를 주면 머리를 그 그림(직업 그림과 같은 좌표)에서 옮긴다 (새 머리 시안)"""
    F, P, (neck, belt, ground) = parts(cls)
    f = F.load(); Hsrc = (head_img or F).load()
    mp = classify(M)
    o = Image.new('RGBA', M.size); O = o.load()
    # 직업 부위 3단 색
    cols = {}
    for p, k in P.items(): cols.setdefault(k, []).append(f[p][:3])
    R = {k: ramp_of(v) for k, v in cols.items()}
    # 몸: 같은 자리가 같은 부위면 직업 색, 아니면 직업 램프 (없으면 마네킹 램프 그대로)
    for p, (k, i) in mp.items():
        if k in ('head', 'shaft', 'fork', 'orb'): continue        # 지팡이는 덧그리기
        if k == 'line':
            # 몸 부위에 닿은 외곽선만 (마네킹 민머리·지팡이·애니 빛줄기의 외곽선은 그리지 않는다 — 머리·지팡이는 따로 옮겨 그리고 tidy 가 다시 두른다)
            if any(mp.get((p[0] + a, p[1] + b), ('',))[0] in BODY for a in (-1, 0, 1) for b in (-1, 0, 1)): O[p] = OUT_C
            continue
        if P.get(p) == k or (k in BODY and P.get(p) in BODY): O[p] = f[p]; continue      # 같은 자리 직업 몸 색 (무늬 유지)
        r = R.get(k) or R.get('torso') if k != 'shaft' else R.get('shaft')
        O[p] = (r[i] if r else RAMP[k][i]) + (255,)
    # 소품: 마네킹 실루엣 밖의 직업 몸통·바지 띠 칸 (망토 자락). 마네킹 몸통 무게중심 이동량으로 옮긴다
    mt = [p for p, (k, i) in mp.items() if k == 'torso']; ct = [p for p, k in P.items() if k == 'torso']
    tdx, tdy = (round(centroid(mt)[0] - centroid(ct)[0]), round(centroid(mt)[1] - centroid(ct)[1])) if mt and ct else (0, 0)
    for p, k in P.items():
        q = (p[0] + tdx, p[1] + tdy)
        if k not in ('torso', 'legs', 'boots') or not (0 <= q[0] < o.width and 0 <= q[1] < o.height): continue     # 망토 자락만 (머리 띠는 머리와 같이, 손·지팡이는 따로)
        if q not in mp and not O[q][3]: O[q] = f[p]
    # 머리: 직업 머리 띠 칸(외곽선 포함)을 마네킹 머리 아랫줄 가운데에 맞춰 옮긴다
    # 마네킹 머리 = 머리색 덩어리 중 몸통에 닿은 것 (애니가 그린 흰 덩어리처럼 머리색으로 잡힌 떨어진 칸은 뺀다)
    torso = {p for p, (k, i) in mp.items() if k in ('torso', 'hand')}
    hcs = comps([p for p, (k, i) in mp.items() if k == 'head'])
    touch = [c for c in hcs if any((p[0] + a, p[1] + b) in torso for p in c for a in (-2, -1, 0, 1, 2) for b in (-2, -1, 0, 1, 2))]
    mh = max(touch, key=len) if touch else []
    STF = ('shaft', 'fork', 'orb')
    near_staff = lambda p: any(P.get((p[0] + a, p[1] + b)) in STF for a in (-1, 0, 1) for b in (-1, 0, 1))
    # 지팡이 칸과 그 둘레 외곽선은 머리에서 뺀다 (지팡이는 덧그리기가 따로 그림)
    hp = [p for p in ((x, y) for y in range(neck) for x in range(F.width)) if Hsrc[p][3] and P.get(p) not in STF
          and not (lum(Hsrc[p]) < 24 and near_staff(p))]
    if mh and hp:
        ax, ay = anchor(mh); bx, by = anchor([p for p in hp if p[1] < neck])
        dx, dy = round(ax - bx), round(ay - by)
        for p in hp:
            q = (p[0] + dx, p[1] + dy)
            if 0 <= q[0] < o.width and 0 <= q[1] < o.height: O[q] = Hsrc[p]
    # 자동 검사 (머리-몸 연결): 옮긴 머리 칸이 몸 칸(2칸 안)에 닿아야 한다. 아니면 o.info['bad'] 로 표시 → pipeline 이 조립 때 이웃 프레임으로 바꾼다
    placed = {(p[0] + dx, p[1] + dy) for p in hp} if (mh and hp) else set()
    bodyp = {p for p, (k, i) in mp.items() if k in BODY}
    bad = 'no-head' if not placed else (None if any((x + a, y + b) in bodyp for (x, y) in placed for a in (-2, -1, 0, 1, 2) for b in (-2, -1, 0, 1, 2)) else 'head-off')
    # 지팡이 덧그리기 (공용 모듈 dev/sheets-common/wpn.py, 0회): 직업 지팡이 그림(전체 캡처와 지팡이 색만 바꾼 key 캡처의 차이)을
    #  마네킹 지팡이 칸의 손 점·끝 방향에 RotSprite 로 돌려 얹고, 쥔 손은 그 위에 다시 그린다
    overdraw_staff(o, mp, cls, P)
    out = tidy(o, palette(F) + palette(img(f'cap1-fight-{cls}')))
    out.info['bad'] = bad
    return out


STF = ('shaft', 'fork', 'orb')
_WS = {}


def staff_sprite(cls, P):
    """직업 지팡이 그림 (wpn.WeaponSprite). 손 점 = 지팡이에 닿은 직업 손 칸"""
    if cls not in _WS:
        sts = {p for p, k in P.items() if k in STF}
        glove = [p for p, k in P.items() if k == 'hand' and any((p[0] + a, p[1] + b) in sts for a in (-1, 0, 1) for b in (-1, 0, 1))]
        _WS[cls] = WeaponSprite.from_capture(img(f'cap1-fight-{cls}'), img(f'cap1-key-{cls}'), glove)
    return _WS[cls]


def staff_grip(mp):
    """마네킹 프레임 → (지팡이 칸, 쥔 손 칸, 손 점, 끝 점).
    지팡이 칸 = 지팡이 부위색의 가장 큰 덩어리 (눈 반짝임처럼 떨어진 구슬색 칸은 뺀다 — 덧그리기 때 같이 지움).
    쥔 손 = 지팡이에 닿은 손 칸, 없으면 손 칸 전체(가장 큰 덩어리) — 애니가 구슬에서 빛줄기를 그려 지팡이 칸이 길어져도 손 점이 손에 붙게"""
    allst = [p for p, (k, i) in mp.items() if k in STF]
    mask = set(biggest(allst))
    hand = [p for p, (k, i) in mp.items() if k == 'hand']
    glove = [p for p in hand if any((p[0] + a, p[1] + b) in mask for a in (-1, 0, 1) for b in (-1, 0, 1))] or biggest(hand)
    orb = [p for p in mask if mp[p][0] == 'orb']
    if not mask: return mask, set(allst), glove, None, None
    hint = centroid(orb) if orb else None
    if not any(mp[p][0] == 'shaft' for p in mask) and glove:
        # 자루가 없다 (애니가 지팡이를 빛줄기로 바꿔 그림): 손에서 가장 먼 칸 쪽을 끝으로 — 손에서 그 방향으로 지팡이를 세운다
        gc = centroid(glove); hint = max(mask, key=lambda p: (p[0] - gc[0]) ** 2 + (p[1] - gc[1]) ** 2)
    g, t = grip_tip(mask, glove, tip_hint=hint)
    if math.hypot(t[0] - g[0], t[1] - g[1]) < 2 and hint: t = hint      # 손 점과 끝 점이 겹치면 끝 = hint
    return mask, set(allst) - mask, glove, g, t


def overdraw_staff(o, mp, cls, P):
    mask, stray, glove, g, t = staff_grip(mp)
    if not mask: return
    out = overlay(o, mask | stray, g, t, staff_sprite(cls, P), front=glove)
    o.paste(out, (0, 0))


def electro_head():
    """뇌전술사 새 머리 시안 (로드맵: 모자 대신 뻗친 머리 + 뿔 장식 관). 직업 그림 좌표 그대로 머리 띠만 다시 그린다."""
    F = img('cap1-fight-electromancer'); o = F.copy(); px = o.load()
    hair = [(167, 144, 53), (232, 200, 74), (255, 224, 102)]
    navy = [(38, 38, 74), (58, 58, 106), (117, 117, 150)]
    horn = [(105, 105, 124), (183, 227, 255), (255, 255, 255)]
    # 모자(남색·밝은 테) 칸을 지운다: 얼굴 윗줄(59)보다 위
    for y in range(40, 59):
        for x in range(30, 58): px[x, y] = (0, 0, 0, 0)
    for x in range(34, 56):                                   # 챙 줄 = 이마의 뒷머리 색으로
        if px[x, 59][3] and px[x, 58][3] == 0: pass
    cx = 43                                                    # 머리 가운데 (얼굴 36~52)
    # 뻗친 머리: 둥근 머리 위로 뒤(왼쪽)로 누운 번개 모양 다발 셋
    dome = {58: (35, 52), 57: (35, 52), 56: (36, 51), 55: (37, 50), 54: (39, 48)}
    for y, (a, b) in dome.items():
        for x in range(a, b + 1): px[x, y] = hair[2 if (x - cx) > 2 and y < 56 else 0 if x < 38 else 1] + (255,)
    spikes = [[(37, 53), (36, 52), (35, 51), (34, 51), (33, 50), (32, 49)], [(41, 53), (40, 52), (40, 51), (39, 50), (38, 49), (38, 48), (37, 47)],
              [(35, 56), (34, 55), (33, 55), (32, 54), (31, 54), (30, 53)], [(34, 58), (33, 58), (32, 57), (31, 57)]]
    for sp in spikes:
        for j, (x, y) in enumerate(sp):
            px[x, y] = hair[1 if j < len(sp) - 2 else 2] + (255,)
            if j < len(sp) - 2: px[x, y + 1] = hair[0] + (255,)
    # 관: 이마 띠(58줄) 남색 + 가운데 앞쪽 보석, 띠 양끝에서 V 로 벌어지는 번개 뿔 둘
    for x in range(36, 52): px[x, 58] = navy[1 if 38 <= x <= 49 else 0] + (255,)
    px[48, 58] = horn[2] + (255,); px[47, 58] = horn[1] + (255,)
    for base, d in ((39, -1), (49, 1)):
        x, pts = base, []
        for k, y in enumerate(range(57, 47, -1)):
            if k in (2, 5, 7): x += d
            pts.append((x, y))
            px[x, y] = horn[1] + (255,); px[x + (1 if d > 0 else -1), y] = horn[0 if k < 6 else 1] + (255,)
        tx, ty = pts[-1]; px[tx, ty - 1] = horn[2] + (255,)
    pal = palette(F) + [c + (255,) for c in horn + navy + hair if c + (255,) not in palette(F)]
    return tidy(o, pal)


def sheet(ims, labels, path, S=4, sil=False, crop=(14, 34, 78, 96), gray=False):
    W, H = crop[2] - crop[0], crop[3] - crop[1]
    out = Image.new('RGBA', (W * S * len(ims), H * S + 14), (18, 20, 27, 255)); d = ImageDraw.Draw(out)
    for i, im in enumerate(ims):
        c = im.crop(crop)
        if sil:
            q = Image.new('RGBA', c.size); a, b = c.load(), q.load()
            for y in range(c.height):
                for x in range(c.width):
                    if a[x, y][3]: b[x, y] = (230, 230, 236, 255)
            c = q
        if gray:
            g = c.convert('LA').convert('RGBA'); g.putalpha(c.getchannel('A')); c = g
        out.alpha_composite(c.resize((W * S, H * S), Image.NEAREST), (W * S * i, 0))
        d.rectangle([W * S * i, 0, W * S * (i + 1) - 1, H * S - 1], outline=(50, 54, 68))
        d.text((W * S * i + 4, H * S + 1), labels[i], fill=(170, 176, 196))
    out.save(path)


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'mq'), exist_ok=True)
    M = mannequin(); M.save(os.path.join(HERE, 'mq', 'staff.png'))
    eh = electro_head(); eh.save(os.path.join(HERE, 'mq', 'electro-head.png'))
    D = {c: dress(c, M, head_img=eh if c == 'electromancer' else None) for c in IDS}     # 뇌전술사 = 시안 B 확정 (2026-10-16)
    for c, im in D.items(): im.save(os.path.join(HERE, 'mq', f'dress-{c}.png'))
    eb = dress('electromancer', M, head_img=eh); eb.save(os.path.join(HERE, 'mq', 'electro-b.png'))
    orig = [img(f'cap1-fight-{c}') for c in IDS]
    sheet([M] + orig, ['mannequin'] + IDS, os.path.join(HERE, 'mq', '_orig.png'))
    sheet([M] + [D[c] for c in IDS], ['mannequin'] + IDS, os.path.join(HERE, 'mq', '_dress.png'))
    sheet([M] + [D[c] for c in IDS], ['mannequin'] + IDS, os.path.join(HERE, 'mq', '_dress-gray.png'), gray=True)
    sheet([M] + orig, ['mannequin'] + IDS, os.path.join(HERE, 'mq', '_orig-gray.png'), gray=True)
    tri = [img('cap1-fight-mage'), img('cap1-fight-electromancer'), eb, img('cap1-fight-thunderEmperor')]
    sheet(tri, ['mage', 'electro now', 'electro B', 'thunderEmp'], os.path.join(HERE, 'mq', '_electro.png'))
    sheet(tri, ['mage', 'electro now', 'electro B', 'thunderEmp'], os.path.join(HERE, 'mq', '_electro-sil.png'), sil=True)
    sheet(tri, ['mage', 'electro now', 'electro B', 'thunderEmp'], os.path.join(HERE, 'mq', '_electro-gray.png'), gray=True)
    print('ok')
