# 창기사 계열 새 디자인 합격본 나란히 (컬러·흑백·실루엣) + 실루엣 IoU(발 맞춤) → dev/review/sheets-spear/v5/
#   python -I -B lineup5.py lancer=lancer6-51 dragoon=dragoon8-11 halberdier=halberdier5-51 cavalier=cavalier5-11
import os, sys, itertools
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'review', 'sheets-spear', 'v5')
S, GAP, BG = 4, 12, (32, 34, 44, 255)


def gray(im):
    g = im.convert('LA').convert('RGBA'); g.putalpha(im.split()[3]); return g


def sil(im):
    o = Image.new('RGBA', im.size); o.paste((230, 232, 240, 255), mask=im.split()[3]); return o


def mask(im, W, H):
    """발(아래)·가운데 맞춤 칸 집합"""
    a = im.split()[3]; ox = (W - im.width) // 2; oy = H - im.height
    return {(x + ox, y + oy) for y in range(im.height) for x in range(im.width) if a.getpixel((x, y))}


if __name__ == '__main__':
    pick = [a.split('=') for a in sys.argv[1:]]
    ims = [(c, Image.open(os.path.join(HERE, 'work', 'pl', f'{n}-polish.png')).convert('RGBA')) for c, n in pick]
    for c, im in ims: im.save(os.path.join(OUT, f'pass-{c}.png'))
    W = sum(im.width for _, im in ims) + GAP * (len(ims) + 1); H = max(im.height for _, im in ims) + 2 * GAP
    for mode, f in (('color', lambda i: i), ('gray', gray), ('sil', sil)):
        o = Image.new('RGBA', (W, H), BG); x = GAP
        for _, im in ims: o.alpha_composite(f(im), (x, H - GAP - im.height)); x += im.width + GAP
        o.resize((W * S, H * S), Image.NEAREST).save(os.path.join(OUT, f'lineup-{mode}.png'))
    MW = max(im.width for _, im in ims); MH = max(im.height for _, im in ims)
    ms = {c: mask(im, MW, MH) for c, im in ims}
    for a, b in itertools.combinations(ms, 2):
        print(f'IoU {a}-{b} {len(ms[a] & ms[b]) / len(ms[a] | ms[b]):.2f}')
