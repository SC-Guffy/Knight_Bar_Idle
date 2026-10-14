# 고른 키 그림·애니 프레임 → 게임 시트 src/vfx/<id>.png (가로로 프레임 이어 붙임)
#  python -I dev/vfx2/finish.py <id> [--crop] [--pad N] [--flip] [--min N] [--keep a,b] f0.png f1.png ...
#   프레임마다: 반투명(알파<128) 지우기 → 테두리 배경판 지우기 → 작은 덩어리(<min) 지우기 (dev/pixellab/sheet.py 와 같은 규칙)
#   --crop: 모든 프레임을 합친 테두리 상자로 자른다 (궤적 줄처럼 끝 위치가 중요한 시트). --pad: 자른 뒤 둘레 여백
#   --keep x0,y0,x1,y1: 이 상자 밖 픽셀은 지운다 (가는 시트를 큰 캔버스에서 뽑았을 때)
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]; sid = args.pop(0)
def opt(name, default=None, cast=str):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return cast(v)
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
crop, flip = flag('--crop'), flag('--flip')
pad, mn, keep = opt('--pad', 1, int), opt('--min', 3, int), opt('--keep')

def clean(im):
    W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
    if keep:
        x0, y0, x1, y1 = map(int, keep.split(','))
        for y in range(H):
            for x in range(W):
                if not (x0 <= x < x1 and y0 <= y < y1): px[x, y] = (0, 0, 0, 0)
    edge = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    bgc = {px[p][:3] for p in edge if px[p][3] >= 128 and max(px[p][:3]) - min(px[p][:3]) < 12 and 70 < sum(px[p][:3]) / 3 < 200}
    near = lambda c: any(abs(c[0] - b[0]) + abs(c[1] - b[1]) + abs(c[2] - b[2]) <= 18 for b in bgc)
    st = [p for p in edge if px[p][3] and near(px[p])]; seen = set(st)
    while st:
        x, y = st.pop(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] and near(px[n]): seen.add(n); st.append(n)
    seen = set()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    a, b = st.pop(); c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3]: seen.add(n); st.append(n)
                if len(c) < mn:
                    for p in c: px[p] = (0, 0, 0, 0)
    return im

fr = [clean(Image.open(f).convert('RGBA')) for f in args]
if flip: fr = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in fr]
if crop:
    bb = [f.getbbox() for f in fr if f.getbbox()]
    x0, y0, x1, y1 = min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb)
    fr = [f.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)) for f in fr]
W, H = fr[0].size
sh = Image.new('RGBA', (W * len(fr), H), (0, 0, 0, 0))
for i, f in enumerate(fr): sh.alpha_composite(f, (i * W, 0))
out = os.path.join(HERE, '..', '..', 'src', 'vfx', sid + '.png')
sh.save(out); print(sid, len(fr), 'frames', W, 'x', H)
