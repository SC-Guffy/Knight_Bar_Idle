# -*- coding: utf-8 -*-
# 평타 컷: 대검 계열 팔·다리 그림 (src/cuts/greatsword.js 끝의 'greatsword' 블록). 실행: python dev/cuts/greatsword.py  (미리보기: --dry)
#  대검(판때기, 양손)은 두 손으로 자루를 쥔다 — 앞팔은 날밑 쪽, 뒷팔은 자루 아래(폼멜 쪽)를 쥔다(손 모양 'grip').
#  뒷팔 손 자리는 컷 표의 bgrip(앞손에서 자루 뒤로 칸)과 맞아야 한다: 뒷손 = 앞손 − bgrip·(cos wa, sin wa), 그림의 어깨→손 = 뒷손 − 뒷어깨.
#  그 값은 브라우저에서 gsMeasure() (src/cuts/greatsword.js) 로 잰다 — 컷 표를 바꾸면 다시 재서 아래 BACK 손 자리를 고친다.
#  팔꿈치는 손 자리와 두 마디 길이로 계산한다 (늘 바른 쪽으로 접힌다: cross(윗팔, 아랫팔) <= 0)
import sys, os, io, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

def arm(h, up=5.4, lo=5.0, hand='grip', radii=(1.75, 1.45, 1.15), bend=1.0):
    """어깨(0,0) → 손 h. 팔꿈치는 두 원의 교점 중 바른 쪽(뒤·아래로 접힘). 손이 너무 멀면 쭉 편다. bend < 1 이면 덜 굽힘"""
    hx, hy = h; d = math.hypot(hx, hy)
    if d >= up + lo - 0.3:                       # 너무 멀면 두 마디를 늘여 아주 조금만 굽힌다 (쭉 편 팔)
        s = d / (up + lo - 0.3); up, lo = up * s, lo * s
    a = (up * up - lo * lo + d * d) / (2 * d); hh = math.sqrt(max(0, up * up - a * a)) * bend
    px, py = hx * a / d, hy * a / d
    e = (px - hy / d * hh, py + hx / d * hh)
    return {'e': (round(e[0], 2), round(e[1], 2)), 'h': h, 'hand': hand, 'radii': radii}

BR = (1.6, 1.35, 1.1)        # 뒷팔은 조금 가늘게 (멀리 있는 팔)
ARMS = {
    # ── 앞팔 (날밑 쪽을 쥔다) ──
    'gs_rest':    arm((3.4, 2.2)),                  # 대검을 어깨에 걸쳤다 — 손은 가슴 앞, 칼등이 어깨에 얹힌다
    'gs_raise':   arm((2.6, -0.6)),                 # 어깨에서 들어 올려 얼굴 앞에 세운다
    'gs_windup':  arm((-1.6, -7.4)),                # 손이 머리 옆·뒤 — 칼날이 머리 뒤로 넘어가 등 뒤로 눕는다
    'gs_chop':    arm((8.4, 5.2)),                  # 앞·아래로 쭉 — 온몸으로 내리찍음
    'gs_dig':     arm((7.6, 7.0)),                  # 땅에 박힐 듯 더 낮게
    'gs_recover': arm((3.2, 2.4)),                  # 들어 올려 어깨로 되돌린다
    'gs_coilA':   arm((-2.6, 4.4)),                 # 허리를 돌리며 대검을 옆구리 뒤로 끌어간다
    'gs_coil':    arm((-6.0, 5.0)),                 # 끝까지 비틀어 뒷허리 — 칼끝이 뒤를 본다
    'gs_sweep':   arm((9.0, 4.8)),                  # 허리 높이로 앞으로 쭉 — 수평 휩쓸기
    'gs_sweepF':  arm((7.4, 6.8)),                  # 휩쓴 뒤 무게에 끌려 내려감
    # ── 뒷팔 (자루 아래를 쥔다) — 손 자리는 gsMeasure() 로 잰 값 ──
    'gsb_free':   arm((-1.2, 9.6), up=5.2, lo=4.8, hand='fist', radii=BR),   # 어깨에 걸치고 있을 땐 뒷손은 허리 옆에 늘어뜨린다
    'gsb_raise':  arm((9.7, 2.6), radii=BR),
    'gsb_windup': arm((6.8, -9.7), radii=BR),
    'gsb_chop':   arm((9.5, 3.4), radii=BR),
    'gsb_dig':    arm((8.6, 5), radii=BR),
    'gsb_recover':arm((10.6, 4.3), radii=BR),
    'gsb_coilA':  arm((6.8, 5.4), radii=BR),
    'gsb_coil':   arm((6.5, 4.9), radii=BR),
    'gsb_sweep':  arm((10.3, 3.4), radii=BR),
    'gsb_sweepF': arm((8.4, 4.7), radii=BR),
}
# ── 다리: 골반 아래(0,0) 기준 (엉덩이, 무릎, 발목). 땅은 G 칸 아래. 무릎은 앞으로 굽는다 ──
LEGS = {
    #             G     뒷다리                                       앞다리
    'gs_set':   (7.0, ((-3.5, -0.5), (-4.8, 2.8), (-6.4, 5.5)), ((3.5, -0.5), (5.4, 2.8), (6.2, 5.5))),    # 넓게 버틴 대기
    'gs_load':  (6.3, ((-3.5, -0.5), (-1.8, 2.3), (-6.0, 4.8)), ((3.5, -0.5), (6.4, 2.0), (8.0, 4.8))),    # 뒷발에 무게 — 뒷무릎 굽힘
    'gs_slam':  (4.6, ((-3.5, -0.5), (-4.6, 2.9), (-9.0, 3.1)), ((3.5, -0.5), (8.2, 0.2), (8.8, 3.1))),    # 앞무릎 깊게, 뒷무릎은 땅 가까이 — 몸이 가라앉는다
    'gs_coil':  (6.0, ((-3.5, -0.5), (-1.4, 2.2), (-5.2, 4.5)), ((3.5, -0.5), (6.6, 1.8), (7.8, 4.5))),    # 허리를 비튼 채 웅크림
    'gs_sweep': (5.2, ((-3.5, -0.5), (-6.4, 1.6), (-10.2, 3.7)), ((3.5, -0.5), (7.6, 0.8), (8.6, 3.7))),   # 넓고 낮은 런지
    'gs_rise':  (6.6, ((-3.5, -0.5), (-4.0, 2.6), (-5.8, 5.1)), ((3.5, -0.5), (5.6, 2.4), (6.0, 5.1))),    # 일어서며 거둔다
}
LIFTED = {}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'greatsword.js'), 'greatsword', ARMS, LEGS, FIX, LIFTED)
