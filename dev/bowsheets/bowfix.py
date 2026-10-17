# 쏘기 프레임 수리 (검수 fix, 스크립트만 — 2026-10-17 저격수 shoot3 비평):
#   1) 화살대 잔여 지우기: 시위 당기는 프레임에서 위가 빈 가로 줄(화살대 색, 5칸 이상 이어짐)
#   2) 끊긴 시위 다시 긋기: 활 위 끝 → 화살 오늬(지운 화살대의 왼쪽 끝) → 활 아래 끝 V자, 빈 칸에만(몸 뒤로 지나감). 떠 있는 옛 시위(1칸 폭 회색 세로선)는 지움
#   3) 활이 사라진 놓음 프레임: 이웃 프레임의 활을 앞손 위치로 옮겨 붙이고 시위는 곧게
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/bowfix.py <cls> <act> <draw프레임들 1,2,3,4> [빈활프레임:원본프레임 5:4]
#   → post-<act>-fix-<i>.png, strip, GIF (입력 = noarrow.py 의 na 판)
import os, sys, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), 'dev', 'sheets-common'))
from skelpost import strip, W96
from dress import line_pts
SHAFT = {(144, 88, 74), (115, 100, 97), (88, 89, 96), (128, 120, 118)}
STR = {(115, 100, 97), (88, 89, 96), (128, 120, 118), (100, 98, 100)}
SCOL = (176, 160, 146, 255)      # 활대보다 조금 밝은 회갈색 (흰색은 1배에서 막대처럼 튐)


def shaft_off(im):
    """위가 빈 화살대 색 가로 줄(5칸 이상) → 지우고, 왼쪽 끝(오늬) 좌표를 돌려줌"""
    P = im.load(); W, H = im.size; best = None
    for y in range(1, H):
        x = 0
        while x < W:
            if P[x, y][3] and P[x, y][:3] in SHAFT and not P[x, y - 1][3] or (P[x, y][3] and P[x, y][:3] in SHAFT and best is None and False):
                x0 = x
                while x < W and P[x, y][3] and P[x, y][:3] in SHAFT: x += 1
                if x - x0 >= 5 and (best is None or x - x0 > best[2] - best[0]): best = (x0, y, x)
            x += 1
    if not best: return None
    x0, y, x1 = best
    # 줄 양 끝으로 이어진 화살대 색도 같이 (가운데 위가 막힌 칸 포함)
    while x0 > 0 and P[x0 - 1, y][3] and P[x0 - 1, y][:3] in SHAFT: x0 -= 1
    for x in range(x0, x1): P[x, y] = (0, 0, 0, 0)
    return (x0, y)


def bow_curve(im, xmin=50, y0=28, y1=66):
    """활대 곡선: 위 끝 = xmin 오른쪽 맨 위 칸, 손잡이 = 몸통 높이에서 가장 오른쪽까지 나간 줄, 아래 끝 = 손잡이 기준 위 끝 대칭.
    세 점을 지나는 x = f(y) 2차식 → (위 끝, 손잡이, 아래 끝, f)"""
    P = im.load(); W, H = im.size
    top = min(((x, y) for y in range(H) for x in range(xmin, W) if P[x, y][3]), key=lambda q: q[1])
    rows = {y: max((x for x in range(W) if P[x, y][3]), default=-1) for y in range(top[1] + 6, y1)}
    mx = max(rows.values()); gy = [y for y, x in rows.items() if x >= mx - 1]
    grip = (mx - 1, sum(gy) / len(gy)); bot = (top[0], 2 * grip[1] - top[1])
    (ya, xa), (yb, xb), (yc, xc) = (top[1], top[0]), (grip[1], grip[0]), (bot[1], bot[0])
    def f(y):   # 라그랑주 2차
        return (xa * (y - yb) * (y - yc) / ((ya - yb) * (ya - yc)) + xb * (y - ya) * (y - yc) / ((yb - ya) * (yb - yc)) + xc * (y - ya) * (y - yb) / ((yc - ya) * (yc - yb)))
    return top, grip, (bot[0], round(bot[1])), f


def bow_pixels(im, ylim=None, band=2):
    top, grip, bot, f = bow_curve(im); P = im.load(); W, H = im.size; ylim = ylim or bot[1]
    return {(x, y): P[x, y] for y in range(top[1], min(H, ylim + 1)) for x in range(W) if P[x, y][3] and abs(x - f(y)) <= band}, (top, grip, bot)


def bow_tips(im, xmin):
    top, grip, bot, f = bow_curve(im)
    return top, bot


def old_string_off(im, xmin):
    P = im.load(); W, H = im.size
    for y in range(H):
        for x in range(xmin, W - 1):
            c = P[x, y]
            if c[3] and c[:3] in STR and not P[x - 1, y][3] and not P[x + 1, y][3]: P[x, y] = (0, 0, 0, 0)


def string(im, pts, top=False):
    """top: 몸 위로 그음(당긴 시위는 얼굴 앞 손끝까지 보여야 읽힌다), 아니면 빈 칸에만"""
    P = im.load(); q = set()
    for a, b in zip(pts, pts[1:]): q |= line_pts(a, b)
    for x, y in q:
        if 0 <= x < im.width and 0 <= y < im.height and (top or not P[x, y][3]): P[x, y] = SCOL


def fingertip(im, ny, xmax):
    """당기는 손끝: 화살대 줄 근처(-1~+3, 얼굴 피부 제외) 피부색 칸 중 활 손잡이보다 왼쪽에서 가장 앞(오른쪽)"""
    P = im.load(); sk = [(x, y) for y in range(ny - 1, ny + 4) for x in range(xmax) if P[x, y][3] and P[x, y][0] > 200 and P[x, y][1] > 130 and P[x, y][2] > 120]
    return max(sk, key=lambda q: (q[0], -abs(q[1] - ny))) if sk else None


def hand_front(im, y0=40, y1=70):
    P = im.load(); pts = [(x, y) for y in range(y0, y1) for x in range(im.width) if P[x, y][3]]
    mx = max(x for x, _ in pts); h = [(x, y) for x, y in pts if x >= mx - 3]
    return (sum(x for x, _ in h) / len(h), sum(y for _, y in h) / len(h))


if __name__ == '__main__':
    cls, act = sys.argv[1], sys.argv[2]; draws = [int(v) for v in sys.argv[3].split(',')]
    # 빈활프레임:원본프레임[:돌림각] — 돌림각(시계 +)은 다음 프레임 활 기울기로 넘어가는 사이 단계 (6번 튐 완화)
    sw = [[int(v) for v in s.split(':')] for s in sys.argv[4].split(',')] if len(sys.argv) > 4 else []
    swap = {a[0]: a[1] for a in sw}; rot = {a[0]: (a[2] if len(a) > 2 else 0) for a in sw}
    Wd = os.path.join(HERE, 'work', cls); fr = []; i = 0
    while os.path.exists(os.path.join(Wd, f'post-{act}-na-{i}.png')):
        fr.append(Image.open(os.path.join(Wd, f'post-{act}-na-{i}.png')).convert('RGBA')); i += 1
    src = {k: fr[v].copy() for k, v in swap.items()}
    for i in draws:
        nock = shaft_off(fr[i])
        if not nock: continue
        old_string_off(fr[i], nock[0] + 3)
        top, grip, bot, _ = bow_curve(fr[i])
        tip = fingertip(fr[i], nock[1], int(grip[0]) - 6) or nock
        string(fr[i], [top, (tip[0] + 1, tip[1])], top=True); string(fr[i], [(tip[0] + 1, tip[1]), bot])   # 위 반쪽은 얼굴 앞, 아래 반쪽은 몸 뒤
    for k, v in swap.items():
        b = src[k]; shaft_off(b); old_string_off(b, 50)
        top, grip, bot, _ = bow_curve(b)
        bow, _ = bow_pixels(b, ylim=round(grip[1] + (grip[1] - top[1]) * 0.7))
        bim = Image.new('RGBA', (W96, W96)); B = bim.load()
        for q, c in bow.items(): B[q] = c
        tips = [min(bow, key=lambda q: q[1]), max(bow, key=lambda q: q[1])]       # 시위는 실제 붙인 활 끝에서 끝나게 (넘침 방지)
        if rot[k]:
            from wpn import rotsprite
            bim, gp = rotsprite(bim, rot[k], grip)
            a = math.radians(rot[k]); rp = lambda q: (round(gp[0] + (q[0] - grip[0]) * math.cos(a) - (q[1] - grip[1]) * math.sin(a)), round(gp[1] + (q[0] - grip[0]) * math.sin(a) + (q[1] - grip[1]) * math.cos(a)))
            tips = [rp(t) for t in tips]; grip = gp
        hy = hand_front(fr[k]); F = fr[k].load()
        hx = max(x for x in range(W96) if F[x, round(hy[1])][3])          # 앞손(남은 옛 활 토막 포함) 오른쪽 끝에 손잡이를 맞춰 덮는다
        dx, dy = round(hx - grip[0]), round(hy[1] - grip[1])
        B = bim.load()
        for y in range(bim.height):
            for x in range(bim.width):
                if B[x, y][3] >= 128:
                    q = (x + dx, y + dy)
                    if 0 <= q[0] < W96 and 0 <= q[1] < W96: F[q] = B[x, y]
        string(fr[k], [(tips[0][0] + dx, tips[0][1] + dy), (tips[1][0] + dx, tips[1][1] + dy)])
    for i, f in enumerate(fr): f.save(os.path.join(Wd, f'post-{act}-fix-{i}.png'))
    strip(fr).save(os.path.join(Wd, f'strip-{act}-fix.png'))
    big = []
    for f in fr:
        b = Image.new('RGBA', (W96, W96), (20, 22, 30, 255)); b.alpha_composite(f); big.append(b.resize((W96 * 4, W96 * 4), Image.NEAREST).convert('RGB'))
    big[0].save(os.path.join(Wd, f'anim-{act}-fix.gif'), save_all=True, append_images=big[1:], duration=110, loop=0)
    print(len(fr))
