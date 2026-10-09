# -*- coding: utf-8 -*-
# 평타 컷: 할버드 계열 팔·다리 그림 (src/cuts/halberd.js 끝의 'halberd' 블록). 실행: python dev/cuts/halberd.py  (미리보기: --dry)
#  두 손으로 긴 자루를 쥔다 — 앞팔(가까운 팔)은 자루 위쪽(날 쪽), 뒷팔은 물미 쪽(컷 표의 bgrip 칸만큼 자루 뒤).
#  뒷팔 손 자리 = 앞손 − bgrip·(cos wa, sin wa) − 뒷어깨 (칸) — 컷 표를 바꾸면 다시 재서 맞춘다
import sys, os, io
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

G = lambda e, h: {'e': e, 'h': h, 'hand': 'grip'}
ARMS = {
    # 앞팔 (자루 위쪽을 쥔다)
    'hb_ready':    G((2.4, 4.0),  (4.5, 2.0)),     # 가슴 앞에서 날을 앞·위로 비스듬히 세움
    'hb_raise':    G((3.4, 2.8),  (2.5, -2.0)),    # 팔꿈치 아래, 손을 얼굴 앞으로 — 할버드를 곧추세움
    'hb_windup':   G((1.0, -4.8), (-3.5, -7.6)),   # 손이 머리 위 뒤로 — 날이 등 뒤로 넘어간다
    'hb_chop':     G((4.4, 2.6),  (8.6, 2.4)),     # 앞으로 크게 내려찍음
    'hb_chopLow':  G((3.4, 3.8),  (7.4, 5.4)),     # 더 낮게 흘러나감
    'hb_recover':  G((2.2, 4.2),  (4.6, 2.6)),
    'hb_low':      G((-2.0, 2.9), (-3.5, 6.0)),    # 날을 허리 뒤 아래로 내림 (팔을 뒤로 뻗음)
    'hb_lowFull':  G((-2.6, 2.4), (-4.6, 5.0)),    # 끝까지 뒤로
    'hb_scoop':    G((4.4, 0.6),  (7.0, -3.0)),    # 앞·위로 퍼올림
    'hb_high':     G((3.4, -2.6), (2.0, -7.5)),    # 머리 위로 치켜듦
    # 뒷팔 (물미 쪽을 쥔다) — 손 자리는 잰 값 (앞손 − bgrip·자루 방향 − 뒷어깨)
    'hb_bReady':   G((2.6, 4.6),  (7.2, 6.0)),     # 물미 쪽을 허리 앞에서
    'hb_bRaise':   G((4.0, 3.0),  (8.4, 1.6)),     # 앞손 바로 아래를 가슴 앞에서 받침
    'hb_bWindup':  G((5.2, -1.2), (7.3, -6.6)),    # 두 손을 머리 위에 모음 (등이 보이게 허리를 돌림)
    'hb_bChop':    G((3.8, 2.8),  (7.7, 1.1)),     # 물미를 가슴 앞으로 끌어당기며 내려찍음
    'hb_bChopLow': G((3.0, 3.8),  (6.9, 3.2)),
    'hb_bRecover': G((1.6, 4.8),  (5.5, 6.0)),
    'hb_bLow':     G((3.8, 4.0),  (8.4, 3.7)),     # 물미를 허리 앞으로 — 날은 허리 뒤
    'hb_bLowFull': G((3.4, 4.0),  (7.6, 3.4)),
    'hb_bScoop':   G((3.4, 4.0),  (8.0, 3.2)),     # 물미를 허리로 끌어내리며 퍼올림
    'hb_bHigh':    G((4.6, 0.8),  (8.8, -2.4)),
}
LEGS = {}
LIFTED = {}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'halberd.js'), 'halberd', ARMS, LEGS, FIX, LIFTED)
