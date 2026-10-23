# 석궁사수 하늘 쏘기(castUp) 2장 — 무료 시험 (마지막 49회 계획 5번): 옆으로 겨눈 평타 프레임에서 허리 위만 뒤로 젖혀 돌린다.
#  4배로 키워 돌린 뒤 4×4 최빈색으로 줄여 계단을 줄이고, 외곽선을 다시 두른다. 다리는 그대로.
#   python3 dev/spear/side49/skyup.py [--install]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
from walk import outline, meta, frame, palette_lock, crumbs
cls = 'arbalest'; WAIST, PIV = 71, (41, 64)      # 허리선(이 줄 위를 돌림) · 축 = 어깨 아래 가슴


def rot_up(f, deg, dx=0):
    S = f.width; K = 4
    up = Image.new('RGBA', f.size); up.paste(f.crop((0, 0, S, WAIST)), (0, 0))
    lo = Image.new('RGBA', f.size); lo.paste(f.crop((0, WAIST, S, S)), (0, WAIST))
    big = up.resize((S * K, S * K), Image.NEAREST).rotate(deg, resample=Image.NEAREST, center=(PIV[0] * K, PIV[1] * K))
    P = big.load(); r = Image.new('RGBA', f.size); R = r.load()
    for y in range(S):
        for x in range(S):
            cs = [P[x * K + a, y * K + b] for a in range(K) for b in range(K) if P[x * K + a, y * K + b][3] >= 128]
            if len(cs) >= 7: R[x, y] = max(set(cs), key=cs.count)[:3] + (255,)
    o = Image.new('RGBA', f.size); o.alpha_composite(lo); o.alpha_composite(r, (dx, 0))
    o = smooth(palette_lock(o, f))                     # 검수 fix(10-23): 원래 팔레트로 · 외곽 1칸 돌출·패임 다듬기
    return palette_lock(outline(crumbs(o, 3)), f)      # 다시 두른 외곽선도 원래 외곽선 색으로 (24색)


def smooth(im):
    """바깥 둘레의 1칸 돌출(칠한 이웃 1개 이하)은 지우고, 1칸 패임(칠한 이웃 3개 이상인 빈칸)은 이웃 최빈색으로 메운다"""
    P = im.load(); W, H = im.size
    nb = lambda x, y: [P[x + a, y + b] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3]]
    cut = [(x, y) for y in range(H) for x in range(W) if P[x, y][3] and len(nb(x, y)) <= 1]
    for q in cut: P[q] = (0, 0, 0, 0)
    fill = [(x, y, nb(x, y)) for y in range(H) for x in range(W) if not P[x, y][3] and len(nb(x, y)) >= 3]
    for x, y, n in fill: P[x, y] = max(set(n), key=n.count)
    return im


src = frame(cls, 'atkA', 3)
out = [rot_up(src, 26), rot_up(src, 36, -3)]     # 검수 fix: 두 장 모두 같은 원본(평타 3번)에서 — 석궁 모양이 같게, 반동은 10° 더 젖히고 뒤로 3칸
D = os.path.join(HERE, cls); os.makedirs(D, exist_ok=True)
for i, f in enumerate(out): f.save(os.path.join(D, f'castUp-{i}.png'))
if '--install' in sys.argv:
    m = meta(cls); S = m['w']; foot = m['foot']
    sp = os.path.join(ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(sp).convert('RGBA')
    keep = os.path.join(D, 'orig.png')
    if not os.path.exists(keep): sheet.save(keep); json.dump(m, open(os.path.join(D, 'orig.json'), 'w'))
    r = m['anims']['castUp']['row']
    for i, f in enumerate(out):
        sheet.paste(Image.new('RGBA', (S, S)), (i * S, r * S)); sheet.alpha_composite(f, (i * S, r * S))
    sheet.save(sp)
    from walk import pts_of
    m['pts']['castUp'] = [pts_of(f, tuple(foot)) for f in out]
    js = os.path.join(ROOT, 'src', 'sprites', f'{cls}.json'); order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(js, 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(foot)},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print('installed castUp')
print('ok')
