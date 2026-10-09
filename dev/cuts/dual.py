# -*- coding: utf-8 -*-
# 평타 컷: 쌍검 계열 팔·다리 그림 (src/cuts/dual.js 끝의 'dual' 블록). 실행: python dev/cuts/dual.py  (미리보기: --dry)
#  두 손에 칼 한 자루씩 — 앞팔(dl_*)은 앞손 칼(wa), 뒷팔(dlb_*)은 뒷손 칼(wb, 뒷팔 그림의 손에 붙는다).
#  뒷팔 손 자리는 뒷어깨 기준이다. 정면(sx >= 0.95)에선 뒷어깨가 앞어깨보다 10.4칸, 옆모습(sx < 0.95)에선 5.2칸 뒤에 있다 —
#  뒷손이 몸 앞으로 나오는 컷(올려베기·X 교차)은 옆모습으로 두고 bfront: 'body' 로 몸 위에 그린다.
#  팔꿈치는 손 자리와 두 마디 길이로 계산한다 (늘 바른 쪽으로 접힌다: cross(윗팔, 아랫팔) <= 0)
import sys, os, io, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from cutgen import preview, write_block

def arm(h, up=5.3, lo=5.0, hand='grip', radii=(1.5, 1.25, 1.0), bend=1.0):
    """어깨(0,0) → 손 h. 팔꿈치는 두 원의 교점 중 바른 쪽. 손이 멀면 두 마디를 늘여 아주 조금만 굽힌다. bend < 1 이면 덜 굽힘"""
    hx, hy = h; d = math.hypot(hx, hy)
    if d >= up + lo - 0.3:
        s = d / (up + lo - 0.3); up, lo = up * s, lo * s
    a = (up * up - lo * lo + d * d) / (2 * d); hh = math.sqrt(max(0, up * up - a * a)) * bend
    px, py = hx * a / d, hy * a / d
    return {'e': (round(px - hy / d * hh, 2), round(py + hx / d * hh, 2)), 'h': h, 'hand': hand, 'radii': radii}

BR = (1.45, 1.2, 0.95)        # 뒷팔은 조금 가늘게 (멀리 있는 팔)
ARMS = {
    # ── 앞팔 (앞손 칼) ──
    'dl_ready':   arm((4.2, 7.0)),          # 허리 앞에서 칼끝을 적에게 — 가볍게 겨눔
    'dl_raise':   arm((3.2, -1.6)),         # 칼을 얼굴 앞으로 끌어올림
    'dl_windup':  arm((-0.6, -10.4)),       # 머리 위로 — 칼날이 등 뒤로 넘어간다
    'dl_strike':  arm((9.6, 3.4)),          # 앞·아래로 쭉 — 내려베기
    'dl_follow':  arm((6.0, 8.4)),          # 내려벤 칼이 허리 아래로 흘러나감
    'dl_recover': arm((4.4, 6.4)),
    'dl_xRaise':  arm((3.8, -3.2)),         # X 베기: 두 팔을 앞으로 끌어올림
    'dl_xHigh':   arm((0.8, -10.2)),        # 머리 위로 — 뒷손 칼과 X 자로 겹친다
    'dl_xCut':    arm((9.4, 4.4)),          # 앞·아래로 갈라 벤다
    'dl_xFollow': arm((7.0, 7.6)),
    # ── 뒷팔 (뒷손 칼, 뒷어깨 기준) ──
    'dlb_ready':  arm((1.6, 9.2), radii=BR),     # 몸 옆에 내리고 칼을 거꾸로 뒤로 늘어뜨림
    'dlb_low':    arm((-2.6, 8.6), radii=BR),    # 뒤·아래로 빼 둔다 (올려베기 예비)
    'dlb_back':   arm((-6.6, 5.4), radii=BR),    # 끝까지 뒤로 젖힘
    'dlb_cock':   arm((-5.8, 6.6), radii=BR),    # 앞손이 벨 때 뒷손은 아래로 장전
    'dlb_up':     arm((7.8, -4.2), radii=BR),    # 뒷손 올려베기 — 몸 앞으로 휘둘러 올림 (옆모습)
    'dlb_recover':arm((-1.0, 9.0), radii=BR),
    'dlb_xRaise': arm((5.4, -2.6), radii=BR),    # X 베기: 몸 앞으로 끌어올림 (옆모습)
    'dlb_xHigh':  arm((5.6, -8.2), radii=BR),    # 머리 앞 높이 — 앞손 칼과 교차
    'dlb_xCut':   arm((-3.6, 8.4), radii=BR),    # 뒤·아래로 갈라 벤다 (정면)
    'dlb_xFollow':arm((-4.8, 7.4), radii=BR),
}
# ── 다리 (골반 아래(0,0) 기준 (엉덩이, 무릎, 발목), 땅은 G 칸 아래) ── 나머지는 공용(set load lunge lungeDeep crouch rise recover)
LEGS = {
    'dl_ready': (7.2, ((-3.5, -0.5), (-3.0, 2.9), (-5.4, 5.7)), ((3.5, -0.5), (5.6, 2.6), (5.0, 5.7))),    # 무릎을 살짝 굽혀 가볍게 선다
}
LIFTED = {}
FIX = {}

if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if '--dry' in sys.argv: preview(ARMS, LEGS, FIX, LIFTED)
    else: write_block(os.path.join(root, 'src', 'cuts', 'dual.js'), 'dual', ARMS, LEGS, FIX, LIFTED)
