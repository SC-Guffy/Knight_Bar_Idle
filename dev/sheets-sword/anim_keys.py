# 관절 애니 B (로드맵 승인: pixen 키 자세 최대 4): 확정 그림(칼 든 성기사)을 edit-image-pixen 으로 젖힘·머리 위·타격·마무리 4자세로 편집
#  → 발 줄(59) 맞춤 → 평타 6프레임 [준비, 젖힘, 머리 위, 타격, 타격 유지, 마무리] (skeleton-v3 는 2번 다 미달: 몸이 안 움직이거나 칼 궤적·방패가 무너짐)
#  python -I -B anim_keys.py → anim/paladin-atkB-strip.png (64×6), anim/paladin-atkB-x4.gif
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim'); W = os.path.join(HERE, 'work', 'paladin')
SEQ = ['src', 'key1', 'key2', 'key3', 'key3', 'key4']
DUR = [120, 90, 90, 70, 160, 140]                 # ms: 젖힘·들기는 빠르게, 타격에서 멈칫


def load(k):
    im = Image.open(os.path.join(A, 'paladin64-src.png') if k == 'src' else os.path.join(W, f'{k}-0.png')).convert('RGBA')
    P = im.load(); yb = max(y for y in range(64) if any(P[x, y][3] for x in range(64)))
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, 59 - yb)); return o


def lock(im, pal):
    """확정 그림 팔레트로 고정 (pixen 이 프레임마다 색을 조금씩 바꿔 30색 넘음)"""
    P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if c[3]: P[x, y] = min(pal, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
    return im


if __name__ == '__main__':
    src = load('src'); pal = sorted({c for c in src.get_flattened_data() if c[3]}) if hasattr(src, 'get_flattened_data') else sorted({c for c in src.getdata() if c[3]})
    fr = [lock(load(k), pal) for k in SEQ]
    strip = Image.new('RGBA', (64 * len(fr), 64))
    for i, f in enumerate(fr): strip.alpha_composite(f, (64 * i, 0))
    strip.save(os.path.join(A, 'paladin-atkB-strip.png'))
    g = []
    for f in fr:
        b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
    g[0].save(os.path.join(A, 'paladin-atkB-x4.gif'), save_all=True, append_images=g[1:], duration=DUR, loop=0)
    print('frames', len(fr))
