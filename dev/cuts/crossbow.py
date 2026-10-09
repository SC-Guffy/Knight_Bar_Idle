# -*- coding: utf-8 -*-
# 평타 컷: 석궁 계열 팔·다리 그림 (src/cuts/crossbow.js 끝의 'crossbow' 블록). 실행: python dev/cuts/crossbow.py  (미리보기: --dry)
#  거대 석궁(석궁사수)·공성 석궁(공성포수)은 두 손으로 받친다 — 앞팔(앞어깨)이 몸체 손잡이(그림의 손 = 석궁 기준점)를 쥐고,
#  뒷팔(뒷어깨)이 개머리 아래를 받친다. 컷은 옆모습(sx 0.86~0.95)이라 뒷어깨 = 앞어깨 + (-5.2, 0.8) 칸.
#  뒷손 자리 = 앞손 + 회전(bowA)·STOCK 칸 (개머리 쪽으로 4칸, 아래로 0.5칸). 아래 POSES 에서 두 손 자리를 계산하고 팔꿈치는 두 마디 길이로 푼다.
#  손 칸은 그림에서 floor(H) + 0.5 로 붙으므로 손 자리는 .5 로 끝나게 둔다
import sys, os, io, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

BS = (-5.2, 0.8)          # 옆모습에서 앞어깨 → 뒷어깨 (칸)
STOCK = (-4.0, 0.5)       # 앞손 → 뒷손 (석궁 축 기준: 개머리 쪽 4칸 — 몸체 줄이 손보다 1.5칸 위라 두 손 모두 몸체 밑을 받친다)

def arm(h, up=4.8, lo=4.8, hand='grip', radii=(1.6, 1.35, 1.1)):
    """어깨(0,0) → 손 h. 팔꿈치는 두 원의 교점 중 바른 쪽(cross <= 0). 너무 멀면 쭉 편다"""
    hx, hy = h; d = math.hypot(hx, hy)
    if d >= up + lo - 0.3: s = d / (up + lo - 0.3); up, lo = up * s, lo * s
    a = (up * up - lo * lo + d * d) / (2 * d); hh = math.sqrt(max(0, up * up - a * a))
    e = (hx * a / d - hy / d * hh, hy * a / d + hx / d * hh)
    return {'e': (round(e[0], 2), round(e[1], 2)), 'h': h, 'hand': hand, 'radii': radii}

def snap(v): return math.floor(v) + 0.5

# 자세: 이름 → (석궁 기울기 bowA, 앞손 자리(앞어깨 기준 칸))
POSES = {
    'Ready':   (0.3,   (4.5, 5.5)),    # 대기: 허리 높이로 내려 든다 (앞코가 아래)
    'Lift':    (0.12,  (6.5, 2.5)),    # 들어 올림
    'Aim':     (0.0,   (6.5, 0.5)),    # 어깨에 견착 — 개머리가 앞어깨에 닿는다
    'Kick':    (-0.3,  (5.5, -0.5)),   # 쏜 반동: 앞코가 들리고 몸 쪽으로 밀린다
    'Settle':  (-0.12, (5.5, 0.5)),    # 여운
    'Recover': (0.2,   (5.5, 3.5)),    # 거두기
}
ARMS = {}
for name, (a, hf) in POSES.items():
    c, s = math.cos(a), math.sin(a)
    hb = (hf[0] + STOCK[0] * c - STOCK[1] * s - BS[0], hf[1] + STOCK[0] * s + STOCK[1] * c - BS[1])
    ARMS['cb_f' + name] = arm(hf)
    ARMS['cb_b' + name] = arm((snap(hb[0]), snap(hb[1])))

LEGS = {
    #               G     뒷다리 (h, k, a)                           앞다리 (h, k, a)
    'cb_stand':    (7.0, ((-3.5, -0.5), (-4.2, 2.8), (-5.4, 5.5)), ((3.5, -0.5), (4.8, 2.8), (5.4, 5.5))),
    'cb_brace':    (6.6, ((-3.5, -0.5), (-5.0, 2.6), (-7.4, 5.1)), ((3.5, -0.5), (6.4, 2.0), (6.4, 5.1))),   # 두 발을 넓게 벌려 버틴다 (앞무릎 굽힘)
    'cb_recoil':   (6.3, ((-3.5, -0.5), (-2.2, 2.3), (-6.0, 4.8)), ((3.5, -0.5), (6.4, 2.2), (9.0, 4.8))),   # 반동: 뒷무릎이 꺾이고 앞다리가 펴지며 밀린다
    'cb_settle':   (6.8, ((-3.5, -0.5), (-3.6, 2.7), (-6.4, 5.3)), ((3.5, -0.5), (5.6, 2.6), (6.6, 5.3))),
    'cb_kneel':    (4.4, ((-3.5, -0.5), (-2.6, 3.0), (-7.6, 3.0)), ((3.5, -0.5), (7.0, -0.2), (7.2, 2.9))),  # 무릎 꿇기 (뒷무릎이 땅에)
    'cb_kneelBack':(4.6, ((-3.5, -0.5), (-3.4, 3.1), (-8.2, 3.2)), ((3.5, -0.5), (6.6, 0.2), (7.6, 3.1))),  # 무릎 꿇은 채 반동
    'cb_half':     (5.6, ((-3.5, -0.5), (-1.4, 2.0), (-5.2, 4.1)), ((3.5, -0.5), (6.6, 1.2), (6.4, 4.1))),   # 일어나는 중 (반쯤 숙임)
}
LIFTED = {'cb_kneel': 'back', 'cb_kneelBack': 'back'}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for k, v in ARMS.items(): print(k, v['e'], v['h'])
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'crossbow.js'), 'crossbow', ARMS, LEGS, FIX, LIFTED)
