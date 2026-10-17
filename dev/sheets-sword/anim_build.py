# 2단계 키 자세 엮기 (cast2b = '고개 들기' 문구 빼고 다시 편집 — cast2 는 투구가 꺾임) (PixelLab 0): work/<cls>/<key>-0.png (pixen 편집) → 발 줄 59 맞춤 → 확정 그림 팔레트 고정 → 6프레임 띠·GIF
#  python -I -B anim_build.py → anim/<cls>-<act>-strip.png, anim/<cls>-<act>-x4.gif, anim/_build.png (전체 몽타주 3배)
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim')
JOBS = {
    ('paladin', 'cast'): (['src', 'cast1F', 'cast2b', 'cast2b', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
    ('swordsman', 'atk'): (['src', 'key1', 'key2', 'key3', 'key3', 'src'], [120, 110, 70, 70, 160, 140]),
    ('swordsman', 'cast'): (['src', 'cast1', 'cast2b', 'cast2b', 'cast3', 'src'], [120, 140, 120, 200, 140, 140]),
}


def load(cls, k):
    if k.endswith('F'):                     # pixen 이 왼쪽을 보게 그린 프레임(성기사 cast1) → 좌우 반전
        return load(cls, k[:-1]).transpose(Image.FLIP_LEFT_RIGHT)
    p = os.path.join(A, f'{cls}64-src.png') if k == 'src' else os.path.join(HERE, 'work', cls, f'{k}-0.png')
    im = Image.open(p).convert('RGBA'); P = im.load(); yb = max(y for y in range(64) if any(P[x, y][3] for x in range(64)))
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, 59 - yb)); return o


def lock(im, pal):
    P = im.load()
    for y in range(64):
        for x in range(64):
            c = P[x, y]
            if c[3]: P[x, y] = min(pal, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
    return im


if __name__ == '__main__':
    rows = []
    for (cls, act), (seq, dur) in JOBS.items():
        src = load(cls, 'src'); pal = sorted({c for c in src.getdata() if c[3]})
        if len(pal) > 24:                   # 검사 확정 그림은 43색 → 22색으로 줄인 팔레트로 고정 (qa colors 경보)
            q = src.convert('RGB').quantize(colors=22, method=Image.Quantize.MEDIANCUT).convert('RGB')
            pal = sorted({q.getpixel((x, y)) + (255,) for y in range(64) for x in range(64) if src.getpixel((x, y))[3]})
        fr = [lock(load(cls, k), pal) for k in seq]
        strip = Image.new('RGBA', (64 * len(fr), 64)); [strip.alpha_composite(f, (64 * i, 0)) for i, f in enumerate(fr)]
        strip.save(os.path.join(A, f'{cls}-{act}-strip.png')); rows.append(strip)
        g = []
        for f in fr:
            b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        g[0].save(os.path.join(A, f'{cls}-{act}-x4.gif'), save_all=True, append_images=g[1:], duration=dur, loop=0)
    m = Image.new('RGBA', (64 * 6, 64 * len(rows)), (38, 40, 50, 255))
    for i, r in enumerate(rows): m.alpha_composite(r, (0, 64 * i))
    m.resize((m.width * 3, m.height * 3), Image.NEAREST).save(os.path.join(A, '_build.png')); print('ok', len(rows))
