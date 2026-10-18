# 관절 애니 검수 fix 공용 수리 (스크립트만, 재호출 없음 — 2026-10-17 레인저 계열 비평 결과)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/animfix.py <cls> <act> <src판> <out판> [명령 ...]
#   명령 (차례대로 적용):
#     seq=0,1,2,3,4,5,5,0      프레임 순서 바꾸기·복사 (튀는 끝 프레임을 붙든 프레임·첫 프레임으로)
#     ridge=<프레임들>:<y0>-<y1>[:<최소길이>]   가는 가로/세로/대각 선(화살대 잔여)을 위·아래 이웃 색으로 메우기
#                              — 그 칸이 위·아래(또는 좌·우) 이웃과 같은 쪽으로 밝기 차 22 넘게 튀고 그런 칸이 최소길이 넘게 이어지면
#     crumbs=1                  몸에서 떨어진 덩어리 지우기 (가장 큰 덩어리만 남김)
#     head=<프레임들>           활 손잡이 높이에서 활대 곡선 앞으로 나온 화살촉 지우기
#     tip=<프레임들>            활 앞으로 튀어나온 화살촉 지우기 (noarrow.tip_off)
#     paste=<원본프레임>:<x0>,<y0>,<x1>,<y1>:<프레임들>[:<기준손>]  원본 프레임의 상자 안(무기)을 다른 프레임에 같은 자리로 덮기
#                              — 'hand' 면 상자 안 피부색 중심을 맞춰 옮기고, 'clear' 면 대상 상자를 먼저 비운다 (예 hand+clear)
#     despeck=<프레임들>[:밝기차]  외톨이 점·몸 안 튀는 점(4방향 이웃과 밝기 차 40 넘음) 정리
#     shift=<프레임들>:<dx>,<dy> 프레임을 통째로 민다 (발사 반동)
#     lift=0.15                 어두운 칸(밝기 14~90) 밝히기, 외곽선은 그대로 (명암 2 → 3)
#     quant=24                  모든 프레임 공통 팔레트로 양자화 (빈도 높은 색 우선, 가까운 색으로)
#   → post-<act>-<out판>-<i>.png, strip, GIF(4배)
import os, sys, math
from collections import Counter
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from skelpost import strip, W96
from noarrow import biggest, tip_off
L = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11


def frames_of(spec, n):
    return list(range(n)) if spec in ('all', '*') else [int(v) for v in spec.split(',')]


def ridge(im, y0, y1, minlen=5, th=22):
    P = im.load(); W, H = im.size; hit = set()
    def lum(x, y):
        return L(P[x, y]) if 0 <= x < W and 0 <= y < H and P[x, y][3] else None
    for y in range(max(1, y0), min(H - 1, y1 + 1)):
        for x in range(W):
            if not P[x, y][3]: continue
            c = lum(x, y); u, d = lum(x, y - 1), lum(x, y + 1)
            if u is None or d is None:            # 위나 아래가 비면: 가는 선의 가장자리 — 위아래 다 비었을 때만
                if u is None and d is None: hit.add((x, y))
                continue
            if (c - u > th and c - d > th) or (u - c > th and d - c > th): hit.add((x, y))
    # 가로로 이어진 것만 (최소 길이)
    keep = set()
    for (x, y) in hit:
        if (x - 1, y) in hit: continue
        run = [(x, y)]; k = x + 1
        while (k, y) in hit or (k, y + 1) in hit or (k, y - 1) in hit:
            q = (k, y) if (k, y) in hit else ((k, y + 1) if (k, y + 1) in hit else (k, y - 1)); run.append(q); y = q[1]; k += 1
        if len(run) >= minlen: keep |= set(run)
    for (x, y) in keep:
        d = P[x, y + 1] if y + 1 < H and P[x, y + 1][3] and (x, y + 1) not in keep else None
        u = P[x, y - 1] if y > 0 and P[x, y - 1][3] and (x, y - 1) not in keep else None
        P[x, y] = d or u or (0, 0, 0, 0)
    return im, len(keep)


def head(im, band=4, pad=1, gap=6):
    """화살촉 지우기: 가장 앞으로 나온 줄(= 손잡이 높이의 화살촉)을 찾고, 그 위·아래 gap 줄의 앞 끝(활대 배)을 이어
    그 너머(+pad)를 band 줄 안에서 지운다"""
    P = im.load(); W, H = im.size; n = 0
    mx = {y: max((x for x in range(W) if P[x, y][3]), default=-1) for y in range(H)}
    gy = max(range(20, H - 20), key=lambda y: mx[y])
    belly = (mx[gy - gap] + mx[gy + gap]) / 2 + 1
    for y in range(gy - band, gy + band + 1):
        for x in range(W):
            if P[x, y][3] and x > belly + pad: P[x, y] = (0, 0, 0, 0); n += 1
    biggest(im)
    return n


def despeck(im, th=40):
    """외톨이 점: 이웃 8칸 중 칠한 칸이 1개 이하면 지우고, 몸 안에서 4방향 이웃 모두와 밝기 차가 th 넘으면 이웃 최빈색으로"""
    P = im.load(); W, H = im.size; n = 0; src = im.copy(); S = src.load()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not S[x, y][3]: continue
            nb = [S[x + a, y + b] for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and S[x + a, y + b][3]]
            if len(nb) <= 1: P[x, y] = (0, 0, 0, 0); n += 1; continue
            f4 = [S[x + a, y + b] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if all(c[3] for c in f4) and all(abs(L(c) - L(S[x, y])) > th for c in f4):
                P[x, y] = Counter(c for c in f4).most_common(1)[0][0]; n += 1
    return n


def skin_c(im, box):
    P = im.load(); x0, y0, x1, y1 = box; x0, y0, x1, y1 = max(0, x0), max(0, y0), min(im.width, x1), min(im.height, y1)
    s = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if P[x, y][3] and P[x, y][0] > 200 and P[x, y][1] > 130 and P[x, y][2] > 110]
    return (sum(x for x, _ in s) / len(s), sum(y for _, y in s) / len(s)) if s else None


def paste(fr, src, box, dst, mode=None):
    S = fr[src].copy(); P = S.load(); x0, y0, x1, y1 = box
    hs = skin_c(S, box) if mode and 'hand' in mode else None
    for i in dst:
        F = fr[i].load(); dx = dy = 0
        if hs:                                    # 손 위치는 비우기 전에 잰다
            hd = skin_c(fr[i], (x0 - 6, y0 - 6, x1 + 6, y1 + 6))
            if hd: dx, dy = round(hd[0] - hs[0]), round(hd[1] - hs[1])
        if mode and 'clear' in mode:              # 상자 안(무기 조각·손)을 먼저 비운다 — 상자는 몸 밖 무기 자리만 잡을 것
            for y in range(y0, y1):
                for x in range(x0, x1): F[x, y] = (0, 0, 0, 0)
        for y in range(y0, y1):
            for x in range(x0, x1):
                q = (x + dx, y + dy)
                if P[x, y][3] and 0 <= q[0] < W96 and 0 <= q[1] < W96: F[q] = P[x, y]


def quant(fr, n):
    cnt = Counter(f.getpixel((x, y))[:3] for f in fr for y in range(f.height) for x in range(f.width) if f.getpixel((x, y))[3])
    pal = []
    for c, _ in cnt.most_common():
        if all(sum((a - b) ** 2 for a, b in zip(c, p)) > 140 for p in pal): pal.append(c)
        if len(pal) >= n: break
    for f in fr:
        P = f.load()
        for y in range(f.height):
            for x in range(f.width):
                if P[x, y][3]:
                    c = P[x, y][:3]; P[x, y] = min(pal, key=lambda p: sum((a - b) ** 2 for a, b in zip(c, p))) + (255,)
    return pal


if __name__ == '__main__':
    cls, act, src, out = sys.argv[1:5]; Wd = os.path.join(HERE, 'work', cls); fr = []; i = 0
    while os.path.exists(os.path.join(Wd, f'post-{act}-{src}-{i}.png')):
        fr.append(Image.open(os.path.join(Wd, f'post-{act}-{src}-{i}.png')).convert('RGBA')); i += 1
    n = len(fr); log = []
    for cmd in sys.argv[5:]:
        k, v = cmd.split('=', 1)
        if k == 'seq': fr = [fr[int(j)].copy() for j in v.split(',')]
        elif k == 'ridge':
            parts = v.split(':'); ys = [int(t) for t in parts[1].split('-')]; ml = int(parts[2]) if len(parts) > 2 else 5
            for j in frames_of(parts[0], len(fr)): _, m = ridge(fr[j], ys[0], ys[1], ml); log.append(f'ridge{j}:{m}')
        elif k == 'crumbs':
            for f in fr: biggest(f)
        elif k == 'head':
            for j in frames_of(v, len(fr)): log.append(f'head{j}:{head(fr[j])}')
        elif k == 'tip':
            for j in frames_of(v, len(fr)): tip_off(fr[j])
        elif k == 'paste':
            parts = v.split(':'); box = tuple(int(t) for t in parts[1].split(','))
            paste(fr, int(parts[0]), box, frames_of(parts[2], len(fr)), parts[3] if len(parts) > 3 else None)
        elif k == 'despeck':
            parts = v.split(':'); th = int(parts[1]) if len(parts) > 1 else 40
            for j in frames_of(parts[0], len(fr)): log.append(f'speck{j}:{despeck(fr[j], th)}')
        elif k == 'shift':                         # 반동: 프레임을 통째로 dx,dy 칸 민다
            parts = v.split(':'); dx, dy = (int(t) for t in parts[1].split(','))
            for j in frames_of(parts[0], len(fr)):
                o = Image.new('RGBA', fr[j].size); o.paste(fr[j], (dx, dy)); fr[j] = o
        elif k == 'lift':                          # 어두운 몸 밝히기: 외곽선(밝기 14 미만)은 두고, 밝기 90 미만 칸을 흰쪽으로 비율만큼
            a = float(v)
            for f in fr:
                P = f.load()
                for y in range(f.height):
                    for x in range(f.width):
                        c = P[x, y]
                        if c[3] and 14 <= L(c) < 90: P[x, y] = tuple(round(ch + (255 - ch) * a) for ch in c[:3]) + (255,)
        elif k == 'quant': log.append(f'pal{len(quant(fr, int(v)))}')
    for j, f in enumerate(fr): f.save(os.path.join(Wd, f'post-{act}-{out}-{j}.png'))
    strip(fr).save(os.path.join(Wd, f'strip-{act}-{out}.png'))
    big = []
    for f in fr:
        b = Image.new('RGBA', (W96, W96), (20, 22, 30, 255)); b.alpha_composite(f); big.append(b.resize((W96 * 4, W96 * 4), Image.NEAREST).convert('RGB'))
    big[0].save(os.path.join(Wd, f'anim-{act}-{out}.gif'), save_all=True, append_images=big[1:], duration=110, loop=0)
    print(len(fr), ' '.join(log))
