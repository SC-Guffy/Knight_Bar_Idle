# PixelLab 원본 → 시트 프레임 정리 (⑤-4). dev/pixellab/sheet.py 와 같은 정리에 "바깥에서 이어진 바탕"을 더 지운다.
#  python -I prep.py out.png [--min 3] [--flip] [--bg dark|grey|both] [--keep N] [--size WxH] f0.png f1.png ...
#   --bg: 테두리에 닿은 불투명 바탕판에서 퍼져 나가며 지울 바탕 (투명 칸은 건너지 않는다 — 외곽선을 지키려고) — dark 검은 판(최대 채널 < 48), grey 체크무늬·회색 판(채도 낮고 중간 밝기), both
#   --keep N: 가장 큰 덩어리 N 개만 남긴다 (찌꺼기 지우기)
#   --size: 프레임 크기를 맞춘다 (가운데 정렬로 자르거나 늘림 없이 붙인다)
import sys
from PIL import Image
args = sys.argv[1:]; out = args.pop(0)
def opt(name, default=None, cast=str):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return cast(v)
    return default
mn = opt('--min', 3, int); bg = opt('--bg', 'both'); keep = opt('--keep', 0, int); size = opt('--size')
flip = '--flip' in args
if '--trimy' in args: args.remove('--trimy')
# --bright: 체크무늬처럼 바탕이 투명 칸과 섞인 그림 — 밝거나 채도 높은 칸만 남기고, 그 둘레(8방향)의 어두운 칸은 외곽선으로 남긴다
bright = '--bright' in args
if bright: args.remove('--bright')
# --lum N: --bright 의 밝기 문턱 (기본 95). 체크무늬 찌꺼기가 색을 띠면 높인다
lum_th = opt('--lum', 95, int)
if flip: args.remove('--flip')

def is_bg(c):
    r, g, b = c[:3]; mx, mi = max(r, g, b), min(r, g, b)
    dark = mx < 48
    grey = mx - mi < 14 and 40 <= (r + g + b) / 3 <= 205
    return (bg in ('dark', 'both') and dark) or (bg in ('grey', 'both') and grey)

def clean(im):
    W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
    if bright:
        kp = set()
        for y in range(H):
            for x in range(W):
                r, g, b, a = px[x, y]
                if a and ((r + g + b) / 3 > lum_th or (lum_th <= 95 and max(r, g, b) - min(r, g, b) > 70)): kp.add((x, y))
        rim = {(x + dx, y + dy) for (x, y) in kp for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        for y in range(H):
            for x in range(W):
                if px[x, y][3] and (x, y) not in kp and ((x, y) not in rim or max(px[x, y][:3]) > 70): px[x, y] = (0, 0, 0, 0)
    # 바탕판 씨앗: 테두리에서 2칸 안쪽까지 (투명 테두리 한 줄 안에 판이 있는 경우)
    edge = [(x, y) for x in range(W) for y in range(H) if min(x, y, W - 1 - x, H - 1 - y) <= 2]
    st = [p for p in edge if px[p][3] and is_bg(px[p])]; seen = set(st)
    while st:
        x, y = st.pop()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] and is_bg(px[n]): seen.add(n); st.append(n)
    # 덩어리
    seen = set(); blobs = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                s = [(x, y)]; seen.add((x, y)); c = []
                while s:
                    a, b = s.pop(); c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3]: seen.add(n); s.append(n)
                blobs.append(c)
    blobs.sort(key=len, reverse=True)
    for i, c in enumerate(blobs):
        if len(c) < mn or (keep and i >= keep):
            for p in c: px[p] = (0, 0, 0, 0)
    return im

# --level: 선 그림을 가로로 눕힌다 (불투명 칸의 주축 각도만큼 돌리고 가운데로) — 선 시트(e09 등)는 가로가 길이 방향이어야 한다
level = '--level' in args
if level: args.remove('--level')
import math
def do_level(im):
    W, H = im.size; px = im.load(); pts = [(x, y) for y in range(H) for x in range(W) if px[x, y][3]]
    if not pts: return im
    mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - mx) ** 2 for p in pts); syy = sum((p[1] - my) ** 2 for p in pts); sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    big = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); big.alpha_composite(im, (W // 2 + int(W / 2 - mx), H // 2 + int(H / 2 - my)))
    r = big.rotate(math.degrees(ang), resample=Image.NEAREST, center=(W, H))
    return r.crop((W // 2, H // 2, W // 2 + W, H // 2 + H))
fr = [clean(Image.open(f).convert('RGBA')) for f in args]
if level: fr = [do_level(f) for f in fr]
if flip: fr = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in fr]
W, H = fr[0].size
# --trimy: 모든 프레임의 위아래 빈 줄을 같이 잘라 낸다 (가는 선 시트 — 늘여 그릴 때 빈칸까지 칠하지 않게)
if '--trimy' in sys.argv:
    ys = [y for f in fr for y in range(H) if any(f.getpixel((x, y))[3] for x in range(W))]
    if ys:
        y0, y1 = max(0, min(ys) - 1), min(H, max(ys) + 2)
        fr = [f.crop((0, y0, W, y1)) for f in fr]; H = y1 - y0
if size:
    W2, H2 = map(int, size.split('x'))
    fr2 = []
    for f in fr:
        n = Image.new('RGBA', (W2, H2), (0, 0, 0, 0)); n.alpha_composite(f, ((W2 - W) // 2, (H2 - H) // 2)) if W <= W2 and H <= H2 else n.paste(f.crop(((W - W2) // 2, (H - H2) // 2, (W - W2) // 2 + W2, (H - H2) // 2 + H2)))
        fr2.append(n)
    fr, W, H = fr2, W2, H2
sh = Image.new('RGBA', (W * len(fr), H), (0, 0, 0, 0))
for i, f in enumerate(fr): sh.alpha_composite(f, (i * W, 0))
sh.save(out); print('sheet', out, len(fr), 'frames', W, 'x', H)
