# 마지막 49회 계획 (docs/specs/legacy-class-sheets.md "구독 끝나기 전 마지막 49회 계획") — 창기사 계열 옆모습 대기·걷기.
#  기준 그림 = 그 직업 평타A 0번(평타 시작·끝 자세, 옆모습으로 무기를 세워 듦). 대기·전투 대기·피격·사망은 이 그림에서 코드로(유료 0),
#  걷기만 animate-with-skeleton-v3 8f(usage 3): 첫 프레임 = 기준 그림에서 무기를 코드로 지운 몸, 팔은 그대로 두고 다리만 걷기 → 무기는 다시 얹는다.
#   python3 dev/spear/side49/walk.py first <cls>     → <cls>/first.png (192칸), <cls>/grid.png (관절 읽기용), <cls>/weapon.png
#   python3 dev/spear/side49/walk.py req <cls> [seed] → <cls>/req.json, <cls>/stick.png (막대 인형 확인)
#   python3 dev/spear/side49/walk.py call <cls>       → PixelLab 호출 (approved.txt 에 <cls>/walk 가 있어야, 상한 49 · usage 합계 usage.json)
#   python3 dev/spear/side49/walk.py post <cls>       → <cls>/walk-<i>.png (시트 칸), <cls>/walk-strip.png, <cls>/walk.gif
#   python3 dev/spear/side49/walk.py install <cls>    → src/sprites/<cls>.png/.json 의 idle·guard·walk·hurt·death·sit 줄만 바꿈 (평타·시전 줄 그대로, 원본은 <cls>/orig.png)
import os, sys, json, math, time, base64, io
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'pixellab'))
N = 192; OUT_C = (0x0b, 0x0d, 0x14, 255)
CAP = 49
USAGE = os.path.join(HERE, 'usage.json'); LOG = os.path.join(HERE, 'usage.md'); APPROVED = os.path.join(HERE, 'approved.txt')

# 직업별: 무기 지우는 규칙(시트 칸 좌표, 이 칸들은 무기) · 첫 프레임에서 눈으로 읽은 관절(시트 칸 좌표) · 설명
CFG = {
    'halberdier': {
        'weapon': lambda x, y: x >= 58,
        # grid.png 로 읽음 (시트 100칸). RIGHT = 가까운 쪽(화면 왼쪽 큰 어깨갑), LEFT = 먼 쪽(무기 쥔 손)
        'kp': {'NECK': (49, 64), 'NOSE': (53, 61), 'RIGHT EYE': (52, 60), 'LEFT EYE': (50, 60), 'RIGHT EAR': (47, 60), 'LEFT EAR': (45, 60.5),
               'RIGHT SHOULDER': (44, 67), 'RIGHT ELBOW': (43, 71), 'RIGHT ARM': (42.5, 74),
               'LEFT SHOULDER': (53, 67), 'LEFT ELBOW': (55, 69.5), 'LEFT ARM': (57, 71),
               'RIGHT HIP': (46, 78), 'RIGHT KNEE': (45, 82.5), 'RIGHT LEG': (45, 87),
               'LEFT HIP': (52, 78), 'LEFT KNEE': (53, 82.5), 'LEFT LEG': (53, 87)},
        'desc': 'young chibi halberdier knight in grey steel plate armor, open-face steel helmet, big round shoulder pauldron, brown leather apron skirt, steel greaves, '
                'one gauntlet held up at the chest (the halberd is drawn later), side view facing right',
    },
    # 2026-10-23 나머지 (사용자 "같은 방식으로 진행해"). 관절은 각 기준 그림 격자에서 읽음
    'warlord': {
        'weapon': lambda x, y: x >= 60 or (x >= 56 and y <= 54),         # 자루 x60~61 + 도끼날, 날 뒤 가시(머리 위)
        'kp': {'NECK': (51, 67), 'NOSE': (55, 64), 'RIGHT EYE': (54, 63), 'LEFT EYE': (52, 63), 'RIGHT EAR': (49, 63), 'LEFT EAR': (47, 63),
               'RIGHT SHOULDER': (47, 69), 'RIGHT ELBOW': (46, 74), 'RIGHT ARM': (48, 78),
               'LEFT SHOULDER': (56, 69), 'LEFT ELBOW': (58, 71), 'LEFT ARM': (59, 72),
               'RIGHT HIP': (49, 79), 'RIGHT KNEE': (47, 83), 'RIGHT LEG': (46, 87),
               'LEFT HIP': (55, 79), 'LEFT KNEE': (56, 83), 'LEFT LEG': (57, 87)},
        'desc': 'young chibi warlord in dark steel plate armor, horned closed steel helmet with a young face, red cape flowing behind, heavy pauldrons, '
                'one gauntlet held up at the chest (the halberd is drawn later), side view facing right',
    },
    'dragonlord': {
        'weapon': lambda x, y: x >= 37,                                     # 세워 든 용황창 자루
        'kp': {'NECK': (28, 67), 'NOSE': (32, 64), 'RIGHT EYE': (30, 62), 'LEFT EYE': (28, 62.5), 'RIGHT EAR': (26, 62), 'LEFT EAR': (24, 62),
               'RIGHT SHOULDER': (25, 69), 'RIGHT ELBOW': (24, 73), 'RIGHT ARM': (24, 77),
               'LEFT SHOULDER': (31, 69), 'LEFT ELBOW': (33, 71), 'LEFT ARM': (35, 71),
               'RIGHT HIP': (25, 77), 'RIGHT KNEE': (23, 82), 'RIGHT LEG': (22, 87),
               'LEFT HIP': (30, 77), 'LEFT KNEE': (30, 82), 'LEFT LEG': (31, 87)},
        'desc': 'young chibi dragon lord knight, golden spiky hair with dragon horns, dark violet armor with gold trim, big dark violet dragon wings on the back, '
                'one hand held up at the chest (the spear is drawn later), side view facing right',
    },
    'dragoon': {
        'weapon': lambda x, y: x >= 32 and 69 <= y <= 76,                   # 앞으로 겨눈 용창 (몸 앞부분, 창 높이만 — 발끝 조각이 무기로 섞이지 않게)
        'cape_fix': {5: (4, 16)},                                           # 검수 fix: 5번 망토만 크게 퍼짐 → x ≤ 16 을 4번 것으로
        'kp': {'NECK': (24, 64), 'NOSE': (28, 61), 'RIGHT EYE': (27, 60), 'LEFT EYE': (25, 60), 'RIGHT EAR': (23, 60), 'LEFT EAR': (21, 60),
               'RIGHT SHOULDER': (21, 67), 'RIGHT ELBOW': (24, 70), 'RIGHT ARM': (29, 72),
               'LEFT SHOULDER': (26, 67), 'LEFT ELBOW': (28, 69), 'LEFT ARM': (31, 72),
               'RIGHT HIP': (21, 75), 'RIGHT KNEE': (18, 80), 'RIGHT LEG': (17, 86),
               'LEFT HIP': (25, 75), 'LEFT KNEE': (27, 80), 'LEFT LEG': (29, 86)},
        'desc': 'young chibi dragoon knight in violet scale armor, violet dragon helmet, long violet cape, '
                'both hands held forward at the waist (the spear is drawn later), side view facing right',
    },
    'skyGeneral': {
        'weapon': lambda x, y: x >= 31 and 64 <= y <= 77,                   # 앞으로 겨눈 원뿔 랜스 (방패는 몸 그림에 남김, 랜스 높이만)
        'kp': {'NECK': (22, 66), 'NOSE': (27, 63), 'RIGHT EYE': (25, 61), 'LEFT EYE': (23, 61), 'RIGHT EAR': (20, 61), 'LEFT EAR': (18, 61),
               'RIGHT SHOULDER': (18, 67), 'RIGHT ELBOW': (15, 70), 'RIGHT ARM': (12, 70),
               'LEFT SHOULDER': (24, 67), 'LEFT ELBOW': (25, 70), 'LEFT ARM': (27, 72),
               'RIGHT HIP': (19, 77), 'RIGHT KNEE': (17, 82), 'RIGHT LEG': (16, 87),
               'LEFT HIP': (24, 77), 'LEFT KNEE': (25, 82), 'LEFT LEG': (26, 87)},
        'desc': 'young chibi celestial general knight in white and silver plate armor, winged white helmet with a golden halo, round golden shield on the back arm, '
                'one hand held forward at the waist (the lance is drawn later), side view facing right',
    },
    'lancer': {
        # 10-23 둘째: 대기가 예전 디자인(회색 큰 투구)이라 평타·시전(새 디자인)과 달라 → 기준을 평타A 0번으로 (예전 keep_idle 판은 걷기만 바꿨다)
        'weapon': lambda x, y: (76 <= y <= 80 and (x >= 33 or x <= 13)) or (x >= 40 and y <= 84),   # 허리 높이로 가로 든 창 앞·뒤 + 깃발
        'kp': {'NECK': (25, 69), 'NOSE': (30, 66), 'RIGHT EYE': (29, 64), 'LEFT EYE': (27, 64), 'RIGHT EAR': (23, 64), 'LEFT EAR': (21, 64),
               'RIGHT SHOULDER': (22, 71), 'RIGHT ELBOW': (21, 75), 'RIGHT ARM': (23, 78),
               'LEFT SHOULDER': (28, 71), 'LEFT ELBOW': (30, 75), 'LEFT ARM': (32, 78),
               'RIGHT HIP': (22, 80), 'RIGHT KNEE': (21, 84), 'RIGHT LEG': (20, 87),
               'LEFT HIP': (27, 80), 'LEFT KNEE': (28, 84), 'LEFT LEG': (29, 87)},
        'desc': 'young chibi lancer knight with an open-faced steel helmet, green plume, green tabard, short green cape, steel greaves, '
                'both hands held low at the waist (the spear is drawn later), side view facing right',
    },
}
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}
BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'),
         ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'),
         ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]
D = lambda cls: os.path.join(HERE, cls)


def meta(cls):
    return json.load(open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.json')))


def frame(cls, anim, i):
    m = meta(cls); S = m['w']; A = m['anims'][anim]
    im = Image.open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png')).convert('RGBA')
    return im.crop((i * S, A['row'] * S, (i + 1) * S, (A['row'] + 1) * S))


def outline(im):
    im = im.copy(); w, h = im.size; px = im.load(); add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for p in add: px[p] = OUT_C
    return im


def to192(cls):
    """시트 칸 좌표 → 192칸 (발 기준점을 (96, 176) 근처에, 2배)"""
    fx, fy = meta(cls)['foot']
    return lambda p: ((p[0] - fx) * 2 + 96, (p[1] - fy) * 2 + 176)


def split(cls):
    base = frame(cls, *CFG[cls].get('base', ('atkA', 0))); W = CFG[cls]['weapon']
    body, wpn = Image.new('RGBA', base.size), Image.new('RGBA', base.size)
    B, P, Wp = body.load(), base.load(), wpn.load()
    for y in range(base.height):
        for x in range(base.width):
            if P[x, y][3]: (Wp if W(x, y) else B)[x, y] = P[x, y]
    return base, body, wpn


def first(cls):
    os.makedirs(D(cls), exist_ok=True)
    base, body, wpn = split(cls); body = outline(body)
    base.save(os.path.join(D(cls), 'base.png')); body.save(os.path.join(D(cls), 'body.png')); wpn.save(os.path.join(D(cls), 'weapon.png'))
    fx, fy = meta(cls)['foot']; S = base.width
    big = Image.new('RGBA', (N, N)); big.alpha_composite(body.resize((S * 2, S * 2), Image.NEAREST), (96 - fx * 2, 176 - fy * 2))
    big.save(os.path.join(D(cls), 'first.png'))
    # 관절 확인: 시트 칸 위에 읽은 관절
    Zm = 10; g = Image.new('RGBA', (S * Zm, S * Zm), (30, 32, 40, 255)); g.alpha_composite(base.resize((S * Zm, S * Zm), Image.NEAREST)); d = ImageDraw.Draw(g)
    kp = CFG[cls]['kp']
    for a, b in BONES: d.line([(kp[a][0] * Zm, kp[a][1] * Zm), (kp[b][0] * Zm, kp[b][1] * Zm)], fill=(255, 220, 90), width=2)
    bb = base.getbbox(); g.crop(((bb[0] - 4) * Zm, (bb[1] - 4) * Zm, (bb[2] + 4) * Zm, (bb[3] + 4) * Zm)).save(os.path.join(D(cls), 'grid.png'))
    print('first', cls, 'body bbox', body.getbbox(), 'weapon px', sum(1 for p in wpn.getdata() if p[3]))


def walk_seq(cls):
    """다리만 걷기 (8f): 골반을 축으로 허벅지 ±30°, 들어 올린 다리는 무릎을 굽힘. 윗몸·팔은 그대로, 들썩임 1.5칸(192)"""
    t = to192(cls); kp = {k: t(v) for k, v in CFG[cls]['kp'].items()}
    TH = (math.dist(kp['RIGHT HIP'], kp['RIGHT KNEE']) + math.dist(kp['LEFT HIP'], kp['LEFT KNEE'])) / 2
    SH = (math.dist(kp['RIGHT KNEE'], kp['RIGHT LEG']) + math.dist(kp['LEFT KNEE'], kp['LEFT LEG'])) / 2
    ground = max(kp['RIGHT LEG'][1], kp['LEFT LEG'][1]); P = lambda o, a, L: (o[0] + L * math.cos(math.radians(a)), o[1] + L * math.sin(math.radians(a)))
    seq = []
    for i in range(8):
        ph = i * math.pi / 4
        legs = {'RIGHT': (90 - 30 * math.cos(ph), 95 - 25 * max(0, math.sin(ph))), 'LEFT': (90 + 30 * math.cos(ph), 95 - 25 * max(0, -math.sin(ph)))}
        p = dict(kp)
        for s, (a1, a2) in legs.items():
            k = P(kp[f'{s} HIP'], a1, TH); p[f'{s} KNEE'] = k; p[f'{s} LEG'] = P(k, a2, SH)
        dy = ground - max(p['RIGHT LEG'][1], p['LEFT LEG'][1]) - 1.5 * abs(math.sin(ph))
        p = {k: (v[0], v[1] + dy) for k, v in p.items()}
        seq.append(p)
    return kp, seq


def kpl(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


def req(cls, seed=7):
    kp0, seq = walk_seq(cls)
    buf = io.BytesIO(); Image.open(os.path.join(D(cls), 'first.png')).save(buf, 'PNG')
    body = {'description': CFG[cls]['desc'], 'action': 'walk cycle', 'direction': 'east', 'view': 'side',
            'first_frame': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'},
            'first_frame_keypoints': kpl(kp0), 'keypoints': [kpl(p) for p in seq], 'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(D(cls), 'req.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    S = 3; f0 = Image.open(os.path.join(D(cls), 'first.png')).resize((N * S, N * S), Image.NEAREST); tiles = []
    for p in [kp0] + seq:
        t = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255))
        if p is kp0: t.alpha_composite(f0)
        d = ImageDraw.Draw(t)
        for a, b in BONES: d.line([(kp0[a][0] * S, kp0[a][1] * S), (kp0[b][0] * S, kp0[b][1] * S)], fill=(60, 64, 80), width=S)
        for a, b in BONES: d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=(255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230), width=S + 1)
        tiles.append(t.crop((50 * S, 100 * S, 142 * S, 182 * S)))
    w, h = tiles[0].size; m = Image.new('RGBA', ((w + 4) * len(tiles), h), (40, 42, 52, 255))
    for i, t in enumerate(tiles): m.paste(t, (i * (w + 4), 0))
    m.save(os.path.join(D(cls), 'stick.png')); print('req', cls, 'frames', len(seq))


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def find_usage(o):
    if isinstance(o, dict):
        if isinstance(o.get('usage'), dict): return o['usage']
        for v in o.values():
            r = find_usage(v)
            if r: return r
    elif isinstance(o, list):
        for v in o:
            r = find_usage(v)
            if r: return r


def call(cls, act='walk', body=None, ep='/animate-with-skeleton-v3'):
    from pl import call as pl
    tag = f'{cls}/{act}'
    ok = open(APPROVED).read().split() if os.path.exists(APPROVED) else []
    if tag not in ok: sys.exit(f'STOP: 승인 안 된 호출 {tag} (approved.txt)')
    st = json.load(open(USAGE)) if os.path.exists(USAGE) else {'used': 0.0, 'calls': []}
    s0, b = pl('GET', '/balance'); b0 = b['subscription']['generations'] if s0 == 200 else None
    need = 3 if 'skeleton' in ep else 1
    if st['used'] + need > CAP: sys.exit(f'STOP: 자기 사용 {st["used"]} — 상한 {CAP}')
    body = body or json.load(open(os.path.join(D(cls), 'req.json'), encoding='utf-8'))
    for _ in range(4):
        s, r = pl('POST', ep, body)
        if s in (200, 202): break
        print('HTTP', s, str(r)[:300])
        if s == 429 or s >= 500: time.sleep(20); continue
        sys.exit(1)
    else: sys.exit('retry 실패')
    u = find_usage(r); job = r.get('background_job_id') if isinstance(r, dict) else None
    if job:
        for _ in range(180):
            time.sleep(5)
            s, j = pl('GET', f'/background-jobs/{job}')
            if isinstance(j, dict) and j.get('status') == 'completed': r = j; break
            if isinstance(j, dict) and j.get('status') == 'failed': print('FAILED', str(j)[:400]); r = None; break
        else: print('TIMEOUT', job); r = None
    if r is not None: u = find_usage(r) or u
    used = float(u.get('generations', 1)) if isinstance(u, dict) else None
    imgs = []
    if r is not None: images(r, imgs)
    os.makedirs(D(cls), exist_ok=True)          # 10-23: 폴더가 없어 결과를 잃은 일이 있다 (3회)
    for i, b64 in enumerate(imgs):
        if ',' in b64[:40]: b64 = b64.split(',', 1)[1]
        open(os.path.join(D(cls), f'raw-{act}-{i}.png'), 'wb').write(base64.b64decode(b64))
    s1, b = pl('GET', '/balance'); b1 = b['subscription']['generations'] if s1 == 200 else None
    if used is None and b0 is not None and b1 is not None: used = round(b0 - b1, 2)
    st['used'] = round(st['used'] + (used or 0), 2); st['calls'].append({'tag': tag, 'ep': ep, 'usage': used, 'n': len(imgs), 'bal_before': b0, 'bal_after': b1})
    json.dump(st, open(USAGE, 'w'), indent=1)
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8') as f:
        if new: f.write(f'# 마지막 49회 — PixelLab 사용 기록\n\n상한: 응답 usage 합계 {CAP}회\n\n| # | 호출 | 엔드포인트 | usage | 누적 | 잔량 전→후 |\n|---|---|---|---|---|---|\n')
        f.write(f'| {len(st["calls"])} | {tag} | `{ep}` | {used} | {st["used"]} | {b0}→{b1} |\n')
    print('saved', len(imgs), 'usage', used, 'self', st['used'], 'bal', b0, '->', b1)


def half(im):
    W, H = im.size[0] // 2, im.size[1] // 2; P = im.load(); o = Image.new('RGBA', (W, H)); O = o.load()
    for y in range(H):
        for x in range(W):
            cs = [P[2 * x + a, 2 * y + b] for a in (0, 1) for b in (0, 1) if P[2 * x + a, 2 * y + b][3] >= 128]
            if len(cs) >= 2: O[x, y] = max(set(cs), key=cs.count)[:3] + (255,)
    return o


def palette_lock(im, ref):
    """생성 색을 기준 그림 팔레트의 가장 가까운 색으로"""
    pal = sorted({p[:3] for p in ref.getdata() if p[3]}); P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if c[3]: P[x, y] = min(pal, key=lambda q: (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2) + (255,)
    return im


def strip_weapon(cell, body, pad=3):
    """모델이 멋대로 그린 무기 지우기 (빈손으로 주문해도 할버드를 그려 넣는다): 몸 그림 가로 범위(+pad) 밖은 지우고,
    그 밖까지 뻗은 가로줄(= 가로로 든 자루)은 몸 안쪽도 위·아래 칸 색으로 메운다"""
    bb = body.getbbox(); x0, x1 = bb[0] - pad, bb[2] - 1 + pad
    P = cell.load(); W, H = cell.size
    pole = [y for y in range(H) if sum(1 for x in range(0, x0 - 2) if P[x, y][3]) >= 6]   # 몸 뒤(왼쪽)로 6칸 넘게 뻗은 줄 = 가로 자루
    for y in range(H):
        for x in range(W):
            if P[x, y][3] and (x < x0 or x > x1): P[x, y] = (0, 0, 0, 0)
    for y in pole:
        for x in range(x0, x1 + 1):
            if not P[x, y][3]: continue
            src = next((P[x, y + d] for d in (-1, 1, -2, 2, -3, 3) if 0 <= y + d < H and (y + d) not in pole), (0, 0, 0, 0))
            P[x, y] = src
    # 몸에서 떨어진 작은 덩어리(지운 무기 찌꺼기)
    seen = set()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3] or (x, y) in seen: continue
            st, comp = [(x, y)], {(x, y)}; seen.add((x, y))
            while st:
                a, b = st.pop()
                for q in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and P[q][3]: seen.add(q); comp.add(q); st.append(q)
            if len(comp) <= 12:
                for q in comp: P[q] = (0, 0, 0, 0)
    return cell


def keep_upper(cell, body, wpn, hip, dy):
    """허리 위는 첫 프레임 몸 그림(들썩임 dy 만큼)으로 덮는다 — 설계상 윗몸·팔은 그대로라, 모델이 윗몸에 그려 넣은 무기·잔선을 한 번에 없앤다.
    허리 아래(다리)는 생성 그대로 두되, 무기에만 쓰인 색(자루 갈색 등)은 지우고 둘레 색으로 메운다"""
    W, H = cell.size; o = Image.new('RGBA', cell.size)
    o.paste(cell.crop((0, hip + dy, W, H)), (0, hip + dy))
    up = Image.new('RGBA', cell.size); up.paste(body.crop((0, 0, W, hip)), (0, dy)); o.alpha_composite(up)
    from collections import Counter
    wn = Counter(p[:3] for p in wpn.getdata() if p[3]); bn = Counter(p[:3] for p in body.getdata() if p[3])
    # 무기에만 쓰인 색 + 무기에 훨씬 많이 쓰인 나무 갈색(자루 — 몸의 허리띠와 같은 색이라도 다리 쪽에선 자루다)
    wc = {c for c in wn if not bn.get(c)} | {c for c, n in wn.items() if n > 3 * bn.get(c, 0) and c[0] > c[1] > c[2] and c[0] - c[2] > 15}
    P = o.load(); holes = []
    for y in range(hip + dy, H):
        for x in range(W):
            if P[x, y][3] and P[x, y][:3] in wc: P[x, y] = (0, 0, 0, 0); holes.append((x, y))
    for _ in range(3):                                   # 지운 자리 중 몸 안쪽(이웃 3칸 이상 칠해짐)은 이웃 최빈색으로
        for x, y in holes:
            if P[x, y][3]: continue
            nb = [P[x + a, y + b] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] and P[x + a, y + b][:3] != OUT_C[:3]]
            if len(nb) >= 3: P[x, y] = max(set(nb), key=nb.count)
    # 다리 쪽 거의 검은 칸(외곽선 색)은 걷어 낸다 — 자루 그림자로 남은 1칸 사선이 사라지고, 몸 둘레·속 외곽선은 post 의 outline() 이 다시 두른다
    for y in range(hip + dy + 2, H):
        for x in range(W):
            c = P[x, y]
            if c[3] and sum(c[:3]) < 60: P[x, y] = (0, 0, 0, 0)
    return crumbs(o, 12)


def crumbs(im, maxn):
    """몸에서 떨어진 maxn 칸 이하 조각 지우기 (지운 자루에 붙어 있던 날 조각 등)"""
    P = im.load(); W, H = im.size; seen = set()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3] or (x, y) in seen: continue
            st, comp = [(x, y)], {(x, y)}; seen.add((x, y))
            while st:
                a, b = st.pop()
                for q in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and P[q][3]: seen.add(q); comp.add(q); st.append(q)
            if len(comp) <= maxn:
                for q in comp: P[q] = (0, 0, 0, 0)
    return im


def post(cls):
    m = meta(cls); S = m['w']; fx, fy = m['foot']
    base, body, wpn = split(cls); kp0, seq = walk_seq(cls); out = []
    for i in range(8):
        p = os.path.join(D(cls), f'raw-walk-{i}.png')
        if not os.path.exists(p): break
        h = half(Image.open(p).convert('RGBA'))                  # 192 → 96, 발 (48, 88)
        cell = Image.new('RGBA', (S, S)); cell.alpha_composite(h, (fx - 48, fy - 88))
        cell = strip_weapon(cell, body)
        cell = palette_lock(cell, base)
        cell = keep_upper(cell, body, wpn, round(CFG[cls]['kp']['RIGHT HIP'][1]), round((seq[i]['NECK'][1] - kp0['NECK'][1]) / 2))
        # 무기: 목(=윗몸) 들썩임만큼 같이 움직여 다시 얹음 (팔은 첫 프레임 그대로 두는 설계)
        dy = round((seq[i]['NECK'][1] - kp0['NECK'][1]) / 2)
        cell.alpha_composite(wpn, (0, dy))
        out.append(outline(cell))
    for i, (j, cx) in CFG[cls].get('cape_fix', {}).items():       # 한 프레임만 튀는 망토: 왼쪽(x ≤ cx)을 이웃 프레임 것으로
        if i < len(out) and j < len(out):
            f = out[i].copy(); f.paste(Image.new('RGBA', (cx + 1, S)), (0, 0)); f.alpha_composite(out[j].crop((0, 0, cx + 1, S)), (0, 0)); out[i] = outline(f)
    for i, f in enumerate(out): f.save(os.path.join(D(cls), f'walk-{i}.png'))
    st = Image.new('RGBA', (S * len(out), S), (24, 24, 34, 255))
    for i, f in enumerate(out): st.alpha_composite(f, (i * S, 0))
    st.resize((st.width * 3, st.height * 3), Image.NEAREST).save(os.path.join(D(cls), 'walk-strip.png'))
    g = []
    for f in out:
        b = Image.new('RGBA', (S, S), (24, 24, 34, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((S * 3, S * 3), Image.NEAREST))
    if g: g[0].save(os.path.join(D(cls), 'walk.gif'), save_all=True, append_images=g[1:], duration=100, loop=0)
    print('post', cls, len(out))


def bob(im, cut, d):
    o = Image.new('RGBA', im.size); o.paste(im.crop((0, cut, im.width, im.height)), (0, cut)); o.alpha_composite(im.crop((0, 0, im.width, cut)), (0, d)); return o


def lean(im, foot, deg, dx=0):
    r = im.rotate(deg, resample=Image.NEAREST, center=foot); o = Image.new('RGBA', im.size); o.alpha_composite(r, (dx, 0))
    if o.getbbox():
        d = foot[1] - (o.getbbox()[3] - 1); q = Image.new('RGBA', im.size); q.paste(o, (0, d)); o = q
    return outline(o)


def pts_of(im, foot):
    px = im.load(); bb = im.getbbox()
    if not bb: return [foot[0], foot[1], foot[0], foot[1]]
    top = bb[1]; xs = [x for x in range(im.width) if px[x, top][3]]; hx, hy = foot
    for x in range(im.width - 1, -1, -1):
        ys = [y for y in range(0, foot[1] - 6) if px[x, y][3]]
        if ys: hx, hy = x, ys[len(ys) // 2]; break
    return [hx, hy, sum(xs) // len(xs), top]


def install(cls):
    m = meta(cls); S = m['w']; foot = tuple(m['foot'])
    sheet = Image.open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png')).convert('RGBA')
    keep = os.path.join(D(cls), 'orig.png')
    if not os.path.exists(keep): sheet.save(keep); json.dump(m, open(os.path.join(D(cls), 'orig.json'), 'w'))
    base = frame(cls, *CFG[cls].get('base', ('atkA', 0))); cut = foot[1] - 18
    walk = [Image.open(os.path.join(D(cls), f'walk-{i}.png')).convert('RGBA') for i in range(8) if os.path.exists(os.path.join(D(cls), f'walk-{i}.png'))]
    new = {}
    if not CFG[cls].get('keep_idle'): new = {'idle': [base, bob(base, cut, 1), bob(base, cut, 1), base],
           'guard': [bob(base, cut, 1), bob(base, cut, 2), bob(base, cut, 2), bob(base, cut, 1)],
           'hurt': [lean(base, foot, 9, -2), lean(base, foot, 4, -1)],
           'death': [lean(base, foot, a) for a in (-12, -30, -55, -78, -90)]}
    if walk: new['walk'] = walk
    # 앉기: 새 대기 그림으로 dev/sheets-sit/build.py 와 같은 하반신 편집 (그 도구의 orig/ 는 건드리지 않고 함수만 빌림). 대기를 안 바꾸면 앉기도 그대로
    sit_pts = None
    if 'idle' in new:
        sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-sit')); import numpy as np; import build as sitb
        t = dict(sitb.DEF, **sitb.TUNE.get(cls, {})); sit, sit_pts = [], []
        for f in new['idle'][:2]:
            P = pts_of(f, foot); o, drop = sitb.sit_frame(np.array(f), list(foot), P[3], t)
            sit.append(Image.fromarray(o)); sit_pts.append([P[0], P[1] + drop, P[2], P[3] + drop])
        new['sit'] = sit
    order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    rows = {a: new[a] if a in new else [sheet.crop((i * S, m['anims'][a]['row'] * S, (i + 1) * S, (m['anims'][a]['row'] + 1) * S)) for i in range(m['anims'][a]['frames'])] for a in order}
    n = max(len(v) for v in rows.values()); out = Image.new('RGBA', (S * n, S * len(order)))
    for r, a in enumerate(order):
        for i, f in enumerate(rows[a]): out.alpha_composite(f, (i * S, r * S))
        m['anims'][a]['row'] = r; m['anims'][a]['frames'] = len(rows[a])
        if a in new: m['pts'][a] = sit_pts if a == 'sit' else [pts_of(f, foot) for f in rows[a]]
    out.save(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png'))
    with open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(list(foot))},\n "anims": {{\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        f.write('\n }\n}\n')
    print('install', cls, {a: len(rows[a]) for a in order})


if __name__ == '__main__':
    cmd, cls = sys.argv[1], sys.argv[2]
    if cmd == 'first': first(cls)
    elif cmd == 'req': req(cls, int(sys.argv[3]) if len(sys.argv) > 3 else 7)
    elif cmd == 'call': call(cls)
    elif cmd == 'post': post(cls)
    elif cmd == 'install': install(cls)
