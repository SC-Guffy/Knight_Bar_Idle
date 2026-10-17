# 걷기 skeleton-v3 8f (로드맵 승인 2026-10-18, 5종 × 3): 첫 프레임 = 다리 드러난 중립 서기(work/<cls>/neutral-0.png, 발 59 맞춤·팔레트 고정)
#  192칸에 2배(캐릭터 ~48%), 직업마다 중립 그림의 키·발 위치에서 관절을 잡고 8프레임 걸음(보폭 크게·무릎 들기·몸 오르내림).
#  후처리: 2배 최빈색으로 64칸 → 다리(엉덩이 줄 아래)는 생성 결과, 상체·무기는 중립 그림을 몸 오르내림만큼 옮겨 붙임(디자인 고정).
#  python -I -B skel_walk.py plan [cls ...]  → anim/<cls>-skelwalk-req.json, anim/_skelwalk-stick.png
#  python -I -B skel_walk.py post [cls ...]  → anim/<cls>-walkK-strip.png, anim/<cls>-walkK-x4.gif
import os, sys, json, math, base64, io
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim')
sys.path.insert(0, HERE)
N, K, OFF = 192, 2, (32, 62)
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}
DESC = {
    'paladin': 'small chibi holy paladin knight, white and cream plate armor with gold trim, golden halo above the visored helmet, kite shield with gold cross on the left arm, golden sword held upright at the chest',
    'squire': 'small chibi young squire, round steel cap with open face, brown leather jerkin over a cream tunic, small round wooden buckler, short sword held at the chest',
    'archon': 'small chibi celestial archon knight, white and gold plate armor, big visored helmet with a ring of gold stars above, star kite shield, golden longsword held upright',
    'tyrant': 'small chibi tyrant king knight, steel helmet with spiked gold crown, crimson cape, spiked pauldrons, huge greatsword with a red rune held upright',
    'swordsaint': 'small chibi sword saint samurai, kabuto with huge gold crescent horns, white hair and white scarf, dark navy armor, navy hakama, blue curved katana',
}


LIT = {   # 10단계 (로드맵 승인 6): 다리 구역만 앞다리 밝은 3톤·뒷다리 어두운 3톤으로 다시 칠한 원본 (어두운 한 덩어리 → 두 다리)
    'tyrant': ([(168, 172, 186), (122, 126, 142), (78, 80, 94)], [(96, 99, 114), (64, 66, 79), (40, 41, 52)]),
    'swordsaint': ([(150, 140, 200), (112, 102, 160), (74, 66, 112)], [(88, 80, 130), (60, 54, 92), (36, 33, 58)]),
}
LITDESC = {'tyrant': ', light steel greaves, front leg brighter than back leg', 'swordsaint': ', light lavender hakama legs, front leg brighter than back leg'}
LV = os.environ.get('LIT') == '1'
NV = os.environ.get('NEW') == '1'      # 12단계 B: 새 디자인(newanim/<cls>-src.png, 칼 든 채) 첫 프레임 — 상체·칼은 그대로 붙임
WR = {'greatswordsman': 6, 'tyrant': 6}   # 다리 구역 오른쪽 끝 (발 가운데 + 칸) — 대검이 그 너머에 서 있음
NDESC = {
    'squire': 'small chibi young squire, messy brown hair, cream padded gambeson, round wooden buckler, short iron sword in hand',
    'swordsman': 'small chibi knight, open-face steel helmet with a tall blue plume, short blue cape, steel breastplate, blue tabard, steel longsword in hand',
    'paladin': 'small chibi paladin, white and gold full plate, great helm with gold cross visor, kite shield with golden sun, short golden sword in hand',
    'blademaster': 'small chibi ronin, long black high ponytail, red headband, indigo kimono, red sash, wide black hakama, curved katana in hand',
    'greatswordsman': 'small chibi black swordsman, spiky black hair, dark iron armor, tattered black cape, enormous slab iron greatsword held upright',
    'archon': 'small chibi archon knight, white and gold plate, great helm with gold stars above, small glowing gold wings, blue cape, golden longsword',
    'tyrant': 'small chibi berserker tyrant, black spiked armor, wolf-skull helmet with red eyes, tattered black cape, giant slab greatsword',
    'swordsaint': 'small chibi sword saint, long white high ponytail, gold crescent ornament, white and gold haori, dark hakama, glowing blue katana',
}
TV = os.environ.get('STAND') == '1'   # 12단계 C: 첫 프레임 = 다리 드러난 옆모습 서기 (work/<cls>/nstand-0.png), 다리 앞 밝게·뒤 어둡게
TAG = 'T' if TV else ('N' if NV else ('L' if LV else ''))


def neutral(cls):
    if NV:
        import build_new as B
        src = Image.open(os.path.join(HERE, 'newanim', f'{cls}-src.png')).convert('RGBA'); pal = B.pal_of(src)
        if not TV: return B.lock(src, pal)
        im, _ = B.foot_align(B.lock(Image.open(os.path.join(HERE, 'work', cls, 'nstand-0.png')).convert('RGBA'), pal))
        return lit_auto(im)
    import walk_script as W
    n = W.neutral(cls)
    return lit(cls, n) if LV and cls in LIT else n


def lit_auto(n):
    """다리 구역(엉덩이 3줄 아래, 발 가운데 ±10)만 앞다리 +28% 밝게 · 뒷다리 -18% 어둡게 (외곽선은 그대로) — 두 다리가 갈려 보이게"""
    cx, top, bot, H = frame_geo(n); hip = int(round(bot - 0.30 * H)) + 3; P = n.load()
    for y in range(hip, 64):
        for x in range(max(0, int(cx) - 10), min(64, int(cx) + 11)):
            c = P[x, y]
            if not c[3] or sum(c[:3]) < 60: continue
            f = 1.28 if x >= cx else 0.82
            P[x, y] = tuple(min(255, round(v * f + (12 if f > 1 else 0))) for v in c[:3]) + (255,)
    return n


def lit(cls, n):
    cx, top, bot, H = frame_geo(n); hip = int(round(bot - 0.30 * H)) + 3; P = n.load()
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    pts = [(x, y) for y in range(hip, 64) for x in range(int(cx) - 10, int(cx) + 11) if P[x, y][3] and not (P[x, y][0] > 70 and P[x, y][0] > P[x, y][1] * 1.6)]
    ls = sorted(lum(P[p]) for p in pts); t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
    for x, y in pts:
        c = P[x, y]; l = lum(c)
        if l < 22: continue                                                            # 외곽선은 그대로
        ramp = LIT[cls][0] if x >= cx else LIT[cls][1]
        P[x, y] = ramp[0 if l >= t2 else 1 if l >= t1 else 2] + (255,)
    return n


def frame_geo(im):
    P = im.load(); op = [(x, y) for y in range(64) for x in range(64) if P[x, y][3]]
    top = min(y for _, y in op); bot = max(y for _, y in op)
    feet = [x for x, y in op if y >= bot - 5]; cx = sum(feet) / len(feet); H = bot - top
    return cx, top, bot, H


def T(p):
    return (p[0] * K + OFF[0], p[1] * K + OFF[1])


def pose(cx, bot, H, t=None):
    """64칸 좌표로 관절 → 192. t=None 이면 첫 프레임(중립, 발 조금 벌림). 걸음: 오른다리 위상 2πt/8, 왼다리 +π"""
    hip_y = bot - 0.30 * H; neck_y = bot - 0.60 * H; head_y = bot - 0.80 * H
    if t is None: ph, bob, A, lift = 0, 0, 0, 0
    else: ph = 2 * math.pi * t / 8; bob = -abs(math.cos(ph)) * 1.0 + 0.5; A, lift = 6.5, 3.5
    p = {}
    p['NECK'] = (cx + 1, neck_y + bob)
    p['RIGHT SHOULDER'] = (cx + 3, neck_y + 1.5 + bob); p['LEFT SHOULDER'] = (cx - 2, neck_y + 1.5 + bob)
    for side, sh, sgn in (('RIGHT', p['RIGHT SHOULDER'], 1), ('LEFT', p['LEFT SHOULDER'], -1)):
        sw = 0 if t is None else -sgn * 2.5 * math.sin(ph)                     # 팔은 다리와 반대로 흔듦
        p[f'{side} ELBOW'] = (sh[0] + sw * 0.5 + sgn * 0.5, sh[1] + 4)
        p[f'{side} ARM'] = (sh[0] + sw + sgn * 0.5, sh[1] + 8)
    for side, sgn, dph in (('RIGHT', 1, 0), ('LEFT', -1, math.pi)):
        q = ph + dph
        hx = cx + sgn * 1.5
        p[f'{side} HIP'] = (hx, hip_y + bob)
        if t is None: fx, fy = cx + sgn * 2.5, bot
        else: fx, fy = cx + A * math.sin(q), bot - lift * max(0.0, math.cos(q))
        kx = (hx + fx) / 2 + 2 + (lift * 0.5 * max(0.0, math.cos(q)) if t is not None else 0); ky = (hip_y + bob + fy) / 2
        p[f'{side} KNEE'] = (kx, ky); p[f'{side} LEG'] = (fx, fy)
    for k, (dx, dy) in {'NOSE': (5, 0), 'RIGHT EYE': (4, -1.5), 'LEFT EYE': (1, -1.5), 'RIGHT EAR': (0, -1), 'LEFT EAR': (-3, -1)}.items():
        p[k] = (cx + dx, head_y + dy + bob)
    return {k: T(v) for k, v in p.items()}, bob


def kp(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'), ('LEFT SHOULDER', 'LEFT ELBOW'),
         ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG')]


def stick(p, under=None):
    im = Image.new('RGBA', (N, N), (20, 22, 30, 255))
    if under is not None: u = under.copy(); u.putalpha(u.split()[3].point(lambda a: a // 3)); im.alpha_composite(u)
    d = ImageDraw.Draw(im)
    for a, b in BONES: d.line([p[a], p[b]], fill=(255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230), width=2)
    return im.crop((40, 50, 170, 192))


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def plan(classes):
    rows = []
    for cls in classes:
        nim = neutral(cls); cx, top, bot, H = frame_geo(nim)
        first = Image.new('RGBA', (N, N)); first.alpha_composite(nim.resize((128, 128), Image.NEAREST), OFF)
        base, _ = pose(cx, bot, H); fr = [pose(cx, bot, H, t)[0] for t in range(8)]
        body = {'description': (NDESC[cls] if NV else DESC[cls] + (LITDESC[cls] if LV and cls in LIT else '')) + ', legs clearly separated', 'action': 'walking forward with long strides, knees lifting, arms swinging slightly',
                'direction': 'east', 'view': 'side', 'first_frame': b64(first), 'first_frame_keypoints': kp(base), 'keypoints': [kp(p) for p in fr],
                'template_id': 'mannequin', 'seed': 47 if NV else 43 if LV else 41, 'no_background': True}
        json.dump(body, open(os.path.join(A, f'{cls}-skelwalk{TAG}-req.json'), 'w'))
        rows.append([stick(base, first)] + [stick(p) for p in fr])
    W, H2 = rows[0][0].size; m = Image.new('RGBA', ((W + 4) * 9, (H2 + 4) * len(rows)), (40, 42, 52, 255))
    for r, row in enumerate(rows):
        for i, t in enumerate(row): m.paste(t, (i * (W + 4), r * (H2 + 4)))
    m.save(os.path.join(A, f'_skelwalk{TAG}-stick.png')); print('plan', classes)


FIX = ('tyrant', 'swordsaint')     # 비평 2개 미달 → 무료 수리 1회: 다리 구역 색을 중립 그림 하체 색으로만 고정 (프레임마다 보라·검정 깜빡임), 파천검왕은 생성 망토(붉은 칸)를 다리에서 뺌


def fix_legs(cls, d, nim, hip):
    lp = sorted({c for c in nim.crop((0, hip, 64, 64)).getdata() if c[3]})
    if cls == 'tyrant': lp = [c for c in lp if not (c[0] > 70 and c[0] > c[1] * 1.6)] or lp
    D = d.load()
    for y in range(hip, 64):
        for x in range(64):
            c = D[x, y]
            if not c[3]: continue
            if cls == 'tyrant' and c[0] > 70 and c[0] > c[1] * 1.6: D[x, y] = (0, 0, 0, 0); continue
            D[x, y] = min(lp, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
    return d


def post(classes):
    import anim_post as AP
    for cls in classes:
        nim = neutral(cls); cx, top, bot, H = frame_geo(nim); hip = int(round(bot - 0.30 * H)) + 3   # 생성 다리는 엉덩이 3줄 아래부터 (칼 조각·치마 색 튐 빼기)
        pal = sorted({c for c in nim.getdata() if c[3]})
        fr = []
        for t in range(8):
            raw = Image.open(os.path.join(HERE, 'work', cls, f'skelwalk{TAG}-{t}.png')).convert('RGBA')
            AP.K, AP.OFF, AP.V2 = K, OFF, True
            d = AP.main_blob(AP.down(raw, pal)); _, bob = pose(cx, bot, H, t)
            if cls in FIX or LV or NV: d = fix_legs(cls, d, nim, hip)
            x0, x1 = int(cx) - 10, int(cx) + (WR.get(cls, 10) if NV else 10) + 1; b = round(bob)   # WR: 다리 옆에 세운 대검은 원본 그대로
            o = Image.new('RGBA', (64, 64)); o.alpha_composite(d.crop((x0, hip, x1, 64)), (x0, hip))   # 다리: 생성 결과 (발 중심 ±10칸만 — 생성 칼 가로획 빼기)
            low = nim.crop((0, hip, 64, 64)); low.paste((0, 0, 0, 0), (x0, 0, x1, low.height))
            o.alpha_composite(low, (0, hip + b)) if hip + b >= 0 else None                               # 다리 구역 밖(방패 끝·칼끝): 중립 그림
            o.alpha_composite(nim.crop((0, 0, 64, hip)), (0, b))                                         # 상체·무기: 중립 그림 고정
            fr.append(o)
        st = Image.new('RGBA', (64 * 8, 64)); [st.alpha_composite(f, (64 * i, 0)) for i, f in enumerate(fr)]
        st.save(os.path.join(A, f'{cls}-walk{TAG or "K"}-strip.png'))
        g = []
        for f in fr:
            b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        g[0].save(os.path.join(A, f'{cls}-walk{TAG or "K"}-x4.gif'), save_all=True, append_images=g[1:], duration=100, loop=0)
        print(cls, 'post ok')


if __name__ == '__main__':
    cls = sys.argv[2:] or list(NDESC if NV else DESC)
    plan(cls) if sys.argv[1] == 'plan' else post(cls)
