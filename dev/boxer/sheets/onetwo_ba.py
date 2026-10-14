# 원투 전후 비교 (개발용): 원투 시전 자세(src/jobs/fighter-fx.js oneTwo pose)를 시트 + 기울기·전진으로 흉내 내 GIF·프레임 나열
#  전 = 3ec0d18 시트(dev/boxer/review/before/) + 예전 자세(전진 2·기울기 0.10), 후 = 지금 시트 + 새 자세(전진 6·기울기 0.18)
#   python -I dev/boxer/sheets/onetwo_ba.py
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import px
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'review')
BG = (20, 22, 29, 255); DUR = 0.6; H1, H2 = 0.3 * DUR, 0.6 * DUR


def seg(t, a, b): return max(0.0, min(1.0, (t - a) / (b - a)))


def pose(t, new):
    if t < (H1 + H2) / 2: return 'atkA', seg(t, H1 - 0.1, H1 + 0.12), 2 * seg(t, 0, H1), 0
    k = seg(t, H1, H2)
    return 'atkB', seg(t, H2 - 0.1, H2 + 0.14), 2 + (6 if new else 2) * k, (0.18 if new else 0.1) * k


def draw(sh, m, t, new):
    a, u, dx, sk = pose(t, new); A = m['anims'][a]
    f = max(0, min(A['frames'] - 1, int(u * A['frames'])))
    im = sh.crop((f * 64, A['row'] * 64, f * 64 + 64, A['row'] * 64 + 64))
    o = Image.new('RGBA', (96, 64), BG)
    for y in range(64):                                    # 발(58) 기준으로 위쪽 줄일수록 앞으로 (drawHeroSheet skew)
        o.alpha_composite(im.crop((0, y, 64, y + 1)), (8 + round(dx + sk * (58 - y)), y))
    return o, f'{a}{f}'


def run(c):
    rows = []
    for new in (False, True):
        sh = Image.open(os.path.join(OUT, 'before', c + '.png') if not new else px.SP(c, 'png')).convert('RGBA'); m = px.meta(c)
        rows.append([draw(sh, m, i / 20, new) for i in range(int(DUR * 20) + 1)])
    S = 3; n = len(rows[0])
    ims = []
    for i in range(n):
        b = Image.new('RGBA', (96 * 2 * S + 8, 64 * S + 14), BG); d = ImageDraw.Draw(b)
        for j in (0, 1):
            b.alpha_composite(rows[j][i][0].resize((96 * S, 64 * S), Image.NEAREST), (j * (96 * S + 8), 14))
            d.text((j * (96 * S + 8) + 4, 1), ('before' if j == 0 else 'after') + '  ' + rows[j][i][1], fill=(255, 220, 120))
        ims.append(b.convert('P', palette=Image.ADAPTIVE))
    ims[0].save(os.path.join(OUT, f'onetwo-ba-{c}.gif'), save_all=True, append_images=ims[1:], duration=[90] * (n - 1) + [500], loop=0)
    # 프레임 나열: 위 = 전, 아래 = 후
    S = 2; o = Image.new('RGBA', (96 * S * n, (64 * S + 12) * 2), BG); d = ImageDraw.Draw(o)
    for j in (0, 1):
        for i, (im, lab) in enumerate(rows[j]):
            o.alpha_composite(im.resize((96 * S, 64 * S), Image.NEAREST), (i * 96 * S, j * (64 * S + 12) + 12)); d.text((i * 96 * S + 3, j * (64 * S + 12)), ('B ' if j == 0 else 'A ') + lab, fill=(255, 220, 120))
    o.convert('RGB').save(os.path.join(OUT, f'onetwo-ba-{c}.png'))
    return o


if __name__ == '__main__':
    al = [run(c) for c in ('fighter', 'striker', 'champion')]
    W = max(a.width for a in al); o = Image.new('RGB', (W, sum(a.height + 6 for a in al)), BG[:3]); y = 0
    for a in al: o.paste(a.convert('RGB'), (0, y)); y += a.height + 6
    o.save(os.path.join(OUT, 'onetwo-ba-all.png')); print('ok')
