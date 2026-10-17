# 12단계 라인업: 새 검사 계열 8종(new/pick-<cls>.png) + 파이터 계열 · 0.78 로 줄인 다른 계열 대기 그림을 게임 배율(시트 1칸 = 같은 크기)로 나란히.
#  컬러 줄 + 실루엣 줄(색깔놀이 확인). python -I -B new_lineup.py → new/_lineup.png
import os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); SP = os.path.join(ROOT, 'src', 'sprites')
SWORD = ['squire', 'swordsman', 'paladin', 'blademaster', 'greatswordsman', 'archon', 'tyrant', 'swordsaint']
OTHERS = ['fighter', 'kickboxer', 'qigong', 'mage', 'ranger', 'lancer']
BG = (38, 40, 50, 255); Z = 4


def idle(cls):
    m = json.load(open(os.path.join(SP, f'{cls}.json'))); W, H = m['w'], m['h']
    return Image.open(os.path.join(SP, f'{cls}.png')).convert('RGBA').crop((0, 0, W, H))


def trim(im):
    return im.crop(im.getbbox())


def sil(im):
    o = Image.new('RGBA', im.size); a = im.split()[3]; o.paste((230, 230, 235, 255), mask=a); return o


def row(ims, labels):
    H = max(i.height for i in ims) + 2; W = sum(i.width + 6 for i in ims) + 6
    o = Image.new('RGBA', (W, H), BG); x = 6
    for i in ims: o.alpha_composite(i, (x, H - 1 - i.height)); x += i.width + 6
    return o


if __name__ == '__main__':
    new = [trim(Image.open(os.path.join(HERE, 'new', f'pick-{c}.png')).convert('RGBA')) for c in SWORD if os.path.exists(os.path.join(HERE, 'new', f'pick-{c}.png'))]
    oth = [trim(idle(c)) for c in OTHERS if os.path.exists(os.path.join(SP, f'{c}.json'))]
    r1 = row(new, SWORD); r2 = row([sil(i) for i in new], SWORD); r3 = row(oth, OTHERS)
    W = max(r.width for r in (r1, r2, r3)); H = r1.height + r2.height + r3.height + 8
    o = Image.new('RGBA', (W, H), BG); o.alpha_composite(r1); o.alpha_composite(r2, (0, r1.height + 4)); o.alpha_composite(r3, (0, r1.height + r2.height + 8))
    o.resize((W * Z, H * Z), Image.NEAREST).save(os.path.join(HERE, 'new', '_lineup.png'))
    print('lineup', [i.height for i in new], 'others', [i.height for i in oth])
