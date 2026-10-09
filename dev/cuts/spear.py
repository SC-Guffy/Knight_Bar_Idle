# -*- coding: utf-8 -*-
# 평타 컷: 창 계열 팔·다리 그림 (src/cuts/spear.js 끝의 'spear' 블록). 실행: python dev/cuts/spear.py  (미리보기: --dry)
#  장병기는 두 손으로 자루를 쥔다 — 앞팔은 자루 앞쪽, 뒷팔은 물미 쪽을 쥔다(손 모양 'grip').
#  뒷팔 손 자리는 컷 표의 bgrip(앞손에서 자루 뒤로 칸)과 맞아야 한다: 뒷손 = 앞손 − bgrip·(cos wa, sin wa), 그림의 어깨→손 = 뒷손 − 뒷어깨
import sys, os, io
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

G = lambda e, h: {'e': e, 'h': h, 'hand': 'grip'}
ARMS = {
    # 앞팔 (자루 앞쪽을 쥔다)
    'sp_ready':    G((0.6, 5.0),  (4.6, 6.2)),     # 허리 앞에서 창끝을 적에게 겨눔
    'sp_pull':     G((-1.4, 4.6), (2.2, 5.6)),     # 팔꿈치를 뒤로 빼며 창을 당김
    'sp_pullFull': G((-2.6, 3.8), (1.2, 5.2)),     # 끝까지 당김 — 손이 가슴 앞
    'sp_thrust':   G((5.2, 0.3),  (10.4, 0.6)),    # 어깨 높이로 쭉
    'sp_follow':   G((4.8, 1.5),  (9.6, 2.4)),     # 조금 거두며 내려옴
    'sp_recover':  G((1.0, 5.0),  (5.0, 5.8)),
    'sp_lift':     G((3.8, 2.4),  (5.2, -1.0)),    # 팔꿈치 아래, 손을 어깨 앞으로 — 창끝을 들어 올림
    'sp_high':     G((3.4, -1.4), (6.0, -5.5)),    # 손을 머리 앞·위로 끝까지 — 창끝이 하늘로, 물미는 허리 뒤
    'sp_stab':     G((4.6, 1.6),  (9.6, 1.8)),     # 어깨 높이에서 앞·아래로 내리꽂음
    'sp_stabLow':  G((4.2, 2.6),  (9.0, 3.0)),
    # 뒷팔 (물미 쪽을 쥔다) — 손 자리는 컷 표(ext·wa)에서 잰 뒷손 − 뒷어깨 (칸)
    'sp_bReady':   G((2.0, 5.0),  (5.4, 8.8)),     # 물미를 허리 앞에서 받침 (팔을 거의 편다)
    'sp_bPull':    G((-4.2, 2.6), (-5.3, 6.5)),    # 물미를 허리 뒤로 당김 (팔꿈치가 뒤로)
    'sp_bPullFull':G((-4.8, 2.0), (-7.7, 6.1)),    # 끝까지 뒤로
    'sp_bThrust':  G((4.6, 0.6),  (9.2, -0.2)),    # 물미를 밀며 앞으로 쭉 — 두 손이 모인다
    'sp_bFollow':  G((3.0, 2.8),  (6.9, 1.5)),
    'sp_bRecover': G((1.4, 5.0),  (5.5, 6.6)),
    'sp_bLift':    G((1.2, 4.0),  (3.5, 2.2)),     # 물미 쪽을 가슴 앞에서 받쳐 든다 (팔꿈치 아래)
    'sp_bHigh':    G((-1.8, 2.2), (1.5, 3.2)),     # 물미를 가슴 아래로 끌어당김 (팔꿈치를 옆구리에)
    'sp_bStab':    G((3.2, 2.0),  (7.0, -0.7)),    # 물미를 밀며 내리꽂음
    'sp_bStabLow': G((2.6, 2.6),  (5.8, 0.5)),
}
LEGS = {
    #            G     뒷다리 (h, k, a)                          앞다리 (h, k, a)
    'sp_jump': (6.0, ((-3.5, -0.5), (-1.2, 2.2), (-4.4, 4.0)), ((3.5, -0.5), (6.4, 1.4), (5.2, 4.2))),   # 뛰어올라 두 무릎을 접음 (용기병 내리꽂기)
}
LIFTED = {'sp_jump': 'front'}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'spear.js'), 'spear', ARMS, LEGS, FIX, LIFTED)
