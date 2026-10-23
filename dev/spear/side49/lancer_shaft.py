# 창기사 평타A 2~4번(10-18 찌르기 키)의 창 자루가 회색 막대라 0·1·5번(갈색 나무 자루)과 번갈아 바뀌어 보임 (검수 10-23)
#  → 그 장들의 창 줄(칸 오른쪽 끝까지 뻗은 줄)에서 회색(채도 낮은) 자루 칸을 0번 장 자루의 갈색 단계로 밝기 순서대로 다시 칠한다. 창끝 4칸은 쇠라 그대로.
#   python3 dev/spear/side49/lancer_shaft.py [--install]
import os, sys, json, colorsys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import walk
cls = 'lancer'; m = walk.meta(cls); S = m['w']
f0 = walk.frame(cls, 'atkA', 0); P0 = f0.load()
L = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
sat = lambda c: colorsys.rgb_to_hsv(*(v / 255 for v in c[:3]))[1]
brown = sorted({P0[x, y][:3] for y in (77, 78) for x in range(30, 44) if P0[x, y][3] and sat(P0[x, y]) > 0.3}, key=L)
out = {}
for i in (2, 3, 4):
    f = walk.frame(cls, 'atkA', i); P = f.load()
    rows = [y for y in range(S) if any(P[x, y][3] for x in range(47, S))]
    xmax = max(x for y in rows for x in range(S) if P[x, y][3])
    grey = [(x, y) for y in rows for x in list(range(33, xmax - 3)) + list(range(0, 15)) if P[x, y][3] and sat(P[x, y]) < 0.18 and L(P[x, y]) > 25]
    if grey:
        lo, hi = min(L(P[q]) for q in grey), max(L(P[q]) for q in grey)
        for q in grey: P[q] = brown[min(len(brown) - 1, int((L(P[q]) - lo) / max(1, hi - lo + 1) * len(brown)))] + (255,)
    out[i] = f; print('frame', i, 'recolored', len(grey))
D = walk.D(cls); M = Image.new('RGBA', (S * 3 * 4, S * 3), (30, 32, 44, 255))
for k, f in enumerate([f0] + [out[i] for i in (2, 3, 4)]): M.alpha_composite(f.resize((S * 3, S * 3), Image.NEAREST), (k * S * 3, 0))
M.crop((0, 50 * 3, M.width, S * 3)).save(os.path.join(D, 'shaft-strip.png'))
if '--install' in sys.argv:
    p = os.path.join(walk.ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA'); r = m['anims']['atkA']['row'] * S
    for i, f in out.items(): sheet.paste(Image.new('RGBA', (S, S)), (i * S, r)); sheet.alpha_composite(f, (i * S, r))
    sheet.save(p); print('installed')
