# -*- coding: utf-8 -*-
# 평타 컷: 돌격창 계열 팔·다리 그림 (src/cuts/lance.js 끝의 'lance' 블록). 실행: python dev/cuts/lance.py  (미리보기: --dry)
#  랜서·천마장군은 방패를 든 기사 — 앞팔은 돌격창을 한 손으로 쥐고(손 모양 'grip'), 뒷팔은 방패를 든다(손 자리가 방패 가운데, shield: 'bh').
#  방패는 손 자리를 가운데로 가로 4PX(8칸)·세로 7PX — 가슴 앞을 가리려면 뒷손이 뒷어깨에서 앞으로 7~8칸, 아래로 2~3칸
import sys, os, io
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

G = lambda e, h: {'e': e, 'h': h, 'hand': 'grip'}
ARMS = {
    # 앞팔 (돌격창을 겨드랑이에 끼고 한 손으로 쥔다)
    'ln_ready':    G((-0.4, 4.8), (3.4, 6.0)),     # 허리춤에 창을 끼고 앞으로 겨눔
    'ln_pull':     G((-2.4, 4.0), (1.4, 6.0)),     # 팔꿈치를 뒤로 빼며 창을 당김
    'ln_pullFull': G((-3.6, 3.0), (-0.6, 5.8)),    # 끝까지 당김 — 손이 허리 옆
    'ln_thrust':   G((4.8, 1.8),  (10.2, 2.4)),    # 낮게 눕혀 쭉 내지름
    'ln_follow':   G((4.4, 2.4),  (9.4, 3.2)),
    'ln_recover':  G((0.6, 4.8),  (4.4, 5.6)),
    'ln_lift':     G((3.4, 1.4),  (3.6, -2.2)),    # 팔꿈치 아래, 창을 어깨 위로 들어 올림
    'ln_high':     G((3.6, 0.2),  (3.0, -5.0)),    # 창을 어깨 위에 메고 끝까지 치켜듦 — 창끝은 앞
    'ln_stab':     G((4.6, 1.6),  (9.4, 1.6)),     # 어깨 높이에서 앞·아래로 내리꽂음
    'ln_stabLow':  G((4.2, 2.6),  (8.8, 3.0)),
    # 뒷팔 (방패를 든다 — 손 자리가 방패 가운데)
    'ln_bGuard':   G((3.0, 4.0),  (8.0, 3.0)),     # 정면(3/4) 자세: 가슴 앞에 방패
    'ln_bGuardS':  G((3.6, 3.2),  (8.5, 1.0)),     # 옆모습: 방패를 몸 앞에 세움
    'ln_bCharge':  G((4.4, 2.0),  (9.2, 0.4)),     # 돌진: 방패를 앞으로 밀어붙임
}
LEGS = {}
LIFTED = {}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'lance.js'), 'lance', ARMS, LEGS, FIX, LIFTED)
