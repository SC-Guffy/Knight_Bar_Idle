# 디자인 시안 줄이기 — 몸 키 기준 (계열 공용, docs/specs/legacy-class-sheets.md 그림체 B · 키 46px).
#  검사 세션 dev/sheets-sword/design.py 의 shrink(im, H) 는 "그림 전체 높이"(무기·깃털 포함)를 H 칸에 맞춘다.
#  긴 무기를 머리 위로 든 직업(할버드·지팡이·활)은 몸이 작아지고, 무기를 수평으로 든 직업은 커져서 계열 안 키가 들쭉날쭉해진다.
#  여기서는 1024 원본에서 몸 키(투구·머리 몸체 꼭대기 ~ 발바닥, 깃털·뿔·무기 제외)를 주고 그 높이가 H 칸이 되게 칸 크기를 정한다.
#  색 고르기·외곽선은 검사 shrink 그대로 (같은 그림체).
#
#    from shrink import shrink_body
#    o = shrink_body(Image.open('raw.png'), top=312, foot=750, H=46)     # top·foot = 1024 원본 y (눈으로 읽거나 다른 방법으로)
#  ncol: 팔레트 색 수 (로드맵 2026-10-16: 12~16색, 기본 16). 발밑 그림자(발바닥 아래)는 줄이기 전에 바탕색으로 지우고, 줄인 뒤 맨 아래 바닥 줄(위 줄보다 1.4배 넘게 넓음)도 지운다.
import os, importlib.util
import numpy as np
from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
_sp = importlib.util.spec_from_file_location('sw_design', os.path.join(_HERE, '..', 'sheets-sword', 'design.py'))
_SW = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_SW)


def shrink_body(im, top, foot, H=46, shadow=True, ncol=16):
    im = im.convert('RGB')
    if shadow:
        a = np.asarray(im).copy()
        border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); a[foot + 1:] = np.median(border, axis=0)
        im = Image.fromarray(a)
    _, m = _SW.fg(im); ys, _ = np.nonzero(m)
    if len(ys) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9])                       # 검사 shrink 가 쓰는 세로 범위와 같게
    o = _SW.shrink(im, max(8, round((int(y1) + 1 - int(y0)) / ((foot - top) / H))), ncol=ncol)
    if o is None: return None
    P = o.load(); W_ = o.width
    for _ in range(2):
        bb = o.getbbox(); yb = bb[3] - 1
        row = lambda y: [x for x in range(W_) if P[x, y][3]]
        a_, b_ = row(yb), row(yb - 1)
        if a_ and b_ and (max(a_) - min(a_)) > 1.4 * (max(b_) - min(b_)):
            for x in range(W_): P[x, yb] = (0, 0, 0, 0)
    return o.crop(o.getbbox())


def body_bounds(im, k=8, r=2):
    """1024 원본에서 몸 높이 (정수리 y, 발바닥 y) 자동: 전경을 1/k 로 줄여 r 칸 열기(깎았다 불리기) → 가는 창·깃털·시위가 떨어져 나감
    → 맨 아래 칸을 포함한 덩어리의 위·아래. 도끼날·깃발처럼 굵은 소품은 몸과 이어져 있지 않으면 빠진다. 무기를 몸 앞에 굵게 붙여 든 그림은 틀릴 수 있다"""
    _, m = _SW.fg(im.convert('RGB'))
    H_, W_ = m.shape; h, w = H_ // k, W_ // k
    s = m[:h * k, :w * k].reshape(h, k, w, k).mean((1, 3)) > 0.5
    # 구멍 메우기: 바탕과 색이 비슷한 은색 갑옷 안쪽이 전경에서 빠져 몸이 끊기므로, 가장자리에서 닿지 않는 빈 칸은 몸으로 본다
    out = np.zeros_like(s); st = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    st = [p for p in st if not s[p]]
    for p in st: out[p] = True
    while st:
        y, x = st.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (y + dy, x + dx)
            if 0 <= q[0] < h and 0 <= q[1] < w and not s[q] and not out[q]: out[q] = True; st.append(q)
    s = ~out
    def shift_and(a, op):
        o = a.copy()
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                b = np.zeros_like(a); ys, xs = slice(max(dy, 0), h + min(dy, 0)), slice(max(dx, 0), w + min(dx, 0))
                yd, xd = slice(max(-dy, 0), h + min(-dy, 0)), slice(max(-dx, 0), w + min(-dx, 0))
                b[yd, xd] = a[ys, xs]; o = op(o, b)
        return o
    o = shift_and(shift_and(s, np.logical_and), np.logical_or)
    ys, xs = np.nonzero(o)
    if len(ys) == 0: return None
    left = set(zip(ys.tolist(), xs.tolist())); comps = []                 # 덩어리 나누기 → 가장 큰 것 = 몸 (발밑 그림자 타원은 작아서 빠짐)
    while left:
        st = [left.pop()]; c = set(st)
        while st:
            y, x = st.pop()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (y + dy, x + dx)
                if q in left: left.discard(q); c.add(q); st.append(q)
        comps.append(c)
    seen = max(comps, key=len)
    rows = [y for y, _ in seen]; top = min(rows) * k; yb = (max(rows) + 1) * k
    cols = sorted({x for _, x in seen}); x0, x1 = cols[0] * k, (cols[-1] + 1) * k
    fr = np.nonzero(m[:min(H_, yb + k), x0:x1].any(1))[0]; foot = int(fr.max())    # 발바닥: 몸 덩어리 아래 한 칸까지만 (그림자 제외)
    tr = np.nonzero(m[top:top + 3 * k, x0:x1].any(1))[0]; top = int(top + (tr.min() if len(tr) else 0))
    return top, foot
