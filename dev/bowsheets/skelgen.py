# 관절 지정 애니 요청 준비 (animate-with-skeleton-v3, 192칸): 정리본 기준 그림 → 무기 지우기 → 96칸 발 (48, 88) → 2배 = 192칸 첫 프레임
#  + 관절 시퀀스(skel.py)를 첫 프레임 그림의 실제 관절(눈으로 읽은 BODY_KP)에 맞춰 옮긴 요청 본문 → skel/req-<cls>-<act>.json
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/bowsheets/skelgen.py first <cls>        → skel/first-<cls>.png (192), skel/first-<cls>-grid.png (관절 읽기용 격자)
#   ... skelgen.py req <cls> <act(walk|shoot|sky)> [seed]                                     → skel/req-<cls>-<act>.json, skel/stick-fit-<cls>-<act>.png
import os, sys, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SK = os.path.join(HERE, 'skel'); REF = os.path.join(HERE, 'design', 'ref')
N = 192


def thin_off(im, win=2, need=11):
    """1~2칸 두께 선(활대·시위·화살) 지우기: (2·win+1)² 창 안 칠한 칸이 need 개 미만이면 지운다. 몸은 두꺼워 남는다. 그다음 가장 큰 덩어리에 붙은 것만"""
    P = im.load(); W, H = im.size; o = im.copy(); O = o.load()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3]: continue
            n = sum(1 for a in range(-win, win + 1) for b in range(-win, win + 1) if 0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] >= 128)
            if n < need: O[x, y] = (0, 0, 0, 0)
    pts = {(x, y) for y in range(H) for x in range(W) if O[x, y][3]}; comps = []
    while pts:
        st = [pts.pop()]; comp = {st[0]}
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); comp.add(q); st.append(q)
        comps.append(comp)
    keep = max(comps, key=len)
    for c in comps:
        if c is not keep and len(c) < 15:
            for p in c: O[p] = (0, 0, 0, 0)
    return o


NEUTRAL = {'marksman', 'ranger', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster'}     # 중립 대기 첫 프레임 (2026-10-17: 조준 자세 첫 프레임은 팔 관절을 안 따름 → edit-image-pixen 으로 팔 내린 빈손 대기) — design/ref/<cls>-neutral.png


# 석궁사수 쏘기만: 중립 편집이 정면으로 돌아(2회) 옆모습 정리본(석궁 겨눈 자세, 석궁은 두꺼워 남김)을 첫 프레임으로 (2026-10-17 로드맵 승인)
ALIAS = {'arbalestAim': 'arbalest', 'arbalestSky': 'arbalest'}
# arbalestSky: 첫 프레임 = 합격한 쏘기(fx4) 0번 겨눔 그림(굵은 석궁), 관절 = 그 프레임을 만든 설계 자세 (xbow-shoot 0번, 석궁사수 중립 뼈 길이)
SKY_FIRST = ('arbalest', 'post-shoot-fx4-0.png')
base_of = lambda cls: ALIAS.get(cls, cls)


def first(cls, nowpn=True):
    if cls in ALIAS: nowpn = False
    im = Image.open(os.path.join(REF, f'{cls}-neutral.png' if cls in NEUTRAL else f'{base_of(cls)}-clean.png')).convert('RGBA')
    if cls in NEUTRAL: nowpn = False
    if nowpn: im = thin_off(im)
    im = im.crop(im.getbbox()); P = im.load()
    row = [x for x in range(im.width) if P[x, im.height - 1][3]]; fx = (min(row) + max(row)) // 2 if row else im.width // 2
    c96 = Image.new('RGBA', (96, 96)); c96.alpha_composite(im, (48 - fx, 88 - (im.height - 1)))
    f = c96.resize((N, N), Image.NEAREST); f.save(os.path.join(SK, f'first-{cls}.png'))
    S = 4; g = Image.new('RGBA', (N * S, N * S), (30, 32, 40, 255)); g.alpha_composite(f.resize((N * S, N * S), Image.NEAREST)); d = ImageDraw.Draw(g)
    for v in range(0, N, 8):
        d.line([(v * S, 0), (v * S, N * S)], fill=(255, 255, 255, 40 if v % 16 else 90)); d.line([(0, v * S), (N * S, v * S)], fill=(255, 255, 255, 40 if v % 16 else 90))
        if v % 16 == 0: d.text((v * S + 2, 2), str(v), fill=(255, 220, 90)); d.text((2, v * S + 2), str(v), fill=(255, 220, 90))
    g.crop((40 * S, 60 * S, 160 * S, 184 * S)).save(os.path.join(SK, f'first-{cls}-grid.png'))
    return f


# 첫 프레임 그림에서 눈으로 읽은 관절 (192칸 좌표, first-<cls>-grid.png: 격자 8칸, 그림 원점 = (40, 60), 1칸 = 4px).
#  팔 역할은 skel.py 와 같다 — 활: LEFT = 앞으로 뻗은 활 든 팔, RIGHT = 시위 당기는 손(가까운 쪽)
BODY_KP = {
    # 저격수: 중립 대기 첫 프레임(팔 내림·빈손, 2026-10-17)에서 다시 읽음. 뒷손만 엉덩이 옆에 보이고 앞팔은 몸통 앞에 겹친다
    'marksman': {'NECK': (93.75, 108.75), 'NOSE': (103, 101.25), 'RIGHT EYE': (98.75, 100), 'LEFT EYE': (96.25, 100.5), 'RIGHT EAR': (91.25, 101.25), 'LEFT EAR': (88.75, 101.5),
                 'LEFT SHOULDER': (100.5, 113.75), 'LEFT ELBOW': (100.5, 127), 'LEFT ARM': (99.5, 139.5),
                 'RIGHT SHOULDER': (89, 113.75), 'RIGHT ELBOW': (88.5, 127), 'RIGHT ARM': (88, 140),
                 'RIGHT HIP': (100, 140), 'RIGHT KNEE': (101.25, 160), 'RIGHT LEG': (101.25, 176),
                 'LEFT HIP': (90, 140), 'LEFT KNEE': (90, 160), 'LEFT LEG': (90, 176)},
}
BODY_KP.update({
    # 석궁사수 겨눈 자세 정리본(옆모습) — 쏘기 재생성용 첫 프레임. RIGHT = 뒷손(개머리), LEFT = 앞손(받침)
    'arbalestAim': {'NECK': (96.25, 127), 'NOSE': (107.5, 118.75), 'RIGHT EYE': (103.75, 115), 'LEFT EYE': (97.5, 115), 'RIGHT EAR': (91.25, 117.5), 'LEFT EAR': (90, 118),
                    'LEFT SHOULDER': (100, 130), 'LEFT ELBOW': (105, 135), 'LEFT ARM': (121.25, 133.75),
                    'RIGHT SHOULDER': (91.25, 130.5), 'RIGHT ELBOW': (107.5, 132.5), 'RIGHT ARM': (115, 131.25),
                    'RIGHT HIP': (103.75, 150), 'RIGHT KNEE': (106.25, 162.5), 'RIGHT LEG': (108.75, 175),
                    'LEFT HIP': (91.25, 150), 'LEFT KNEE': (88.75, 162.5), 'LEFT LEG': (83.75, 175)},
})
BODY_KP.update({
    # 2026-10-17 중립 대기 첫 프레임(팔 내림·빈손)에서 다시 읽음 — 활: LEFT = 앞(활 든) 팔, RIGHT = 뒤(당기는) 팔
    'ranger': {'NECK': (106.25, 120), 'NOSE': (119.5, 113.75), 'RIGHT EYE': (115, 108.75), 'LEFT EYE': (108.75, 109), 'RIGHT EAR': (101.25, 112.5), 'LEFT EAR': (98.75, 113),
               'LEFT SHOULDER': (112.5, 123.75), 'LEFT ELBOW': (115, 133), 'LEFT ARM': (117, 143.75),
               'RIGHT SHOULDER': (93.75, 123.75), 'RIGHT ELBOW': (93, 135), 'RIGHT ARM': (92.5, 146.25),
               'RIGHT HIP': (107.5, 142.5), 'RIGHT KNEE': (108.75, 158.75), 'RIGHT LEG': (110, 175),
               'LEFT HIP': (96.25, 142.5), 'LEFT KNEE': (96.25, 158.75), 'LEFT LEG': (96.25, 175)},
    'arcaneArcher': {'NECK': (100, 121.25), 'NOSE': (108.75, 113.75), 'RIGHT EYE': (106.25, 109.5), 'LEFT EYE': (98, 109.5), 'RIGHT EAR': (92.5, 111.25), 'LEFT EAR': (90, 111.5),
                     'LEFT SHOULDER': (107.5, 126.25), 'LEFT ELBOW': (110, 136), 'LEFT ARM': (111.25, 146.25),
                     'RIGHT SHOULDER': (85, 126.25), 'RIGHT ELBOW': (84, 137.5), 'RIGHT ARM': (83.75, 148.75),
                     'RIGHT HIP': (101.25, 146.25), 'RIGHT KNEE': (102.5, 160), 'RIGHT LEG': (103.75, 175),
                     'LEFT HIP': (90, 146.25), 'LEFT KNEE': (88.75, 160), 'LEFT LEG': (88.75, 175)},
    # 석궁사수: 2026-10-18 PixelLab rotate(south-east → east) 옆모습 중립에서 다시 읽음 (예전 3/4 정면 판: design/ref/arbalest-neutral-34.png). RIGHT = 뒷손(개머리), LEFT = 앞손(받침)
    'arbalest': {'NECK': (105, 120), 'NOSE': (115, 113.75), 'RIGHT EYE': (111.25, 110), 'LEFT EYE': (108.75, 110), 'RIGHT EAR': (102.5, 112.5), 'LEFT EAR': (100, 112.75),
                 'LEFT SHOULDER': (108, 124), 'LEFT ELBOW': (107, 136), 'LEFT ARM': (106, 147),
                 'RIGHT SHOULDER': (101, 124), 'RIGHT ELBOW': (102, 136), 'RIGHT ARM': (103, 148),
                 'RIGHT HIP': (107.5, 151.25), 'RIGHT KNEE': (108.75, 161), 'RIGHT LEG': (107.5, 175),
                 'LEFT HIP': (101, 151.25), 'LEFT KNEE': (100, 161), 'LEFT LEG': (98.75, 175)},
})


def ik(sh, target, L1, L2, elbow_up=True):
    """2관절 역산: 어깨 sh 에서 손을 target 에 두는 (위팔 각, 아래팔 각) (도). 닿지 않으면 쭉 뻗어 그 방향. elbow_up: 팔꿈치가 위쪽으로 꺾이는 해"""
    dx, dy = target[0] - sh[0], target[1] - sh[1]; D = max(1e-6, min(math.hypot(dx, dy), L1 + L2 - 1e-3))
    base = math.atan2(dy, dx); c = (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D); a = math.acos(max(-1, min(1, c)))
    a1 = base - a if elbow_up else base + a
    e = (sh[0] + L1 * math.cos(a1), sh[1] + L1 * math.sin(a1))
    a2 = math.atan2(sh[1] + D * math.sin(base) - e[1], sh[0] + D * math.cos(base) - e[0])
    return math.degrees(a1), math.degrees(a2)


def solve_hands(ns, kind):
    """손 목표 보정 (2026-10-17 로드맵 지시: 첫 프레임 뼈 길이에 맞추면 팔이 짧아져 손이 목표에 못 미친다 → 목표 손 위치로 관절 각을 역산).
    활: 당기는 프레임(draw) 은 당기는 손(RIGHT ARM)을 귀 옆(귀 + (1, 3))에 — 팔꿈치 위로 꺾임 / 활 손(LEFT ARM)은 지금 방향으로 팔 길이 97% 까지 뻗음.
    석궁: 겨눔 프레임(deg 가 0 근처, 반동 전) 은 뒷손을 볼 옆(귀 + (7, 6))에"""
    P = ns['P']; UA, FA = ns['UA'], ns['FA']
    for name, seq in ns['SEQ'].items():
        if not name.startswith(kind + '-'): continue
        for k, (p, note) in enumerate(seq):
            if kind == 'bow' and note.get('draw'):
                ear = p['RIGHT EAR']; tgt = (ear[0] + 1, ear[1] + 3)
                a1, a2 = ik(p['RIGHT SHOULDER'], tgt, UA, FA, elbow_up=True)
                p['RIGHT ELBOW'] = P(p['RIGHT SHOULDER'], a1, UA); p['RIGHT ARM'] = P(p['RIGHT ELBOW'], a2, FA)
                sh = p['LEFT SHOULDER']; h = p['LEFT ARM']; ang = math.atan2(h[1] - sh[1], h[0] - sh[0])
                p['LEFT ELBOW'] = (sh[0] + math.cos(ang) * UA, sh[1] + math.sin(ang) * UA); p['LEFT ARM'] = (sh[0] + math.cos(ang) * (UA + FA) * 0.97, sh[1] + math.sin(ang) * (UA + FA) * 0.97)
            if kind == 'xbow' and name == 'xbow-shoot' and k in (0, 1):
                ear = p['RIGHT EAR']; tgt = (ear[0] + 7, ear[1] + 6)
                a1, a2 = ik(p['RIGHT SHOULDER'], tgt, UA, FA, elbow_up=False)
                p['RIGHT ELBOW'] = P(p['RIGHT SHOULDER'], a1, UA); p['RIGHT ARM'] = P(p['RIGHT ELBOW'], a2, FA)


ACT = {'walk': 'bow-walk', 'shoot': 'bow-shoot', 'sky': 'bow-sky'}
ACT_X = {'walk': 'xbow-walk', 'shoot': 'xbow-shoot', 'sky': 'xbow-sky'}
ACT_S = {'walk': 'siege-walk', 'shoot': 'siege-shoot', 'sky': 'siege-sky'}
# 3차: 2차 중립 그림을 3차 디자인으로 편집한 것이라 몸·자세가 같다 — 관절은 2차 것을 그대로 (발 가운데 기준으로 이미 맞춰 놓임)
PARENT = {'deadeye': 'marksman', 'voidArcher': 'arcaneArcher', 'siegeMaster': 'arbalest'}
kind_of = lambda cls: 'siege' if cls == 'siegeMaster' else ('xbow' if base_of(cls) == 'arbalest' else 'bow')
DESC = {
    'marksman': 'young chibi sniper archer, black hair tied back, yellow goggles on the forehead, short teal high-collared jacket with a belt, long red scarf fluttering behind, dark trousers and tall boots, hands empty (the bow is drawn later)',
}
DESC.update({
    'deadeye': 'young chibi legendary master archer, golden crown of sun rays, small golden sun disc halo behind the head, long white and gold coat with teal trim, long red scarf, golden bracers, white trousers and tall boots, hands empty (the bow is drawn later)',
    'voidArcher': 'young chibi void archer, dark violet hood with two curved horns, broken glowing purple and cyan ring floating behind the back, long dark violet starry cloak, glowing cyan eyes, cyan runes, hands empty (the bow is drawn later)',
    'siegeMaster': 'young chibi siege master, heavy steel helmet with a red crest, big round steel pauldrons, bulky gear backpack, red tabard over plate armor, thick gauntlets and greaves, holding a huge siege crossbow on the shoulder',
    'ranger': 'young chibi forest ranger, wide-brimmed green hat with a big white feather, auburn hair, cream shirt, brown leather vest and belt, brown trousers and boots, hands empty (the bow is drawn later)',
    'arcaneArcher': 'young chibi arcane archer, navy hood with a pointed tip, glowing cyan eyes, short navy tunic with cyan runes and a belt, navy trousers and boots, glowing cyan bracers, short shoulder cape, hands empty (the bow is drawn later)',
    'arbalest': 'young chibi crossbowman, steel helmet with raised visor and a young face, red tabard over a breastplate, belt with bolts, short red cape, steel greaves and boots, holding a heavy crossbow',
})

ACTION = {'walk': 'walk cycle', 'shoot': 'draw a bowstring back to the ear and release', 'sky': 'aim upward and shoot an arrow into the sky'}


def fitted(cls):
    """skel.py 를 이 그림의 뼈 길이로 다시 계산한 모듈 (몸통·허벅지·정강이·위팔·아래팔·어깨 간격·머리 관절은 BODY_KP 에서)"""
    kp = BODY_KP['arbalest' if cls == 'arbalestSky' else PARENT.get(cls, cls)]; d = lambda a, b: math.dist(kp[a], kp[b])
    mid = lambda a, b: ((kp[a][0] + kp[b][0]) / 2, (kp[a][1] + kp[b][1]) / 2)
    hipm = mid('RIGHT HIP', 'LEFT HIP')
    L = {'TORSO': math.dist(kp['NECK'], hipm), 'TH': (d('RIGHT HIP', 'RIGHT KNEE') + d('LEFT HIP', 'LEFT KNEE')) / 2,
         'SH': (d('RIGHT KNEE', 'RIGHT LEG') + d('LEFT KNEE', 'LEFT LEG')) / 2,
         'UA': (d('RIGHT SHOULDER', 'RIGHT ELBOW') + d('LEFT SHOULDER', 'LEFT ELBOW')) / 2, 'FA': (d('RIGHT ELBOW', 'RIGHT ARM') + d('LEFT ELBOW', 'LEFT ARM')) / 2}
    KB = (kp['LEFT SHOULDER'][0] - kp['RIGHT SHOULDER'][0]) / 18          # turn=1 일 때 어깨 간격 = (10 + 8) * KB
    head = {k: (kp[k][0] - kp['NECK'][0], kp[k][1] - kp['NECK'][1]) for k in ('NOSE', 'RIGHT EYE', 'LEFT EYE', 'RIGHT EAR', 'LEFT EAR')}
    src = open(os.path.join(HERE, 'skel.py'), encoding='utf-8').read().split("if __name__ == '__main__':")[0]
    src = src.replace("UA, FA, TH, SH, TORSO = 11, 11, 12, 12, 30", f"UA, FA, TH, SH, TORSO = {L['UA']:.2f}, {L['FA']:.2f}, {L['TH']:.2f}, {L['SH']:.2f}, {L['TORSO']:.2f}")
    src = src.replace("KB = 1.3 ", f"KB = {KB:.3f} ")
    src = src.replace("def pose(x=97,", f"def pose(x={hipm[0]:.1f},")
    ns = {'__file__': os.path.join(HERE, 'skel.py'), '__name__': 'skel_fit'}; exec(src, ns)
    ns['HEAD'].clear(); ns['HEAD'].update(head)
    # 머리 관절을 바꿨으니 SEQ 를 다시 계산 (pose 가 HEAD 를 쓴다) — 모듈 본문을 한 번 더 돌리되 HEAD 고정
    src2 = src.replace("HEAD = {k: (v[0] * 1.45, v[1] * 1.45) for k, v in", "HEAD = HEAD_FIX or {k: (v[0] * 1.45, v[1] * 1.45) for k, v in")
    ns = {'__file__': os.path.join(HERE, 'skel.py'), '__name__': 'skel_fit', 'HEAD_FIX': head}; exec(src2, ns)
    solve_hands(ns, kind_of(cls))
    return ns, L, KB


def req(cls, act, seed=7):
    from PIL import Image as I
    import base64, io
    ns, L, KB = fitted(cls); kind = kind_of(cls)
    name = {'xbow': ACT_X, 'siege': ACT_S, 'bow': ACT}[kind][act]; frames = ns['SEQ'][name]
    if cls == 'arbalestSky':
        f = I.open(os.path.join(HERE, 'work', SKY_FIRST[0], SKY_FIRST[1])).convert('RGBA').resize((N, N), I.NEAREST)
        kp0 = fitted('arbalest')[0]['SEQ']['xbow-shoot'][0][0]
    else:
        kp0 = BODY_KP[PARENT.get(cls, cls)]
        f = I.open(os.path.join(SK, f'first-{cls}.png')).convert('RGBA')
    buf = io.BytesIO(); f.save(buf, 'PNG')
    body = {'description': DESC[base_of(cls)], 'action': ACTION[act], 'direction': 'east', 'view': 'side',
            'first_frame': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'},
            'first_frame_keypoints': ns['kp'](kp0), 'keypoints': [ns['kp'](p) for p, _ in frames], 'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(SK, f'req-{cls}-{act}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump([n for _, n in frames], open(os.path.join(SK, f'wpn-{cls}-{act}.json'), 'w', encoding='utf-8'))
    # 확인용: 첫 프레임 그림 위에 읽은 관절, 그다음 설계 프레임 막대 인형
    tiles = [ns['stick'](kp0, kind, {'draw': False}, ghost=None)]
    base = f.resize((N * 3, N * 3), I.NEAREST); t0 = I.new('RGBA', (N * 3, N * 3), (20, 22, 30, 255)); t0.alpha_composite(base)
    dr = ImageDraw.Draw(t0)
    for a, b in ns['BONES']: dr.line([(kp0[a][0] * 3, kp0[a][1] * 3), (kp0[b][0] * 3, kp0[b][1] * 3)], fill=(255, 220, 90), width=2)
    tiles = [t0.crop((30 * 3, 66 * 3, 166 * 3, 182 * 3))] + [ns['stick'](p, kind, n, ghost=kp0) for p, n in frames]
    W_, H_ = tiles[0].size; m = I.new('RGBA', ((W_ + 6) * len(tiles), H_), (40, 42, 52, 255))
    for i, t in enumerate(tiles): m.paste(t, (i * (W_ + 6), 0))
    m.save(os.path.join(SK, f'stick-fit-{cls}-{act}.png'))
    return {k: round(v, 1) for k, v in L.items()}, round(KB, 2)


if __name__ == '__main__':
    os.makedirs(SK, exist_ok=True)
    if sys.argv[1] == 'first': first(sys.argv[2]); print('ok')
    elif sys.argv[1] == 'req': print(req(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 7))
