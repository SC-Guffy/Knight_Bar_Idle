# 레인저 계열 관절 지정 애니(animate-with-skeleton-v3) 설계 — 0회 준비 (docs/specs/legacy-class-sheets.md "동작은 관절 지정 애니")
#  형식은 검사 계열 dev/sheets-sword/skel.py 와 같다: 192칸, 발 = (96, 176), 관절 18개 라벨·z, 얼굴 오른쪽(east).
#  다른 점: 좌표를 손으로 찍지 않고 각도로 자세를 정해 계산한다 (팔다리 길이가 프레임마다 흔들리지 않게, 과장해도 길이는 그대로).
#  팔 역할 — 활: LEFT = 활 든 팔(먼 쪽, 과녁으로 뻗음) · RIGHT = 시위 당기는 손(가까운 쪽, 몸 앞, 턱·귀까지)
#             석궁·공성: RIGHT = 뒤 손(방아쇠·개머리, 가까운 쪽) · LEFT = 앞 손(몸체 받침, 먼 쪽)
#  활대·시위·석궁은 관절이 없다 → 손목 좌표로 덧그린다 (weapon_of: 이 파일의 막대 인형에 노란 선으로 같이 그린다)
#  python -I -B dev/bowsheets/skel.py  → dev/bowsheets/skel/<동작>.json (키포인트 시퀀스) · stick-<동작>.png 막대 인형 · stick-<동작>.gif
#  실제 요청 본문(first_frame = 새 디자인 기준 그림)은 디자인 승인 뒤에 만든다 — 여기서는 관절만.
import os, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); SK = os.path.join(HERE, 'skel'); os.makedirs(SK, exist_ok=True)
N, GROUND = 192, 173            # 칸 · 발목 관절이 닿는 땅 높이 (발바닥 176)
UA, FA, TH, SH, TORSO = 8.5, 8.5, 8, 8, 24      # 위팔·아래팔·허벅지·정강이·목→골반 (검사 계열 BASE 비율, 지금 키 기준 — 키를 키우면 S 로 곱한다)
HEAD = {'NOSE': (8.5, -5), 'RIGHT EYE': (6.5, -8), 'LEFT EYE': (-2.5, -8), 'RIGHT EAR': (0.5, -10), 'LEFT EAR': (-5.5, -10)}
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}
BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'),
         ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'),
         ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]
P = lambda o, ang, L: (o[0] + L * math.cos(math.radians(ang)), o[1] + L * math.sin(math.radians(ang)))   # 각도: 0 = 앞(오른쪽), 90 = 아래, -90 = 위


def pose(x=97, lean=0, head=0, ra=(95, 95), la=(85, 85), rl=(85, 92), ll=(95, 92), air=0, sq=0, turn=0.0):
    """각도로 자세. lean = 몸통 기울기(+ 앞으로 숙임), head = 머리 앞(+)/뒤(-) 젖힘(목 위치만), ra/la = (위팔, 아래팔) 각도,
    rl/ll = (허벅지, 정강이) 각도, air = 땅에서 뜬 높이, sq = 어깨를 몸 쪽으로 좁히기(칸),
    turn 0~1 = 몸을 과녁 쪽으로 튼 정도 — 1 이면 먼 어깨(LEFT, 활 든 팔)가 앞(+10), 가까운 어깨(RIGHT, 당기는 손)가 뒤(-8): 궁수 옆모습.
    낮은 발이 땅에 닿게 위아래를 맞춘다"""
    t = math.radians(lean); up = (math.sin(t), -math.cos(t))                 # 골반 → 목 방향
    hip = (x, 150.0); neck = (hip[0] + up[0] * TORSO, hip[1] + up[1] * TORSO)
    side = (math.cos(t), math.sin(t))                                         # 몸통 가로 (앞쪽)
    ro = (11 - sq) * (1 - turn) + (-8) * turn; lo = -(10 - sq) * (1 - turn) + 10 * turn
    rs = (neck[0] + side[0] * ro - up[0] * 5, neck[1] + side[1] * ro - up[1] * 5)
    ls = (neck[0] + side[0] * lo - up[0] * 5, neck[1] + side[1] * lo - up[1] * 5)
    rh, lh = (hip[0] + side[0] * 6, hip[1] + side[1] * 6), (hip[0] - side[0] * 6, hip[1] - side[1] * 6)
    p = {'NECK': (neck[0] + head, neck[1]), 'RIGHT SHOULDER': rs, 'LEFT SHOULDER': ls, 'RIGHT HIP': rh, 'LEFT HIP': lh}
    p['RIGHT ELBOW'] = P(rs, ra[0], UA); p['RIGHT ARM'] = P(p['RIGHT ELBOW'], ra[1], FA)
    p['LEFT ELBOW'] = P(ls, la[0], UA); p['LEFT ARM'] = P(p['LEFT ELBOW'], la[1], FA)
    p['RIGHT KNEE'] = P(rh, rl[0], TH); p['RIGHT LEG'] = P(p['RIGHT KNEE'], rl[1], SH)
    p['LEFT KNEE'] = P(lh, ll[0], TH); p['LEFT LEG'] = P(p['LEFT KNEE'], ll[1], SH)
    dy = GROUND - air - max(p['RIGHT LEG'][1], p['LEFT LEG'][1])
    p = {k: (v[0], v[1] + dy) for k, v in p.items()}
    nx, ny = p['NECK']
    for k, (dx, dy2) in HEAD.items(): p[k] = (nx + dx, ny + dy2)
    return p


# ── 동작 (8프레임씩 — 값 8f = usage 3). 각 프레임: (자세, 무기 메모) ──
# 무기 메모: 활 {'draw': 시위를 손이 잡고 있나} · 석궁 {'deg': 석궁 방향(없으면 두 손을 잇는 선)}
IDLE_BOW = pose(turn=0.3, ra=(100, 85), la=(60, 30), rl=(80, 95), ll=(100, 90))     # 대기: 몸을 조금 틀고 활을 앞 아래로
SEQ = {}
# 활 걷기: 다리 크게 교차(±35°), 활은 앞손에 들고, 뒷손은 크게 흔든다, 몸 들썩
SEQ['bow-walk'] = [(pose(x=97, lean=6, turn=0.3, ra=(95 + 35 * math.sin(i * math.pi / 4), 80 + 30 * math.sin(i * math.pi / 4)), la=(55, 25),
                         rl=(90 - 35 * math.cos(i * math.pi / 4), 95 - 25 * max(0, math.sin(i * math.pi / 4))),
                         ll=(90 + 35 * math.cos(i * math.pi / 4), 95 - 25 * max(0, -math.sin(i * math.pi / 4))),
                         air=2 * abs(math.sin(i * math.pi / 4))), {'draw': False}) for i in range(8)]
# 활 평타 A — 시위를 끝까지 당겨 쏘기: 몸을 과녁 쪽으로 틀며 활을 앞으로 뻗음 → 메김 → 당기며 팔꿈치를 뒤·위로 → 귀까지(앞다리 내딛고 젖힘) → 버팀 → 놓음(뒷손이 머리 뒤로 튕김) → 여운 → 대기
SEQ['bow-shoot'] = [
    (pose(lean=2, turn=0.7, ra=(40, 0), la=(10, 5), rl=(80, 95), ll=(100, 90)), {'draw': False}),              # 1 몸을 틀며 활을 앞으로, 뒷손이 시위로
    (pose(lean=0, turn=1, ra=(10, 0), la=(0, 0), rl=(72, 95), ll=(108, 90)), {'draw': True}),                   # 2 메김: 활팔 쭉, 뒷손이 활 앞에서 시위를 잡음
    (pose(lean=-4, turn=1, ra=(200, 0), la=(-2, -2), rl=(66, 92), ll=(114, 92)), {'draw': True}),             # 3 당기기: 팔꿈치가 뒤로
    (pose(lean=-9, turn=1, head=-1, ra=(-135, 0), la=(-4, -4), rl=(58, 90), ll=(120, 95)), {'draw': True}),    # 4 끝까지: 뒷손이 턱·귀, 팔꿈치 머리 뒤 위, 앞다리 내딛고 젖힘
    (pose(lean=-11, turn=1, head=-1, ra=(-140, 3), la=(-5, -5), rl=(58, 90), ll=(122, 95)), {'draw': True}),  # 5 버팀 (더 젖힘)
    (pose(lean=-6, turn=1, ra=(-150, 180), la=(6, 10), rl=(62, 90), ll=(118, 95)), {'draw': False}),            # 6 놓음: 뒷손이 머리 뒤로 튕겨 펴짐, 활팔 앞으로 툭
    (pose(lean=0, turn=0.6, ra=(140, 120), la=(25, 25), rl=(74, 92), ll=(106, 92)), {'draw': False}),          # 7 여운: 팔이 내려옴
    (IDLE_BOW, {'draw': False}),                                                                                 # 8 대기
]
# 활 평타 B — 하늘 45° 쏘기 (화살비·태양 화살): 몸을 크게 뒤로 젖히고 두 팔이 45° 위로
SEQ['bow-sky'] = [
    (pose(lean=-6, turn=0.7, ra=(30, -20), la=(-30, -35), rl=(80, 95), ll=(100, 90)), {'draw': False}),        # 1 활을 위로 겨눔
    (pose(lean=-14, turn=1, ra=(-25, -45), la=(-45, -45), rl=(72, 92), ll=(108, 92)), {'draw': True}),          # 2 메김 (45° 위)
    (pose(lean=-20, turn=1, head=-2, ra=(170, -45), la=(-46, -46), rl=(66, 90), ll=(116, 92)), {'draw': True}), # 3 당기기
    (pose(lean=-26, turn=1, head=-3, ra=(-175, -45), la=(-47, -47), rl=(60, 88), ll=(122, 95)), {'draw': True}), # 4 끝까지 (크게 젖힘)
    (pose(lean=-27, turn=1, head=-3, ra=(-180, -42), la=(-48, -48), rl=(60, 88), ll=(122, 95)), {'draw': True}), # 5 버팀
    (pose(lean=-20, turn=1, ra=(-190, 150), la=(-55, -60), rl=(64, 90), ll=(118, 95)), {'draw': False}),         # 6 놓음: 뒷손 뒤로 튕김, 활 더 위로 튐
    (pose(lean=-8, turn=0.6, ra=(130, 110), la=(-10, 0), rl=(75, 92), ll=(105, 92)), {'draw': False}),          # 7 여운
    (IDLE_BOW, {'draw': False}),
]
# 석궁: 두 손으로 허리 높이에 든다 (RIGHT 개머리·방아쇠, LEFT 앞 받침)
IDLE_XB = pose(turn=0.4, ra=(70, 10), la=(30, -10), rl=(80, 95), ll=(100, 90))
SEQ['xbow-walk'] = [(pose(x=97, lean=8, ra=(70, 10), la=(40, -10), rl=(90 - 32 * math.cos(i * math.pi / 4), 95 - 22 * max(0, math.sin(i * math.pi / 4))),
                          ll=(90 + 32 * math.cos(i * math.pi / 4), 95 - 22 * max(0, -math.sin(i * math.pi / 4))),
                          air=1.5 * abs(math.sin(i * math.pi / 4))), {'deg': 0}) for i in range(8)]
# 석궁 평타 A — 겨눔 → 발사 반동 → 재장전(앞을 땅에 대고 시위를 끌어올림) → 대기
SEQ['xbow-shoot'] = [
    (pose(lean=2, turn=0.9, ra=(20, -60), la=(5, -5), rl=(75, 95), ll=(105, 90)), {'deg': 0}),                                     # 1 개머리를 어깨로 올려 겨눔 (뒷손 볼 옆)
    (pose(lean=6, head=1, turn=1, ra=(25, -70), la=(0, -5), rl=(65, 92), ll=(112, 95)), {'deg': 4}),                            # 2 숙여 조준, 앞다리 디딤
    (pose(lean=-10, head=-2, turn=1, ra=(15, -55), la=(-15, -25), rl=(72, 92), ll=(110, 95)), {'deg': -18}),            # 3 발사 반동: 어깨·석궁이 뒤·위로 튐
    (pose(x=94, lean=-14, head=-2, turn=1, ra=(25, -50), la=(-10, -20), rl=(82, 95), ll=(104, 90)), {'deg': -12}),      # 4 반 걸음 밀려남
    (pose(lean=30, ra=(80, 60), la=(85, 80), rl=(70, 100), ll=(110, 92)), {'deg': 80, 'grip': 'L'}),                         # 5 재장전: 석궁 앞을 땅으로, 크게 숙임
    (pose(lean=22, ra=(-60, -100), la=(85, 85), rl=(70, 100), ll=(110, 92)), {'deg': 80, 'grip': 'L', 'pull': True}),                      # 6 시위를 끌어올림 (뒷손 가슴 위로 크게)
    (pose(lean=10, ra=(60, 20), la=(50, 0), rl=(78, 95), ll=(102, 90)), {'deg': 15}),                                    # 7 들어 올림
    (IDLE_XB, {'deg': 0}),
]
# 석궁 평타 B — 하늘 45° 포격: 젖히며 겨눔 → 큰 반동
SEQ['xbow-sky'] = [
    (pose(turn=1, lean=-6, ra=(-10, -70), la=(-30, -40), rl=(78, 95), ll=(102, 90)), {'deg': -45}),
    (pose(turn=1, lean=-14, head=-2, ra=(-20, -80), la=(-45, -45), rl=(70, 92), ll=(110, 93)), {'deg': -45}),
    (pose(turn=1, lean=-16, head=-2, ra=(-22, -82), la=(-46, -46), rl=(68, 92), ll=(112, 93)), {'deg': -46}),
    (pose(turn=1, lean=-28, head=-3, ra=(-40, -95), la=(-65, -70), rl=(66, 90), ll=(118, 95)), {'deg': -62}),          # 발사: 크게 뒤로
    (pose(turn=1, x=94, lean=-24, head=-3, ra=(-35, -90), la=(-60, -65), rl=(80, 95), ll=(110, 93)), {'deg': -58}),
    (pose(lean=-12, ra=(10, -50), la=(-20, -20), rl=(78, 95), ll=(104, 90)), {'deg': -25}),
    (pose(lean=0, ra=(50, 0), la=(30, -10), rl=(80, 95), ll=(100, 90)), {'deg': -5}),
    (IDLE_XB, {'deg': 0}),
]
# 공성: 어깨 거치 (RIGHT 손이 어깨 위 개머리, LEFT 손이 앞에서 받침), 넓은 자세
IDLE_SG = pose(ra=(-80, -10), la=(10, -20), rl=(70, 95), ll=(112, 92))
SEQ['siege-walk'] = [(pose(x=97, lean=10, ra=(-80, -10), la=(10, -20), rl=(85 - 28 * math.cos(i * math.pi / 4), 95 - 18 * max(0, math.sin(i * math.pi / 4))),
                           ll=(95 + 28 * math.cos(i * math.pi / 4), 95 - 18 * max(0, -math.sin(i * math.pi / 4))),
                           air=1 * abs(math.sin(i * math.pi / 4))), {'deg': 0}) for i in range(8)]
# 공성 평타 A — 넓게 버팀 → 발사 → 큰 반동으로 반 걸음 밀림·석궁 들림 → 버텨 되돌림
SEQ['siege-shoot'] = [
    (pose(lean=4, ra=(-80, -10), la=(5, -15), rl=(60, 92), ll=(120, 95)), {'deg': 0}),                          # 1 다리 넓게 버팀
    (pose(lean=10, head=1, ra=(-75, -5), la=(0, -10), rl=(55, 90), ll=(125, 97)), {'deg': 2}),                  # 2 숙여 조준
    (pose(lean=-14, head=-3, ra=(-100, -30), la=(-30, -45), rl=(62, 92), ll=(120, 95)), {'deg': -25}),          # 3 발사: 어깨·석궁 크게 튐
    (pose(x=92, lean=-20, head=-3, ra=(-105, -40), la=(-35, -50), rl=(78, 95), ll=(108, 92)), {'deg': -30}),    # 4 반 걸음 밀림
    (pose(x=90, lean=-12, ra=(-95, -25), la=(-15, -30), rl=(85, 95), ll=(105, 92)), {'deg': -15}),              # 5 비틀
    (pose(x=93, lean=0, ra=(-85, -15), la=(0, -20), rl=(72, 95), ll=(110, 92)), {'deg': -5}),                   # 6 버팀
    (pose(x=96, lean=6, ra=(-80, -10), la=(8, -18), rl=(68, 95), ll=(114, 92)), {'deg': 0}),                    # 7 다시 겨눔
    (IDLE_SG, {'deg': 0}),
]
# 공성 평타 B — 한쪽 무릎 꿇고 하늘 45° 포격 (집중 포격·포격 스킬): 앉아 버팀 → 들어 올림 → 발사 → 반동
SEQ['siege-sky'] = [
    (pose(lean=6, ra=(-80, -10), la=(5, -15), rl=(40, 95), ll=(150, 175)), {'deg': 0}),                         # 1 뒷무릎 꿇음
    (pose(lean=-6, ra=(-95, -40), la=(-30, -45), rl=(35, 95), ll=(150, 178)), {'deg': -30}),
    (pose(lean=-14, head=-2, ra=(-105, -55), la=(-45, -55), rl=(30, 95), ll=(150, 178)), {'deg': -45}),        # 3 45° 겨눔
    (pose(lean=-26, head=-3, ra=(-120, -70), la=(-60, -75), rl=(30, 95), ll=(150, 178)), {'deg': -60}),        # 4 발사 반동
    (pose(lean=-20, head=-3, ra=(-115, -65), la=(-55, -70), rl=(32, 95), ll=(150, 178)), {'deg': -55}),
    (pose(lean=-10, ra=(-100, -45), la=(-35, -50), rl=(35, 95), ll=(150, 176)), {'deg': -40}),
    (pose(lean=0, ra=(-85, -20), la=(-5, -25), rl=(55, 95), ll=(130, 120)), {'deg': -10}),                      # 7 일어섬
    (IDLE_SG, {'deg': 0}),
]
FIRST = {'bow': IDLE_BOW, 'xbow': IDLE_XB, 'siege': IDLE_SG}
FIRST_NOTE = {'bow': {'draw': False}, 'xbow': {'deg': 0}, 'siege': {'deg': 0}}


def weapon_of(kind, p, note):
    """덧그리기 계획을 선으로: 활 = 활 든 손(LEFT ARM)에 세로 활대(화살 방향에 수직, 화살 방향 = 당기는 손 → 활 손), 시위 = 활 끝 → (당길 땐) 당기는 손
    석궁 = 뒤 손(RIGHT ARM) → 앞 손(LEFT ARM) 방향 몸체(note.deg 가 있으면 그 각도) + 앞 끝 가로 활대 · 공성 = 어깨 거치(뒤 손 = 어깨 위)"""
    out = []
    if kind == 'bow':
        b, d = p['LEFT ARM'], p['RIGHT ARM']
        if note.get('draw'): ang = math.atan2(b[1] - d[1], b[0] - d[0])
        else: ang = math.atan2(p['LEFT ARM'][1] - p['LEFT ELBOW'][1], p['LEFT ARM'][0] - p['LEFT ELBOW'][0])
        nx, ny = -math.sin(ang), math.cos(ang); R = 15
        t1, t2 = (b[0] + nx * R, b[1] + ny * R), (b[0] - nx * R, b[1] - ny * R)
        mid = (b[0] + math.cos(ang) * 6, b[1] + math.sin(ang) * 6)
        out += [('arc', t1, mid, t2)]
        out += [('line', t1, d), ('line', d, t2)] if note.get('draw') else [('line', t1, t2)]
    else:
        g = p['LEFT ARM'] if note.get('grip') == 'L' else p['RIGHT ARM']; f = p['LEFT ARM']      # 재장전은 앞손이 쥐고 코를 땅에
        deg = note.get('deg'); ang = math.radians(deg) if deg is not None else math.atan2(f[1] - g[1], f[0] - g[0])
        L = 26 if kind == 'siege' else 20; back = 6
        a = (g[0] - math.cos(ang) * back, g[1] - math.sin(ang) * back); e = (g[0] + math.cos(ang) * L, g[1] + math.sin(ang) * L)
        nx, ny = -math.sin(ang), math.cos(ang); R = 12 if kind == 'siege' else 9
        t1, t2 = (e[0] + nx * R, e[1] + ny * R), (e[0] - nx * R, e[1] - ny * R)
        out += [('line', a, e), ('line', t1, t2)]
        if note.get('pull'): out += [('line', t1, p['RIGHT ARM']), ('line', p['RIGHT ARM'], t2)]   # 재장전: 뒷손이 시위를 끌어올림
    return out


def kp(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


def stick(p, kind, note, S=3, ghost=None):
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255)); d = ImageDraw.Draw(im)
    if ghost:
        for a, b in BONES: d.line([(ghost[a][0] * S, ghost[a][1] * S), (ghost[b][0] * S, ghost[b][1] * S)], fill=(60, 64, 80), width=S)
    col = lambda a, b: (255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230)
    order = sorted(BONES, key=lambda ab: Z.get(ab[1], 5))
    for a, b in order: d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=col(a, b), width=S + 1)
    hx, hy = p['NECK'][0] + 2, p['NECK'][1] - 9
    d.ellipse([(hx - 8) * S, (hy - 8) * S, (hx + 8) * S, (hy + 8) * S], outline=(230, 230, 230), width=S)
    d.ellipse([(p['NOSE'][0] - 1) * S, (p['NOSE'][1] - 1) * S, (p['NOSE'][0] + 1) * S, (p['NOSE'][1] + 1) * S], fill=(230, 230, 230))
    for w in weapon_of(kind, p, note):
        if w[0] == 'line': d.line([(w[1][0] * S, w[1][1] * S), (w[2][0] * S, w[2][1] * S)], fill=(255, 215, 80), width=max(1, S - 1))
        else:
            pts = [((1 - u) ** 2 * w[1][0] + 2 * (1 - u) * u * w[2][0] + u * u * w[3][0], (1 - u) ** 2 * w[1][1] + 2 * (1 - u) * u * w[2][1] + u * u * w[3][1]) for u in [i / 12 for i in range(13)]]
            d.line([(x * S, y * S) for x, y in pts], fill=(200, 150, 70), width=S + 1)
    d.line([(40 * S, 176 * S), (152 * S, 176 * S)], fill=(80, 80, 100), width=1)
    return im.crop((40 * S, 88 * S, 152 * S, 182 * S))


if __name__ == '__main__':
    summary = {}
    for name, frames in SEQ.items():
        kind = name.split('-')[0]
        first = FIRST[kind]
        json.dump({'action': name, 'frames': len(frames), 'first_frame_keypoints': kp(first), 'first_weapon': FIRST_NOTE[kind], 'keypoints': [kp(p) for p, _ in frames],
                   'weapon': [n for _, n in frames], 'note': '192칸, 발 (96,176). first_frame 이미지는 새 디자인 승인 뒤 붙인다'},
                  open(os.path.join(SK, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        tiles = [stick(first, kind, FIRST_NOTE[kind])] + [stick(p, kind, n, ghost=first) for p, n in frames]
        W_, H_ = tiles[0].size
        mont = Image.new('RGBA', ((W_ + 6) * len(tiles), H_ + 22), (40, 42, 52, 255)); dd = ImageDraw.Draw(mont)
        for i, t in enumerate(tiles):
            mont.paste(t, (i * (W_ + 6), 22)); dd.text((i * (W_ + 6) + 6, 4), 'first' if i == 0 else str(i), fill=(255, 220, 90))
        mont.save(os.path.join(SK, f'stick-{name}.png'))
        g = [t.convert('RGB') for t in tiles[1:]]
        g[0].save(os.path.join(SK, f'stick-{name}.gif'), save_all=True, append_images=g[1:], duration=[140] * len(g), loop=0)
        # 과장 정도: 대기 대비 손목·목 최대 이동 (칸)
        mv = lambda k: max(math.hypot(p[k][0] - first[k][0], p[k][1] - first[k][1]) for p, _ in frames)
        summary[name] = {k: round(mv(k), 1) for k in ('RIGHT ARM', 'LEFT ARM', 'NECK', 'RIGHT LEG', 'LEFT LEG')}
    json.dump(summary, open(os.path.join(SK, 'motion-summary.json'), 'w'), indent=1)
    for k, v in summary.items(): print(k, v)
