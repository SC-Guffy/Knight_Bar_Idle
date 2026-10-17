# 검사 계열 2차 4종 기준 그림 나란히 (컬러·흑백·실루엣) — 색깔놀이 금지 확인용, 로드맵·사용자 검토
#  python -I -B lineup.py → dev/review/sheets-sword/design/lineup-{color,gray,sil}-x4.png, lineup-x1.png, lineup-all-x4.png
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PL = os.path.join(HERE, 'design', 'pl2'); RV = os.path.join(ROOT, 'dev', 'review', 'sheets-sword', 'design')
LINE = [('검사', 'swordsman', 'clean-swordsman.png'), ('성기사', 'paladin', 'fix-paladin.png'),
        ('검성', 'blademaster', 'fix-blademaster-n14.png'), ('대검전사', 'greatswordsman', 'final-greatswordsman-n15.png')]
BG = (38, 40, 50, 255)


def gray(im):
    g = im.convert('LA').convert('RGBA'); g.putalpha(im.split()[3]); return g


def sil(im):
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); a = im.split()[3]
    o.paste((235, 235, 240, 255), mask=a); return o


def row(ims, S, gap=10):
    H = max(i.height for i in ims); W = sum(i.width + gap for i in ims) + gap
    o = Image.new('RGBA', (W * S, (H + 4) * S), BG); x = gap
    for i in ims:
        o.alpha_composite(i.resize((i.width * S, i.height * S), Image.NEAREST), (x * S, (H + 2 - i.height) * S)); x += i.width + gap
    return o


if __name__ == '__main__':
    os.makedirs(RV, exist_ok=True)
    ims = [Image.open(os.path.join(PL, f)).convert('RGBA') for _, _, f in LINE]
    for i, (_, c, _) in enumerate(LINE): ims[i].save(os.path.join(RV, f'final-{c}.png'))
    rows = {'color': ims, 'gray': [gray(i) for i in ims], 'sil': [sil(i) for i in ims]}
    for k, r in rows.items(): row(r, 4).save(os.path.join(RV, f'lineup-{k}-x4.png'))
    row(ims, 1).save(os.path.join(RV, 'lineup-x1.png'))
    parts = [row(r, 4) for r in rows.values()]
    all_ = Image.new('RGBA', (parts[0].width, sum(p.height for p in parts)), BG); y = 0
    for p in parts: all_.alpha_composite(p, (0, y)); y += p.height
    all_.save(os.path.join(RV, 'lineup-all-x4.png'))
    print('sizes', [i.size for i in ims])
