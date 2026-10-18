# 공성포수 석궁이 활처럼 보이는 문제 (2026-10-18 비평): 활대(앞 끝 세로 곡선)를 짧고 굵게 — 석궁은 옆에서 짧은 T 자
#   원본 프레임(걷기 0번)의 석궁 상자에서: 앞 끝 PROD 칸 너비의 활대를 개머리 줄(y0) 쪽으로 세로 SQ 배 눌러 줄이고 1칸 굵게,
#   길게 늘어진 V 시위는 지우고 활대 끝 → 개머리 뒤 짧은 시위로 다시 긋는다 → 같은 폴더에 post-<out>-<i>.png 로 저장 (animfix paste 원본으로 씀)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/xbowfix.py <cls> <원본png> <출력png> <x0,y0,x1,y1>
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from dress import line_pts
PROD, SQ = 7, 0.65   # 0.45 는 1배에서 너무 작아 창처럼 보임 (비평)


def fix(im, box):
    P = im.load(); x0, y0b, x1, y1b = box
    pts = {(x, y): P[x, y] for y in range(y0b, y1b) for x in range(x0, x1) if P[x, y][3]}
    xmax = max(x for x, _ in pts)
    rows = {}
    for (x, y) in pts:
        if x < xmax - PROD: rows[y] = rows.get(y, 0) + 1
    ys = max(rows, key=rows.get)                        # 개머리(가로 대) 줄 = 활대 앞쪽에서 가장 긴 가로 줄
    prod = {q: c for q, c in pts.items() if q[0] >= xmax - PROD}
    sc = min(c for c in pts.values())                  # (사용 안 함 — 색은 원본 칸 그대로)
    hand = min(x for (x, y) in pts if abs(y - ys) <= 1)
    for (x, y) in pts:                                  # 활대·시위(개머리 줄 ±2 밖, 손 앞) 지우기
        if x >= hand + 4 and abs(y - ys) > 2: P[x, y] = (0, 0, 0, 0)
    for (x, y), c in prod.items():                      # 활대: 세로로 눌러 다시 놓고 1칸 굵게
        ny = round(ys + (y - ys) * SQ)
        for dx in (0, -1):
            q = (x + dx, ny)
            if not P[q][3] or abs(ny - ys) > 0: P[q] = c
    tip = [q for q in prod]; top = min(tip, key=lambda q: q[1]); bot = max(tip, key=lambda q: q[1])
    tt, bb = (top[0], round(ys + (top[1] - ys) * SQ)), (bot[0], round(ys + (bot[1] - ys) * SQ))
    knot = (xmax - PROD - 5, ys)                       # 시위를 거는 자리 (개머리 위)
    sc = (60, 40, 40, 255)
    for q in line_pts(tt, knot) | line_pts(knot, bb):
        if not P[q][3]: P[q] = sc
    return im


if __name__ == '__main__':
    cls, src, out, box = sys.argv[1], sys.argv[2], sys.argv[3], tuple(int(v) for v in sys.argv[4].split(','))
    W = os.path.join(HERE, 'work', cls)
    fix(Image.open(os.path.join(W, src)).convert('RGBA'), box).save(os.path.join(W, out)); print('ok')
