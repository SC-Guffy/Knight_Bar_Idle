# 애니 프레임들 → 가로 시트 한 장. 프레임마다: 반투명(알파<128) 지우기, 가장자리에 닿은 배경판(구석 색과 비슷한 불투명 픽셀) 지우기, 작은 덩어리 지우기
#  python -I sheet.py out.png [--min 3] [--flip] f0.png f1.png ...
import sys
from PIL import Image
args = sys.argv[1:]; out = args.pop(0); mn = 3; flip = False
if '--min' in args: i = args.index('--min'); mn = int(args[i + 1]); del args[i:i + 2]
if '--flip' in args: args.remove('--flip'); flip = True

def clean(im):
    W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
    # 배경판: 테두리 픽셀 중 불투명한 것의 색을 모아, 그 색과 가까운(±10) 픽셀을 테두리에서부터 퍼져 나가며 지운다
    edge = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    bgc = {px[p][:3] for p in edge if px[p][3] >= 128 and max(px[p][:3]) - min(px[p][:3]) < 12 and 70 < sum(px[p][:3]) / 3 < 200}
    near = lambda c: any(abs(c[0] - b[0]) + abs(c[1] - b[1]) + abs(c[2] - b[2]) <= 18 for b in bgc)
    st = [p for p in edge if px[p][3] and near(px[p])]; seen = set(st)
    while st:
        x, y = st.pop(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] and near(px[n]): seen.add(n); st.append(n)
    # 작은 덩어리
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
W, H = fr[0].size
sh = Image.new('RGBA', (W * len(fr), H), (0, 0, 0, 0))
for i, f in enumerate(fr): sh.alpha_composite(f, (i * W, 0))
sh.save(out); print('sheet', out, len(fr), 'frames', W, 'x', H)
