# 검토 페이지 그림 (dev/review/sheets-mage/): 기준 그림 줄 세우기(컬러·흑백·실루엣, 대기·전투 대기), 직업별 1배 원본, 시험 시트 미리보기
import os, shutil
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
O = os.path.join(HERE, '..', 'review', 'sheets-mage'); os.makedirs(O, exist_ok=True)
IDS = ['mage', 'pyromancer', 'cryomancer', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor']
FX, FY = 44, 88


def gray(im):
    g = im.convert('LA').convert('RGBA'); g.putalpha(im.getchannel('A')); return g


def sil(im):
    o = Image.new('RGBA', im.size); px, q = im.load(), o.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3]: q[x, y] = (230, 230, 236, 255)
    return o


for mode, tag in (('stand', 'ref'), ('fight', 'ref-fight')):
    for name, f in (('color', lambda i: i), ('gray', gray), ('sil', sil)):
        S = 3; o = Image.new('RGBA', (96 * len(IDS) * S, 96 * S), (18, 20, 27, 255)); d = ImageDraw.Draw(o)
        for i, c in enumerate(IDS):
            im = f(Image.open(os.path.join(HERE, 'cap', f'cap1-{mode}-{c}.png')).convert('RGBA'))
            o.alpha_composite(im.resize((96 * S, 96 * S), Image.NEAREST), (96 * S * i, 0))
            d.rectangle([96 * S * i, 0, 96 * S * (i + 1) - 1, 96 * S - 1], outline=(60, 64, 80))
            d.line([(96 * S * i + (FX - 8) * S, (FY + 1) * S), (96 * S * i + (FX + 8) * S, (FY + 1) * S)], fill=(255, 90, 90))
        o.save(os.path.join(O, f'{tag}-{name}.png'))
    for c in IDS:
        shutil.copy(os.path.join(HERE, 'cap', f'cap1-{mode}-{c}.png'), os.path.join(O, f'{c}{"" if mode == "stand" else "-fight"}.png'))
p = Image.open(os.path.join(HERE, 'preview', 'pyromancer.png'))
p.crop((0, 0, 90 + 384 * 5, p.height)).save(os.path.join(O, 'stub-pyromancer.png'))
