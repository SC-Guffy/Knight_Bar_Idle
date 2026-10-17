# 걷기 프레임 고르기 (로드맵 승인 2026-10-17 대안 A): 같은 관절 시간표로 뽑은 두 걷기(W1 = 첫 재생성, W2 = 더 과장)에서
#  프레임 번호마다 하나를 고른다. 점수 = 다리 분리(발목 높이 줄의 덩어리 수·두 발 사이 폭) − 이웃 프레임과 거의 같으면 벌점 (DP).
#  같은 번호는 같은 걸음 위상이라 섞어도 순서가 이어진다.
#  python -I -B walk_pick.py <cls> [--only W1|W2]   → skel/<cls>/W-wpn/0..7.png, W-tips.json (W1 원본은 W1-wpn 에 보관)
import os, sys, json, shutil
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))


def leg_score(body):
    B = body.load(); bb = body.getbbox(); foot = bb[3] - 1; s = 0
    for dy in (3, 5, 7):                          # 발목~정강이 줄
        y = foot - dy; runs = 0; inside = False; xs = []
        for x in range(body.width):
            on = B[x, y][3] > 0
            if on and not inside: runs += 1
            if on: xs.append(x)
            inside = on
        s += min(runs, 2) * 4 + (xs[-1] - xs[0] if xs else 0) * 0.3
    return s


def mask(im):
    P = im.load(); return {(x, y) for y in range(im.height) for x in range(im.width) if P[x, y][3]}


def iou(a, b): return len(a & b) / max(1, len(a | b))


def pick(cls, only=None):
    d = os.path.join(HERE, 'skel', cls)
    w1 = os.path.join(d, 'W1-wpn')
    if not os.path.exists(w1):                     # 첫 재생성 결과 보관
        shutil.copytree(os.path.join(d, 'W-wpn'), w1); shutil.copytree(os.path.join(d, 'W-body'), os.path.join(d, 'W1-body'))
        shutil.copy(os.path.join(d, 'W-tips.json'), os.path.join(d, 'W1-tips.json'))
    src = {'W1': ('W1-wpn', 'W1-body', 'W1-tips.json'), 'W2': ('W2-wpn', 'W2-body', 'W2-tips.json')}
    C = {k: dict(wpn=[Image.open(os.path.join(d, v[0], f'{i}.png')).convert('RGBA') for i in range(8)],
                 body=[Image.open(os.path.join(d, v[1], f'{i}.png')).convert('RGBA') for i in range(8)],
                 tips=json.load(open(os.path.join(d, v[2])))) for k, v in src.items() if not only or k == only}
    keys = list(C)
    sc = {k: [leg_score(b) for b in C[k]['body']] for k in keys}
    ms = {k: [mask(b) for b in C[k]['body']] for k in keys}
    # DP: 이웃과 IoU 0.93 넘게 같으면 벌점 (정지처럼 보임), 끝→처음 이음도 본다
    best = None
    for k0 in keys:
        dp = {k: (sc[k][0] if k == k0 else -1e9, [k]) for k in keys}
        for i in range(1, 8):
            nd = {}
            for k in keys:
                cand = [(dp[p][0] + sc[k][i] - (6 if iou(ms[p][i - 1], ms[k][i]) > 0.93 else 0), dp[p][1] + [k]) for p in keys]
                nd[k] = max(cand)
            dp = nd
        for k in keys:
            tot = dp[k][0] - (6 if iou(ms[k][7], ms[k0][0]) > 0.93 else 0)
            if best is None or tot > best[0]: best = (tot, dp[k][1])
    seq = best[1]
    out = os.path.join(d, 'W-wpn'); tips = []
    for i, k in enumerate(seq): C[k]['wpn'][i].save(os.path.join(out, f'{i}.png')); tips.append(C[k]['tips'][i])
    json.dump(tips, open(os.path.join(d, 'W-tips.json'), 'w'))
    print('walk_pick', cls, seq, 'scores', {k: [round(v) for v in sc[k]] for k in keys})


if __name__ == '__main__':
    a = sys.argv; only = a[a.index('--only') + 1] if '--only' in a else None
    pick(a[1], only)
