# 파이터 계열 관절 시퀀스 설계 (animate-with-skeleton-v3, 192칸, 그림체 B 3등신 — 마법사 skel.py to_b 기준 뼈 길이) — PixelLab 0, 설계만.
#  오른쪽(east)을 본다. RIGHT = 가까운 쪽(뒷손·뒷발, 위에 그려짐), LEFT = 먼 쪽(앞손·앞발). 오소독스: 잽 = LEFT, 스트레이트 = RIGHT(뒷발 피벗·몸 숙임).
#  각도: 0 = 아래, 90 = 앞(오른쪽), 180 = 위. 팔은 각도(FK), 다리는 발 위치(IK, 무릎은 앞으로 굽음).
#  묶음 15f: 주먹 = 잽 7 + 스트레이트 8 · 발 = 앞차기 7 + 돌려차기 8 · 장 = 한손 장타 7 + 두손 장풍 8.  걷기 8f.
#  python -I -B dev/boxer/b/bskel.py → dev/boxer/b/skel/stick-<묶음>.png (막대 인형 확인)
import os, sys, math, importlib.util
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
_sp = importlib.util.spec_from_file_location('mskel', os.path.join(ROOT, 'dev', 'sheets-mage', 'skel.py')); MS = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(MS)
BASE = MS.to_b(MS.pose())                      # 팔 내린 중립 (첫 프레임 관절의 기준)
kp, BONES, N = MS.kp, MS.BONES, MS.N
UA, FA, TH, SH = 15.0, 13.4, 14.3, 14.0        # 위팔·아래팔·허벅지·정강이
TORSO = 28.8                                    # 골반 가운데 → 목
PEL0 = (67.5, 145.0); GROUND = 173.0
HEADO = {k: (BASE[k][0] - BASE['NECK'][0], BASE[k][1] - BASE['NECK'][1]) for k in ('NOSE', 'RIGHT EYE', 'LEFT EYE', 'RIGHT EAR', 'LEFT EAR')}


def v(a, l):
    r = math.radians(a); return (math.sin(r) * l, math.cos(r) * l)


def ik(hip, foot, bend=1):
    """2마디 다리: 무릎은 앞(+x)으로 굽는다. 닿지 않으면 쭉 편다"""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]; d = min(math.hypot(dx, dy), TH + SH - 0.01)
    a = math.atan2(dy, dx); c = (TH * TH + d * d - SH * SH) / (2 * TH * d); c = max(-1, min(1, c))
    k = a - bend * math.acos(c)
    return (hip[0] + TH * math.cos(k), hip[1] + TH * math.sin(k)), (hip[0] + d * math.cos(a), hip[1] + d * math.sin(a))


def P(pel=(0, 0), lean=0, twist=0, ra=(10, 10), la=(-10, -10), rf=(11, 0), lf=(-13, 0), head=0, lt=0, hipw=1.0):
    """pel: 골반 이동(중립 대비) · lean: 몸통 앞 기울기(도) · twist: 뒷어깨(RIGHT)가 앞으로 나온 정도(칸, + 면 스트레이트 회전)
    ra/la: (위팔 각, 아래팔 각) · rf/lf: 발 위치 (골반 중립 x 기준 칸, 땅에서 위로 칸)
    lt: 앞어깨(LEFT)가 앞으로 나온 정도(잽) · hipw: 엉덩이 좌우 폭 배수 (자세에서 다리가 X 로 엇갈리지 않게 좁힘)"""
    px, py = PEL0[0] + pel[0], PEL0[1] + pel[1]
    nx, ny = px + math.sin(math.radians(lean)) * TORSO, py - math.cos(math.radians(lean)) * TORSO
    c, s = math.cos(math.radians(lean)), math.sin(math.radians(lean))
    sh = lambda ox, oy: (nx + ox * c - oy * s, ny + ox * s + oy * c)
    p = {'NECK': (nx, ny)}
    p['RIGHT SHOULDER'] = sh(14.7 + twist, 6.6); p['LEFT SHOULDER'] = sh(-13.0 + twist * 0.6 + lt, 6.6)
    p['RIGHT HIP'] = (px + 8.2 * hipw + twist * 0.35, py); p['LEFT HIP'] = (px - 8.1 * hipw + twist * 0.2, py)
    for side, (a1, a2) in (('RIGHT', ra), ('LEFT', la)):
        s0 = p[f'{side} SHOULDER']; e = (s0[0] + v(a1, UA)[0], s0[1] + v(a1, UA)[1]); h = (e[0] + v(a2, FA)[0], e[1] + v(a2, FA)[1])
        p[f'{side} ELBOW'], p[f'{side} ARM'] = e, h
    for side, (fx, fy) in (('RIGHT', rf), ('LEFT', lf)):
        p[f'{side} KNEE'], p[f'{side} LEG'] = ik(p[f'{side} HIP'], (PEL0[0] + fx, GROUND - fy))
    hr = math.radians(head + lean * 0.4)
    for k, (ox, oy) in HEADO.items():
        p[k] = (nx + ox * math.cos(hr) - oy * math.sin(hr), ny + ox * math.sin(hr) + oy * math.cos(hr))
    return {k: (round(x, 1), round(y, 1)) for k, (x, y) in p.items()}


# 가드: 앞발(LEFT) 앞, 뒷발 뒤, 무릎 굽힘(골반 2 낮춤), 두 주먹 턱 앞 — 앞주먹이 더 앞
G = dict(pel=(0, 2), lean=6, ra=(30, 160), la=(55, 150), rf=(-10, 0), lf=(14, 0), hipw=0.25, lt=4)


def g(**o):
    d = dict(G); d.update(o); return P(**d)


PUNCH = [  # 잽 7 (LEFT 앞손) — 짧고 빠르게, 몸은 조금만
    g(),
    g(pel=(2, 2), lf=(17, 0), la=(70, 120), lt=8),
    g(pel=(4, 2), lean=10, lf=(19, 0), la=(92, 92), ra=(28, 162), lt=14),     # 잽 타격: 앞어깨 내밀며 앞팔 수평으로 쭉
    g(pel=(4, 2), lean=10, lf=(19, 0), la=(93, 93), ra=(28, 162), lt=14),
    g(pel=(2, 2), lf=(17, 0), la=(68, 125), lt=8),
    g(),
    g(pel=(0, 3)),
] + [      # 스트레이트 8 (RIGHT 뒷손) — 장전 → 뒷발 뒤꿈치 들며 골반·어깨 회전 → 몸 숙여 끝까지 → 회수
    g(),
    g(pel=(-2, 3), lean=2, twist=-4, ra=(20, 170), la=(60, 145)),               # 장전: 뒤로 꼬기
    g(pel=(4, 2), lean=12, twist=6, ra=(70, 110), la=(40, 160), rf=(-8, 3)),    # 회전 시작, 뒤꿈치 듦
    g(pel=(8, 1), lean=20, twist=12, ra=(94, 94), la=(35, 165), rf=(-4, 5), lf=(18, 0)),   # 타격: 뒷팔 끝까지 + 어깨 앞으로
    g(pel=(8, 1), lean=20, twist=12, ra=(95, 95), la=(35, 165), rf=(-4, 5), lf=(18, 0)),
    g(pel=(5, 2), lean=14, twist=7, ra=(60, 130), la=(45, 158), rf=(-6, 2), lf=(17, 0)),
    g(pel=(1, 2), lean=8, twist=1),
    g(),
]
KICK = [   # 앞차기 7 (RIGHT 가까운 다리로 밀어 차기 — 먼 쪽 팔·다리는 모델이 그리지 않는다: 스트라이커 잽 시험 2026-10-17)
    g(),
    g(pel=(-2, 1), lean=-4, rf=(8, 14)),                                         # 무릎 들기
    g(pel=(-3, 0), lean=-10, rf=(40, 24), la=(45, 160)),                         # 쭉 밀어 차기 (발 허리 높이)
    g(pel=(-3, 0), lean=-10, rf=(41, 24), la=(45, 160)),
    g(pel=(-2, 1), lean=-4, rf=(10, 13)),
    g(pel=(0, 2), rf=(-8, 1)),
    g(),
] + [      # 돌려차기 8 (RIGHT 뒷발이 높이 돌아 옴) — 몸을 뒤로 크게 젖힘
    g(),
    g(pel=(2, 2), lean=0, twist=-3, lf=(15, 0), rf=(-6, 3)),                     # 체중 앞발로
    g(pel=(4, 0), lean=-12, twist=4, rf=(8, 18), ra=(10, 120), la=(70, 140)),    # 무릎 접어 돌려 올림
    g(pel=(4, -1), lean=-26, twist=8, rf=(48, 42), ra=(-30, -20), la=(80, 130)),  # 타격: 머리 높이로 쭉 (뒷팔은 뒤로 균형)
    g(pel=(4, -1), lean=-26, twist=8, rf=(49, 43), ra=(-30, -20), la=(80, 130)),
    g(pel=(3, 0), lean=-12, twist=3, rf=(10, 16), ra=(10, 120)),
    g(pel=(1, 2), lean=2, rf=(-8, 2)),
    g(),
]
PALM = [   # 한손 장타 7 (RIGHT 앞으로 손바닥 밀기, 앞굽이)
    g(),
    g(pel=(-2, 4), lean=0, twist=-3, ra=(15, 175), la=(70, 120)),               # 손을 허리로 당김
    g(pel=(6, 5), lean=12, twist=8, ra=(90, 88), la=(30, 170), lf=(22, 0), rf=(-14, 0)),   # 깊은 앞굽이로 장타
    g(pel=(6, 5), lean=12, twist=8, ra=(91, 89), la=(30, 170), lf=(22, 0), rf=(-14, 0)),
    g(pel=(3, 3), lean=8, twist=3, ra=(60, 120), lf=(18, 0)),
    g(),
    g(pel=(0, 3)),
] + [      # 두손 장풍 8 — 두 손을 허리 옆으로 모아 기를 모았다가 앞으로 크게 밀어냄 (마보)
    g(),
    g(pel=(-3, 6), lean=-4, twist=-2, ra=(20, 140), la=(10, 150), lf=(16, 0), rf=(-14, 0)),   # 모으기 (허리 옆)
    g(pel=(-4, 7), lean=-6, twist=-3, ra=(15, 150), la=(5, 160), lf=(16, 0), rf=(-14, 0)),
    g(pel=(5, 6), lean=14, twist=5, ra=(88, 84), la=(86, 84), lf=(22, 0), rf=(-15, 0)),        # 두 손 밀어냄
    g(pel=(6, 6), lean=16, twist=6, ra=(90, 86), la=(88, 86), lf=(22, 0), rf=(-15, 0)),
    g(pel=(6, 6), lean=16, twist=6, ra=(90, 86), la=(88, 86), lf=(22, 0), rf=(-15, 0)),
    g(pel=(2, 4), lean=8, ra=(50, 140), la=(55, 140)),
    g(),
]


def walk(n=8, stride=13, lift=6, swing=28):
    """걷기 8f: 발 위치를 사이클로 (앞으로 나가는 발은 들어 올린다), 몸 위아래 ±2, 팔은 반대로 흔듦 (주먹 쥔 채 살짝 굽힘)"""
    out = []
    for i in range(n):
        t = i / n * 2 * math.pi
        fx = lambda ph: stride * math.cos(t + ph)
        fy = lambda ph: max(0.0, lift * math.sin(t + ph))
        bob = -2 * abs(math.sin(t))
        out.append(P(pel=(0, bob + 1), lean=8, ra=(-swing * math.cos(t) + 5, -swing * math.cos(t) + 45), la=(swing * math.cos(t) + 5, swing * math.cos(t) + 45),
                     rf=(fx(0), fy(0)), lf=(fx(math.pi), fy(math.pi))))
    return out


BUNDLE = {'punch': PUNCH, 'kick': KICK, 'palm': PALM}
KIND = {'fighter': 'punch', 'striker': 'punch', 'champion': 'punch', 'kickboxer': 'kick', 'tempest': 'kick', 'qigong': 'palm', 'grandmaster': 'palm'}


def stick(p, S=2, ghost=None, crop=(0, 60, 192, 184)):
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255)); d = ImageDraw.Draw(im)
    col = lambda a, b: (255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230)
    if ghost:
        for a, b in BONES: d.line([(ghost[a][0] * S, ghost[a][1] * S), (ghost[b][0] * S, ghost[b][1] * S)], fill=(60, 64, 80), width=S)
    for a, b in sorted(BONES, key=lambda ab: 0 if 'LEFT' in ab[0] + ab[1] else 1):
        d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=col(a, b), width=S + 1)
    hx, hy = (p['RIGHT EAR'][0] + p['NOSE'][0]) / 2, (p['RIGHT EAR'][1] + p['NOSE'][1]) / 2
    d.ellipse([(hx - 13) * S, (hy - 13) * S, (hx + 13) * S, (hy + 13) * S], outline=(230, 230, 230), width=S)
    for k in ('RIGHT ARM', 'LEFT ARM'): d.ellipse([(p[k][0] - 3) * S, (p[k][1] - 3) * S, (p[k][0] + 3) * S, (p[k][1] + 3) * S], fill=col(k, ''))
    d.line([(0, GROUND * S), (N * S, GROUND * S)], fill=(80, 80, 100), width=1)
    return im.crop(tuple(c * S for c in crop))


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'skel'), exist_ok=True)
    rows = []
    for name, fr in list(BUNDLE.items()) + [('walk', walk())]:
        tiles = [stick(p, ghost=BASE) for p in fr]
        row = Image.new('RGBA', (tiles[0].width * len(tiles), tiles[0].height), (30, 32, 40, 255))
        for i, t in enumerate(tiles): row.paste(t, (i * t.width, 0))
        row.save(os.path.join(HERE, 'skel', f'stick-{name}.png')); rows.append(row)
        out = [(i, k) for i, p in enumerate(fr) for k, (x, y) in p.items() if not (2 <= x <= 190 and 2 <= y <= GROUND + 0.5)]
        print(name, len(fr), 'out' if out else 'in', out[:3])
    W = max(r.width for r in rows); allm = Image.new('RGB', (W, sum(r.height for r in rows))); y = 0
    for r in rows: allm.paste(r, (0, y)); y += r.height
    allm.save(os.path.join(HERE, 'skel', 'stick-all.png'))
