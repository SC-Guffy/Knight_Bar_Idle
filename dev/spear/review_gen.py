# 검토 페이지 6절 그림: 생성 시트 결과 (전후 GIF·몽타주·라인업·마네킹 원본) → dev/review/sheets-spear/gen/
#   python -I -B review_gen.py   (gen.py dress · build.py --src gen 뒤, shots/ 에 지금 그림 캡처가 있어야 한다)
import os, sys, glob, shutil
from PIL import Image, ImageOps, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from build import CELL, build
OUT = os.path.join(HERE, '..', 'review', 'sheets-spear', 'gen'); os.makedirs(os.path.join(OUT, 'gif'), exist_ok=True)
ORDER = ['lancer', 'dragoon', 'cavalier', 'halberdier', 'dragonlord', 'skyGeneral', 'warlord']
BG = (0x14, 0x16, 0x1d, 255)


def old(cls, anim, i):
    """지금 게임 그림 (capture.js spearCap, 160칸 발 (80,140)) → 같은 칸·발"""
    S, (fx, fy) = CELL[cls]
    im = Image.open(os.path.join(HERE, 'shots', f'{cls}-{anim}-{i}.png')).convert('RGBA').crop((80 - fx, 140 - fy, 80 - fx + S, 140 - fy + S))
    px = im.load()
    for y in range(S):
        for x in range(S):
            c = px[x, y]; px[x, y] = c[:3] + (255,) if c[3] >= 160 else (0, 0, 0, 0)
    return im


def pair_gif(cls, anim, A, n_old=8, fps=10, Z=3):
    S, _ = CELL[cls]; new = A[anim]['frames']; olds = [old(cls, anim, i) for i in range(n_old) if os.path.exists(os.path.join(HERE, 'shots', f'{cls}-{anim}-{i}.png'))]
    N = max(len(new), len(olds)); fr = []
    for k in range(N):
        b = Image.new('RGBA', (S * 2 + 4, S), BG)
        b.alpha_composite(olds[k * len(olds) // N], (0, 0)); b.alpha_composite(new[k * len(new) // N], (S + 4, 0))
        d = ImageDraw.Draw(b); d.text((3, 2), 'before', fill=(150, 150, 170)); d.text((S + 7, 2), 'after', fill=(255, 220, 90))
        fr.append(b.convert('RGB').resize((b.width * Z, b.height * Z), Image.NEAREST))
    fr[0].save(os.path.join(OUT, 'gif', f'{cls}-{anim}-ba.gif'), save_all=True, append_images=fr[1:], duration=round(1000 / fps), loop=0)


def tile(im, cls, mode):
    S, (fx, fy) = CELL[cls]
    if mode == 'gray':
        a = im.split()[3]; im = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); im.putalpha(a)
    elif mode == 'sil':
        a = im.split()[3]; im = Image.new('RGBA', im.size, (230, 232, 240, 255)); im.putalpha(a)
    b = Image.new('RGBA', (128, 100), (32, 34, 44, 255)); b.paste(im, (40 - fx, 92 - fy), im); return b


def row(tiles, name, Z=3):
    r = Image.new('RGBA', (len(tiles) * 130, 100), (20, 22, 29, 255))
    for i, t in enumerate(tiles): r.alpha_composite(t, (i * 130, 0))
    r.resize((r.width * Z, r.height * Z), Image.NEAREST).save(os.path.join(OUT, name))


if __name__ == '__main__':
    As = {c: build(c, 'gen') for c in ORDER}
    for c in ORDER:
        for a in ('idle', 'walk', 'atkA', 'atkB'): pair_gif(c, a, As[c])
        shutil.copy(os.path.join(HERE, 'out', f'{c}-frames.png'), os.path.join(OUT, f'{c}-frames.png'))
        for a in ('cast', 'hurt', 'death', 'guard'):
            g = os.path.join(HERE, 'out', 'gif', f'{c}-{a}.gif')
            if os.path.exists(g): shutil.copy(g, os.path.join(OUT, 'gif', f'{c}-{a}.gif'))
    for pose, fi in (('guard', 0), ('atkA', 5)):
        for mode in ('color', 'gray', 'sil'):
            row([tile(old(c, pose, fi if pose == 'atkA' else 0), c, mode) for c in ORDER], f'before-{pose}-{mode}.png')
            row([tile(As[c][pose]['frames'][fi], c, mode) for c in ORDER], f'after-{pose}-{mode}.png')
    for n in ('idle', 'walk', 'spearA', 'spearB', 'halbA', 'halbB'):
        shutil.copy(os.path.join(HERE, 'out', f'g-{n}.png'), os.path.join(OUT, f'mq-{n}.png'))
    print('ok', OUT)
