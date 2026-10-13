# 라인업 그림: 기존 직업(게임에서 추출한 도트)과 파이터 계열 기준 그림을 같은 축척으로 나란히, 컬러와 흑백(실루엣 확인용)으로 찍는다.
#   python -I dev/boxer/lineup.py  →  dev/boxer/lineup-*.png
import os
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
S = 4  # 확대 배율 (nearest)

def at64(path, foot_from_bbox=True):
    im = Image.open(path).convert('RGBA')
    if os.path.basename(path).startswith('base-'): return im
    b = im.getbbox(); c = im.crop(b)
    out = Image.new('RGBA', (64, 64)); out.paste(c, (32 - (c.width // 2), 59 - c.height), c)
    return out

def strip(paths, name, bg=(40, 40, 48, 255)):
    ims = [at64(os.path.join(HERE, p)) for p in paths]
    o = Image.new('RGBA', (66 * len(ims), 64), bg)
    for k, a in enumerate(ims): o.alpha_composite(a, (66 * k, 0))
    o = o.resize((o.width * S, o.height * S), Image.NEAREST)
    o.save(os.path.join(HERE, f'lineup-{name}.png'))
    g = ImageOps.grayscale(o.convert('RGB')).convert('RGBA')
    g.save(os.path.join(HERE, f'lineup-{name}-gray.png'))
    # 실루엣: 칠한 칸은 모두 검게 (색·명암 없이 모양만)
    sil = Image.new('RGBA', o.size, (230, 230, 236, 255))
    mask = Image.new('L', o.size, 0)
    for k, a in enumerate(ims):
        m = a.split()[3].point(lambda v: 255 if v > 0 else 0).resize((64 * S, 64 * S), Image.NEAREST)
        mask.paste(m, (66 * k * S, 0))
    sil.paste((20, 20, 26, 255), (0, 0), mask)
    sil.save(os.path.join(HERE, f'lineup-{name}-sil.png'))

if __name__ == '__main__':
    strip(['base-striker.png', 'base-kickboxer.png', 'base-qigong.png'], 'family')
    strip(['raw/hero-squire.png', 'raw/hero-swordsman.png', 'raw/hero-lancer.png', 'raw/hero-ranger.png', 'raw/hero-mage.png', 'base-fighter.png'], 'tier1')
    strip(['raw/hero-paladin.png', 'raw/hero-blademaster.png', 'raw/hero-greatswordsman.png', 'base-striker.png', 'base-kickboxer.png', 'base-qigong.png'], 'tier2')
    print('ok')
