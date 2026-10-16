# 디자인 시안 줄이기 — 몸 키 기준 (계열 공용, docs/specs/legacy-class-sheets.md 그림체 B · 키 46px).
#  검사 세션 dev/sheets-sword/design.py 의 shrink(im, H) 는 "그림 전체 높이"(무기·깃털 포함)를 H 칸에 맞춘다.
#  긴 무기를 머리 위로 든 직업(할버드·지팡이·활)은 몸이 작아지고, 무기를 수평으로 든 직업은 커져서 계열 안 키가 들쭉날쭉해진다.
#  여기서는 1024 원본에서 몸 키(투구·머리 몸체 꼭대기 ~ 발바닥, 깃털·뿔·무기 제외)를 주고 그 높이가 H 칸이 되게 칸 크기를 정한다.
#  색 고르기·외곽선은 검사 shrink 그대로 (같은 그림체).
#
#    from shrink import shrink_body
#    o = shrink_body(Image.open('raw.png'), top=312, foot=750, H=46)     # top·foot = 1024 원본 y (눈으로 읽거나 다른 방법으로)
#  발밑 그림자(발바닥 아래)는 줄이기 전에 바탕색으로 지우고, 줄인 뒤 맨 아래 바닥 줄(위 줄보다 1.4배 넘게 넓음)도 지운다.
import os, importlib.util
import numpy as np
from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
_sp = importlib.util.spec_from_file_location('sw_design', os.path.join(_HERE, '..', 'sheets-sword', 'design.py'))
_SW = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_SW)


def shrink_body(im, top, foot, H=46, shadow=True):
    im = im.convert('RGB')
    if shadow:
        a = np.asarray(im).copy()
        border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); a[foot + 1:] = np.median(border, axis=0)
        im = Image.fromarray(a)
    _, m = _SW.fg(im); ys, _ = np.nonzero(m)
    if len(ys) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9])                       # 검사 shrink 가 쓰는 세로 범위와 같게
    o = _SW.shrink(im, max(8, round((int(y1) + 1 - int(y0)) / ((foot - top) / H))))
    if o is None: return None
    P = o.load(); W_ = o.width
    for _ in range(2):
        bb = o.getbbox(); yb = bb[3] - 1
        row = lambda y: [x for x in range(W_) if P[x, y][3]]
        a_, b_ = row(yb), row(yb - 1)
        if a_ and b_ and (max(a_) - min(a_)) > 1.4 * (max(b_) - min(b_)):
            for x in range(W_): P[x, yb] = (0, 0, 0, 0)
    return o.crop(o.getbbox())
