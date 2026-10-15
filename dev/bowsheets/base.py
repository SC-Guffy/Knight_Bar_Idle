# 기준 그림: 지금 게임의 대기 자세를 8배로 찍은 것(dev/shots/base-<cls>-stand.png, 브라우저 bigShot) → 1배 도트 칸(96/128)
#   python -I dev/bowsheets/base.py  → dev/bowsheets/ref/<cls>.png
# 칸마다 가운데 픽셀을 쓴다. 격자 어긋남(0~7)은 칸 안 색이 가장 고르게 되는 쪽을 고른다.
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster']
K = 8


def down(im):
    W, H = im.width // K, im.height // K; px = im.load()
    best = None
    for o in range(K):
        bad = 0
        for y in range(0, H - 1, 2):
            for x in range(0, W - 1, 2):
                a = px[x * K + o, y * K + o]; b = px[x * K + (o + K - 2) % K, y * K + (o + K - 2) % K]
                bad += a != b
        if best is None or bad < best[0]: best = (bad, o)
    o = best[1]; c = (o + K // 2) % K
    out = Image.new('RGBA', (W, H)); q = out.load()
    for y in range(H):
        for x in range(W):
            X, Y = x * K + c, y * K + c
            if X < im.width and Y < im.height:
                p = px[X, Y]; q[x, y] = p[:3] + (255,) if p[3] >= 128 else (0, 0, 0, 0)
    return out, o


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'ref'), exist_ok=True)
    for cls in IDS:
        for m in ('stand', 'fight'):
            im = Image.open(os.path.join(ROOT, 'dev', 'shots', f'base-{cls}-{m}.png')).convert('RGBA')
            out, o = down(im)
            out.save(os.path.join(HERE, 'ref', f'{cls}{"" if m == "stand" else "-fight"}.png'))
            print(cls, m, out.size, 'offset', o, 'colors', len({c for c in out.getdata() if c[3]}))
